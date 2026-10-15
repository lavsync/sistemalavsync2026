"use client";

// LavSync · Projetado × Real › Editar
//
// Sessão própria para EDITAR o projetado da franqueadora:
//   · lista das projeções salvas da unidade (qual está ATIVA, abrir, excluir);
//   · grade linhas × meses por ano (Ano 1..5), célula editável em pt-BR — a
//     célula alterada fica marcada e a linha recebe `editado`; linhas que o
//     CLOCK pediu para conferir ficam destacadas até o usuário confirmar;
//   · premissas editáveis + "Recalcular pelas premissas" (fórmulas da
//     franqueadora em recalcularPelasPremissas — função pura, roda no cliente);
//   · mês 1 da projeção, investimento e método do Simples;
//   · Salvar / Descartar. Nada vai ao banco sem o clique em Salvar.
import * as React from "react";
import {
  Save, RotateCcw, Trash2, Plus, Upload, Loader2, Calculator, CheckCircle2, AlertTriangle, FolderOpen, PencilLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { nowBR } from "@/lib/timezone-br";
import {
  listarProjecoes, carregarProjecao, salvarProjecao, excluirProjecao, inauguracaoDaUnidade,
} from "@/lib/financeiro/projecao/actions";
import { recalcularPelasPremissas, resultadoDasLinhas, acumular } from "@/lib/financeiro/projecao/calculo";
import { GRUPOS_CUSTO } from "@/lib/financeiro/projecao/tipos";
import type {
  Projecao, LinhaProjecao, PremissasProjecao, InvestimentoProjecao,
} from "@/lib/financeiro/projecao/tipos";
import type { EdicaoProjecao } from "./projetado-vs-real";
import { clonar } from "./projetado-vs-real";
import { SeletorUnidade, ListaAvisos, MensagemErro, EstadoVazio, mensagemDeErro } from "./ui";
import { CampoNumero } from "./campo-numero";
import {
  MESES_LONGOS, ORDEM_GRUPO, ROTULO_GRUPO, TOTAL_MESES, fmtBRL, fmtNumero, fmtPct,
  linhaEhPercentual, rotuloChave, rotuloMesCalendario,
} from "./formatos";

type ItemLista = {
  id?: string; nome: string; origem: Projecao["origem"]; arquivo_nome?: string | null;
  ativa: boolean; mes1_ano: number; mes1_mes: number; atualizado_em: string;
};

const PREMISSAS_ZERADAS = (): PremissasProjecao => ({
  potencial_faturamento: 0, rampa: Array(TOTAL_MESES).fill(0), csp_pct: 0,
  royalties_pct: 0, royalties_minimo: 0, royalties_minimo_a_partir_mes: 1, fundo_propaganda_fixo: 0,
  aluguel: 0, energia_pct: 0, agua_pct: 0, telefone: 0, contador: 0, software: 0, seguro: 0,
  taxa_cartao_pct: 0, servicos_bancarios: 0, publicidade_local: 0, publicidade_inaugural: 0,
  publicidade_inaugural_meses: 0, materiais: 0, pessoal: 0, metodo_simples: "franqueadora",
});

export function AreaEditar({
  unidades, unidadeId, onUnidade, edicao, onEdicao, onSalvo, onImportar, nomeUnidade,
}: {
  unidades: Array<{ id: string; nome: string }>;
  unidadeId: string;
  onUnidade: (id: string) => void;
  edicao: EdicaoProjecao | null;
  onEdicao: (e: EdicaoProjecao | null) => void;
  onSalvo: () => void;
  onImportar: () => void;
  nomeUnidade: (id: string) => string;
}) {
  // Lista guardada junto com a "chave" da consulta: carregando = chave mudou.
  const [listaDe, setListaDe] = React.useState<{ chave: string; itens: ItemLista[] } | null>(null);
  const [abrindo, setAbrindo] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [versaoLista, setVersaoLista] = React.useState(0);
  const chaveLista = `${unidadeId}:${versaoLista}`;
  const lista = listaDe && listaDe.chave.startsWith(`${unidadeId}:`) ? listaDe.itens : null;
  const carregandoLista = listaDe?.chave !== chaveLista;
  // Abertura automática da ativa: uma vez por unidade.
  const autoAberta = React.useRef<string | null>(null);
  const edicaoRef = React.useRef(edicao);
  React.useEffect(() => { edicaoRef.current = edicao; }, [edicao]);

  const abrir = React.useCallback(async (id: string) => {
    setAbrindo(id);
    setErro(null);
    try {
      const r = await carregarProjecao(id);
      if (!r.ok) { setErro(mensagemDeErro(r, "Não foi possível abrir a projeção.")); return; }
      onEdicao({ projecao: clonar(r.projecao), base: clonar(r.projecao), sujo: false });
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível abrir a projeção."));
    } finally {
      setAbrindo(null);
    }
  }, [onEdicao]);

  React.useEffect(() => {
    let vivo = true;
    listarProjecoes(unidadeId)
      .then((r) => {
        if (!vivo) return;
        if (!r.ok) {
          setErro(mensagemDeErro(r, "Não foi possível listar as projeções."));
          setListaDe({ chave: chaveLista, itens: [] });
          return;
        }
        setListaDe({ chave: chaveLista, itens: r.projecoes });
        // Sem nada aberto: abre a projeção ATIVA da unidade (uma vez por unidade).
        if (!edicaoRef.current && autoAberta.current !== unidadeId) {
          autoAberta.current = unidadeId;
          const ativa = r.projecoes.find((p) => p.ativa && p.id);
          if (ativa?.id) void abrir(ativa.id);
        }
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setErro(mensagemDeErro(e, "Não foi possível listar as projeções."));
        setListaDe({ chave: chaveLista, itens: [] });
      });
    return () => { vivo = false; };
  }, [unidadeId, chaveLista, abrir]);

  async function novaManual() {
    // Mês 1 = inauguração da unidade (como na importação); sem ela, mês atual + aviso
    const hoje = nowBR();
    const inaug = await inauguracaoDaUnidade(unidadeId).catch(() => null);
    const temInaug = !!(inaug && inaug.ok && inaug.ano && inaug.mes);
    const premissas = PREMISSAS_ZERADAS();
    const p: Projecao = {
      unidade_id: unidadeId, nome: "Projeção manual", origem: "manual",
      arquivo_path: null, arquivo_nome: null,
      mes1_ano: temInaug && inaug?.ok ? inaug.ano! : hoje.ano,
      mes1_mes: temInaug && inaug?.ok ? inaug.mes! : hoje.mes,
      premissas, investimento: null,
      linhas: recalcularPelasPremissas(premissas),
      avisos: temInaug ? [] : ["A unidade não tem mês de inauguração configurado: o mês 1 da projeção ficou no mês atual — ajuste antes de salvar."],
      ativa: !(lista ?? []).some((x) => x.ativa),
    };
    onEdicao({ projecao: p, base: clonar(p), sujo: true });
  }

  const trocarUnidade = (id: string) => {
    if (edicao?.sujo && !window.confirm("Há alterações não salvas nesta projeção. Trocar de unidade descarta essas alterações. Continuar?")) return;
    autoAberta.current = null;
    onUnidade(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SeletorUnidade unidades={unidades} valor={unidadeId} onChange={trocarUnidade} />
        <div className="flex gap-2 ml-auto">
          <Button type="button" variant="outline" size="sm" onClick={onImportar}><Upload /> Importar arquivo</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void novaManual()}><Plus /> Criar manualmente</Button>
        </div>
      </div>

      {erro && <MensagemErro texto={erro} onFechar={() => setErro(null)} />}

      <ListaSalvas
        lista={lista}
        carregando={carregandoLista}
        abertaId={edicao?.projecao.id}
        abrindo={abrindo}
        onAbrir={(id) => {
          if (edicao?.sujo && !window.confirm("Há alterações não salvas. Abrir outra projeção descarta essas alterações. Continuar?")) return;
          void abrir(id);
        }}
        onExcluido={(id) => {
          if (edicao?.projecao.id === id) onEdicao(null);
          autoAberta.current = unidadeId; // não reabrir sozinho logo após excluir
          setVersaoLista((v) => v + 1);
          onSalvo();
        }}
        onErro={setErro}
      />

      {edicao ? (
        <Editor
          edicao={edicao}
          onEdicao={onEdicao}
          nomeUnidade={nomeUnidade}
          onSalvo={() => { setVersaoLista((v) => v + 1); onSalvo(); }}
        />
      ) : abrindo ? (
        <div className="card-premium rounded-xl p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Abrindo a projeção…
        </div>
      ) : (
        lista && (
          <EstadoVazio
            icone={PencilLine}
            titulo={lista.length ? "Escolha uma projeção para editar" : "Nenhuma projeção para esta unidade"}
            texto={lista.length
              ? "Abra uma das projeções salvas acima, importe outro arquivo ou crie uma projeção do zero."
              : "Importe o DRE projetado que a franqueadora apresentou ou monte a projeção manualmente pelas premissas."}
            acao={
              <div className="flex gap-2">
                <Button type="button" onClick={onImportar}><Upload /> Importar arquivo</Button>
                <Button type="button" variant="outline" onClick={() => void novaManual()}><Plus /> Criar manualmente</Button>
              </div>
            }
          />
        )
      )}
    </div>
  );
}

// ─── Lista de projeções salvas ─────────────────────────────────────────────

function ListaSalvas({ lista, carregando, abertaId, abrindo, onAbrir, onExcluido, onErro }: {
  lista: ItemLista[] | null;
  carregando: boolean;
  abertaId?: string;
  abrindo: string | null;
  onAbrir: (id: string) => void;
  onExcluido: (id: string) => void;
  onErro: (e: string) => void;
}) {
  const [confirmando, setConfirmando] = React.useState<string | null>(null);
  const [excluindo, setExcluindo] = React.useState<string | null>(null);

  if (!lista || lista.length === 0) {
    return carregando ? (
      <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando projeções salvas…</p>
    ) : null;
  }

  async function excluir(id: string) {
    setExcluindo(id);
    try {
      const r = await excluirProjecao(id);
      if (!r.ok) { onErro(mensagemDeErro(r, "Não foi possível excluir.")); return; }
      onExcluido(id);
    } catch (e) {
      onErro(mensagemDeErro(e, "Não foi possível excluir."));
    } finally {
      setExcluindo(null);
      setConfirmando(null);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">Projeções salvas</h3>
        {carregando && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </header>
      <ul className="divide-y divide-border">
        {lista.map((p) => {
          const id = p.id ?? "";
          const aberta = abertaId != null && abertaId === id;
          return (
            <li key={id || p.nome} className={cn("px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5", aberta && "bg-muted/60")}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium truncate">{p.nome}</span>
                  {p.ativa && (
                    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-success/15 text-success">
                      <CheckCircle2 className="w-3 h-3" /> Ativa
                    </span>
                  )}
                  {aberta && <span className="text-[10px] text-muted-foreground">aberta no editor</span>}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  {p.origem === "importacao" ? `Importada${p.arquivo_nome ? ` de ${p.arquivo_nome}` : ""}` : "Criada manualmente"}
                  {" · "}mês 1 = {MESES_LONGOS[p.mes1_mes - 1]?.toLowerCase()}/{p.mes1_ano}
                  {p.atualizado_em && ` · atualizada em ${new Date(p.atualizado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {confirmando === id ? (
                  <>
                    <span className="text-[11px] text-danger">Excluir de vez?</span>
                    <Button type="button" size="sm" variant="destructive" disabled={excluindo === id} onClick={() => void excluir(id)}>
                      {excluindo === id ? <Loader2 className="animate-spin" /> : <Trash2 />} Excluir
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmando(null)}>Cancelar</Button>
                  </>
                ) : (
                  <>
                    {!aberta && id && (
                      <Button type="button" size="sm" variant="outline" disabled={abrindo === id} onClick={() => onAbrir(id)}>
                        {abrindo === id ? <Loader2 className="animate-spin" /> : <FolderOpen />} Abrir
                      </Button>
                    )}
                    {id && (
                      <Button type="button" size="icon-sm" variant="ghost" aria-label={`Excluir ${p.nome}`} onClick={() => setConfirmando(id)}>
                        <Trash2 />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ─── Editor da projeção aberta ─────────────────────────────────────────────

function Editor({ edicao, onEdicao, nomeUnidade, onSalvo }: {
  edicao: EdicaoProjecao;
  onEdicao: (e: EdicaoProjecao | null) => void;
  nomeUnidade: (id: string) => string;
  onSalvo: () => void;
}) {
  const p = edicao.projecao;
  const [ano, setAno] = React.useState(0); // 0..4
  const [celulas, setCelulas] = React.useState<Set<string>>(() => new Set());
  const [premissasPendentes, setPremissasPendentes] = React.useState(false);
  const [confirmarRecalculo, setConfirmarRecalculo] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [okMsg, setOkMsg] = React.useState<string | null>(null);

  // Outra projeção aberta (ou recém-salva): zera as marcas locais da sessão.
  const [baseVista, setBaseVista] = React.useState(edicao.base);
  if (edicao.base !== baseVista) {
    setBaseVista(edicao.base);
    setCelulas(new Set());
    setPremissasPendentes(false);
    setConfirmarRecalculo(false);
    if (baseVista.id && edicao.base.id !== baseVista.id) setOkMsg(null);
  }

  function alterar(fn: (p: Projecao) => void) {
    const nova = clonar(p);
    fn(nova);
    onEdicao({ ...edicao, projecao: nova, sujo: true });
    setOkMsg(null);
  }

  function editarCelula(chave: string, i: number, v: number) {
    alterar((n) => {
      const l = n.linhas.find((x) => x.chave === chave);
      if (!l) return;
      while (l.valores.length < TOTAL_MESES) l.valores.push(0);
      l.valores[i] = v;
      l.editado = true;
      // Receita ou custo mudou: resultado e fluxo acompanham (se não foram editados à mão).
      if (l.grupo === "receita" || GRUPOS_CUSTO.includes(l.grupo)) {
        const res = n.linhas.find((x) => x.chave === "resultado");
        if (res && !res.editado) {
          res.valores = resultadoDasLinhas(n.linhas).map((x) => Math.round(x * 100) / 100);
          const fluxo = n.linhas.find((x) => x.chave === "fluxo_acumulado");
          if (fluxo && !fluxo.editado) fluxo.valores = acumular(res.valores).map((x) => Math.round(x * 100) / 100);
        }
      }
    });
    setCelulas((s) => new Set(s).add(`${chave}:${i}`));
  }

  function alterarPremissa<K extends keyof PremissasProjecao>(k: K, v: PremissasProjecao[K]) {
    alterar((n) => { if (n.premissas) n.premissas[k] = v; });
    setPremissasPendentes(true);
  }

  const linhasEditadas = p.linhas.filter((l) => l.editado).length;

  function recalcular() {
    if (!p.premissas) return;
    const premissas = p.premissas;
    alterar((n) => {
      // Linhas que as premissas não cobrem (outras_despesas, outros:*) entram
      // como estão e também descontam do resultado.
      n.linhas = recalcularPelasPremissas(premissas, n.linhas);
    });
    setCelulas(new Set());
    setPremissasPendentes(false);
    setConfirmarRecalculo(false);
  }

  async function salvar() {
    if (!p.nome.trim()) { setErro("Dê um nome para a projeção antes de salvar."); return; }
    setSalvando(true);
    setErro(null);
    try {
      const r = await salvarProjecao(p);
      if (!r.ok) { setErro(mensagemDeErro(r, "Não foi possível salvar a projeção.")); return; }
      const salva = { ...clonar(p), id: r.id };
      onEdicao({ projecao: salva, base: clonar(salva), sujo: false });
      setCelulas(new Set());
      setOkMsg(salva.ativa ? "Projeção salva e ativa para a unidade." : "Projeção salva.");
      onSalvo();
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível salvar a projeção."));
    } finally {
      setSalvando(false);
    }
  }

  function descartar() {
    if (!edicao.base.id) {
      if (!window.confirm("Descartar o rascunho importado? O arquivo continua guardado, mas a leitura não será salva.")) return;
      onEdicao(null);
      return;
    }
    onEdicao({ projecao: clonar(edicao.base), base: edicao.base, sujo: false });
    setCelulas(new Set());
    setPremissasPendentes(false);
    setErro(null);
  }

  const linhasConferir = p.linhas.filter((l) => l.conferir).length;

  return (
    <div className="space-y-4">
      {/* Barra de identificação + ações */}
      <section className="card-premium rounded-xl p-4 flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] flex-1 min-w-0">
          <label className="text-[11px] text-muted-foreground space-y-1 min-w-0">
            <span className="block">Nome da projeção · {nomeUnidade(p.unidade_id)}</span>
            <input
              className="form-input h-8 py-0"
              value={p.nome}
              onChange={(e) => alterar((n) => { n.nome = e.target.value; })}
            />
          </label>
          <div className="text-[11px] text-muted-foreground space-y-1">
            <span className="block">Mês 1 da projeção (inauguração)</span>
            <div className="flex gap-1.5">
              <select
                className="form-input w-auto h-8 py-0"
                value={p.mes1_mes}
                onChange={(e) => alterar((n) => { n.mes1_mes = Number(e.target.value); })}
                aria-label="Mês do mês 1"
              >
                {MESES_LONGOS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <CampoNumero
                valor={p.mes1_ano}
                min={2000}
                ariaLabel="Ano do mês 1"
                onCommit={(v) => alterar((n) => { n.mes1_ano = Math.round(v); })}
                className="form-input w-20 h-8 py-0 text-left"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[12px] self-end h-8">
            <input
              type="checkbox"
              className="accent-[var(--brand-cyan)] w-4 h-4"
              checked={p.ativa}
              onChange={(e) => alterar((n) => { n.ativa = e.target.checked; })}
            />
            Projeção ativa da unidade
          </label>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {edicao.sujo && <span className="text-[11px] text-warning hidden sm:inline">Alterações não salvas</span>}
          <Button type="button" variant="outline" onClick={descartar} disabled={salvando || (!edicao.sujo && !!edicao.base.id)}>
            <RotateCcw /> Descartar
          </Button>
          <Button type="button" onClick={() => void salvar()} disabled={salvando || (!edicao.sujo && !!edicao.base.id)}>
            {salvando ? <Loader2 className="animate-spin" /> : <Save />} Salvar
          </Button>
        </div>
      </section>

      {erro && <MensagemErro texto={erro} onFechar={() => setErro(null)} />}
      {okMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/[0.06] px-3 py-2 text-[12px] text-success" role="status">
          <CheckCircle2 className="w-4 h-4" /> {okMsg}
        </div>
      )}

      {p.ativa && !edicao.base.ativa && (
        <p className="text-[11px] text-muted-foreground">Ao salvar como ativa, a projeção ativa anterior desta unidade deixa de ser usada no comparativo.</p>
      )}

      {linhasConferir > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/[0.06] px-3 py-2 text-[12px]">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-px" />
          <span>
            <strong className="text-warning">{linhasConferir} {linhasConferir === 1 ? "linha" : "linhas"} para conferir.</strong>{" "}
            O CLOCK transcreveu esses valores; compare com o documento original e confirme cada linha na grade.
          </span>
        </div>
      )}

      <ListaAvisos avisos={p.avisos} />

      {/* Grade */}
      <Grade
        projecao={p}
        ano={ano}
        onAno={setAno}
        celulasEditadas={celulas}
        onCelula={editarCelula}
        onConferida={(chave) => alterar((n) => {
          const l = n.linhas.find((x) => x.chave === chave);
          if (l) l.conferir = false;
        })}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <PainelPremissas
          premissas={p.premissas}
          ano={ano}
          pendentes={premissasPendentes}
          linhasEditadas={linhasEditadas}
          confirmar={confirmarRecalculo}
          onConfirmar={setConfirmarRecalculo}
          onCriar={() => { alterar((n) => { n.premissas = PREMISSAS_ZERADAS(); }); setPremissasPendentes(true); }}
          onAlterar={alterarPremissa}
          onRecalcular={recalcular}
        />
        <PainelInvestimento
          investimento={p.investimento}
          onAlterar={(inv) => alterar((n) => { n.investimento = inv; })}
        />
      </div>
    </div>
  );
}

// ─── Grade linhas × meses ──────────────────────────────────────────────────

function Grade({ projecao, ano, onAno, celulasEditadas, onCelula, onConferida }: {
  projecao: Projecao;
  ano: number;
  onAno: (a: number) => void;
  celulasEditadas: Set<string>;
  onCelula: (chave: string, i: number, v: number) => void;
  onConferida: (chave: string) => void;
}) {
  const ini = ano * 12;
  const indices = Array.from({ length: 12 }, (_, k) => ini + k);

  const grupos = React.useMemo(() => {
    const ordenadas = projecao.linhas.slice().sort((a, b) => a.ordem - b.ordem);
    return ORDEM_GRUPO
      .map((g) => ({ grupo: g, linhas: ordenadas.filter((l) => l.grupo === g) }))
      .filter((g) => g.linhas.length > 0);
  }, [projecao.linhas]);

  function totalAno(l: LinhaProjecao): string {
    const vs = indices.map((i) => l.valores[i] ?? 0);
    if (linhaEhPercentual(l)) return fmtPct(vs.reduce((s, v) => s + v, 0) / 12, 0) + " méd.";
    if (l.chave === "fluxo_acumulado") return fmtNumero(vs[11]);
    return fmtNumero(vs.reduce((s, v) => s + v, 0));
  }

  return (
    <section className="card-premium rounded-xl p-0 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-3">
        <div>
          <h3 className="font-display font-semibold text-[15px]">DRE projetado · mês a mês</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Clique na célula para corrigir. Valores em R$; a linha de rampa em % do potencial.</p>
        </div>
        <div role="tablist" aria-label="Ano da projeção" className="inline-flex rounded-lg border border-border p-0.5">
          {[0, 1, 2, 3, 4].map((a) => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={ano === a}
              onClick={() => onAno(a)}
              className={cn(
                "h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors",
                ano === a ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              Ano {a + 1}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-brand-cyan/15 ring-1 ring-brand-cyan/50" /> editado por você</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-warning/15 ring-1 ring-warning/50" /> conferir com o original</span>
      </div>

      <div className="overflow-x-auto border-t border-border">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-muted/60">
              <th scope="col" className="sticky left-0 z-10 bg-muted text-left font-semibold px-3 py-2 min-w-[190px]">Linha</th>
              {indices.map((i) => (
                <th key={i} scope="col" className="px-1.5 py-2 font-medium text-right min-w-[92px] whitespace-nowrap">
                  <div className="text-foreground">Mês {i + 1}</div>
                  <div className="text-[10px] text-muted-foreground font-normal">{rotuloMesCalendario(projecao.mes1_ano, projecao.mes1_mes, i)}</div>
                </th>
              ))}
              <th scope="col" className="px-3 py-2 font-semibold text-right min-w-[110px] whitespace-nowrap">Ano {ano + 1}</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map(({ grupo, linhas }) => (
              <React.Fragment key={grupo}>
                <tr>
                  <th colSpan={14} scope="colgroup" className="sticky left-0 text-left px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground bg-card">
                    {ROTULO_GRUPO[grupo]}
                  </th>
                </tr>
                {linhas.map((l) => {
                  const destaque = l.grupo === "resultado";
                  const pct = linhaEhPercentual(l);
                  return (
                    <tr key={l.chave} className={cn("border-t border-border/70", l.conferir && "bg-warning/[0.05]")}>
                      <th scope="row" className={cn(
                        "sticky left-0 z-10 text-left font-normal px-3 py-1 bg-card",
                        destaque && "font-semibold",
                      )}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate" title={l.descricao}>{l.descricao || rotuloChave(l.chave)}</span>
                          {l.editado && <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-brand-cyan">editado</span>}
                        </div>
                        {l.conferir && (
                          <button
                            type="button"
                            onClick={() => onConferida(l.chave)}
                            className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold text-warning hover:underline"
                          >
                            <AlertTriangle className="w-3 h-3" /> conferir · marcar como conferida
                          </button>
                        )}
                      </th>
                      {indices.map((i) => {
                        const v = l.valores[i] ?? 0;
                        const editada = celulasEditadas.has(`${l.chave}:${i}`);
                        return (
                          <td key={i} className="px-0.5 py-0.5">
                            <CampoNumero
                              valor={v}
                              percentual={pct}
                              ariaLabel={`${l.descricao || rotuloChave(l.chave)}, mês ${i + 1}`}
                              title={editada ? "Editado por você" : l.conferir ? "Conferir com o arquivo original" : undefined}
                              onCommit={(nv) => onCelula(l.chave, i, nv)}
                              className={cn(
                                "w-full h-7 px-1.5 rounded-md bg-transparent border border-transparent outline-none",
                                "hover:border-border-strong focus:border-brand-cyan focus:bg-card",
                                v < 0 && "text-danger",
                                destaque && "font-semibold",
                                editada && "bg-brand-cyan/15 ring-1 ring-brand-cyan/50",
                                !editada && l.conferir && "ring-1 ring-warning/40",
                              )}
                            />
                          </td>
                        );
                      })}
                      <td className={cn("px-3 py-1 text-right font-mono tabular-nums whitespace-nowrap", destaque && "font-semibold")}>
                        {totalAno(l)}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
            {grupos.length === 0 && (
              <tr><td colSpan={14} className="px-3 py-6 text-center text-muted-foreground">Sem linhas. Preencha as premissas e recalcule.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Premissas ─────────────────────────────────────────────────────────────

type CampoPremissa = { k: Exclude<keyof PremissasProjecao, "rampa" | "metodo_simples">; rotulo: string; tipo: "brl" | "pct" | "mes" | "int" };

const CAMPOS_PREMISSAS: Array<{ titulo: string; campos: CampoPremissa[] }> = [
  {
    titulo: "Receita e custo",
    campos: [
      { k: "potencial_faturamento", rotulo: "Potencial de faturamento/mês", tipo: "brl" },
      { k: "csp_pct", rotulo: "CSP (% do faturamento)", tipo: "pct" },
      { k: "taxa_cartao_pct", rotulo: "Taxa de cartão (%)", tipo: "pct" },
    ],
  },
  {
    titulo: "Franchising",
    campos: [
      { k: "royalties_pct", rotulo: "Royalties (%)", tipo: "pct" },
      { k: "royalties_minimo", rotulo: "Royalties mínimo", tipo: "brl" },
      { k: "royalties_minimo_a_partir_mes", rotulo: "Mínimo a partir do mês", tipo: "mes" },
      { k: "fundo_propaganda_fixo", rotulo: "Fundo de propaganda (fixo)", tipo: "brl" },
    ],
  },
  {
    titulo: "Ocupação e utilidades",
    campos: [
      { k: "aluguel", rotulo: "Aluguel e IPTU", tipo: "brl" },
      { k: "energia_pct", rotulo: "Energia (% do faturamento)", tipo: "pct" },
      { k: "agua_pct", rotulo: "Água (% do faturamento)", tipo: "pct" },
      { k: "telefone", rotulo: "Telefone e internet", tipo: "brl" },
    ],
  },
  {
    titulo: "Administrativo",
    campos: [
      { k: "contador", rotulo: "Contador", tipo: "brl" },
      { k: "software", rotulo: "Software", tipo: "brl" },
      { k: "seguro", rotulo: "Seguro", tipo: "brl" },
      { k: "servicos_bancarios", rotulo: "Serviços bancários", tipo: "brl" },
      { k: "pessoal", rotulo: "Pessoal", tipo: "brl" },
      { k: "materiais", rotulo: "Materiais", tipo: "brl" },
    ],
  },
  {
    titulo: "Marketing",
    campos: [
      { k: "publicidade_local", rotulo: "Publicidade local", tipo: "brl" },
      { k: "publicidade_inaugural", rotulo: "Publicidade inaugural", tipo: "brl" },
      { k: "publicidade_inaugural_meses", rotulo: "Meses de publicidade inaugural", tipo: "int" },
    ],
  },
];

function PainelPremissas({
  premissas, ano, pendentes, linhasEditadas, confirmar, onConfirmar, onCriar, onAlterar, onRecalcular,
}: {
  premissas: PremissasProjecao | null;
  ano: number;
  pendentes: boolean;
  linhasEditadas: number;
  confirmar: boolean;
  onConfirmar: (v: boolean) => void;
  onCriar: () => void;
  onAlterar: <K extends keyof PremissasProjecao>(k: K, v: PremissasProjecao[K]) => void;
  onRecalcular: () => void;
}) {
  if (!premissas) {
    return (
      <section className="card-premium rounded-xl p-5">
        <h3 className="font-display font-semibold text-[15px]">Premissas</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Esta projeção não tem premissas — as linhas vieram prontas do arquivo. Preencha as premissas para poder recalcular a grade pelas fórmulas da franqueadora.
        </p>
        <Button type="button" variant="outline" className="mt-3" onClick={onCriar}><Plus /> Preencher premissas</Button>
      </section>
    );
  }

  const rampa = Array.from({ length: 12 }, (_, k) => ano * 12 + k);

  return (
    <section className="card-premium rounded-xl p-5 space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-display font-semibold text-[15px]">Premissas</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Altere as premissas e recalcule: a grade é refeita com as fórmulas da franqueadora. Percentuais em pontos (5 = 5%).
          </p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
          {confirmar ? (
            <div className="flex items-center gap-1.5">
              <Button type="button" size="sm" onClick={onRecalcular}><Calculator /> Confirmar recálculo</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => onConfirmar(false)}>Cancelar</Button>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant={pendentes ? "default" : "outline"}
              onClick={() => (linhasEditadas > 0 ? onConfirmar(true) : onRecalcular())}
            >
              <Calculator /> Recalcular pelas premissas
            </Button>
          )}
          {confirmar && linhasEditadas > 0 && (
            <span className="text-[11px] text-warning max-w-[260px] sm:text-right">
              {linhasEditadas} {linhasEditadas === 1 ? "linha editada à mão será substituída" : "linhas editadas à mão serão substituídas"} pelo cálculo.
            </span>
          )}
          {pendentes && !confirmar && <span className="text-[11px] text-warning">Premissas alteradas · recalcule para atualizar a grade</span>}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CAMPOS_PREMISSAS.map((bloco) => (
          <fieldset key={bloco.titulo} className="space-y-2">
            <legend className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">{bloco.titulo}</legend>
            {bloco.campos.map((c) => (
              <label key={c.k} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="text-muted-foreground">{c.rotulo}</span>
                <span className="flex items-center gap-1 shrink-0">
                  {c.tipo === "brl" && <span className="text-[11px] text-muted-foreground">R$</span>}
                  <CampoNumero
                    valor={premissas[c.k]}
                    min={c.tipo === "mes" ? 1 : 0}
                    ariaLabel={c.rotulo}
                    onCommit={(v) => onAlterar(c.k, c.tipo === "mes" || c.tipo === "int" ? Math.round(v) : v)}
                    className="form-input w-24 h-8 py-0"
                  />
                  {c.tipo === "pct" && <span className="text-[11px] text-muted-foreground">%</span>}
                </span>
              </label>
            ))}
          </fieldset>
        ))}

        <fieldset className="space-y-2">
          <legend className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1">Simples Nacional</legend>
          <select
            className="form-input w-auto h-8 py-0"
            value={premissas.metodo_simples}
            onChange={(e) => onAlterar("metodo_simples", e.target.value as PremissasProjecao["metodo_simples"])}
            aria-label="Método de cálculo do Simples"
          >
            <option value="franqueadora">Método da franqueadora</option>
            <option value="legal">Regra legal (RBT12)</option>
          </select>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {premissas.metodo_simples === "franqueadora"
              ? "Faixa calculada com o faturamento do próprio mês × 12, como na planilha da franqueadora."
              : "Faixa pela receita bruta dos 12 meses anteriores, como manda a lei — o mesmo critério do nosso DRE."}
          </p>
        </fieldset>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Rampa · % do potencial no ano {ano + 1}</h4>
          <span className="text-[11px] text-muted-foreground">troque o ano na grade acima</span>
        </div>
        <div className="mt-2 grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
          {rampa.map((i) => (
            <label key={i} className="text-[10px] text-muted-foreground text-center space-y-0.5">
              <span className="block">Mês {i + 1}</span>
              <CampoNumero
                valor={premissas.rampa[i] ?? 0}
                percentual
                min={0}
                ariaLabel={`Rampa do mês ${i + 1} em %`}
                onCommit={(v) => {
                  const r = premissas.rampa.slice();
                  while (r.length < TOTAL_MESES) r.push(0);
                  r[i] = v;
                  onAlterar("rampa", r);
                }}
                className="form-input w-full h-8 py-0 px-1.5 text-center"
              />
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Investimento ──────────────────────────────────────────────────────────

function PainelInvestimento({ investimento, onAlterar }: {
  investimento: InvestimentoProjecao | null;
  onAlterar: (inv: InvestimentoProjecao | null) => void;
}) {
  const [aberta, setAberta] = React.useState<string | null>(null);

  if (!investimento) {
    return (
      <section className="card-premium rounded-xl p-5">
        <h3 className="font-display font-semibold text-[15px]">Investimento</h3>
        <p className="text-xs text-muted-foreground mt-1">Sem investimento informado. Ele é a base do payback projetado × real.</p>
        <Button type="button" variant="outline" className="mt-3"
          onClick={() => onAlterar({ total: 0, capital_giro: 0, categorias: [] })}>
          <Plus /> Informar investimento
        </Button>
      </section>
    );
  }

  const somaCategorias = investimento.categorias.reduce((s, c) => s + (c.valor || 0), 0);
  const diverge = investimento.categorias.length > 0 && Math.abs(somaCategorias - investimento.total) > 1;

  return (
    <section className="card-premium rounded-xl p-5 space-y-3">
      <h3 className="font-display font-semibold text-[15px]">Investimento</h3>
      <label className="flex items-center justify-between gap-2 text-[12px]">
        <span className="text-muted-foreground">Investimento total</span>
        <span className="flex items-center gap-1">
          <span className="text-[11px] text-muted-foreground">R$</span>
          <CampoNumero valor={investimento.total} min={0} ariaLabel="Investimento total"
            onCommit={(v) => onAlterar({ ...investimento, total: v })} className="form-input w-32 h-8 py-0" />
        </span>
      </label>
      <label className="flex items-center justify-between gap-2 text-[12px]">
        <span className="text-muted-foreground">Capital de giro</span>
        <span className="flex items-center gap-1">
          <span className="text-[11px] text-muted-foreground">R$</span>
          <CampoNumero valor={investimento.capital_giro} min={0} ariaLabel="Capital de giro"
            onCommit={(v) => onAlterar({ ...investimento, capital_giro: v })} className="form-input w-32 h-8 py-0" />
        </span>
      </label>

      {investimento.categorias.length > 0 && (
        <div className="border-t border-border pt-3">
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="font-semibold uppercase tracking-[0.08em] text-muted-foreground">Categorias</span>
            <span className="font-mono text-muted-foreground">soma {fmtBRL(somaCategorias, 2)}</span>
          </div>
          {diverge && (
            <p className="mt-1 text-[11px] text-warning">A soma das categorias difere do total em {fmtBRL(Math.abs(somaCategorias - investimento.total), 2)}.</p>
          )}
          <ul className="mt-2 divide-y divide-border/70">
            {investimento.categorias.map((c, ci) => (
              <li key={`${c.nome}-${ci}`} className="py-1.5">
                <div className="flex items-center justify-between gap-2 text-[12px]">
                  <button
                    type="button"
                    className="text-left truncate hover:underline disabled:no-underline"
                    disabled={c.itens.length === 0}
                    aria-expanded={aberta === c.nome}
                    onClick={() => setAberta(aberta === c.nome ? null : c.nome)}
                  >
                    {c.nome}
                    {c.itens.length > 0 && <span className="text-muted-foreground"> · {c.itens.length} itens</span>}
                  </button>
                  <CampoNumero
                    valor={c.valor}
                    min={0}
                    ariaLabel={`Valor de ${c.nome}`}
                    onCommit={(v) => {
                      const cats = investimento.categorias.map((x, j) => (j === ci ? { ...x, valor: v } : x));
                      onAlterar({ ...investimento, categorias: cats });
                    }}
                    className="form-input w-28 h-7 py-0"
                  />
                </div>
                {aberta === c.nome && (
                  <ul className="mt-1.5 space-y-1 pl-2 border-l-2 border-border">
                    {c.itens.map((it, ii) => (
                      <li key={ii} className="flex justify-between gap-2 text-[11px] text-muted-foreground">
                        <span className="truncate">{it.descricao} <span className="font-mono">({fmtNumero(it.quantidade)} × {fmtBRL(it.unitario, 2)})</span></span>
                        <span className="font-mono shrink-0 text-foreground">{fmtBRL(it.total, 2)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

"use client";

// LavSync · Projetado × Real › Comparar
//
// Por unidade ou consolidado (escopo da server action compararProjecao, que usa
// o motor único do DRE como fonte do REAL). Mostra:
//   · KPIs — faturamento e resultado acumulados real × projetado, % atingido,
//     gap em R$, payback projetado × payback no ritmo real;
//   · gráfico mensal projetado × real (legenda liga/desliga, tooltip com %);
//   · tabela mês a mês;
//   · comparação POR LINHA de custo (R$ e % do faturamento) num mês ou no
//     acumulado realizado — desvio acima de 2 p.p. destacado;
//   · insights determinísticos com tom e link, e atalho para pedir ao CLOCK.
// Esta tela só apresenta: nenhum número é calculado fora do comparativo além
// de somas e razões dos próprios valores devolvidos.
import * as React from "react";
import Link from "next/link";
import {
  GitCompareArrows, Upload, Loader2, TrendingUp, TrendingDown, Info, ArrowRight, MessageSquare, PencilLine, Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/ui/chart-card";
import { useClock } from "@/components/clock/clock-provider";
import { compararProjecao } from "@/lib/financeiro/projecao/actions";
import type { ComparativoProjecao, ComparativoMes } from "@/lib/financeiro/projecao/tipos";
import { SeletorUnidade, MensagemErro, EstadoVazio, mensagemDeErro } from "./ui";
import { GraficoMensal, type PontoGrafico } from "./grafico-mensal";
import { fmtBRL, fmtBRLCompacto, fmtPct, fmtPP, ordemChave, rotuloChave, rotuloChaveMes } from "./formatos";

type Faixa = "realizado" | "completo";
type Metrica = "faturamento" | "resultado";

const CHAVES_FORA_DOS_CUSTOS = new Set(["faturamento", "resultado", "fluxo_acumulado", "percentual_potencial"]);

/** "AAAA-MM" + n meses. */
function somarMeses(chave: string, n: number): string {
  const [a, m] = chave.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/**
 * Rótulo de um mes_index do comparativo. Por unidade, mes_index é o mês da
 * projeção ("mês 5 · dez/25"); no consolidado é só a posição na linha do tempo
 * das unidades (inaugurações diferentes), então vale o mês do calendário.
 */
function rotuloIndice(c: ComparativoProjecao, idx: number, consolidado: boolean): string {
  if (c.meses.length === 0) return `mês ${idx}`;
  const cal = rotuloChaveMes(somarMeses(c.meses[0].chave_mes, idx - 1));
  return consolidado ? cal : `mês ${idx} · ${cal}`;
}

export function AreaComparar({ unidades, unidadeId, versaoDados, onImportar, onEditar, nomeUnidade }: {
  unidades: Array<{ id: string; nome: string }>;
  unidadeId: string;
  versaoDados: number;
  onImportar: () => void;
  onEditar: (unidadeId: string) => void;
  nomeUnidade: (id: string) => string;
}) {
  const [escopo, setEscopo] = React.useState(unidadeId);
  // Resultado guardado com a chave da consulta: carregando = chave mudou.
  // Ao recarregar, o comparativo anterior fica na tela (esmaecido), sem salto.
  const [resposta, setResposta] = React.useState<{ chave: string; dados: ComparativoProjecao | null; erro: string | null } | null>(null);
  const [tentativa, setTentativa] = React.useState(0);

  // A unidade da página mudou: o escopo acompanha (sem efeito).
  const [unidadeVista, setUnidadeVista] = React.useState(unidadeId);
  if (unidadeId !== unidadeVista) {
    setUnidadeVista(unidadeId);
    if (escopo !== "consolidado") setEscopo(unidadeId);
  }

  const chave = `${escopo}:${versaoDados}:${tentativa}`;
  const carregando = resposta?.chave !== chave;
  const erro = resposta?.erro ?? null;
  // Dados de OUTRO escopo não são mostrados enquanto carrega (evita confundir unidades).
  const dados: ComparativoProjecao | null | undefined =
    resposta && !resposta.erro && resposta.chave.startsWith(`${escopo}:`) ? resposta.dados : undefined;

  React.useEffect(() => {
    let vivo = true;
    compararProjecao(escopo)
      .then((r) => {
        if (!vivo) return;
        if (!r.ok) { setResposta({ chave, dados: null, erro: mensagemDeErro(r, "Não foi possível montar o comparativo.") }); return; }
        setResposta({ chave, dados: r.comparativo, erro: null });
      })
      .catch((e: unknown) => {
        if (vivo) setResposta({ chave, dados: null, erro: mensagemDeErro(e, "Não foi possível montar o comparativo.") });
      });
    return () => { vivo = false; };
  }, [escopo, chave]);

  const nomeEscopo = escopo !== "consolidado" ? nomeUnidade(escopo)
    : dados && dados.unidades_sem_projecao && dados.unidades_sem_projecao.length > 0
      ? `consolidado de ${dados.unidades.length} de ${dados.unidades.length + dados.unidades_sem_projecao.length} unidades (sem projeção: ${dados.unidades_sem_projecao.join(", ")})`
      : "consolidado da rede";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SeletorUnidade unidades={unidades} valor={escopo} onChange={setEscopo} incluirConsolidado rotulo="Comparar" />
        {carregando && dados !== undefined && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-label="Atualizando" />}
      </div>

      {erro && !carregando && (
        <div className="space-y-2">
          <MensagemErro texto={erro} />
          <Button type="button" variant="outline" size="sm" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</Button>
        </div>
      )}

      {dados === undefined && carregando && (
        <div className="card-premium rounded-xl p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Cruzando o projetado com o real…
        </div>
      )}

      {dados === null && !erro && (
        <EstadoVazio
          icone={GitCompareArrows}
          titulo={escopo === "consolidado" ? "Nenhuma unidade com projeção ativa" : `${nomeUnidade(escopo)} ainda não tem projeção ativa`}
          texto="Importe o DRE projetado que a franqueadora apresentou (planilha, PDF ou imagem). O CLOCK lê o arquivo e você revisa antes de salvar."
          acao={<Button type="button" onClick={onImportar}><Upload /> Importar arquivo da franqueadora</Button>}
        />
      )}

      {dados && (
        <div className={cn("space-y-4 transition-opacity", carregando && "opacity-60")}>
          <Conteudo
            c={dados}
            nomeEscopo={nomeEscopo}
            consolidado={escopo === "consolidado"}
            onEditar={escopo !== "consolidado" ? () => onEditar(escopo) : undefined}
          />
        </div>
      )}
    </div>
  );
}

// ─── Conteúdo do comparativo ───────────────────────────────────────────────

function Conteudo({ c, nomeEscopo, consolidado, onEditar }: {
  c: ComparativoProjecao;
  nomeEscopo: string;
  consolidado: boolean;
  onEditar?: () => void;
}) {
  const [faixa, setFaixa] = React.useState<Faixa>("realizado");
  const [metrica, setMetrica] = React.useState<Metrica>("faturamento");

  const ultimoReal = React.useMemo(() => {
    let u = -1;
    c.meses.forEach((m, i) => { if (m.real) u = i; });
    return u;
  }, [c.meses]);
  const mesesRealizados = ultimoReal + 1;

  const visiveis = faixa === "realizado" && mesesRealizados > 0 ? c.meses.slice(0, mesesRealizados) : c.meses;

  const pontos: PontoGrafico[] = visiveis.map((m) => ({
    // Consolidado: mes_index não é o mês da projeção de nenhuma unidade
    rotulo: consolidado ? rotuloChaveMes(m.chave_mes) : `M${m.mes_index}`,
    calendario: rotuloChaveMes(m.chave_mes),
    real: m.real ? m.real[metrica] : null,
    projetado: m.projetado[metrica],
    // Faturamento real nunca é estimado: só o resultado herda custo estimado
    estimado: metrica === "resultado" && !!m.real?.estimado,
  }));

  return (
    <>
      <Kpis c={c} mesesRealizados={mesesRealizados} consolidado={consolidado} />

      {/* Filtros do gráfico e da tabela — uma linha, acima do que eles afetam */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmentado
          rotulo="Métrica"
          valor={metrica}
          opcoes={[{ v: "faturamento", t: "Faturamento" }, { v: "resultado", t: "Resultado" }]}
          onChange={(v) => setMetrica(v as Metrica)}
        />
        <Segmentado
          rotulo="Período"
          valor={faixa}
          opcoes={[
            { v: "realizado", t: mesesRealizados > 0 ? `Realizado (${mesesRealizados} meses)` : "Realizado" },
            { v: "completo", t: "5 anos projetados" },
          ]}
          onChange={(v) => setFaixa(v as Faixa)}
        />
        <div className="ml-auto flex items-center gap-2">
          {onEditar && (
            <Button type="button" variant="outline" size="sm" onClick={onEditar}><PencilLine /> Editar projeção</Button>
          )}
          <PerguntarClock c={c} nomeEscopo={nomeEscopo} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ChartCard
          title={metrica === "faturamento" ? "Faturamento mensal · projetado × real" : "Resultado mensal · projetado × real"}
          subtitle={consolidado ? `${nomeEscopo} · meses do calendário` : `${nomeEscopo} · mês 1 = mês inicial da projeção`}
          height={320}
        >
          <GraficoMensal dados={pontos} metrica={metrica} />
        </ChartCard>
        <Insights c={c} />
      </div>

      <TabelaMensal meses={visiveis} consolidado={consolidado} />

      {mesesRealizados > 0 && <ComparacaoPorLinha meses={c.meses.slice(0, mesesRealizados)} consolidado={consolidado} />}
    </>
  );
}

function Segmentado({ rotulo, valor, opcoes, onChange }: {
  rotulo: string;
  valor: string;
  opcoes: Array<{ v: string; t: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="inline-flex rounded-lg border border-border bg-card p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={valor === o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            "h-7 px-2.5 rounded-md text-[12px] font-medium whitespace-nowrap transition-colors",
            valor === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          {o.t}
        </button>
      ))}
    </div>
  );
}

// ─── KPIs ──────────────────────────────────────────────────────────────────

function Kpis({ c, mesesRealizados, consolidado }: { c: ComparativoProjecao; mesesRealizados: number; consolidado: boolean }) {
  const a = c.acumulado;
  // pct_atingido vem em PONTOS (55 = 55%); a tela trabalha em fração
  const pct = a.fat_proj > 0 ? a.fat_real / a.fat_proj : a.pct_atingido / 100;
  const gap = a.fat_real - a.fat_proj;
  const gapRes = a.res_real - a.res_proj;
  const pb = c.payback;
  const periodo = mesesRealizados > 0
    ? `${consolidado ? "" : `meses 1 a ${mesesRealizados} · `}${rotuloChaveMes(c.meses[0].chave_mes)} a ${rotuloChaveMes(c.meses[mesesRealizados - 1].chave_mes)}`
    : "sem meses realizados";

  const tomPct = pct >= 0.95 ? "bom" : pct >= 0.7 ? "atencao" : "ruim";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <Kpi
        rotulo="Faturamento acumulado"
        valor={fmtBRLCompacto(a.fat_real)}
        detalhe={`projetado ${fmtBRLCompacto(a.fat_proj)}`}
        rodape={periodo}
      />
      <Kpi
        rotulo="% do projetado atingido"
        valor={fmtPct(pct, 0)}
        detalhe={tomPct === "bom" ? "no ritmo da franqueadora" : tomPct === "atencao" ? "abaixo do projetado" : "muito abaixo do projetado"}
        tom={tomPct}
        barra={Math.min(1, Math.max(0, pct))}
      />
      <Kpi
        rotulo="Gap de faturamento"
        valor={`${gap > 0 ? "+" : ""}${fmtBRLCompacto(gap)}`}
        detalhe={gap < 0 ? "faltou para o projetado" : "acima do projetado"}
        tom={gap < 0 ? "ruim" : "bom"}
        icone={gap < 0 ? TrendingDown : TrendingUp}
      />
      <Kpi
        rotulo="Resultado acumulado"
        valor={fmtBRLCompacto(a.res_real)}
        detalhe={`projetado ${fmtBRLCompacto(a.res_proj)}`}
        rodape={`diferença ${gapRes > 0 ? "+" : ""}${fmtBRLCompacto(gapRes)}`}
        tom={gapRes < 0 ? "ruim" : "bom"}
      />
      <Kpi
        className="col-span-2 lg:col-span-1"
        rotulo="Payback"
        valor={pb.real_estimado_mes != null ? rotuloIndice(c, pb.real_estimado_mes, consolidado) : "não fecha"}
        detalhe={pb.projetado_mes != null ? `projetado: ${rotuloIndice(c, pb.projetado_mes, consolidado)}` : "projetado: não fecha em 60 meses"}
        rodape={pb.real_estimado_mes != null
          ? `no ritmo real · investimento ${fmtBRLCompacto(pb.investimento)}`
          : `no ritmo real não se paga em 60 meses · investimento ${fmtBRLCompacto(pb.investimento)}`}
        tom={pb.real_estimado_mes == null ? "ruim"
          : pb.projetado_mes != null && pb.real_estimado_mes > pb.projetado_mes ? "atencao" : "bom"}
        icone={Scale}
      />
    </div>
  );
}

function Kpi({ rotulo, valor, detalhe, rodape, tom, barra, icone: Icone, className }: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  rodape?: string;
  tom?: "bom" | "atencao" | "ruim";
  barra?: number;
  icone?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const corTom = tom === "bom" ? "text-success" : tom === "atencao" ? "text-warning" : tom === "ruim" ? "text-danger" : "text-muted-foreground";
  return (
    <div className={cn("card-premium rounded-xl p-4 min-w-0", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{rotulo}</span>
        {Icone && <Icone className={cn("w-4 h-4 shrink-0", corTom)} />}
      </div>
      <div className="mt-2 font-mono font-bold text-[22px] leading-none tracking-tight truncate">{valor}</div>
      {detalhe && <div className={cn("mt-1.5 text-[11px]", tom ? corTom : "text-muted-foreground")}>{detalhe}</div>}
      {barra != null && (
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden>
          <div
            className={cn("h-full rounded-full", tom === "bom" ? "bg-success" : tom === "atencao" ? "bg-warning" : "bg-danger")}
            style={{ width: `${barra * 100}%` }}
          />
        </div>
      )}
      {rodape && <div className="mt-1.5 text-[10px] text-muted-foreground truncate" title={rodape}>{rodape}</div>}
    </div>
  );
}

// ─── Insights ──────────────────────────────────────────────────────────────

function Insights({ c }: { c: ComparativoProjecao }) {
  return (
    <section className="card-premium rounded-xl p-5 flex flex-col">
      <header className="mb-3">
        <h3 className="font-display font-semibold text-[15px]">O que o cruzamento mostra</h3>
        <p className="text-xs text-muted-foreground mt-1">Leituras automáticas do projetado × real.</p>
      </header>
      {c.simples_divergente && (
        <div className="mb-3 flex gap-2 rounded-lg border border-warning/30 bg-warning/[0.06] p-3 text-[12px]">
          <Scale className="w-4 h-4 text-warning shrink-0 mt-px" />
          <span>
            <strong className="text-warning">Simples calculado de forma diferente da lei.</strong>{" "}
            A franqueadora usa o faturamento do mês × 12 para a faixa; a regra legal usa os 12 meses anteriores.
          </span>
        </div>
      )}
      {c.insights.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">Sem leituras para este período ainda.</p>
      ) : (
        <ul className="space-y-2 overflow-y-auto max-h-[300px] pr-1">
          {c.insights.map((ins, i) => {
            const Icone = ins.tom === "positivo" ? TrendingUp : ins.tom === "negativo" ? TrendingDown : Info;
            return (
              <li
                key={i}
                className={cn(
                  "flex gap-2.5 rounded-lg border p-3",
                  ins.tom === "positivo" && "border-success/30 bg-success/[0.05]",
                  ins.tom === "negativo" && "border-danger/30 bg-danger/[0.05]",
                  ins.tom === "neutro" && "border-border bg-muted/40",
                )}
              >
                <Icone className={cn(
                  "w-4 h-4 shrink-0 mt-px",
                  ins.tom === "positivo" ? "text-success" : ins.tom === "negativo" ? "text-danger" : "text-brand-cyan",
                )} />
                <div className="min-w-0 text-[12px] leading-relaxed">
                  <span className="sr-only">{ins.tom === "positivo" ? "Ponto positivo: " : ins.tom === "negativo" ? "Ponto de atenção: " : "Observação: "}</span>
                  {ins.texto}
                  {ins.href && (
                    <Link href={ins.href} className="ml-1 inline-flex items-center gap-0.5 font-semibold text-brand-cyan hover:underline whitespace-nowrap">
                      Ver detalhe <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PerguntarClock({ c, nomeEscopo }: { c: ComparativoProjecao; nomeEscopo: string }) {
  const clock = useClock();
  if (!clock.ativo) return null;
  const a = c.acumulado;
  const pct = a.fat_proj > 0 ? a.fat_real / a.fat_proj : a.pct_atingido / 100;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={clock.estado === "pensando"}
      onClick={() => {
        clock.enviar(
          `Analise o projetado da franqueadora × o real (${nomeEscopo}). Faturamento acumulado: real ${fmtBRL(a.fat_real)} contra ${fmtBRL(a.fat_proj)} projetados (${fmtPct(pct, 0)}). ` +
          `Explique onde o real descolou da rampa, quais custos fogem do projetado e o que fazer para recuperar o payback.`,
          "texto",
        );
        clock.setRailRecolhido(false);
        clock.setSheetAberto(true);
      }}
    >
      <MessageSquare /> Pedir análise ao CLOCK
    </Button>
  );
}

// ─── Tabela mês a mês ──────────────────────────────────────────────────────

function TabelaMensal({ meses, consolidado }: { meses: ComparativoMes[]; consolidado: boolean }) {
  return (
    <ChartCard title="Mês a mês" subtitle="Faturamento e resultado — projetado pela franqueadora × real" height="auto">
      <div className="overflow-auto max-h-[420px] -mx-5 border-t border-border">
        <table className="w-full text-[12px] border-collapse">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr className="text-muted-foreground">
              <th scope="col" className="text-left font-semibold px-3 py-2">Mês</th>
              <th scope="col" className="text-right font-semibold px-3 py-2 whitespace-nowrap">Fat. projetado</th>
              <th scope="col" className="text-right font-semibold px-3 py-2 whitespace-nowrap">Fat. real</th>
              <th scope="col" className="text-right font-semibold px-3 py-2">Atingido</th>
              <th scope="col" className="text-right font-semibold px-3 py-2 whitespace-nowrap">Res. projetado</th>
              <th scope="col" className="text-right font-semibold px-3 py-2 whitespace-nowrap">Res. real</th>
              <th scope="col" className="text-right font-semibold px-3 py-2 whitespace-nowrap">Gap resultado</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => {
              const pct = m.real && m.projetado.faturamento > 0 ? m.real.faturamento / m.projetado.faturamento : null;
              const gapRes = m.real ? m.real.resultado - m.projetado.resultado : null;
              return (
                <tr key={m.mes_index} className="border-t border-border/70 hover:bg-muted/40">
                  <th scope="row" className="text-left font-normal px-3 py-1.5 whitespace-nowrap">
                    {consolidado
                      ? <span className="font-medium">{rotuloChaveMes(m.chave_mes)}</span>
                      : <><span className="font-medium">Mês {m.mes_index}</span><span className="text-muted-foreground"> · {rotuloChaveMes(m.chave_mes)}</span></>}
                    {m.real?.estimado && <span className="ml-1.5 text-[10px] text-muted-foreground uppercase tracking-wide">estimado</span>}
                  </th>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtBRL(m.projetado.faturamento)}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">{m.real ? fmtBRL(m.real.faturamento) : "—"}</td>
                  <td className="px-3 py-1.5 text-right">
                    {pct != null ? (
                      <span className={cn(
                        "inline-block min-w-[46px] rounded px-1.5 py-0.5 font-mono font-semibold tabular-nums",
                        pct >= 0.95 ? "bg-success/12 text-success" : pct >= 0.5 ? "bg-warning/12 text-warning" : "bg-danger/12 text-danger",
                      )}>{fmtPct(pct, 0)}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className={cn("px-3 py-1.5 text-right font-mono tabular-nums", m.projetado.resultado < 0 && "text-danger")}>{fmtBRL(m.projetado.resultado)}</td>
                  <td className={cn("px-3 py-1.5 text-right font-mono tabular-nums", m.real && m.real.resultado < 0 && "text-danger")}>{m.real ? fmtBRL(m.real.resultado) : "—"}</td>
                  <td className={cn("px-3 py-1.5 text-right font-mono tabular-nums", gapRes != null && gapRes < 0 && "text-danger")}>
                    {gapRes != null ? `${gapRes > 0 ? "+" : ""}${fmtBRL(gapRes)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

// ─── Comparação por linha de custo ─────────────────────────────────────────

function ComparacaoPorLinha({ meses, consolidado }: { meses: ComparativoMes[]; consolidado: boolean }) {
  // "acumulado" ou o mes_index escolhido
  const [sel, setSel] = React.useState<string>("acumulado");
  const escolhidos = sel === "acumulado" ? meses : meses.filter((m) => String(m.mes_index) === sel);
  const comReal = escolhidos.filter((m) => m.real);

  const fatProj = comReal.reduce((s, m) => s + m.projetado.faturamento, 0);
  const fatReal = comReal.reduce((s, m) => s + (m.real?.faturamento ?? 0), 0);
  const estimado = comReal.some((m) => m.real?.estimado);

  // Mesma regra do comparativo: linha que o nosso DRE não modela (nenhum mês
  // realizado tem essa chave no real) fica sem base — traço, sem cor e fora
  // da contagem de desvios. Senão "real = 0" pareceria economia.
  const comBaseReal = new Set<string>();
  for (const m of meses) Object.keys(m.real?.linhas ?? {}).forEach((k) => comBaseReal.add(k));

  const chaves = new Set<string>();
  for (const m of comReal) {
    Object.keys(m.projetado.linhas).forEach((k) => chaves.add(k));
    Object.keys(m.real?.linhas ?? {}).forEach((k) => chaves.add(k));
  }
  const linhas = [...chaves]
    .filter((k) => !CHAVES_FORA_DOS_CUSTOS.has(k))
    .sort((a, b) => ordemChave(a) - ordemChave(b) || a.localeCompare(b))
    .map((k) => {
      const proj = comReal.reduce((s, m) => s + Math.abs(m.projetado.linhas[k] ?? 0), 0);
      const real = comReal.reduce((s, m) => s + Math.abs(m.real?.linhas[k] ?? 0), 0);
      const pProj = fatProj > 0 ? proj / fatProj : 0;
      const pReal = fatReal > 0 ? real / fatReal : 0;
      return { k, proj, real, pProj, pReal, desvio: pReal - pProj, semBase: !comBaseReal.has(k) };
    })
    .filter((l) => l.proj !== 0 || l.real !== 0);

  const fora = linhas.filter((l) => !l.semBase && Math.abs(l.desvio) > 0.02).length;
  const semBase = linhas.filter((l) => l.semBase).length;

  return (
    <ChartCard
      title="Custos linha a linha"
      subtitle={`Projetado × real em R$ e em % do faturamento${fora ? ` · ${fora} ${fora === 1 ? "linha" : "linhas"} com desvio acima de 2 p.p.` : ""}`}
      height="auto"
      actions={
        <select
          className="form-input w-auto h-8 py-0"
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          aria-label="Período da comparação por linha"
        >
          <option value="acumulado">Acumulado realizado ({meses.length} meses)</option>
          {meses.slice().reverse().filter((m) => m.real).map((m) => (
            <option key={m.mes_index} value={String(m.mes_index)}>{consolidado ? rotuloChaveMes(m.chave_mes) : `Mês ${m.mes_index} · ${rotuloChaveMes(m.chave_mes)}`}</option>
          ))}
        </select>
      }
    >
      {estimado && (
        <p className="mb-2 text-[11px] text-muted-foreground">
          Parte do real é estimada: onde não há despesa paga lançada, o DRE usa o % de referência do custo.
        </p>
      )}
      <div className="overflow-x-auto -mx-5 border-t border-border">
        <table className="w-full text-[12px] border-collapse">
          <thead className="bg-muted">
            <tr className="text-muted-foreground">
              <th scope="col" className="text-left font-semibold px-3 py-2">Linha</th>
              <th scope="col" className="text-right font-semibold px-3 py-2">Projetado</th>
              <th scope="col" className="text-right font-semibold px-3 py-2">Real</th>
              <th scope="col" className="text-right font-semibold px-3 py-2 whitespace-nowrap">% fat. proj.</th>
              <th scope="col" className="text-right font-semibold px-3 py-2 whitespace-nowrap">% fat. real</th>
              <th scope="col" className="text-right font-semibold px-3 py-2">Desvio</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border/70 font-semibold">
              <th scope="row" className="text-left px-3 py-1.5">Faturamento</th>
              <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtBRL(fatProj)}</td>
              <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtBRL(fatReal)}</td>
              <td className="px-3 py-1.5 text-right font-mono">100%</td>
              <td className="px-3 py-1.5 text-right font-mono">100%</td>
              <td className="px-3 py-1.5 text-right text-muted-foreground font-normal">
                {fatProj > 0 ? `${fmtPct(fatReal / fatProj, 0)} atingido` : "—"}
              </td>
            </tr>
            {linhas.map((l) => {
              if (l.semBase) {
                return (
                  <tr key={l.k} className="border-t border-border/70">
                    <th scope="row" className="text-left font-normal px-3 py-1.5">{rotuloChave(l.k)}</th>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtBRL(l.proj)}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">—</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtPct(l.pProj)}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">—</td>
                    <td className="px-3 py-1.5 text-right text-[11px] text-muted-foreground whitespace-nowrap">sem base no real</td>
                  </tr>
                );
              }
              const forte = Math.abs(l.desvio) > 0.02;
              return (
                <tr key={l.k} className={cn("border-t border-border/70", forte && "bg-warning/[0.05]")}>
                  <th scope="row" className="text-left font-normal px-3 py-1.5">{rotuloChave(l.k)}</th>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtBRL(l.proj)}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtBRL(l.real)}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtPct(l.pProj)}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtPct(l.pReal)}</td>
                  <td className={cn(
                    "px-3 py-1.5 text-right font-mono tabular-nums whitespace-nowrap",
                    forte ? (l.desvio > 0 ? "text-danger font-semibold" : "text-success font-semibold") : "text-muted-foreground",
                  )}>
                    {fmtPP(l.pReal, l.pProj)}
                    {forte && <span className="sr-only">{l.desvio > 0 ? " (custo acima do projetado)" : " (custo abaixo do projetado)"}</span>}
                  </td>
                </tr>
              );
            })}
            {linhas.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Sem linhas de custo para o período.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Desvio em pontos percentuais do faturamento: positivo = o custo pesa mais do que a franqueadora projetou.
        {semBase > 0 && ` "Sem base no real": custo que o DRE da unidade não tem cadastrado, por isso fica fora da comparação (${semBase} ${semBase === 1 ? "linha" : "linhas"}).`}
      </p>
    </ChartCard>
  );
}

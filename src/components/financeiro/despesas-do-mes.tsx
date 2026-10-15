"use client";

// Financeiro › DRE Mensal · Despesas lançadas no mês
// Lista as despesas da competência com edição inline (uma linha por vez),
// marcação rápida de paga/em aberto (por linha ou em lote) e exclusão com
// confirmação inline.
// O DRE segue a competência: pago ou aberto não muda o valor no DRE.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Wallet, Pencil, Trash2, Check, X, Loader2, AlertTriangle, Plus, Info, CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { despesasUsadasNoDRE } from "@/lib/financeiro/engine";
import { parseValorBR, formatValorBR } from "@/lib/financeiro/valor-br";
import { todayBRiso } from "@/lib/timezone-br";
import { atualizarDespesa, excluirDespesa, marcarDespesasPagas, type AtualizarDespesaPatch } from "@/lib/financeiro/despesas-actions";
import type { DespesaItem, CategoriaDespesa } from "./financeiro-view";

const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const fmtBRL = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

type Situacao = "paga" | "aberta" | "vencida";
type Draft = { descricao: string; categoria: string; valor: string; vencimento: string; pago: boolean; pago_em: string };
type EstadoLinha = { erro?: string; salvo?: boolean };

export function DespesasDoMes({ unidadeId, ano, mes, despesas, categorias, custos, onLancar }: {
  unidadeId: string;
  ano: number;
  mes: number;
  despesas: DespesaItem[];
  categorias: CategoriaDespesa[];
  /** Custos configurados (mesmo critério de casamento do motor do DRE). */
  custos: Array<{ descricao: string; ativo: boolean; tipo?: string }>;
  onLancar: () => void;
}) {
  const router = useRouter();
  const hoje = todayBRiso();
  const listId = React.useId();

  // Status otimista por id (toggle de paga/em aberto) até as props refletirem o novo valor
  const [otimista, setOtimista] = React.useState<Record<string, "paga" | "aberta">>({});
  // Excluídas (some na hora; a lista nova chega no refresh)
  const [removidas, setRemovidas] = React.useState<Set<string>>(new Set());
  const [despesasPrev, setDespesasPrev] = React.useState(despesas);
  if (despesasPrev !== despesas) {
    setDespesasPrev(despesas);
    const ids = new Set(despesas.map((d) => d.id));
    setOtimista((o) => {
      const n: Record<string, "paga" | "aberta"> = {};
      for (const d of despesas) {
        const v = o[d.id];
        if (v && (v === "paga") !== (d.status === "paga")) n[d.id] = v;
      }
      return n;
    });
    setRemovidas((r) => new Set([...r].filter((id) => ids.has(id))));
  }
  const pagaEfetiva = React.useCallback((d: DespesaItem) => (otimista[d.id] ?? (d.status === "paga" ? "paga" : "aberta")) === "paga", [otimista]);

  const situacao = React.useCallback((d: DespesaItem): Situacao =>
    pagaEfetiva(d) ? "paga" : (d.status === "vencida" || d.vencimento < hoje) ? "vencida" : "aberta", [hoje, pagaEfetiva]);

  const linhas = React.useMemo(
    () => despesas.filter((d) => !removidas.has(d.id))
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.descricao.localeCompare(b.descricao, "pt-BR")),
    [despesas, removidas],
  );

  // Quais despesas entram no DRE — o MESMO casamento do motor (descrição, depois categoria)
  const noDRE = React.useMemo(() => {
    const usadas = despesasUsadasNoDRE(custos, despesas.map((d) => ({ descricao: d.descricao, categoria: d.categoria_nome, valor: d.valor })));
    return new Set(despesas.filter((_, i) => usadas.has(i)).map((d) => d.id));
  }, [custos, despesas]);

  const kpi = React.useMemo(() => {
    let total = 0, pagas = 0, nPagas = 0, abertas = 0, nAbertas = 0, vencidas = 0, nVencidas = 0, entraDRE = 0;
    for (const d of linhas) {
      total += d.valor;
      if (noDRE.has(d.id)) entraDRE += d.valor;
      const s = situacao(d);
      if (s === "paga") { pagas += d.valor; nPagas++; }
      else { abertas += d.valor; nAbertas++; if (s === "vencida") { vencidas += d.valor; nVencidas++; } }
    }
    return { total, pagas, nPagas, abertas, nAbertas, vencidas, nVencidas, entraDRE };
  }, [linhas, noDRE, situacao]);

  const [editId, setEditId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [salvando, setSalvando] = React.useState(false);
  const [alternando, setAlternando] = React.useState<Set<string>>(new Set());
  const [excluirId, setExcluirId] = React.useState<string | null>(null);
  const [excluindo, setExcluindo] = React.useState(false);
  const [estado, setEstado] = React.useState<Record<string, EstadoLinha>>({});
  const [selecionadas, setSelecionadas] = React.useState<Set<string>>(new Set());
  const [emLote, setEmLote] = React.useState(false);
  const [aviso, setAviso] = React.useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const excluirBtn = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const editarBtn = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const lancarBtn = React.useRef<HTMLButtonElement | null>(null);

  // Troca de mês: fecha edição/confirmação abertas
  const chave = `${ano}-${mes}`;
  const [chavePrev, setChavePrev] = React.useState(chave);
  if (chavePrev !== chave) {
    setChavePrev(chave);
    setEditId(null); setDraft(null); setExcluirId(null); setEstado({}); setSelecionadas(new Set()); setAviso(null);
  }

  // Aviso de sucesso some em 3 s
  React.useEffect(() => {
    if (aviso?.tipo !== "ok") return;
    const t = setTimeout(() => setAviso(null), 3000);
    return () => clearTimeout(t);
  }, [aviso]);

  const timers = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  React.useEffect(() => {
    const t = timers.current;
    return () => { for (const id of t.values()) clearTimeout(id); };
  }, []);

  function marcar(id: string, e: EstadoLinha | null) {
    setEstado((s) => {
      const n = { ...s };
      if (e) n[id] = e; else delete n[id];
      return n;
    });
  }
  function marcarSalvo(id: string) {
    marcar(id, { salvo: true });
    const prev = timers.current.get(id);
    if (prev) clearTimeout(prev);
    timers.current.set(id, setTimeout(() => {
      setEstado((s) => {
        if (!s[id]?.salvo) return s;
        const n = { ...s };
        delete n[id];
        return n;
      });
      timers.current.delete(id);
    }, 2000));
  }

  function editar(d: DespesaItem) {
    setExcluirId(null);
    setEditId(d.id);
    setDraft({
      descricao: d.descricao,
      categoria: d.categoria_nome === "Sem categoria" ? "" : d.categoria_nome,
      valor: formatValorBR(d.valor),
      vencimento: d.vencimento,
      pago: d.status === "paga",
      pago_em: d.pago_em ?? hoje,
    });
    marcar(d.id, null);
  }
  function cancelarEdicao() {
    const id = editId;
    if (id) marcar(id, null);
    setEditId(null); setDraft(null);
    if (id) requestAnimationFrame(() => editarBtn.current.get(id)?.focus());
  }
  function cancelarExclusao() {
    const id = excluirId;
    setExcluirId(null);
    if (id) requestAnimationFrame(() => excluirBtn.current.get(id)?.focus());
  }

  const original = editId ? despesas.find((d) => d.id === editId) ?? null : null;
  const draftValor = draft ? parseValorBR(draft.valor) : null;
  /** Só os campos que o usuário alterou — categoria intocada não é reenviada. */
  const patchDraft: AtualizarDespesaPatch = {};
  if (draft && original) {
    const catOrig = original.categoria_nome === "Sem categoria" ? "" : original.categoria_nome;
    if (draft.descricao.trim() !== original.descricao) patchDraft.descricao = draft.descricao.trim();
    if (draftValor !== original.valor) patchDraft.valor = draftValor ?? 0;
    if (draft.categoria.trim() !== catOrig) patchDraft.categoria_nome = draft.categoria.trim() || null;
    if (draft.vencimento !== original.vencimento) patchDraft.vencimento = draft.vencimento;
    const pagoOrig = original.status === "paga";
    if (draft.pago !== pagoOrig || (draft.pago && (draft.pago_em || hoje) !== (original.pago_em ?? hoje))) {
      patchDraft.pago = draft.pago;
      patchDraft.pago_em = draft.pago ? draft.pago_em || hoje : null;
    }
  }
  const draftSujo = Object.keys(patchDraft).length > 0;
  const draftErro = !draft ? null
    : !draft.descricao.trim() ? "Informe a descrição"
    : !(draftValor != null && draftValor > 0) ? "Valor deve ser maior que zero. Use 1.234,56"
    : !draft.vencimento ? "Informe o vencimento"
    : null;

  async function salvarLinha(d: DespesaItem) {
    if (!draft || draftErro || salvando) return;
    setSalvando(true);
    marcar(d.id, null);
    try {
      if (!draftSujo) { cancelarEdicao(); return; }
      const r = await atualizarDespesa(unidadeId, d.id, patchDraft);
      if (!r.ok) { marcar(d.id, { erro: r.erro }); return; }
      setEditId(null); setDraft(null);
      marcarSalvo(d.id);
      router.refresh();
      requestAnimationFrame(() => editarBtn.current.get(d.id)?.focus());
    } catch (e) {
      marcar(d.id, { erro: `Não foi possível salvar. Verifique a conexão. (${e instanceof Error ? e.message : String(e)})` });
    } finally {
      setSalvando(false);
    }
  }

  async function alternarPago(d: DespesaItem) {
    if (alternando.has(d.id)) return;
    const proximo = !pagaEfetiva(d);
    setAlternando((s) => new Set(s).add(d.id));
    setOtimista((o) => ({ ...o, [d.id]: proximo ? "paga" : "aberta" }));
    marcar(d.id, null);
    const desfazer = () => setOtimista((o) => { const n = { ...o }; delete n[d.id]; return n; });
    try {
      const r = await atualizarDespesa(unidadeId, d.id, { pago: proximo });
      if (!r.ok) { desfazer(); marcar(d.id, { erro: r.erro }); return; }
      marcarSalvo(d.id);
      router.refresh();
    } catch (e) {
      desfazer();
      marcar(d.id, { erro: `Não foi possível atualizar. (${e instanceof Error ? e.message : String(e)})` });
    } finally {
      setAlternando((s) => { const n = new Set(s); n.delete(d.id); return n; });
    }
  }

  async function confirmarExclusao(d: DespesaItem) {
    if (excluindo) return;
    setExcluindo(true);
    marcar(d.id, null);
    try {
      const r = await excluirDespesa(unidadeId, d.id);
      if (!r.ok) { marcar(d.id, { erro: r.erro }); return; }
      // Foco vai para a próxima linha (ou a anterior / botão Lançar)
      const pos = linhas.findIndex((x) => x.id === d.id);
      const vizinho = linhas[pos + 1] ?? linhas[pos - 1];
      setRemovidas((s) => new Set(s).add(d.id));
      setSelecionadas((s) => { const n = new Set(s); n.delete(d.id); return n; });
      setExcluirId(null);
      setAviso({ tipo: "ok", texto: `Despesa “${d.descricao}” excluída` });
      router.refresh();
      requestAnimationFrame(() => (vizinho ? editarBtn.current.get(vizinho.id) : lancarBtn.current)?.focus());
    } catch (e) {
      marcar(d.id, { erro: `Não foi possível excluir. (${e instanceof Error ? e.message : String(e)})` });
    } finally {
      setExcluindo(false);
    }
  }

  const emAberto = linhas.filter((d) => !pagaEfetiva(d));
  const selAbertas = [...selecionadas].filter((id) => emAberto.some((d) => d.id === id));
  const todasSel = emAberto.length > 0 && selAbertas.length === emAberto.length;
  function alternarSel(id: string) {
    setSelecionadas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function alternarTodasSel() {
    setSelecionadas(todasSel ? new Set() : new Set(emAberto.map((d) => d.id)));
  }
  async function pagarSelecionadas() {
    if (emLote || selAbertas.length === 0) return;
    setEmLote(true);
    setAviso(null);
    const ids = selAbertas;
    setOtimista((o) => { const n = { ...o }; for (const id of ids) n[id] = "paga"; return n; });
    const desfazer = () => setOtimista((o) => { const n = { ...o }; for (const id of ids) delete n[id]; return n; });
    try {
      const r = await marcarDespesasPagas(unidadeId, ids, true);
      if (!r.ok) { desfazer(); setAviso({ tipo: "erro", texto: r.erro }); return; }
      setSelecionadas(new Set());
      setAviso({ tipo: "ok", texto: `${r.atualizadas} ${r.atualizadas === 1 ? "despesa marcada como paga" : "despesas marcadas como pagas"}` });
      router.refresh();
    } catch (e) {
      desfazer();
      setAviso({ tipo: "erro", texto: `Não foi possível atualizar. Verifique a conexão. (${e instanceof Error ? e.message : String(e)})` });
    } finally {
      setEmLote(false);
    }
  }
  // Edição com alteração não salva trava as ações das outras linhas
  const travado = editId != null && (draftSujo || salvando);

  const rolar = linhas.length > 30;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <div className="font-display font-bold text-[15px] inline-flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-brand-cyan" /> Despesas lançadas · {MESES_PT[mes - 1]}/{ano}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1">
            <Info className="w-3 h-3" /> O DRE considera a competência; a situação de pagamento controla o caixa.
          </div>
        </div>
        <Button ref={lancarBtn} onClick={onLancar} className="ml-auto bg-gradient-to-r from-brand-cyan to-brand-blue text-white">
          <Plus className="w-3.5 h-3.5 mr-1" /> Lançar despesas
        </Button>
      </div>

      {linhas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-5 py-3 border-b border-border">
          <Kpi label="Total do mês" valor={fmtBRL(kpi.total)} hint={`${linhas.length} ${linhas.length === 1 ? "lançamento" : "lançamentos"}`} />
          <Kpi label="Pagas" valor={fmtBRL(kpi.pagas)} hint={`${kpi.nPagas} ${kpi.nPagas === 1 ? "despesa" : "despesas"}`} tone="success" />
          <Kpi label="Em aberto" valor={fmtBRL(kpi.abertas)} tone="warning"
            hint={`${kpi.nAbertas} ${kpi.nAbertas === 1 ? "despesa" : "despesas"}${kpi.nVencidas > 0 ? ` · vencidas ${fmtBRL(kpi.vencidas)}` : ""}`}
            alerta={kpi.nVencidas > 0} />
        </div>
      )}

      {(aviso || selAbertas.length > 0) && (
        <div className="px-5 py-2 border-b border-border flex flex-wrap items-center gap-2 bg-muted/10">
          {selAbertas.length > 0 && (
            <>
              <span className="text-[12px]">{selAbertas.length} {selAbertas.length === 1 ? "selecionada" : "selecionadas"}</span>
              <Button size="sm" onClick={() => void pagarSelecionadas()} disabled={emLote} className="bg-success text-white hover:bg-success/90">
                {emLote ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5 mr-1" />} Marcar selecionadas como pagas
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelecionadas(new Set())} disabled={emLote}>Limpar seleção</Button>
            </>
          )}
          <span role="status" aria-live="polite" className={cn("text-[12px] inline-flex items-center gap-1 ml-auto",
            aviso?.tipo === "erro" ? "text-danger" : "text-success")}>
            {aviso && (aviso.tipo === "ok" ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />)} {aviso?.texto}
          </span>
        </div>
      )}

      {linhas.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <div className="text-[13px] text-muted-foreground">Nenhuma despesa lançada neste mês.</div>
          <Button variant="outline" onClick={onLancar} className="mt-3 border-brand-cyan/40 text-brand-cyan hover:bg-brand-cyan/10">
            <Plus className="w-3.5 h-3.5 mr-1" /> Lançar despesas do mês
          </Button>
        </div>
      ) : (
        <>
          <datalist id={listId}>
            {categorias.map((c) => <option key={c.id} value={c.nome} />)}
          </datalist>
          <div className={cn("overflow-x-auto", rolar && "max-h-[560px] overflow-y-auto custom-scroll-thin")}>
            <table className="w-full text-xs">
              <thead className={cn("bg-card", rolar && "sticky top-0 z-10")}>
                <tr className="text-[9px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="w-8 py-2 pl-3">
                    <input type="checkbox" checked={todasSel} disabled={emAberto.length === 0 || emLote}
                      onChange={alternarTodasSel} aria-label="Selecionar todas em aberto"
                      title={emAberto.length === 0 ? "Todas as despesas já estão pagas" : "Selecionar todas em aberto"}
                      className="w-3.5 h-3.5 accent-[var(--success)] cursor-pointer disabled:cursor-not-allowed" />
                  </th>
                  <th className="text-left py-2 px-3 font-semibold">Descrição</th>
                  <th className="text-left py-2 px-3 font-semibold">Categoria</th>
                  <th className="text-right py-2 px-3 font-semibold">Valor</th>
                  <th className="text-left py-2 px-3 font-semibold">Vencimento</th>
                  <th className="text-left py-2 px-3 font-semibold">Situação</th>
                  <th className="text-right py-2 px-3 font-semibold w-24">Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((d) => {
                  const st = estado[d.id];
                  const emEdicao = editId === d.id && draft != null;
                  const emExclusao = excluirId === d.id;
                  const sit = situacao(d);
                  return (
                    <React.Fragment key={d.id}>
                      {emExclusao ? (
                        <tr className="border-b border-border/40 bg-danger/5"
                          onKeyDown={(e) => { if (e.key === "Escape" && !excluindo) { e.preventDefault(); cancelarExclusao(); } }}>
                          <td colSpan={7} className="py-2 px-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[12px]">Excluir <strong>{d.descricao}</strong> · {fmtBRL(d.valor)}?</span>
                              <span className="ml-auto inline-flex gap-2">
                                <Button size="sm" variant="outline" disabled={excluindo} onClick={cancelarExclusao}>Cancelar</Button>
                                <Button size="sm" autoFocus disabled={excluindo} onClick={() => void confirmarExclusao(d)} className="bg-danger text-white hover:bg-danger/90">
                                  {excluindo ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />} {excluindo ? "Excluindo…" : "Excluir"}
                                </Button>
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : emEdicao ? (
                        <tr className="border-b border-border/40 bg-brand-cyan/5 ring-1 ring-inset ring-brand-cyan/30"
                          onKeyDown={(e) => { if (e.key === "Escape") cancelarEdicao(); if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); void salvarLinha(d); } }}>
                          <td className="py-2 pl-3" />
                          <td className="py-2 px-3">
                            <input value={draft.descricao} autoFocus aria-label="Descrição"
                              onChange={(e) => setDraft({ ...draft, descricao: e.target.value })}
                              className="form-input text-[11px] py-1 w-full min-w-[140px]" />
                          </td>
                          <td className="py-2 px-3">
                            <input value={draft.categoria} list={listId} aria-label="Categoria" placeholder="Categoria"
                              onChange={(e) => setDraft({ ...draft, categoria: e.target.value })}
                              className="form-input text-[11px] py-1 w-36" />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input value={draft.valor} inputMode="decimal" aria-label="Valor"
                              onChange={(e) => setDraft({ ...draft, valor: e.target.value })}
                              className={cn("form-input text-[11px] py-1 w-28 font-mono text-right",
                                !(draftValor != null && draftValor > 0) && "border-danger")} />
                          </td>
                          <td className="py-2 px-3">
                            <input type="date" value={draft.vencimento} aria-label="Vencimento"
                              onChange={(e) => setDraft({ ...draft, vencimento: e.target.value })}
                              className="form-input text-[11px] py-1 w-36 font-mono" />
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex flex-col gap-1">
                              <div className="inline-flex rounded-md border border-border overflow-hidden w-fit">
                                <button type="button" aria-pressed={draft.pago} onClick={() => setDraft({ ...draft, pago: true, pago_em: draft.pago_em || hoje })}
                                  className={cn("px-2 py-1 text-[10px] font-semibold", draft.pago ? "bg-success/20 text-success" : "text-muted-foreground hover:bg-secondary")}>
                                  Paga
                                </button>
                                <button type="button" aria-pressed={!draft.pago} onClick={() => setDraft({ ...draft, pago: false })}
                                  className={cn("px-2 py-1 text-[10px] font-semibold border-l border-border", !draft.pago ? "bg-warning/20 text-warning" : "text-muted-foreground hover:bg-secondary")}>
                                  Em aberto
                                </button>
                              </div>
                              {draft.pago && (
                                <label className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                                  Paga em
                                  <input type="date" value={draft.pago_em} aria-label="Data do pagamento" onChange={(e) => setDraft({ ...draft, pago_em: e.target.value })}
                                    className="form-input text-[10px] py-0.5 w-32 font-mono" />
                                </label>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            <button type="button" onClick={() => void salvarLinha(d)} disabled={!!draftErro || salvando}
                              aria-label="Salvar alterações" title={draftErro ?? (draftSujo ? "Salvar (Enter)" : "Nada alterado")}
                              className="w-7 h-7 inline-flex items-center justify-center rounded text-success hover:bg-success/10 disabled:opacity-40 disabled:cursor-not-allowed">
                              {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button type="button" onClick={cancelarEdicao} disabled={salvando} aria-label="Cancelar edição" title="Cancelar"
                              className="w-7 h-7 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-secondary">
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ) : (
                        <tr className={cn("border-b border-border/40 hover:bg-muted/20", st?.salvo && "bg-success/5", selecionadas.has(d.id) && "bg-success/[0.04]")}>
                          <td className="py-2 pl-3">
                            {sit !== "paga" && (
                              <input type="checkbox" checked={selecionadas.has(d.id)} disabled={emLote}
                                onChange={() => alternarSel(d.id)} aria-label={`Selecionar ${d.descricao}`}
                                className="w-3.5 h-3.5 accent-[var(--success)] cursor-pointer" />
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-medium">{d.descricao}</span>
                              {!noDRE.has(d.id) && (
                                <span title="Não casa com nenhum custo configurado; não entra no DRE"
                                  className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-muted text-muted-foreground border border-border cursor-help">
                                  Fora do DRE
                                </span>
                              )}
                              {st?.salvo && (
                                <span className="text-[10px] text-success inline-flex items-center gap-0.5"><Check className="w-3 h-3" /> Salvo</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{d.categoria_nome}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">{fmtBRL(d.valor)}</td>
                          <td className="py-2 px-3 font-mono">{ddmm(d.vencimento)}</td>
                          <td className="py-2 px-3">
                            <PilulaSituacao situacao={sit} carregando={alternando.has(d.id) || (emLote && selAbertas.includes(d.id))}
                              onClick={() => void alternarPago(d)} />
                          </td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            <button type="button" onClick={() => editar(d)} disabled={travado}
                              ref={(el) => { if (el) editarBtn.current.set(d.id, el); else editarBtn.current.delete(d.id); }}
                              aria-label={`Editar ${d.descricao}`} title={travado ? "Salve ou cancele a edição em andamento" : "Editar"}
                              className="w-7 h-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-brand-cyan hover:bg-brand-cyan/10 disabled:opacity-40 disabled:cursor-not-allowed">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => { if (editId) { marcar(editId, null); setEditId(null); setDraft(null); } setExcluirId(d.id); }}
                              disabled={travado}
                              ref={(el) => { if (el) excluirBtn.current.set(d.id, el); else excluirBtn.current.delete(d.id); }}
                              aria-label={`Excluir ${d.descricao}`} title={travado ? "Salve ou cancele a edição em andamento" : "Excluir"}
                              className="w-7 h-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-danger hover:bg-danger/10 disabled:opacity-40 disabled:cursor-not-allowed">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      )}
                      {(st?.erro || (emEdicao && draftErro)) && (
                        <tr className="border-b border-border/40">
                          <td colSpan={7} className="px-3 pb-2 pt-0 text-[11px] text-danger">
                            <span className="inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {st?.erro ?? draftErro}</span>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2.5 border-t border-border flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-[12px]">
            <span>Total do mês <strong className="font-mono">{fmtBRL(kpi.total)}</strong></span>
            <span className="text-muted-foreground">·</span>
            <span title="Soma das despesas que casam com um custo configurado — são as linhas marcadas como real no DRE">
              Entra no DRE <strong className="font-mono text-success">{fmtBRL(kpi.entraDRE)}</strong>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, valor, hint, tone, alerta }: { label: string; valor: string; hint?: string; tone?: "success" | "warning"; alerta?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-muted/10 px-3 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={cn("font-mono tabular-nums text-[15px] font-bold mt-0.5",
        tone === "success" && "text-success", tone === "warning" && "text-warning")}>{valor}</div>
      {hint && (
        <div className={cn("text-[10px] mt-0.5 inline-flex items-center gap-1", alerta ? "text-danger" : "text-muted-foreground")}>
          {alerta && <AlertTriangle className="w-3 h-3" />} {hint}
        </div>
      )}
    </div>
  );
}

function PilulaSituacao({ situacao, carregando, onClick }: { situacao: Situacao; carregando: boolean; onClick: () => void }) {
  const cfg = situacao === "paga"
    ? { label: "Paga", cls: "bg-success/15 text-success border-success/30", acao: "Marcar como em aberto" }
    : situacao === "vencida"
      ? { label: "Vencida", cls: "bg-danger/15 text-danger border-danger/30", acao: "Marcar como paga" }
      : { label: "Em aberto", cls: "bg-warning/15 text-warning border-warning/30", acao: "Marcar como paga" };
  return (
    <button type="button" onClick={onClick} disabled={carregando} title={cfg.acao} aria-label={cfg.acao}
      className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider transition-smooth hover:brightness-110 disabled:opacity-70", cfg.cls)}>
      {carregando && <Loader2 className="w-3 h-3 animate-spin" />}
      {cfg.label}
    </button>
  );
}

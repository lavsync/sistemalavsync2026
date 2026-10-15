"use client";

// Financeiro › DRE Mensal · Diálogo "Lançar despesas do mês"
// Linhas: custos configurados (valor lançado, senão o projetado do motor do DRE),
// despesas avulsas do mês e novas avulsas. Marca o que já foi pago e salva só o
// que mudou ou ainda não foi lançado. O pai remonta o diálogo a cada abertura
// (key), então o estado sempre nasce dos lançamentos atuais.

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Wallet, X, Loader2, Save, Check, Plus, AlertTriangle, CheckCheck, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { normDesc, nomeCategoriaFinanceira, type CustoFixo, type CustoVariavel } from "@/lib/financeiro/engine";
import { parseValorBR, formatValorBR } from "@/lib/financeiro/valor-br";
import { lancarDespesasLote, type LancarDespesaItem } from "@/lib/financeiro/despesas-actions";
import type { DespesaItem, CategoriaDespesa } from "./financeiro-view";

const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const fmtBRL = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Origem = "fixo" | "variavel" | "avulsa" | "nova";
type Item = {
  key: string;
  origem: Origem;
  descricao: string;
  categoria: string;
  valor: string;
  vencimento: string;
  pago: boolean;
  /** pago_em gravado (preservado se continuar pago) */
  pago_em: string | null;
  despesa_id: string | null;
  projetado: number | null;
  /** > 1 = há N lançamentos para o mesmo custo; linha fica fora do lote */
  duplicadas: number;
};
type Snap = { descricao: string; categoria: string; valor: number | null; vencimento: string; pago: boolean };

const snap = (i: Item): Snap => ({
  descricao: i.descricao.trim(), categoria: i.categoria.trim(), valor: parseValorBR(i.valor), vencimento: i.vencimento, pago: i.pago,
});
const igual = (a: Snap, b: Snap) =>
  a.descricao === b.descricao && a.categoria === b.categoria && a.valor === b.valor && a.vencimento === b.vencimento && a.pago === b.pago;

function montarItens(
  ano: number, mes: number,
  custosFixos: CustoFixo[], custosVariaveis: CustoVariavel[],
  projetadoPorDescricao: Record<string, number>, despesasDoMes: DespesaItem[],
): Item[] {
  const venc05 = `${ano}-${String(mes).padStart(2, "0")}-05`;
  const out: Item[] = [];
  const consumidas = new Set<string>();
  const custos: Array<{ id: string; descricao: string; origem: "fixo" | "variavel" }> = [
    ...custosFixos.filter((c) => c.ativo).map((c) => ({ id: c.id, descricao: c.descricao, origem: "fixo" as const })),
    ...custosVariaveis.filter((c) => c.ativo && c.tipo !== "simples").map((c) => ({ id: c.id, descricao: c.descricao, origem: "variavel" as const })),
  ];
  for (const c of custos) {
    const n = normDesc(c.descricao);
    const matches = despesasDoMes.filter((d) => normDesc(d.descricao) === n);
    matches.forEach((d) => consumidas.add(d.id));
    const projetado = projetadoPorDescricao[c.descricao] ?? 0;
    const catPadrao = nomeCategoriaFinanceira(c.descricao);
    if (matches.length === 1) {
      const d = matches[0];
      out.push({
        key: `${c.origem}-${c.id}`, origem: c.origem, descricao: c.descricao,
        categoria: d.categoria_nome && d.categoria_nome !== "Sem categoria" ? d.categoria_nome : catPadrao,
        valor: formatValorBR(d.valor), vencimento: d.vencimento,
        pago: d.status === "paga", pago_em: d.pago_em, despesa_id: d.id, projetado, duplicadas: 1,
      });
    } else if (matches.length > 1) {
      out.push({
        key: `${c.origem}-${c.id}`, origem: c.origem, descricao: c.descricao, categoria: matches[0].categoria_nome,
        valor: formatValorBR(matches.reduce((s, d) => s + d.valor, 0)), vencimento: matches[0].vencimento,
        pago: matches.every((d) => d.status === "paga"), pago_em: null, despesa_id: null, projetado, duplicadas: matches.length,
      });
    } else {
      out.push({
        key: `${c.origem}-${c.id}`, origem: c.origem, descricao: c.descricao, categoria: catPadrao,
        valor: projetado > 0 ? formatValorBR(projetado) : "", vencimento: venc05,
        pago: false, pago_em: null, despesa_id: null, projetado, duplicadas: 0,
      });
    }
  }
  for (const d of despesasDoMes) {
    if (consumidas.has(d.id)) continue;
    out.push({
      key: `avulsa-${d.id}`, origem: "avulsa", descricao: d.descricao,
      categoria: d.categoria_nome === "Sem categoria" ? "" : d.categoria_nome,
      valor: formatValorBR(d.valor), vencimento: d.vencimento,
      pago: d.status === "paga", pago_em: d.pago_em, despesa_id: d.id, projetado: null, duplicadas: 1,
    });
  }
  return out;
}

export function LancarDespesasDialog({
  open,
  onOpenChange,
  unidadeId,
  unidadeNome,
  ano,
  mes,
  custosFixos,
  custosVariaveis,
  projetadoPorDescricao,
  despesasDoMes,
  categorias,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unidadeId: string;
  unidadeNome: string;
  ano: number;
  mes: number;
  custosFixos: CustoFixo[];
  custosVariaveis: CustoVariavel[];
  /** Projetado do motor do DRE (sem valores pagos) por descrição do custo. */
  projetadoPorDescricao: Record<string, number>;
  despesasDoMes: DespesaItem[];
  categorias: CategoriaDespesa[];
}) {
  const router = useRouter();
  const listId = React.useId();
  const [itens, setItens] = React.useState<Item[]>(() =>
    montarItens(ano, mes, custosFixos, custosVariaveis, projetadoPorDescricao, despesasDoMes));
  const [base, setBase] = React.useState<Record<string, Snap>>(() =>
    Object.fromEntries(itens.map((i) => [i.key, snap(i)])));
  const [saving, setSaving] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [falhas, setFalhas] = React.useState<Record<string, string>>({});
  const [done, setDone] = React.useState<{ total: number; inseridas: number; atualizadas: number } | null>(null);
  const [confirmDescartar, setConfirmDescartar] = React.useState(false);
  const novaSeq = React.useRef(0);
  const fecharTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (fecharTimer.current) clearTimeout(fecharTimer.current); }, []);

  // ── Estado derivado ──
  const editaveis = itens.filter((i) => i.duplicadas <= 1);
  const linhas = itens.map((i) => {
    const v = parseValorBR(i.valor);
    const vazio = i.valor.trim() === "";
    const lancada = i.despesa_id != null;
    // Linha nunca lançada com valor vazio/zero = "não lançar" (não é erro)
    const pulada = !lancada && (vazio || v === 0);
    const invalida = i.duplicadas <= 1 && !pulada && !(v != null && v > 0);
    const semDescricao = i.duplicadas <= 1 && !pulada && !i.descricao.trim();
    const b = base[i.key];
    const editada = !b || !igual(snap(i), b);
    const pendente = i.duplicadas <= 1 && !pulada && !invalida && !semDescricao && (editada || !lancada);
    return { item: i, v, pulada, invalida, semDescricao, editada, pendente };
  });
  const pendentes = linhas.filter((l) => l.pendente);
  const temInvalida = linhas.some((l) => l.invalida || l.semDescricao);
  const editadasUsuario = linhas.filter((l) => l.editada && !(l.item.origem === "nova" && !l.item.descricao.trim() && !l.item.valor.trim())).length;
  const nPagas = editaveis.filter((i) => i.pago).length;
  const total = linhas.reduce((s, l) => s + (l.item.duplicadas <= 1 && l.v ? l.v : 0), 0);
  const projetadoTotal = itens.reduce((s, i) => s + (i.projetado ?? 0), 0);
  const pagasTotal = linhas.reduce((s, l) => s + (l.item.pago && l.item.duplicadas <= 1 && l.v ? l.v : 0), 0);

  function alterar(key: string, patch: Partial<Item>) {
    setItens((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
    setConfirmDescartar(false);
    setErro(null);
    if (falhas[key]) setFalhas((f) => { const n = { ...f }; delete n[key]; return n; });
  }
  function marcarTodas(pago: boolean) {
    setItens((xs) => xs.map((x) => (x.duplicadas <= 1 ? { ...x, pago } : x)));
    setConfirmDescartar(false);
  }
  function adicionarAvulsa() {
    const key = `nova-${++novaSeq.current}`;
    setItens((xs) => [...xs, {
      key, origem: "nova", descricao: "", categoria: "", valor: "",
      vencimento: `${ano}-${String(mes).padStart(2, "0")}-05`,
      pago: false, pago_em: null, despesa_id: null, projetado: null, duplicadas: 0,
    }]);
  }
  function removerNova(key: string) {
    setItens((xs) => xs.filter((x) => x.key !== key));
    setFalhas((f) => { const n = { ...f }; delete n[key]; return n; });
  }

  function pedirFechar() {
    if (saving) return;
    if (!done && editadasUsuario > 0) { setConfirmDescartar(true); return; }
    onOpenChange(false);
  }

  async function salvar() {
    if (saving || pendentes.length === 0 || temInvalida) return;
    setSaving(true);
    setErro(null);
    setFalhas({});
    setDone(null);
    const envio = pendentes.map((l) => l.item);
    const lote: LancarDespesaItem[] = envio.map((i) => ({
      despesa_id: i.despesa_id,
      descricao: i.descricao.trim(),
      valor: parseValorBR(i.valor)!,
      vencimento: i.vencimento,
      categoria_nome: i.categoria.trim() || null,
      pago: i.pago,
      pago_em: i.pago ? i.pago_em : null,
    }));
    try {
      const r = await lancarDespesasLote(unidadeId, `${ano}-${String(mes).padStart(2, "0")}`, lote);
      if (!r.ok) { setErro(r.erro); return; }
      // Linhas salvas ganham o id (nova tentativa não duplica) e viram a nova base
      const salvas = new Map<string, string>();
      envio.forEach((i, idx) => { if (r.ids[idx]) salvas.set(i.key, r.ids[idx]); });
      const proximos = itens.map((x) => (salvas.has(x.key) ? { ...x, despesa_id: salvas.get(x.key)! } : x));
      setItens(proximos);
      setBase((b) => {
        const n = { ...b };
        for (const x of proximos) if (salvas.has(x.key)) n[x.key] = snap(x);
        return n;
      });
      const f: Record<string, string> = {};
      for (const fa of r.falhas) { const it = envio[fa.indice]; if (it) f[it.key] = fa.erro; }
      setFalhas(f);
      if (salvas.size > 0) router.refresh();
      if (r.falhas.length === 0) {
        setDone({ total: salvas.size, inseridas: r.inseridas, atualizadas: r.atualizadas });
        fecharTimer.current = setTimeout(() => onOpenChange(false), 1200);
      } else {
        setErro(`${r.falhas.length} ${r.falhas.length === 1 ? "despesa não foi salva" : "despesas não foram salvas"}${salvas.size > 0 ? ` · ${salvas.size} ${salvas.size === 1 ? "salva" : "salvas"}` : ""}. Corrija as linhas em vermelho e tente de novo.`);
      }
    } catch (e) {
      setErro(`Não foi possível salvar. Verifique a conexão e tente de novo. (${e instanceof Error ? e.message : String(e)})`);
    } finally {
      setSaving(false);
    }
  }

  const n = pendentes.length;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => (v ? onOpenChange(true) : pedirFechar())}>
      <Dialog.Portal>
        <AnimatePresence>
          {open && (
            <>
              <Dialog.Overlay asChild forceMount>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="fixed left-[50%] top-[50%] z-50 w-[min(96vw,980px)] max-h-[90vh] translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-border bg-popover shadow-2xl flex flex-col overflow-hidden">

                  <header className="px-5 py-4 border-b border-border flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-cyan/15 border border-brand-cyan/30 flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-brand-cyan" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Dialog.Title className="font-display font-bold text-[15px]">
                        Lançar despesas · {MESES_PT[mes - 1]}/{ano}
                      </Dialog.Title>
                      <Dialog.Description className="text-[12px] text-muted-foreground">
                        Unidade {unidadeNome} · confira os valores, marque o que já foi pago e salve
                      </Dialog.Description>
                    </div>
                    <button type="button" onClick={pedirFechar} aria-label="Fechar"
                      className="w-8 h-8 rounded hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4" /></button>
                  </header>

                  {itens.length > 0 && (
                    <div className="px-5 py-2 border-b border-border flex flex-wrap items-center gap-2 bg-muted/10">
                      <Button size="sm" variant="outline" onClick={() => marcarTodas(true)} disabled={saving}>
                        <CheckCheck className="w-3.5 h-3.5 mr-1" /> Marcar todas como pagas
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => marcarTodas(false)} disabled={saving}>
                        <Square className="w-3.5 h-3.5 mr-1" /> Desmarcar todas
                      </Button>
                      <span className="ml-auto text-[11px] text-muted-foreground font-mono">
                        {nPagas} de {editaveis.length} pagas
                      </span>
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto px-5 py-3 custom-scroll-thin">
                    <datalist id={listId}>
                      {categorias.map((c) => <option key={c.id} value={c.nome} />)}
                    </datalist>
                    {itens.length === 0 ? (
                      <div className="text-center py-8 text-[12px] text-muted-foreground">
                        Nenhum custo configurado nesta unidade. Configure custos fixos e variáveis em Configurações ou adicione uma despesa avulsa.
                      </div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-popover z-10">
                          <tr className="text-[9px] uppercase tracking-wider text-muted-foreground border-b border-border">
                            <th className="text-left py-2 px-2 font-semibold">Descrição</th>
                            <th className="text-left py-2 px-2 font-semibold">Categoria</th>
                            <th className="text-right py-2 px-2 font-semibold">Valor</th>
                            <th className="text-left py-2 px-2 font-semibold">Vencimento</th>
                            <th className="text-center py-2 px-2 font-semibold w-14">Pago</th>
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {linhas.map(({ item: it, invalida, semDescricao, pulada, editada }) => {
                            const bloqueada = it.duplicadas > 1;
                            const falha = falhas[it.key];
                            const descEditavel = it.origem === "avulsa" || it.origem === "nova";
                            return (
                              <React.Fragment key={it.key}>
                                <tr className={cn("border-b border-border/40",
                                  falha && "bg-danger/5 outline outline-1 -outline-offset-1 outline-danger/60",
                                  bloqueada && "opacity-70",
                                  !falha && editada && !bloqueada && "bg-brand-cyan/[0.04]")}>
                                  <td className="py-2 px-2 align-top">
                                    {descEditavel ? (
                                      <input value={it.descricao} placeholder="Ex.: Gás" aria-label="Descrição" disabled={saving}
                                        autoFocus={it.origem === "nova" && !it.descricao}
                                        onChange={(e) => alterar(it.key, { descricao: e.target.value })}
                                        className={cn("form-input text-[11px] py-1 w-full min-w-[120px]", semDescricao && "border-danger")} />
                                    ) : (
                                      <div className="font-medium">{it.descricao}</div>
                                    )}
                                    <div className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1">
                                      {it.origem === "avulsa" || it.origem === "nova" ? (
                                        <span className="px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-muted border border-border">Avulsa</span>
                                      ) : (
                                        <span>{it.origem === "fixo" ? "Fixo" : "Variável"} · projetado {fmtBRL(it.projetado ?? 0)}</span>
                                      )}
                                      {it.despesa_id && !bloqueada && <span className="text-success">· lançada</span>}
                                      {pulada && <span>· não será lançada</span>}
                                    </div>
                                  </td>
                                  {bloqueada ? (
                                    <td colSpan={4} className="py-2 px-2 align-top text-[11px] text-warning">
                                      <span className="inline-flex items-start gap-1">
                                        <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                                        Há {it.duplicadas} lançamentos para este custo ({it.valor}). Ajuste na lista Despesas lançadas.
                                      </span>
                                    </td>
                                  ) : (
                                    <>
                                      <td className="py-2 px-2 align-top">
                                        <input value={it.categoria} list={listId} aria-label="Categoria" disabled={saving}
                                          placeholder={nomeCategoriaFinanceira(it.descricao || "-")}
                                          onChange={(e) => alterar(it.key, { categoria: e.target.value })}
                                          className="form-input text-[11px] py-1 w-36" />
                                      </td>
                                      <td className="py-2 px-2 text-right align-top">
                                        <input value={it.valor} inputMode="decimal" placeholder="0,00" aria-label="Valor" disabled={saving}
                                          aria-invalid={invalida || undefined}
                                          onChange={(e) => alterar(it.key, { valor: e.target.value })}
                                          className={cn("form-input text-[11px] py-1 w-28 font-mono text-right", invalida && "border-danger")} />
                                        {invalida && <div className="text-[10px] text-danger mt-0.5">Use 1.234,56</div>}
                                      </td>
                                      <td className="py-2 px-2 align-top">
                                        <input type="date" value={it.vencimento} aria-label="Vencimento" disabled={saving}
                                          onChange={(e) => alterar(it.key, { vencimento: e.target.value })}
                                          className="form-input text-[11px] py-1 w-36 font-mono" />
                                      </td>
                                      <td className="py-2 px-2 text-center align-top">
                                        <input type="checkbox" checked={it.pago} aria-label={`Pago: ${it.descricao || "despesa avulsa"}`} disabled={saving}
                                          onChange={(e) => alterar(it.key, { pago: e.target.checked })}
                                          className="w-4 h-4 mt-1 accent-[var(--success)] cursor-pointer" />
                                      </td>
                                    </>
                                  )}
                                  <td className="py-2 px-1 text-center align-top">
                                    {it.origem === "nova" && !it.despesa_id && (
                                      <button type="button" onClick={() => removerNova(it.key)} aria-label="Remover linha" disabled={saving}
                                        className="w-6 h-6 mt-0.5 inline-flex items-center justify-center rounded text-muted-foreground hover:text-danger hover:bg-danger/10">
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                                {falha && (
                                  <tr>
                                    <td colSpan={6} className="px-2 pb-2 text-[11px] text-danger">
                                      <span className="inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {falha}</span>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                    <button type="button" onClick={adicionarAvulsa} disabled={saving}
                      className="mt-2 w-full px-2 py-2 text-left text-[12px] text-brand-cyan font-semibold hover:bg-brand-cyan/5 rounded inline-flex items-center gap-1">
                      <Plus className="w-4 h-4" /> Adicionar despesa avulsa
                    </button>
                  </div>

                  {/* Rodapé sempre visível */}
                  <footer className="sticky bottom-0 border-t border-border bg-popover">
                    {done && (
                      <div role="status" className="px-5 py-2 bg-success/15 text-success text-[12px] font-semibold inline-flex w-full items-center gap-1.5">
                        <Check className="w-4 h-4" /> {done.total} {done.total === 1 ? "despesa salva" : "despesas salvas"} ({done.inseridas} {done.inseridas === 1 ? "nova" : "novas"}, {done.atualizadas} {done.atualizadas === 1 ? "atualizada" : "atualizadas"})
                      </div>
                    )}
                    {erro && (
                      <div role="alert" className="px-5 py-2 bg-danger/15 text-danger text-[12px] font-semibold inline-flex w-full items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 shrink-0" /> {erro}
                      </div>
                    )}
                    <div className="px-5 py-3 flex flex-wrap items-center gap-3">
                      <div className="text-[11px] text-muted-foreground font-mono flex flex-wrap gap-x-2">
                        <span>Total a lançar <strong className="text-foreground">{fmtBRL(total)}</strong></span>
                        <span>·</span>
                        <span>Projetado {fmtBRL(projetadoTotal)}</span>
                        <span>·</span>
                        <span>Pagas <strong className="text-success">{fmtBRL(pagasTotal)}</strong></span>
                      </div>
                      <div className="ml-auto flex flex-wrap items-center gap-2">
                        {confirmDescartar ? (
                          <>
                            <span className="text-[12px]">Descartar {editadasUsuario} {editadasUsuario === 1 ? "alteração" : "alterações"}?</span>
                            <Button variant="outline" onClick={() => setConfirmDescartar(false)}>Continuar editando</Button>
                            <Button onClick={() => onOpenChange(false)} className="bg-danger text-white hover:bg-danger/90">Descartar</Button>
                          </>
                        ) : (
                          <>
                            <Button variant="outline" onClick={pedirFechar} disabled={saving}>Cancelar</Button>
                            <Button onClick={salvar} disabled={saving || n === 0 || temInvalida || !!done}
                              title={temInvalida ? "Corrija os valores em vermelho" : n === 0 ? "Nenhuma alteração para salvar" : undefined}
                              className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white">
                              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                              Salvar despesas ({n} {n === 1 ? "alteração" : "alterações"})
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </footer>
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

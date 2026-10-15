"use client";

// Financeiro › Configurações · Custo variável lançado pelo valor pago (R$).
// O operador escolhe o mês e informa só o valor; faturamento, % do mês,
// categoria, competência e o novo % de referência são preenchidos sozinhos.

import * as React from "react";
import { Banknote, Loader2, Save, Check, X, AlertTriangle, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { normDesc, nomeCategoriaFinanceira, type CustoVariavel } from "@/lib/financeiro/engine";
import type { LancamentoMes } from "@/lib/financeiro/queries";
import { lancarCustoVariavelReal, removerCustoVariavelReal } from "@/lib/financeiro/custo-real-actions";
import type { DespesaItem } from "./financeiro-view";
import { parseValorBR } from "@/lib/financeiro/valor-br";
import { nowBR } from "@/lib/timezone-br";

const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const fmtBRL = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const chaveMes = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}`;
const rotuloMes = (k: string) => { const [a, m] = k.split("-").map(Number); return `${MESES_PT[m - 1]}/${a}`; };

const NOVO = "__novo__";
const TIPOS = [
  { v: "variavel", l: "Custo variável" },
  { v: "csp", l: "Custo do serviço (CSP)" },
  { v: "royalties", l: "Royalties" },
] as const;

export function CustoVariavelReal({ unidadeId, custos, lancamentos, despesasPorMes }: {
  unidadeId: string;
  custos: CustoVariavel[];
  lancamentos: LancamentoMes[];
  despesasPorMes: Record<string, DespesaItem[]>;
}) {
  const custosLancaveis = custos.filter((c) => c.tipo !== "simples");

  // Meses com faturamento real, do mais recente pro mais antigo
  const fatPorMes = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lancamentos) if (l.faturamento_real != null && l.faturamento_real > 0) m.set(chaveMes(l.ano, l.mes), l.faturamento_real);
    return m;
  }, [lancamentos]);
  const meses = React.useMemo(() => [...fatPorMes.keys()].sort().reverse(), [fatPorMes]);

  // Default = último mês FECHADO (o mês corrente ainda está em aberto)
  const hoje = nowBR();
  const atual = chaveMes(hoje.ano, hoje.mes);
  const [mes, setMes] = React.useState(meses.find((k) => k < atual) ?? meses[0] ?? "");
  const [custoSel, setCustoSel] = React.useState(custosLancaveis.find((c) => c.tipo === "variavel")?.id ?? NOVO);
  const [novoNome, setNovoNome] = React.useState("");
  const [novoTipo, setNovoTipo] = React.useState<"variavel" | "csp" | "royalties">("variavel");
  const [valor, setValor] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const custo = custosLancaveis.find((c) => c.id === custoSel) ?? null;
  const descricao = custo ? custo.descricao : novoNome.trim();
  const fatMes = fatPorMes.get(mes) ?? 0;
  const v = parseValorBR(valor) ?? 0;
  const pctMes = fatMes > 0 && v > 0 ? (v / fatMes) * 100 : null;

  // Valores pagos já lançados por custo (descrição normalizada → mês → R$)
  const pagosPorCusto = React.useMemo(() => {
    const m = new Map<string, Map<string, { valor: number; ids: string[] }>>();
    for (const [k, itens] of Object.entries(despesasPorMes)) {
      for (const d of itens) {
        const n = normDesc(d.descricao);
        if (!custosLancaveis.some((c) => normDesc(c.descricao) === n)) continue;
        if (!m.has(n)) m.set(n, new Map());
        const cur = m.get(n)!.get(k) ?? { valor: 0, ids: [] };
        cur.valor += d.valor; cur.ids.push(d.id);
        m.get(n)!.set(k, cur);
      }
    }
    return m;
  }, [despesasPorMes, custosLancaveis]);

  // Novo % de referência = soma paga ÷ soma do faturamento dos meses lançados (com este valor)
  const pctRecalibrado = React.useMemo(() => {
    if (!descricao || !(v > 0) || fatMes <= 0) return null;
    const hist = new Map(pagosPorCusto.get(normDesc(descricao)) ?? []);
    hist.set(mes, { valor: v, ids: [] });
    let pago = 0, fat = 0;
    for (const [k, h] of hist) { const f = fatPorMes.get(k); if (f && f > 0) { pago += h.valor; fat += f; } }
    return fat > 0 ? { pct: (pago / fat) * 100, meses: [...hist.keys()].filter((k) => (fatPorMes.get(k) ?? 0) > 0).length } : null;
  }, [descricao, v, fatMes, mes, pagosPorCusto, fatPorMes]);

  const jaLancado = descricao ? pagosPorCusto.get(normDesc(descricao))?.get(mes)?.valor ?? null : null;

  async function salvar() {
    setMsg(null);
    if (!mes) { setMsg({ tipo: "erro", texto: "Nenhum mês com faturamento real." }); return; }
    if (!descricao) { setMsg({ tipo: "erro", texto: "Dê um nome ao novo custo." }); return; }
    if (!(v > 0)) { setMsg({ tipo: "erro", texto: "Informe o valor pago." }); return; }
    setSaving(true);
    const [ano, m] = mes.split("-").map(Number);
    const r = await lancarCustoVariavelReal({
      unidade_id: unidadeId, ano, mes: m, valor: v,
      ...(custo ? { custo_id: custo.id } : { novo: { descricao, tipo: novoTipo } }),
    });
    setSaving(false);
    if (!r.ok) { setMsg({ tipo: "erro", texto: r.erro }); return; }
    setMsg({
      tipo: "ok",
      texto: `${descricao} · ${rotuloMes(mes)}: ${fmtBRL(v)} = ${fmtPct(r.percentual_mes)} do faturamento.`
        + (r.percentual_recalibrado != null ? ` % de referência atualizado para ${fmtPct(r.percentual_recalibrado)} (${r.meses_base} ${r.meses_base === 1 ? "mês" : "meses"} reais).` : ""),
    });
    setValor("");
    if (!custo) { setNovoNome(""); setCustoSel(r.custo_id); }
  }

  async function remover(custoId: string, ids: string[]) {
    if (!confirm("Remover este valor pago? O mês volta a usar o % de referência.")) return;
    for (const id of ids) await removerCustoVariavelReal(unidadeId, id, custoId);
  }

  // Histórico: linhas (custo × mês) com valor pago
  const historico = React.useMemo(() => {
    const out: Array<{ custo: CustoVariavel; mes: string; valor: number; ids: string[]; fat: number }> = [];
    for (const c of custosLancaveis) {
      const h = pagosPorCusto.get(normDesc(c.descricao));
      if (!h) continue;
      for (const [k, x] of h) out.push({ custo: c, mes: k, valor: x.valor, ids: x.ids, fat: fatPorMes.get(k) ?? 0 });
    }
    return out.sort((a, b) => b.mes.localeCompare(a.mes) || a.custo.descricao.localeCompare(b.custo.descricao));
  }, [custosLancaveis, pagosPorCusto, fatPorMes]);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <div className="font-display font-bold inline-flex items-center gap-1.5">
          <Banknote className="w-4 h-4 text-brand-cyan" /> Lançar custo variável pelo valor pago (R$)
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          Informe só o valor pago no mês. O DRE daquele mês passa a usar o valor real, e o % do custo se reajusta pela média dos meses pagos.
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-3">
        <Campo label="Mês de competência">
          <select value={mes} onChange={(e) => setMes(e.target.value)} className="form-input font-mono">
            {meses.length === 0 && <option value="">Sem faturamento real</option>}
            {meses.map((k) => <option key={k} value={k}>{rotuloMes(k)}{k === atual ? " (em aberto)" : ""}</option>)}
          </select>
        </Campo>
        <Campo label="Custo">
          <select value={custoSel} onChange={(e) => setCustoSel(e.target.value)} className="form-input">
            {custosLancaveis.map((c) => <option key={c.id} value={c.id}>{c.descricao}</option>)}
            <option value={NOVO}>+ Novo custo variável</option>
          </select>
        </Campo>
        {custoSel === NOVO ? (
          <>
            <Campo label="Nome do novo custo">
              <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex.: Gás, Tarifa Pix" className="form-input" />
            </Campo>
            <Campo label="Tipo">
              <select value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as typeof novoTipo)} className="form-input">
                {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </Campo>
          </>
        ) : (
          <div className="md:col-span-2" />
        )}
        <Campo label="Valor pago no mês (R$)">
          <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" inputMode="decimal"
            onKeyDown={(e) => { if (e.key === "Enter") salvar(); }}
            className="form-input font-mono text-right" />
        </Campo>

        {/* Campos preenchidos automaticamente */}
        <Auto label="Faturamento do mês" valor={fatMes > 0 ? fmtBRL(fatMes) : "—"} />
        <Auto label="% do faturamento no mês" valor={pctMes != null ? fmtPct(pctMes) : "—"} destaque />
        <Auto label="Novo % de referência"
          valor={pctRecalibrado ? `${fmtPct(pctRecalibrado.pct)}` : "—"}
          hint={pctRecalibrado ? `média de ${pctRecalibrado.meses} ${pctRecalibrado.meses === 1 ? "mês" : "meses"} pagos · era ${custo?.percentual_faturamento != null ? fmtPct(custo.percentual_faturamento) : "—"}` : undefined} />
        <Auto label="Categoria · competência"
          valor={descricao ? nomeCategoriaFinanceira(descricao) : "—"}
          hint={mes ? `${rotuloMes(mes)} · status paga` : undefined} />
      </div>

      <div className="px-5 pb-4 flex flex-wrap items-center gap-3">
        <Button onClick={salvar} disabled={saving || meses.length === 0} className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white">
          {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
          {jaLancado != null ? "Atualizar valor pago" : "Lançar valor pago"}
        </Button>
        {jaLancado != null && (
          <span className="text-[11px] text-warning inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Já existe {fmtBRL(jaLancado)} lançado neste mês — será substituído.
          </span>
        )}
        {msg && (
          <span className={cn("text-[11px] inline-flex items-center gap-1", msg.tipo === "ok" ? "text-success" : "text-danger")}>
            {msg.tipo === "ok" ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />} {msg.texto}
          </span>
        )}
      </div>

      {historico.length > 0 && (
        <div className="border-t border-border">
          <div className="px-5 pt-3 pb-1 text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground inline-flex items-center gap-1.5">
            <History className="w-3 h-3" /> Valores pagos lançados
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-[9px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/20">
                <th className="text-left py-2 px-3 font-semibold">Mês</th>
                <th className="text-left py-2 px-3 font-semibold">Custo</th>
                <th className="text-right py-2 px-3 font-semibold">Valor pago</th>
                <th className="text-right py-2 px-3 font-semibold">Faturamento</th>
                <th className="text-right py-2 px-3 font-semibold">% do mês</th>
                <th className="text-right py-2 px-3 font-semibold" />
              </tr></thead>
              <tbody>
                {historico.map((h) => (
                  <tr key={`${h.custo.id}-${h.mes}`} className="border-b border-border/40">
                    <td className="py-1.5 px-3 font-mono">{rotuloMes(h.mes)}</td>
                    <td className="py-1.5 px-3">{h.custo.descricao}</td>
                    <td className="py-1.5 px-3 text-right font-mono">{fmtBRL(h.valor)}</td>
                    <td className="py-1.5 px-3 text-right font-mono text-muted-foreground">{h.fat > 0 ? fmtBRL(h.fat) : "—"}</td>
                    <td className="py-1.5 px-3 text-right font-mono font-semibold">{h.fat > 0 ? fmtPct((h.valor / h.fat) * 100) : "—"}</td>
                    <td className="py-1.5 px-3 text-right">
                      <button onClick={() => remover(h.custo.id, h.ids)} aria-label="Remover valor pago"
                        className="w-6 h-6 inline-flex items-center justify-center text-muted-foreground hover:text-danger">
                        <X className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

function Auto({ label, valor, hint, destaque }: { label: string; valor: string; hint?: string; destaque?: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label} · auto</div>
      <div className={cn("font-mono tabular-nums text-[13px] font-semibold mt-0.5", destaque && "text-brand-cyan")}>{valor}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

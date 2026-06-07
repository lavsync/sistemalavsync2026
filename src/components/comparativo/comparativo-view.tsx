"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Legend, Line, LineChart,
} from "recharts";
import {
  Building2, Calendar, ChevronDown, Check, TrendingUp, TrendingDown,
  ArrowRight, DollarSign, ShoppingCart, Users, Receipt, UserPlus,
  Wand2, Clock, CalendarDays, Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgregadoJanela, PeriodoComp } from "@/lib/comparativo/queries";

const fmtBRL = (n: number, dec = 2) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
const fmtNum = (n: number) => n.toLocaleString("pt-BR");
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1).replace(".", ",")}%`;

const HORAS = ["00h", "01h", "02h", "03h", "04h", "05h", "06h", "07h", "08h", "09h", "10h", "11h",
  "12h", "13h", "14h", "15h", "16h", "17h", "18h", "19h", "20h", "21h", "22h", "23h"];

type Unidade = { id: string; nome: string };

export type ComparativoViewProps = {
  unidades: Unidade[];
  ladoA: AgregadoJanela;
  ladoB: AgregadoJanela;
  periodoA: PeriodoComp;
  periodoB: PeriodoComp;
  unidadeA: string;
  unidadeB: string;
  fromA?: string;
  toA?: string;
  fromB?: string;
  toB?: string;
};

const PRESETS: Array<{ key: PeriodoComp; label: string }> = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "mes", label: "Mês atual" },
  { key: "mes_anterior", label: "Mês anterior" },
  { key: "90d", label: "Últimos 90 dias" },
  { key: "ano", label: "Ano atual" },
  { key: "ano_anterior", label: "Ano anterior" },
];

export function ComparativoView(props: ComparativoViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { ladoA, ladoB } = props;

  function push(updates: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  // Chart sobreposto — alinhar tamanho dos arrays (intercalar por índice)
  const chartData = React.useMemo(() => {
    const maxLen = Math.max(ladoA.porDia.length, ladoB.porDia.length);
    const out: Array<{ idx: number; rotuloA?: string; rotuloB?: string; valorA?: number; valorB?: number }> = [];
    for (let i = 0; i < maxLen; i++) {
      out.push({
        idx: i,
        rotuloA: ladoA.porDia[i]?.rotulo,
        rotuloB: ladoB.porDia[i]?.rotulo,
        valorA: ladoA.porDia[i]?.valor,
        valorB: ladoB.porDia[i]?.valor,
      });
    }
    return out;
  }, [ladoA.porDia, ladoB.porDia]);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-3xl p-6 lg:p-8 bg-gradient-lavsync relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-white">
                Comparativo · A vs B
              </span>
            </div>
            <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tight text-white">Análise comparativa</h1>
            <p className="text-[13px] text-white/80 mt-1">
              Mesma unidade em períodos diferentes, ou unidades distintas — lado a lado.
            </p>
          </div>
        </div>
      </div>

      {/* Seletores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SeletorLado
          titulo="Lado A"
          cor="brand-cyan"
          unidades={props.unidades}
          unidadeAtiva={props.unidadeA}
          periodo={props.periodoA}
          from={props.fromA}
          to={props.toA}
          onUnidade={(id) => push({ unidadeA: id })}
          onPeriodo={(p) => push({ periodoA: p, fromA: null, toA: null })}
          onCustom={(f, t) => push({ periodoA: "custom", fromA: f, toA: t })}
        />
        <SeletorLado
          titulo="Lado B"
          cor="brand-purple"
          unidades={props.unidades}
          unidadeAtiva={props.unidadeB}
          periodo={props.periodoB}
          from={props.fromB}
          to={props.toB}
          onUnidade={(id) => push({ unidadeB: id })}
          onPeriodo={(p) => push({ periodoB: p, fromB: null, toB: null })}
          onCustom={(f, t) => push({ periodoB: "custom", fromB: f, toB: t })}
        />
      </div>

      {/* KPIs comparativos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCompare icon={DollarSign} label="Faturamento" a={ladoA.faturamento} b={ladoB.faturamento} fmt={fmtBRL} />
        <KpiCompare icon={ShoppingCart} label="Vendas" a={ladoA.qtdVendas} b={ladoB.qtdVendas} fmt={fmtNum} />
        <KpiCompare icon={Receipt} label="Ticket médio" a={ladoA.ticketMedio} b={ladoB.ticketMedio} fmt={fmtBRL} />
        <KpiCompare icon={Users} label="CPFs únicos" a={ladoA.cpfsUnicos} b={ladoB.cpfsUnicos} fmt={fmtNum} />
        <KpiCompare icon={UserPlus} label="Novos clientes" a={ladoA.cpfsNovos} b={ladoB.cpfsNovos} fmt={fmtNum} />
        <KpiCompare icon={TrendingUp} label="Vendas/dia" a={ladoA.vendasPorDia} b={ladoB.vendasPorDia} fmt={(v) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} />
        <KpiCompare icon={Tag} label="Cupons usados" a={ladoA.cupomUsos} b={ladoB.cupomUsos} fmt={fmtNum} />
        <KpiCompare icon={Wand2} label="Vouchers usados" a={ladoA.voucherUsos} b={ladoB.voucherUsos} fmt={fmtNum} />
      </div>

      {/* Mix Lavagem × Secagem (lado a lado) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MixCard titulo="Mix Lavagem × Secagem · Lado A" cor="brand-cyan"
          lavagem={ladoA.faturamentoLavagem} secagem={ladoA.faturamentoSecagem} total={ladoA.faturamento} />
        <MixCard titulo="Mix Lavagem × Secagem · Lado B" cor="brand-purple"
          lavagem={ladoB.faturamentoLavagem} secagem={ladoB.faturamentoSecagem} total={ladoB.faturamento} />
      </div>

      {/* Faturamento diário sobreposto */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-display font-bold text-[15px]">Faturamento diário sobreposto</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Eixo X = ordem do dia no período (1º dia de A vs 1º dia de B, e assim por diante)
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-brand-cyan" />
              <span className="text-muted-foreground">A · {ladoA.unidadeNome} · {ladoA.rotuloJanela}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-brand-purple" />
              <span className="text-muted-foreground">B · {ladoB.unidadeNome} · {ladoB.rotuloJanela}</span>
            </span>
          </div>
        </div>
        {chartData.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="idx" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `D${v + 1}`} />
                <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `R$${(v as number / 1000).toFixed(1)}k`} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 11 }}
                  formatter={(v, n) => [fmtBRL(Number(v ?? 0)), n === "valorA" ? "Lado A" : "Lado B"] as [string, string]}
                  labelFormatter={(idx) => `Dia ${Number(idx) + 1}`}
                />
                <Line type="monotone" dataKey="valorA" stroke="var(--brand-cyan)" strokeWidth={2.5} dot={false} name="valorA" />
                <Line type="monotone" dataKey="valorB" stroke="var(--brand-purple)" strokeWidth={2.5} dot={false} name="valorB" strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Insights detalhados */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InsightsCard titulo="Lado A" cor="brand-cyan" data={ladoA} />
        <InsightsCard titulo="Lado B" cor="brand-purple" data={ladoB} />
      </div>
    </div>
  );
}

// ─── Subcomponentes ─────────────────────────────────────────────────

function SeletorLado({
  titulo, cor, unidades, unidadeAtiva, periodo, from, to,
  onUnidade, onPeriodo, onCustom,
}: {
  titulo: string;
  cor: "brand-cyan" | "brand-purple";
  unidades: Unidade[];
  unidadeAtiva: string;
  periodo: PeriodoComp;
  from?: string;
  to?: string;
  onUnidade: (id: string) => void;
  onPeriodo: (p: PeriodoComp) => void;
  onCustom: (f: string, t: string) => void;
}) {
  const [customOpen, setCustomOpen] = React.useState(periodo === "custom");
  const [f, setF] = React.useState(from ?? "");
  const [t, setT] = React.useState(to ?? "");
  const unidadeNome = unidades.find((u) => u.id === unidadeAtiva)?.nome ?? "—";
  const periodoLabel = PRESETS.find((p) => p.key === periodo)?.label
    ?? (periodo === "custom" && from && to ? `${from} → ${to}` : "Personalizado");

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className={cn("w-2 h-2 rounded-full", cor === "brand-cyan" ? "bg-brand-cyan" : "bg-brand-purple")} />
        <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-muted-foreground">{titulo}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {/* Unidade */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/70 border border-border text-[12px] font-semibold">
              <Building2 className="w-3.5 h-3.5" />
              <span>{unidadeNome}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content sideOffset={6} className="z-50 min-w-[200px] rounded-lg border border-border bg-popover p-1 shadow-xl">
              {unidades.map((u) => (
                <DropdownMenu.Item key={u.id} onSelect={() => onUnidade(u.id)}
                  className={cn("flex items-center gap-2 px-2 py-1.5 rounded text-[12px] cursor-pointer outline-none",
                    u.id === unidadeAtiva ? "bg-brand-cyan/15 text-brand-cyan font-semibold" : "hover:bg-secondary")}>
                  <Building2 className="w-3 h-3" />
                  <span className="flex-1">{u.nome}</span>
                  {u.id === unidadeAtiva && <Check className="w-3 h-3" />}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Período */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/70 border border-border text-[12px] font-semibold">
              <Calendar className="w-3.5 h-3.5" />
              <span>{periodoLabel}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content sideOffset={6} align="end" className="z-50 min-w-[220px] rounded-lg border border-border bg-popover p-1 shadow-xl">
              {PRESETS.map((p) => (
                <DropdownMenu.Item key={p.key} onSelect={(e) => { e.preventDefault(); setCustomOpen(false); onPeriodo(p.key); }}
                  className={cn("flex items-center gap-2 px-2 py-1.5 rounded text-[12px] cursor-pointer outline-none",
                    p.key === periodo ? "bg-brand-cyan/15 text-brand-cyan font-semibold" : "hover:bg-secondary")}>
                  <span className="flex-1">{p.label}</span>
                  {p.key === periodo && <Check className="w-3 h-3" />}
                </DropdownMenu.Item>
              ))}
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item onSelect={(e) => { e.preventDefault(); setCustomOpen(true); }}
                className={cn("flex items-center gap-2 px-2 py-1.5 rounded text-[12px] cursor-pointer outline-none",
                  periodo === "custom" ? "bg-brand-cyan/15 text-brand-cyan font-semibold" : "hover:bg-secondary")}>
                <span className="flex-1">Personalizado…</span>
                {periodo === "custom" && <Check className="w-3 h-3" />}
              </DropdownMenu.Item>
              {customOpen && (
                <div className="px-2 py-2 mt-1 border-t border-border space-y-2" onClick={(e) => e.stopPropagation()}>
                  <input type="date" value={f} onChange={(e) => setF(e.target.value)} className="w-full form-input h-8 text-[12px]" />
                  <input type="date" value={t} onChange={(e) => setT(e.target.value)} className="w-full form-input h-8 text-[12px]" />
                  <button onClick={() => { if (f && t) onCustom(f, t); }} className="w-full px-2 py-1.5 rounded bg-brand-cyan text-primary-foreground text-[11px] font-semibold">
                    Aplicar
                  </button>
                </div>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}

function KpiCompare({ icon: Icon, label, a, b, fmt }: {
  icon: React.ElementType; label: string; a: number; b: number; fmt: (v: number) => string;
}) {
  const delta = b > 0 ? ((a - b) / b) * 100 : a > 0 ? 100 : 0;
  const abs = a - b;
  const trend = delta > 0.5 ? "up" : delta < -0.5 ? "down" : "neutral";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</div>
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="grid grid-cols-2 gap-2 items-end">
        <div>
          <div className="text-[9px] font-bold text-brand-cyan uppercase tracking-wider">Lado A</div>
          <div className="font-display font-bold text-[18px] text-brand-cyan tabular-nums leading-tight">{fmt(a)}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-bold text-brand-purple uppercase tracking-wider">Lado B</div>
          <div className="font-display font-bold text-[18px] text-brand-purple tabular-nums leading-tight">{fmt(b)}</div>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">A vs B</span>
        <span className={cn("inline-flex items-center gap-1 text-[11px] font-mono font-bold",
          trend === "up" ? "text-success" : trend === "down" ? "text-danger" : "text-muted-foreground")}>
          {trend === "up" && <TrendingUp className="w-3 h-3" />}
          {trend === "down" && <TrendingDown className="w-3 h-3" />}
          {fmtPct(delta)}
          {abs !== 0 && <span className="text-muted-foreground">({abs > 0 ? "+" : ""}{fmt(Math.abs(abs))})</span>}
        </span>
      </div>
    </div>
  );
}

function MixCard({ titulo, cor, lavagem, secagem, total }: {
  titulo: string; cor: "brand-cyan" | "brand-purple"; lavagem: number; secagem: number; total: number;
}) {
  const pLav = total > 0 ? (lavagem / total) * 100 : 0;
  const pSec = total > 0 ? (secagem / total) * 100 : 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className={cn("w-2 h-2 rounded-full", cor === "brand-cyan" ? "bg-brand-cyan" : "bg-brand-purple")} />
        <div className="font-display font-bold text-[13px]">{titulo}</div>
      </div>
      {total === 0 ? (
        <div className="text-[12px] text-muted-foreground py-6 text-center">Sem dados nesta janela</div>
      ) : (
        <>
          <div className="h-3 rounded-full overflow-hidden bg-secondary flex">
            <div style={{ width: `${pLav}%` }} className="bg-brand-cyan" />
            <div style={{ width: `${pSec}%` }} className="bg-brand-purple" />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div>
              <div className="text-[10px] text-muted-foreground">Lavagem</div>
              <div className="font-mono font-bold text-[14px]">{fmtBRL(lavagem)}</div>
              <div className="text-[10px] text-muted-foreground">{pLav.toFixed(1)}%</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">Secagem</div>
              <div className="font-mono font-bold text-[14px]">{fmtBRL(secagem)}</div>
              <div className="text-[10px] text-muted-foreground">{pSec.toFixed(1)}%</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function InsightsCard({ titulo, cor, data }: { titulo: string; cor: "brand-cyan" | "brand-purple"; data: AgregadoJanela }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className={cn("w-2 h-2 rounded-full", cor === "brand-cyan" ? "bg-brand-cyan" : "bg-brand-purple")} />
        <div className="font-display font-bold text-[13px]">{titulo} · {data.unidadeNome}</div>
      </div>
      <div className="space-y-2">
        <Linha icon={CalendarDays} label="Janela" valor={data.rotuloJanela} />
        <Linha icon={Calendar} label="Dias com venda" valor={`${data.diasUnicos} dia${data.diasUnicos === 1 ? "" : "s"}`} />
        <Linha icon={Clock} label="Hora de pico" valor={data.melhorHora ? `${HORAS[data.melhorHora.hora]} (${data.melhorHora.vendas} vendas)` : "—"} />
        <Linha icon={CalendarDays} label="Melhor dia" valor={data.melhorDow ? `${data.melhorDow.nome} (${data.melhorDow.vendas} vendas)` : "—"} />
      </div>
    </div>
  );
}

function Linha({ icon: Icon, label, valor }: { icon: React.ElementType; label: string; valor: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-mono font-semibold ml-auto">{valor}</span>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-72 flex flex-col items-center justify-center text-muted-foreground">
      <ArrowRight className="w-8 h-8 opacity-30 mb-2" />
      <div className="text-[13px] font-semibold">Sem dados pra comparar</div>
      <div className="text-[11px] mt-1">Escolha outra unidade ou período</div>
    </div>
  );
}

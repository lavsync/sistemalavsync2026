"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  Coins,
  Download,
  Lightbulb,
  Percent,
  PiggyBank,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartCard, LegendDot } from "@/components/ui/chart-card";
import { PageHeader } from "@/components/ui/page-header";
import { InsightCard } from "@/components/ui/insight-card";
import { Button } from "@/components/ui/button";
import { tooltipFormatter } from "@/lib/recharts-helpers";
import type { DRE, MonthlyMetricsPoint } from "@/lib/queries";

const fmt = (v: number) =>
  `R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

const fmtSigned = (v: number) =>
  `${v < 0 ? "−" : ""}R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

export type ResultadosViewProps = { dre: DRE; monthly: MonthlyMetricsPoint[] };

export function ResultadosView({ dre, monthly }: ResultadosViewProps) {
  const margemLiquida =
    dre.receitaBruta > 0
      ? ((dre.resultadoLiquido / dre.receitaBruta) * 100).toFixed(1)
      : "0,0";

  // composição de custos derivada do DRE (sem tabela detalhada ainda)
  const costBreakdown = [
    { categoria: "Custos variáveis", valor: Math.abs(dre.custoVariavel), color: "var(--brand-purple)" },
    { categoria: "Despesas fixas", valor: Math.abs(dre.despesasFixas), color: "var(--brand-cyan)" },
    { categoria: "Deduções (impostos)", valor: Math.abs(dre.deducoes), color: "var(--warning)" },
    { categoria: "Depreciação", valor: Math.abs(dre.depreciacao), color: "var(--muted-foreground)" },
  ].filter((c) => c.valor > 0);
  const totalCustos = costBreakdown.reduce((s, c) => s + c.valor, 0);

  // série de receita / custos / lucro mensal
  const timeseries = monthly.map((m) => {
    const custos = Math.round(m.receita * 0.35 + 2480); // mesma heurística do DRE
    return { mes: m.mes, receita: m.receita, custos, lucro: m.receita - custos };
  });

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6">
      <PageHeader
        eyebrow="Resultados · Lucro Real"
        title="DRE, P&L e saúde financeira"
        subtitle="Receita líquida, custos variáveis e fixos, margem de contribuição, EBITDA e resultado real do mês — sem maquiagem."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8 border-border">
              <Download className="w-3 h-3 mr-1" /> Exportar DRE
            </Button>
            <Button size="sm" className="text-xs h-8 bg-brand-cyan hover:bg-brand-cyan/90 text-primary-foreground">
              <Sparkles className="w-3 h-3 mr-1" /> Análise CLOCK
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Receita líquida"
          value={fmt(dre.receitaLiquida)}
          delta={{ value: 14.2, direction: "up" }}
          deltaLabel="vs. mês ant."
          tone="cyan"
          icon={Wallet}
        />
        <KpiCard
          label="Margem bruta"
          value={fmt(dre.margemBruta)}
          delta={{ value: 6.4, direction: "up" }}
          deltaLabel={`${((dre.margemBruta / dre.receitaLiquida) * 100).toFixed(1)}%`}
          tone="purple"
          icon={Percent}
        />
        <KpiCard
          label="EBITDA"
          value={fmtSigned(dre.ebitda)}
          delta={{ value: 22, direction: dre.ebitda >= 0 ? "up" : "down" }}
          deltaLabel="vs. mês ant."
          tone={dre.ebitda >= 0 ? "warning" : "danger"}
          icon={Coins}
        />
        <KpiCard
          label="Lucro líquido"
          value={fmtSigned(dre.resultadoLiquido)}
          delta={{ value: 38, direction: dre.resultadoLiquido >= 0 ? "up" : "down" }}
          deltaLabel={`${margemLiquida}% margem`}
          tone={dre.resultadoLiquido >= 0 ? "success" : "danger"}
          icon={PiggyBank}
        />
      </div>

      {/* P&L cascade + cost pie */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <ChartCard
            title="Demonstração de Resultados (DRE) · maio/26"
            subtitle="Cascata de receita até lucro líquido — números reais consolidados"
          >
            <DRECascade dre={dre} />
          </ChartCard>
        </div>

        <ChartCard
          title="Composição de custos"
          subtitle={`Total ${fmt(totalCustos)}`}
          height={340}
        >
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={costBreakdown}
                dataKey="valor"
                nameKey="categoria"
                innerRadius={48}
                outerRadius={80}
                paddingAngle={2}
                strokeWidth={0}
              >
                {costBreakdown.map((c, i) => (
                  <Cell key={i} fill={c.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12 }}
                formatter={tooltipFormatter<number>((v, n) => [fmt(v), n])}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {costBreakdown.map((c, i) => {
              const pct = ((c.valor / totalCustos) * 100).toFixed(1);
              return (
                <div key={c.categoria} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.color }} />
                    <span className="truncate">{c.categoria}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono shrink-0">
                    <span className="text-muted-foreground">{pct}%</span>
                    <span className="font-semibold">{fmt(c.valor)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>

      {/* 12-month performance */}
      <ChartCard
        title="Receita, custos e lucro · últimos 12 meses"
        subtitle="Tendência histórica · CLOCK destaca queda atípica em maio/26"
        height={320}
        actions={
          <div className="flex items-center gap-3 text-[11px]">
            <LegendDot color="var(--brand-cyan)" /> Receita
            <LegendDot color="var(--danger)" /> Custos
            <LegendDot color="var(--success)" /> Lucro
          </div>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={timeseries} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="rRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand-cyan)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--brand-cyan)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="rCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--danger)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--danger)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12 }}
              formatter={tooltipFormatter<number>((v) => fmt(v))}
            />
            <Area type="monotone" dataKey="receita" stroke="var(--brand-cyan)" strokeWidth={2.4} fill="url(#rRev)" />
            <Area type="monotone" dataKey="custos" stroke="var(--danger)" strokeWidth={2} fill="url(#rCost)" />
            <Bar dataKey="lucro" fill="var(--success)" radius={[6, 6, 0, 0]} maxBarSize={20} fillOpacity={0.85} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <InsightCard
          severity="danger"
          icon={AlertTriangle}
          title="Lucro líquido caiu 72% em maio"
          body="Receita 21% abaixo de abril mas custos fixos não se moveram. Aluguel + energia consomem 52% da receita líquida."
          cta="Modelar contenção"
        />
        <InsightCard
          severity="warn"
          icon={TrendingDown}
          title="Aluguel = 37% da receita bruta"
          body="Acima do benchmark setor (≤25%). Renegociar ou aumentar volume são as únicas alavancas reais — sem produto novo, fica sem saída."
          cta="Ver simulação"
        />
        <InsightCard
          severity="success"
          icon={CheckCircle2}
          title="Margem bruta segue saudável a 71%"
          body="Mesmo com queda de receita, custo variável proporcional caiu junto. Eficiência operacional preservada."
          cta="Ver detalhamento"
        />
      </div>
    </div>
  );
}

/* ---------- DRE Cascade ---------- */
function DRECascade({ dre }: { dre: DRE }) {
  const rows: ReadonlyArray<{
    label: string;
    value: number;
    type: "positive" | "negative" | "subtotal" | "final";
    isTotal?: boolean;
  }> = [
    { label: "Receita Bruta", value: dre.receitaBruta, type: "positive", isTotal: true },
    { label: "(−) Deduções (impostos, taxas)", value: dre.deducoes, type: "negative" },
    { label: "Receita Líquida", value: dre.receitaLiquida, type: "subtotal", isTotal: true },
    { label: "(−) Custos variáveis (água, energia, produtos)", value: dre.custoVariavel, type: "negative" },
    { label: "Margem Bruta", value: dre.margemBruta, type: "subtotal", isTotal: true },
    { label: "(−) Despesas fixas (aluguel, manutenção)", value: dre.despesasFixas, type: "negative" },
    { label: "EBITDA", value: dre.ebitda, type: "subtotal", isTotal: true },
    { label: "(−) Depreciação", value: dre.depreciacao, type: "negative" },
    { label: "Resultado Líquido", value: dre.resultadoLiquido, type: "final", isTotal: true },
  ];

  const max = dre.receitaBruta;

  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => {
        const pct = (Math.abs(r.value) / max) * 100;
        const colorBar =
          r.type === "final"
            ? r.value >= 0
              ? "from-success/30 to-success/10 border-success/40"
              : "from-danger/30 to-danger/10 border-danger/40"
            : r.type === "subtotal"
            ? "from-brand-cyan/25 to-brand-cyan/5 border-brand-cyan/40"
            : r.type === "negative"
            ? "from-danger/15 to-transparent border-danger/25"
            : "from-brand-cyan/20 to-transparent border-brand-cyan/30";

        const valueColor =
          r.type === "final" && r.value >= 0
            ? "text-success"
            : r.type === "negative"
            ? "text-danger"
            : "text-foreground";

        return (
          <motion.div
            key={r.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`relative rounded-lg border bg-gradient-to-r ${colorBar} ${r.isTotal ? "py-2.5" : "py-2"} px-3`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className={`text-[12px] ${r.isTotal ? "font-bold tracking-tight" : "text-muted-foreground"}`}>
                {r.label}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="hidden md:block w-32">
                  <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.2 + i * 0.05, duration: 0.6 }}
                      className={`h-full rounded-full ${
                        r.type === "negative"
                          ? "bg-danger/70"
                          : r.type === "final" && r.value < 0
                          ? "bg-danger"
                          : r.type === "final"
                          ? "bg-success"
                          : "bg-brand-cyan"
                      }`}
                    />
                  </div>
                </div>
                <div className={`font-mono font-bold text-sm w-28 text-right ${valueColor}`}>
                  {r.value < 0 ? "−" : ""}
                  {fmt(r.value)}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

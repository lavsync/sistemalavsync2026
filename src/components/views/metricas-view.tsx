"use client";

import { motion } from "framer-motion";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Gauge,
  Lightbulb,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { ChartCard, LegendDot } from "@/components/ui/chart-card";
import { PageHeader } from "@/components/ui/page-header";
import { InsightCard } from "@/components/ui/insight-card";
import { Button } from "@/components/ui/button";
import {
  MOCK_METRICS,
  MOCK_METRICS_HISTORY,
  MOCK_UNIT_COSTS,
} from "@/lib/mock-data";

const toneClassMap = {
  cyan: { bar: "bg-brand-cyan", text: "text-brand-cyan", glow: "glow-cyan" },
  purple: { bar: "bg-brand-purple", text: "text-brand-purple", glow: "glow-purple" },
  warning: { bar: "bg-warning", text: "text-warning", glow: "" },
  success: { bar: "bg-success", text: "text-success", glow: "" },
  danger: { bar: "bg-danger", text: "text-danger", glow: "" },
} as const;

export function MetricasView() {
  return (
    <div className="px-6 lg:px-8 py-6 space-y-6">
      <PageHeader
        eyebrow="Métricas · KPIs Operacionais"
        title="Indicadores em profundidade"
        subtitle="Ticket, frequência, ocupação, CAC, LTV, NPS, churn — comparados à meta · sparkline de 12 meses · custos unitários por ciclo."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8 border-border">
              <Filter className="w-3 h-3 mr-1" /> Período
            </Button>
            <Button size="sm" className="text-xs h-8 bg-brand-cyan hover:bg-brand-cyan/90 text-primary-foreground">
              <Sparkles className="w-3 h-3 mr-1" /> Pedir interpretação CLOCK
            </Button>
          </div>
        }
      />

      {/* Gauges grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {MOCK_METRICS.map((m, i) => (
          <MetricGauge key={m.key} metric={m} delay={i * 0.05} />
        ))}
      </div>

      {/* Historical trends */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="Evolução · ticket e frequência"
          subtitle="Médias mensais — últimos 12 meses"
          height={280}
          actions={
            <div className="flex items-center gap-3 text-[11px]">
              <LegendDot color="var(--brand-cyan)" /> Ticket (R$)
              <LegendDot color="var(--brand-purple)" /> Frequência (x10)
            </div>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={MOCK_METRICS_HISTORY} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12 }}
                formatter={(v: number, n: string) => (n === "freq" ? [`${(v * 10).toFixed(1)}`, "Freq x10"] : [`R$ ${(+v).toFixed(2)}`, "Ticket"])}
              />
              <Line type="monotone" dataKey="ticket" stroke="var(--brand-cyan)" strokeWidth={2.4} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="freq" stroke="var(--brand-purple)" strokeWidth={2.4} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Evolução · ocupação e NPS"
          subtitle="Indicadores de saúde da operação"
          height={280}
          actions={
            <div className="flex items-center gap-3 text-[11px]">
              <LegendDot color="var(--warning)" /> Ocupação (%)
              <LegendDot color="var(--success)" /> NPS
            </div>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={MOCK_METRICS_HISTORY} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12 }}
                formatter={(v: number, n: string) => (n === "ocupacao" ? [`${v.toFixed(1)}%`, "Ocupação"] : [`${v.toFixed(0)}`, "NPS"])}
              />
              <Line type="monotone" dataKey="ocupacao" stroke="var(--warning)" strokeWidth={2.4} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="nps" stroke="var(--success)" strokeWidth={2.4} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Unit costs */}
      <ChartCard
        title="Custo unitário por ciclo · meta vs realizado"
        subtitle="Quanto cada ciclo de máquina está custando — ponto crítico de margem"
        height={300}
        actions={
          <div className="flex items-center gap-3 text-[11px]">
            <LegendDot color="var(--brand-cyan)" /> Realizado
            <LegendDot color="var(--warning)" /> Meta
          </div>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={MOCK_UNIT_COSTS} margin={{ top: 8, right: 16, left: -8, bottom: 0 }} layout="vertical">
            <CartesianGrid stroke="var(--border)" horizontal={false} strokeDasharray="3 3" />
            <XAxis type="number" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v.toFixed(2)}`} />
            <YAxis type="category" dataKey="categoria" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={90} />
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12 }}
              formatter={(v: number, n: string) => [`R$ ${(+v).toFixed(2)}`, n === "valor" ? "Realizado" : "Meta"]}
            />
            <Bar dataKey="valor" radius={[0, 6, 6, 0]} maxBarSize={20}>
              {MOCK_UNIT_COSTS.map((d, i) => (
                <Cell key={i} fill={d.valor <= d.target ? "var(--brand-cyan)" : "var(--danger)"} />
              ))}
            </Bar>
            <Bar dataKey="target" radius={[0, 6, 6, 0]} maxBarSize={4} fill="var(--warning)" fillOpacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <InsightCard
          severity="warn"
          icon={AlertTriangle}
          title="Energia 15% acima da meta por ciclo"
          body="R$ 1,84 vs meta R$ 1,60. Causa provável: máquinas em standby longo. Ativar automação de desligamento entre 02h–05h."
          cta="Configurar standby"
        />
        <InsightCard
          severity="success"
          icon={CheckCircle2}
          title="CAC caiu 12% — campanhas mais eficientes"
          body="WhatsApp + cupom local performando 2,3x melhor que Meta Ads. Realocar verba para canais próprios."
          cta="Ver realocação"
        />
        <InsightCard
          severity="info"
          icon={Lightbulb}
          title="LTV / CAC = 18,7x — folga grande"
          body="Acima do benchmark setor (5x–8x). Espaço seguro para escalar aquisição em até R$ 25 CAC sem comprometer margem."
          cta="Modelar expansão"
        />
      </div>
    </div>
  );
}

/* ---------- Gauge ---------- */
function MetricGauge({ metric, delay }: { metric: (typeof MOCK_METRICS)[number]; delay: number }) {
  const range = metric.max - metric.min;
  const pct = Math.max(0, Math.min(100, ((metric.value - metric.min) / range) * 100));
  const targetPct = Math.max(0, Math.min(100, ((metric.target - metric.min) / range) * 100));
  const onTarget = metric.value >= metric.target;
  const tone = toneClassMap[metric.tone as keyof typeof toneClassMap];
  const trendUp = metric.trend > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="card-premium rounded-xl p-4 hover:border-border-strong transition-smooth group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {metric.label}
        </div>
        <div
          className={`text-[10px] font-mono font-bold inline-flex items-center gap-0.5 ${
            trendUp ? "text-success" : "text-danger"
          }`}
        >
          {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(metric.trend).toFixed(1)}%
        </div>
      </div>
      <div className="flex items-baseline gap-1.5 mb-3">
        <div className={`font-mono font-bold text-2xl ${tone.text}`}>
          {metric.unit === "R$" ? "R$ " : ""}
          {metric.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
          {metric.unit !== "R$" && metric.unit ? ` ${metric.unit}` : ""}
        </div>
      </div>
      <div className="relative">
        <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ delay: delay + 0.2, duration: 0.6 }}
            className={`h-full rounded-full ${tone.bar}`}
          />
        </div>
        <div
          className="absolute top-[-3px] w-0.5 h-3 bg-warning"
          style={{ left: `${targetPct}%` }}
          title={`Meta: ${metric.target}`}
        />
      </div>
      <div className="flex items-center justify-between text-[9px] text-muted-foreground mt-1.5 font-mono">
        <span>{metric.min}</span>
        <span className={onTarget ? "text-success" : "text-warning"}>
          meta {metric.target}
        </span>
        <span>{metric.max}</span>
      </div>
    </motion.div>
  );
}

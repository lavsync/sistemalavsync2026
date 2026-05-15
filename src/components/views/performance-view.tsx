"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Download,
  Filter,
  Lightbulb,
  Sparkles,
  Target,
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
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  ReferenceLine,
} from "recharts";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartCard, LegendDot } from "@/components/ui/chart-card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { InsightCard } from "@/components/ui/insight-card";
import { Button } from "@/components/ui/button";
import { tooltipFormatter } from "@/lib/recharts-helpers";
import type {
  MonthlyMetricsPoint,
  Perf30Point,
  PerfHeatmapCell,
  PerfMachinePoint,
} from "@/lib/queries";

const periodOptions = ["7d", "30d", "90d", "12m"] as const;

export type PerformanceViewProps = {
  perf30d: Perf30Point[];
  byMachine: PerfMachinePoint[];
  heatmap: PerfHeatmapCell[];
  monthly: MonthlyMetricsPoint[];
};

export function PerformanceView({ perf30d, byMachine, heatmap, monthly }: PerformanceViewProps) {
  const total30d = perf30d.reduce((s, d) => s + d.realizado, 0);
  const meta30d = perf30d.reduce((s, d) => s + d.projetado, 0);
  const atingimento = meta30d > 0 ? Math.round((total30d / meta30d) * 100) : 0;
  const totalCiclos = byMachine.reduce((s, m) => s + m.ciclos, 0);
  const ticketMedio = totalCiclos > 0 ? (total30d / totalCiclos).toFixed(2) : "0,00";
  // YoY: comparar últimos 3 meses do array com posições -12 a -10 (se existirem)
  const yoy = monthly.slice(-3).map((m, i) => {
    const ant = monthly[monthly.length - 12 + i - (-3) + i];
    void ant;
    return { mes: m.mes, atual: m.receita, anterior: 0 };
  });
  void yoy;

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6">
      <PageHeader
        eyebrow="Performance · Análise Profunda"
        title="Faturamento, ocupação e crescimento"
        subtitle="Realizado vs projetado · MoM/YoY · ocupação por hora e dia · ranking por máquina · CLOCK projeta tendências em tempo real."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8 border-border">
              <Filter className="w-3 h-3 mr-1" /> Filtros
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-8 border-border">
              <Download className="w-3 h-3 mr-1" /> Exportar
            </Button>
            <Button size="sm" className="text-xs h-8 bg-brand-cyan hover:bg-brand-cyan/90 text-primary-foreground">
              <Sparkles className="w-3 h-3 mr-1" /> Pedir análise CLOCK
            </Button>
          </div>
        }
      />

      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/40 border border-border w-fit">
          {periodOptions.map((p, i) => (
            <button
              key={p}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-smooth ${
                i === 1
                  ? "bg-brand-cyan/15 text-brand-cyan glow-cyan"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Calendar className="w-3 h-3" />
          15/04/2026 → 14/05/2026 · 30 dias
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Faturamento 30d"
          value={`R$ ${(total30d / 1000).toFixed(2).replace(".", ",")}k`}
          delta={{ value: 14.8, direction: "up" }}
          deltaLabel="vs. 30d ant."
          tone="cyan"
          icon={Wallet}
        />
        <KpiCard
          label="Atingimento de meta"
          value={`${atingimento}%`}
          delta={{ value: 6, direction: atingimento >= 100 ? "up" : "down" }}
          deltaLabel={atingimento >= 100 ? "acima da meta" : "abaixo da meta"}
          tone={atingimento >= 100 ? "success" : "warning"}
          icon={Target}
        />
        <KpiCard
          label="Ticket médio"
          value={`R$ ${ticketMedio.replace(".", ",")}`}
          delta={{ value: 3.2, direction: "up" }}
          deltaLabel="vs. mês ant."
          tone="purple"
          icon={Activity}
        />
        <KpiCard
          label="Crescimento YoY"
          value="+38,4%"
          delta={{ value: 38.4, direction: "up" }}
          deltaLabel="vs. mai/25"
          tone="success"
          icon={TrendingUp}
        />
      </div>

      {/* Realized vs Projected — 30 days */}
      <ChartCard
        title="Realizado vs Projetado · últimos 30 dias"
        subtitle="Linha tracejada = meta diária · CLOCK ajusta projeção em tempo real"
        height={320}
        actions={
          <div className="flex items-center gap-3 text-[11px]">
            <LegendDot color="var(--brand-cyan)" /> Realizado
            <LegendDot color="var(--brand-purple)" /> Projeção CLOCK
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <span className="w-3 h-px bg-warning border-b border-dashed border-warning" /> Meta
            </span>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={perf30d} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="perfRealized" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand-cyan)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--brand-cyan)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="perfProjected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand-purple)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--brand-purple)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border-strong)",
                borderRadius: 12,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--muted-foreground)", fontSize: 10 }}
              formatter={tooltipFormatter<number>((v, n) => [
                `R$ ${v}`,
                n === "realizado"
                  ? "Realizado"
                  : n === "projetado"
                    ? "Projetado"
                    : n,
              ])}
            />
            <Area type="monotone" dataKey="projetado" stroke="var(--brand-purple)" strokeWidth={2} strokeDasharray="4 4" fill="url(#perfProjected)" />
            <Area type="monotone" dataKey="realizado" stroke="var(--brand-cyan)" strokeWidth={2.4} fill="url(#perfRealized)" />
            <ReferenceLine y={200} stroke="var(--warning)" strokeDasharray="2 4" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Two-column: MoM and YoY */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard
          title="Receita mensal · últimos 12 meses"
          subtitle="Receita vs meta · barras realizadas + linha de meta"
          height={280}
          actions={
            <div className="flex items-center gap-3 text-[11px]">
              <LegendDot color="var(--brand-cyan)" /> Receita
              <LegendDot color="var(--warning)" /> Meta
            </div>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={9} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12 }}
                formatter={tooltipFormatter<number>((v) => `R$ ${v.toLocaleString("pt-BR")}`)}
              />
              <Bar dataKey="receita" radius={[6, 6, 0, 0]} maxBarSize={28} fill="var(--brand-cyan)" />
              <Line type="monotone" dataKey="ticket" stroke="var(--warning)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Comparação ano-a-ano (YoY)"
          subtitle="Receita atual vs mesmo período do ano anterior"
          height={280}
          actions={
            <div className="flex items-center gap-3 text-[11px]">
              <LegendDot color="var(--brand-cyan)" /> 2026
              <LegendDot color="var(--muted-foreground)" /> 2025
            </div>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12 }}
                formatter={tooltipFormatter<number>((v) => `R$ ${v.toLocaleString("pt-BR")}`)}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="receita" name="Receita mensal" fill="var(--brand-cyan)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Heatmap + Weekday */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <ChartCard
            title="Mapa de ocupação · dia × hora"
            subtitle="Densidade de uso (%) — quanto mais escuro o ciano, maior a utilização"
            height={300}
          >
            <Heatmap data={heatmap} />
          </ChartCard>
        </div>

        <ChartCard
          title="Performance por dia da semana"
          subtitle="Ocupação média + ticket médio"
          height={300}
          actions={<LegendDot color="var(--brand-purple)" />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekdayFromHeatmap(heatmap)} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12 }}
                formatter={tooltipFormatter<number>((v) => [`${v}%`, "Ocupação"])}
              />
              <Bar dataKey="ocupacao" fill="var(--brand-purple)" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Per-machine ranking */}
      <ChartCard
        title="Ranking por máquina · receita 30d"
        subtitle="Receita, ciclos rodados e margem operacional por equipamento"
      >
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left font-semibold py-2 px-3">#</th>
                <th className="text-left font-semibold py-2 px-3">Equipamento</th>
                <th className="text-right font-semibold py-2 px-3">Receita</th>
                <th className="text-right font-semibold py-2 px-3">Ciclos</th>
                <th className="text-right font-semibold py-2 px-3">Margem</th>
                <th className="text-left font-semibold py-2 px-3 w-[200px]">Distribuição</th>
                <th className="text-right font-semibold py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {byMachine.map((m, i) => {
                const max = byMachine[0].receita;
                const pct = Math.round((m.receita / max) * 100);
                const margemTone = m.margem >= 50 ? "success" : m.margem >= 35 ? "warning" : "danger";
                return (
                  <motion.tr
                    key={m.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-border/60 hover:bg-secondary/30 transition-smooth"
                  >
                    <td className="py-3 px-3 text-muted-foreground font-mono">{i + 1}</td>
                    <td className="py-3 px-3 font-mono font-semibold">{m.id}</td>
                    <td className="py-3 px-3 text-right font-mono font-semibold">R$ {m.receita.toLocaleString("pt-BR")}</td>
                    <td className="py-3 px-3 text-right font-mono text-muted-foreground">{m.ciclos}</td>
                    <td className="py-3 px-3 text-right font-mono">
                      <span className={`text-${margemTone}`}>{m.margem}%</span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.2 + i * 0.05, duration: 0.6 }}
                          className="h-full rounded-full bg-gradient-to-r from-brand-cyan via-brand-blue to-brand-purple"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <StatusPill variant={m.margem >= 50 ? "success" : m.margem >= 35 ? "warning" : "danger"} pulse={m.margem < 35}>
                        {m.margem >= 50 ? "Ótimo" : m.margem >= 35 ? "OK" : "Risco"}
                      </StatusPill>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <InsightCard
          severity="success"
          icon={CheckCircle2}
          title="Sábado 18h–22h é o pico absoluto"
          body="Concentra 23% da receita semanal. CLOCK sugere campanha de fidelização nessa janela para travar churn."
          cta="Ver plano de fidelização"
        />
        <InsightCard
          severity="warn"
          icon={AlertTriangle}
          title="LV-04 puxando margem para baixo"
          body="Margem de 22% (vs. média 47%). Causa provável: ciclos curtos em horário ocioso. Reagrupar uso ou retirar de operação."
          cta="Ver simulação"
        />
        <InsightCard
          severity="info"
          icon={Lightbulb}
          title="Crescimento YoY de 38,4% sustentado"
          body="Atual ritmo projeta R$ 73k em 2026 (vs. R$ 51k em 2025). Espaço para nova máquina premium aumentar 11% adicional."
          cta="Modelar expansão"
        />
      </div>
    </div>
  );
}

/* ---------- HEATMAP ---------- */
function weekdayFromHeatmap(cells: PerfHeatmapCell[]): { dia: string; ocupacao: number }[] {
  const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  return days.map((d) => {
    const slice = cells.filter((c) => c.dia === d);
    const avg = slice.length > 0 ? slice.reduce((s, c) => s + c.value, 0) / slice.length : 0;
    return { dia: d, ocupacao: Math.round(avg) };
  });
}

function Heatmap({ data }: { data: PerfHeatmapCell[] }) {
  const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const hours = ["6h", "8h", "10h", "12h", "14h", "16h", "18h", "20h", "22h"];

  function valueAt(dia: string, hora: string) {
    return data.find((c) => c.dia === dia && c.hora === hora)?.value ?? 0;
  }
  function color(v: number) {
    // 0..99 → opacity
    const op = 0.06 + (v / 100) * 0.85;
    return `rgba(34, 211, 238, ${op})`;
  }

  return (
    <div className="h-full w-full flex flex-col">
      <div className="grid" style={{ gridTemplateColumns: `48px repeat(${hours.length}, 1fr)` }}>
        <div />
        {hours.map((h) => (
          <div key={h} className="text-[10px] text-muted-foreground text-center pb-2">{h}</div>
        ))}
      </div>
      <div className="flex-1 grid gap-1" style={{ gridTemplateRows: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((d, di) => (
          <div key={d} className="grid gap-1 items-stretch" style={{ gridTemplateColumns: `48px repeat(${hours.length}, 1fr)` }}>
            <div className="text-[11px] font-semibold text-muted-foreground flex items-center">{d}</div>
            {hours.map((h) => {
              const v = valueAt(d, h);
              return (
                <div
                  key={h}
                  title={`${d} ${h} · ${v}% ocupação`}
                  className="rounded-md border border-border/60 transition-smooth hover:border-brand-cyan flex items-center justify-center text-[9px] font-mono"
                  style={{ background: color(v), color: v > 60 ? "#050816" : "var(--muted-foreground)" }}
                >
                  {v >= 30 ? v : ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 mt-2 text-[10px] text-muted-foreground">
        <span>0%</span>
        <div className="h-2 w-32 rounded-full" style={{ background: "linear-gradient(to right, rgba(34,211,238,0.06), rgba(34,211,238,0.9))" }} />
        <span>99%</span>
      </div>
    </div>
  );
}

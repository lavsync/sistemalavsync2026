"use client";

import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Calendar,
  Clock,
  DollarSign,
  Download,
  Filter,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartCard, LegendDot } from "@/components/ui/chart-card";
import { StatusPill } from "@/components/ui/status-pill";
import { InsightCard } from "@/components/ui/insight-card";
import { Button } from "@/components/ui/button";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  DashboardKpis,
  HourlyOccupationPoint,
  MachineRow,
  RevenuePoint,
  RevenueSplitSlice,
} from "@/lib/queries";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (atual: number, base: number) => {
  if (base <= 0) return { text: "—", trend: "neutral" as const };
  const pct = ((atual - base) / base) * 100;
  const trend = pct > 0.5 ? ("up" as const) : pct < -0.5 ? ("down" as const) : ("neutral" as const);
  return {
    text: `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1).replace(".", ",")}%`,
    trend,
  };
};
const fmtDateBR = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

export type DashboardViewProps = {
  kpis: DashboardKpis;
  timeseries: RevenuePoint[];
  split: RevenueSplitSlice[];
  hourly: HourlyOccupationPoint[];
  machines: MachineRow[];
};

export function DashboardView({ kpis, timeseries, split, hourly, machines }: DashboardViewProps) {
  const today = new Date();
  const hoje = fmtDateBR(today);
  const deltaFat = fmtPct(kpis.faturamentoHoje, kpis.faturamentoOntem);
  const deltaVendas = fmtPct(kpis.vendasHoje, kpis.vendasMedia7d);
  const machineCount = machines.length;
  const warningCount = machines.filter((m) => m.status === "warning").length;
  return (
    <div className="px-6 lg:px-8 py-6 space-y-6">
      {/* HERO BRANDED — Gradiente oficial LavSync (Brandbook §09) */}
      <div className="relative overflow-hidden rounded-3xl p-6 lg:p-8 bg-gradient-lavsync particles-glow">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white">
                Central Operacional · Tempo Real
              </span>
            </div>
            <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tight text-white mt-3">
              Boa tarde, Daniel.
            </h1>
            <p className="text-[14px] text-white/85 mt-2">
              Operação do dia <span className="font-mono font-semibold">{hoje}</span> ·{" "}
              <span className="font-mono font-semibold">R$ {fmtBRL(kpis.faturamentoHoje)}</span> em{" "}
              <span className="font-mono font-semibold">{kpis.vendasHoje} vendas</span>.
            </p>
            <p className="text-[12px] text-white/65 mt-1 italic">
              Tudo da sua lavanderia. Sincronizado. Inteligente. Lucrativo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs h-8 bg-white/10 hover:bg-white/20 text-white border-white/10">
              <Filter className="w-3 h-3 mr-1" /> Filtros
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-8 bg-white/10 hover:bg-white/20 text-white border-white/10">
              <Download className="w-3 h-3 mr-1" /> Exportar
            </Button>
            <Button size="sm" className="text-xs h-8 bg-white text-brand-deep hover:bg-white/90 font-semibold">
              <Calendar className="w-3 h-3 mr-1" /> Hoje · {hoje.slice(0, 5)}
            </Button>
          </div>
        </div>
      </div>

      {/* KPI ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          index={0}
          label="Faturamento hoje"
          prefix="R$"
          value={fmtBRL(kpis.faturamentoHoje)}
          delta={{ value: deltaFat.text, trend: deltaFat.trend, vs: "vs. ontem" }}
          icon={DollarSign}
          tone="cyan"
          sparkline={
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeseries.slice(-7)}>
                <defs>
                  <linearGradient id="kpi1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand-cyan)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="var(--brand-cyan)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke="var(--brand-cyan)" strokeWidth={1.5} fill="url(#kpi1)" />
              </AreaChart>
            </ResponsiveContainer>
          }
        />

        <KpiCard
          index={1}
          label="Ticket médio · 7d"
          prefix="R$"
          value={fmtBRL(kpis.ticketMedio)}
          delta={{ value: "média móvel", trend: "neutral", vs: "ciclos concluídos" }}
          icon={TrendingUp}
          tone="purple"
        />

        <KpiCard
          index={2}
          label="Vendas no dia"
          value={String(kpis.vendasHoje)}
          suffix={`/ ~${kpis.vendasMedia7d} média`}
          delta={{ value: deltaVendas.text, trend: deltaVendas.trend, vs: "vs. média 7d" }}
          icon={ShoppingCart}
          tone="purple"
        />

        <KpiCard
          index={3}
          label="Saúde operacional"
          value={String(machineCount - warningCount)}
          suffix={`/ ${machineCount} máquinas`}
          delta={{
            value: warningCount === 0 ? "todas ok" : `${warningCount} alerta${warningCount > 1 ? "s" : ""}`,
            trend: warningCount === 0 ? "up" : "down",
            vs: "tempo real",
          }}
          icon={Activity}
          tone={warningCount === 0 ? "success" : "warning"}
        />
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Revenue evolution */}
        <ChartCard
          className="xl:col-span-2"
          title="Evolução de receita · últimos 14 dias"
          subtitle="Realizado vs projetado · ticket médio R$ 22,36"
          actions={
            <>
              <button className="text-[11px] px-2 py-1 rounded bg-secondary text-foreground font-semibold">14d</button>
              <button className="text-[11px] px-2 py-1 rounded text-muted-foreground hover:bg-secondary">30d</button>
              <button className="text-[11px] px-2 py-1 rounded text-muted-foreground hover:bg-secondary">90d</button>
            </>
          }
          legend={
            <>
              <LegendDot color="var(--brand-cyan)" label="Realizado" />
              <LegendDot color="var(--muted-foreground)" label="Projeção CLOCK" />
            </>
          }
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={timeseries} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand-cyan)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--brand-cyan)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `R$ ${v}`} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "8px",
                  fontSize: "11px",
                  color: "var(--popover-foreground)",
                }}
                cursor={{ stroke: "var(--brand-cyan)", strokeDasharray: "3 3" }}
              />
              <Area type="monotone" dataKey="projected" stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="3 3" fill="none" />
              <Area type="monotone" dataKey="value" stroke="var(--brand-cyan)" strokeWidth={2} fill="url(#revArea)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Revenue split */}
        <ChartCard
          title="Composição da receita"
          subtitle="Mix por tipo de serviço (mês)"
        >
          <div className="flex items-center justify-center pt-4">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={split}
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="var(--background)"
                  strokeWidth={2}
                >
                  {split.map((s, i) => (
                    <Cell key={i} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1.5">
            {split.map(s => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span className="font-mono font-semibold">{s.value}%</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* SECONDARY GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Hourly occupation */}
        <ChartCard
          className="xl:col-span-2"
          title="Ocupação por horário · hoje"
          subtitle="Pico previsto entre 18h–22h · sub-utilização entre 06h–10h"
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hourly} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="hourBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand-purple)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--brand-cyan)" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: "8px", fontSize: "11px" }}
                cursor={{ fill: "var(--brand-cyan)", fillOpacity: 0.04 }}
              />
              <Bar dataKey="value" fill="url(#hourBar)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Atenção hoje */}
        <ChartCard
          title="Atenção hoje"
          subtitle="Tarefas que CLOCK pediu para você revisar"
          height={240}
        >
          <ul className="space-y-2.5">
            {[
              { icon: Wrench, title: "Manutenção LV-04", time: "amanhã 03h", tone: "warning" as const },
              { icon: Zap, title: "Pico de energia previsto", time: "20h–22h", tone: "info" as const },
              { icon: Users, title: "5 clientes inativos > 14 dias", time: "campanha", tone: "info" as const },
              { icon: AlertCircle, title: "PINPAD timeout 7×", time: "última: 12h31", tone: "danger" as const },
            ].map((t, i) => (
              <li key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-secondary/40 transition-smooth cursor-pointer">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                  t.tone === "danger" ? "bg-danger/12 text-danger" :
                  t.tone === "warning" ? "bg-warning/12 text-warning" :
                  "bg-brand-cyan/12 text-brand-cyan"
                }`}>
                  <t.icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold leading-snug">{t.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{t.time}</div>
                </div>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      {/* MACHINE STATUS */}
      <ChartCard
        title="Status das máquinas"
        subtitle={`Tempo real · ${machineCount} equipamento${machineCount === 1 ? "" : "s"}${
          warningCount > 0 ? ` · ${warningCount} com alerta técnico` : ""
        }`}
        actions={
          <Button variant="ghost" size="sm" className="text-xs h-7 text-brand-cyan">
            Ver todas <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {machines.map((m) => {
            const variant =
              m.status === "warning" ? "warning" :
              m.status === "running" ? "success" :
              "neutral";
            const label =
              m.status === "warning" ? "Atenção" :
              m.status === "running" ? "Operando" :
              "Ociosa";
            return (
              <div key={m.id} className="rounded-lg border border-border bg-card/40 p-3 transition-smooth hover:border-border-strong">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-mono text-sm font-bold">{m.id}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{m.type}</div>
                  </div>
                  <StatusPill variant={variant} pulse={m.status === "running" || m.status === "warning"}>
                    {label}
                  </StatusPill>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Utilização</span>
                    <span className="font-mono font-semibold">{m.utilization}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${m.utilization}%`,
                        background: m.status === "warning" ? "var(--warning)" : "linear-gradient(90deg, var(--brand-cyan), var(--brand-purple))",
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ChartCard>

      {/* INSIGHTS GRID */}
      <div>
        <div className="flex items-end justify-between mb-3">
          <div>
            <h3 className="font-display font-semibold text-base tracking-tight">Insights da CLOCK AI</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Análise contínua dos últimos 7 dias</p>
          </div>
          <Button variant="ghost" size="sm" className="text-xs h-7 text-brand-cyan">
            Ver histórico <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <InsightCard
            severity="danger"
            icon={Clock}
            title="Janela ociosa entre 03h–05h custou R$ 1.890 em 30 dias"
            body="Energia base + aluguel rateado nesta janela soma R$ 1,89/h sem retorno. CLOCK sugere reduzir iluminação ou automatizar standby de máquinas."
            cta="Ver simulação de standby"
          />
          <InsightCard
            severity="warn"
            icon={Wallet}
            title="Aluguel = 101% da receita líquida atual"
            body="A R$ 4.000/mês, o aluguel sozinho consome toda a receita. Renegociação ou aumento de volume são as duas únicas alavancas reais."
            cta="Modelar cenários"
          />
          <InsightCard
            severity="info"
            icon={BarChart3}
            title="Mix premium pode adicionar R$ 2.400/mês"
            body="Reposicionar secadoras 22kg como 'express premium' (+R$ 6/ciclo) tem absorção projetada de 78% baseada nos hábitos atuais."
            cta="Criar plano de teste A/B"
          />
        </div>
      </div>
    </div>
  );
}

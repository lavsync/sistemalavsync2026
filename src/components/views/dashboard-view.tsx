"use client";

import {
  Activity, AlertCircle, ArrowRight, BarChart3, Clock, DollarSign,
  ShoppingCart, TrendingUp, TrendingDown, Users, Wallet, Wrench, Zap,
  Crown, AlertTriangle, Sparkles, Calendar, Tag, Radio, Receipt,
  type LucideIcon,
} from "lucide-react";
import { useAutoRefresh } from "@/lib/use-auto-refresh";
import { RefreshBar } from "@/components/shell/refresh-bar";
import { cn } from "@/lib/utils";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartCard, LegendDot } from "@/components/ui/chart-card";
import { StatusPill } from "@/components/ui/status-pill";
import { InsightCard } from "@/components/ui/insight-card";
import { Button } from "@/components/ui/button";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type {
  DashboardKpis, HourlyOccupationPoint, MachineRow, Periodo, RevenuePoint,
  RevenueSplitSlice, Unidade,
} from "@/lib/dashboard/queries";
import type { Insight, InsightIcone } from "@/lib/insights/engine";
import type { SelecaoUnidades } from "@/lib/unidade-multi";
import { DashboardFilters } from "@/components/dashboard/filters";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (atual: number, base: number) => {
  if (base <= 0) return { text: "—", trend: "neutral" as const };
  const pct = ((atual - base) / base) * 100;
  const trend = pct > 0.5 ? ("up" as const) : pct < -0.5 ? ("down" as const) : ("neutral" as const);
  return { text: `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1).replace(".", ",")}%`, trend };
};
const fmtDateBR = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

export type DashboardViewProps = {
  unidades: Unidade[];
  selecaoUnidades: SelecaoUnidades;
  periodo: Periodo;
  from?: string;
  to?: string;
  labelJanela: string;
  kpis: DashboardKpis;
  timeseries: RevenuePoint[];
  split: RevenueSplitSlice[];
  hourly: HourlyOccupationPoint[];
  machines: MachineRow[];
  insights: Insight[];
  usuarioNome?: string;
  resumoHoje?: import("@/lib/dashboard/queries").ResumoHoje;
};

const INSIGHT_ICON_MAP: Record<InsightIcone, LucideIcon> = {
  Clock, TrendingDown, TrendingUp, Crown, AlertTriangle,
  Wallet, Sparkles, Users, Calendar, Tag, DollarSign,
};

function saudacaoPorHora(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function DashboardView({
  unidades, selecaoUnidades, periodo, from, to, labelJanela,
  kpis, timeseries, split, hourly, machines, insights, usuarioNome, resumoHoje,
}: DashboardViewProps) {
  const autoRefresh = useAutoRefresh(30, true);
  const today = new Date();
  const hoje = fmtDateBR(today);
  const unidadeRotulo = selecaoUnidades.rotulo;

  const deltaFat = fmtPct(kpis.faturamento, kpis.faturamentoAnterior);
  const deltaVendas = fmtPct(kpis.qtdVendas, kpis.qtdVendasAnterior);
  const deltaTicket = fmtPct(kpis.ticketMedio, kpis.ticketMedioAnterior);
  const deltaCli = fmtPct(kpis.clientesAtivos, kpis.clientesAtivosAnterior);

  const machineCount = machines.length;
  const warningCount = machines.filter((m) => m.status === "warning").length;

  const temDados = kpis.qtdVendas > 0;

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6">
      {/* HERO BRANDED — Gradient oficial LavSync */}
      <div className="relative overflow-hidden rounded-3xl p-6 lg:p-8 bg-gradient-lavsync particles-glow">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white">
                Central Operacional · {unidadeRotulo} · {labelJanela}
              </span>
            </div>
            <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tight text-white mt-3">
              {saudacaoPorHora()}{usuarioNome ? `, ${usuarioNome}` : ""}.
            </h1>
            <p className="text-[14px] text-white/85 mt-2">
              {temDados ? (
                <>
                  <span className="font-mono font-semibold">R$ {fmtBRL(kpis.faturamento)}</span> em{" "}
                  <span className="font-mono font-semibold">{kpis.qtdVendas} vendas</span> ·{" "}
                  ticket médio <span className="font-mono font-semibold">R$ {fmtBRL(kpis.ticketMedio)}</span>
                </>
              ) : (
                <>Nenhuma venda nesta janela · troque o período pra ver os dados</>
              )}
            </p>
            <p className="text-[12px] text-white/65 mt-1 italic">Hoje · {hoje}</p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <RefreshBar
              ligado={autoRefresh.ligado}
              restante={autoRefresh.restante}
              onAlternar={() => autoRefresh.setLigado(!autoRefresh.ligado)}
              onRefreshAgora={autoRefresh.refreshAgora}
              ultima={autoRefresh.ultima}
            />
            <DashboardFilters
              unidades={unidades}
              selecaoUnidades={selecaoUnidades}
              periodo={periodo}
              from={from}
              to={to}
              labelJanela={labelJanela}
            />
          </div>
        </div>
      </div>

      {/* HOJE EM DESTAQUE */}
      {resumoHoje && <HojeBanner r={resumoHoje} multiUnidades={selecaoUnidades.ids.length > 1} />}

      {/* KPI ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          index={0}
          label={`Faturamento · ${labelJanela}`}
          prefix="R$"
          value={fmtBRL(kpis.faturamento)}
          delta={{ value: deltaFat.text, trend: deltaFat.trend, vs: "vs. período anterior" }}
          icon={DollarSign}
          tone="cyan"
          sparkline={timeseries.length > 1 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeseries}>
                <defs>
                  <linearGradient id="kpi1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand-cyan)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="var(--brand-cyan)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke="var(--brand-cyan)" strokeWidth={1.5} fill="url(#kpi1)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        />

        <KpiCard
          index={1}
          label="Ticket médio"
          prefix="R$"
          value={fmtBRL(kpis.ticketMedio)}
          delta={{ value: deltaTicket.text, trend: deltaTicket.trend, vs: "vs. período anterior" }}
          icon={TrendingUp}
          tone="purple"
        />

        <KpiCard
          index={2}
          label="Vendas concluídas"
          value={String(kpis.qtdVendas)}
          suffix={`/ ${kpis.qtdVendasAnterior} no anterior`}
          delta={{ value: deltaVendas.text, trend: deltaVendas.trend, vs: "vs. período anterior" }}
          icon={ShoppingCart}
          tone="purple"
        />

        <KpiCard
          index={3}
          label="Clientes ativos (CPF)"
          value={String(kpis.clientesAtivos)}
          suffix={kpis.clientesAtivos === 1 ? "cliente único" : "clientes únicos"}
          delta={{ value: deltaCli.text, trend: deltaCli.trend, vs: "vs. período anterior" }}
          icon={Users}
          tone={warningCount === 0 ? "success" : "warning"}
        />
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Revenue evolution */}
        <ChartCard
          className="xl:col-span-2"
          title={`Evolução de receita · ${labelJanela}`}
          subtitle={temDados
            ? `Realizado vs projeção (média móvel 7d) · ticket médio R$ ${fmtBRL(kpis.ticketMedio)}`
            : "Sem dados na janela escolhida"}
          legend={
            <>
              <LegendDot color="var(--brand-cyan)" label="Realizado" />
              <LegendDot color="var(--muted-foreground)" label="Média móvel 7d" />
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
              <XAxis dataKey="rotulo" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${Math.round(v as number)}`} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: "8px", fontSize: "11px", color: "var(--popover-foreground)" }}
                cursor={{ stroke: "var(--brand-cyan)", strokeDasharray: "3 3" }}
                formatter={(v) => [`R$ ${fmtBRL(Number(v ?? 0))}`, "Receita"] as [string, string]}
              />
              <Area type="monotone" dataKey="projected" stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="3 3" fill="none" />
              <Area type="monotone" dataKey="value" stroke="var(--brand-cyan)" strokeWidth={2} fill="url(#revArea)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Revenue split */}
        <ChartCard title="Composição da receita" subtitle={`Mix por tipo de serviço · ${labelJanela}`}>
          {split.length === 0 ? (
            <div className="flex items-center justify-center h-[240px] text-xs text-muted-foreground">Sem dados</div>
          ) : (
            <>
              <div className="flex items-center justify-center pt-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={split} innerRadius={55} outerRadius={85} paddingAngle={2}
                      dataKey="value" stroke="var(--background)" strokeWidth={2}>
                      {split.map((s, i) => <Cell key={i} fill={s.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: "8px", fontSize: "11px" }}
                      formatter={(_v, _name, ctx) => {
                        const payload = (ctx as { payload?: RevenueSplitSlice } | undefined)?.payload;
                        return [payload ? `R$ ${fmtBRL(payload.valor)} · ${payload.value}%` : "", ""] as [string, string];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-1.5">
                {split.map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </span>
                    <span className="font-mono font-semibold">R$ {fmtBRL(s.valor)} · {s.value}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>
      </div>

      {/* SECONDARY GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Hourly occupation */}
        <ChartCard
          className="xl:col-span-2"
          title={`Ocupação por horário · ${labelJanela}`}
          subtitle={temDados ? `Distribuição de vendas nas 24h · pico = 100%` : "Sem dados"}
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
              <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false}
                interval={1} />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: "8px", fontSize: "11px" }}
                cursor={{ fill: "var(--brand-cyan)", fillOpacity: 0.04 }}
                formatter={(_v, _n, ctx) => {
                  const p = (ctx as { payload?: HourlyOccupationPoint } | undefined)?.payload;
                  return [p ? `${p.value}% do pico · ${p.vendas} vendas/dia` : "", ""] as [string, string];
                }}
              />
              <Bar dataKey="value" fill="url(#hourBar)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Atenção hoje */}
        <ChartCard title="Atenção hoje" subtitle="Tarefas que a CLOCK AI sinalizou" height={240}>
          <ul className="space-y-2.5">
            {[
              { icon: Wrench, title: "Manutenção LV-04", time: "amanhã 03h", tone: "warning" as const },
              { icon: Zap, title: "Pico de energia previsto", time: "20h–22h", tone: "info" as const },
              { icon: Users, title: `${kpis.clientesAtivos} CPFs ativos no período`, time: labelJanela, tone: "info" as const },
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
      {machines.length > 0 && (
        <ChartCard
          title="Status das máquinas"
          subtitle={`Tempo real · ${machineCount} equipamento${machineCount === 1 ? "" : "s"}${
            warningCount > 0 ? ` · ${warningCount} com alerta técnico` : ""}`}
          actions={
            <Button variant="ghost" size="sm" className="text-xs h-7 text-brand-cyan">
              Ver todas <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {machines.map((m) => {
              const variant = m.status === "warning" ? "warning" : m.status === "running" ? "success" : "neutral";
              const label = m.status === "warning" ? "Atenção" : m.status === "running" ? "Operando" : "Ociosa";
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
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${m.utilization}%`,
                        background: m.status === "warning" ? "var(--warning)" : "linear-gradient(90deg, var(--brand-cyan), var(--brand-purple))",
                      }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      )}

      {/* INSIGHTS GRID — dinâmicos da CLOCK AI engine */}
      <div>
        <div className="flex items-end justify-between mb-3">
          <div>
            <h3 className="font-display font-semibold text-base tracking-tight inline-flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-brand-cyan" />
              Insights da CLOCK AI
              <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-brand-cyan/15 text-brand-cyan">
                {insights.length} {insights.length === 1 ? "insight" : "insights"}
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Heurísticas sobre os últimos 90 dias · prioridade decrescente
            </p>
          </div>
        </div>
        {insights.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border bg-muted/10 p-8 text-center">
            <Sparkles className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <div className="text-[13px] font-semibold">Sem dados suficientes pra gerar insights</div>
            <div className="text-[11px] text-muted-foreground mt-1">Importe planilhas de vendas em /performance</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {insights.map((ins) => (
              <InsightCard
                key={ins.id}
                severity={ins.severidade}
                icon={INSIGHT_ICON_MAP[ins.icone] ?? Sparkles}
                title={ins.titulo}
                body={
                  <>
                    {ins.descricao}
                    {ins.destaque && (
                      <span className="block mt-1.5 font-mono font-bold text-[11px] text-foreground/85">
                        {ins.destaque}
                      </span>
                    )}
                  </>
                }
                cta={ins.acao_sugerida}
              />
            ))}
          </div>
        )}
      </div>

      <Activity className="hidden" />
      <Wrench className="hidden" />
      <Zap className="hidden" />
      <AlertCircle className="hidden" />
      <BarChart3 className="hidden" />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// HOJE EM DESTAQUE — banner sempre visível com vendas do dia
// ────────────────────────────────────────────────────────────
function HojeBanner({ r, multiUnidades }: { r: import("@/lib/dashboard/queries").ResumoHoje; multiUnidades: boolean }) {
  const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const deltaOntem = r.faturamentoOntemMesmoHorario > 0
    ? ((r.faturamentoHoje - r.faturamentoOntemMesmoHorario) / r.faturamentoOntemMesmoHorario) * 100
    : null;
  const minDesde = r.minutosDesdeUltimaVenda;
  const semVendas = r.vendasHoje === 0;
  return (
    <div className="rounded-2xl border border-success/30 bg-gradient-to-br from-success/5 via-card to-card p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="inline-flex items-center gap-2">
          <span className="relative flex w-2.5 h-2.5">
            <span className="absolute inset-0 rounded-full bg-success/70 animate-ping" />
            <span className="relative rounded-full bg-success w-2.5 h-2.5" />
          </span>
          <Radio className="w-3.5 h-3.5 text-success animate-pulse" />
          <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-success">HOJE · AO VIVO</span>
        </div>
        {minDesde !== null && (
          <div className={cn("text-[11px] inline-flex items-center gap-1 font-mono font-bold",
            minDesde < 5 ? "text-success" : minDesde < 30 ? "text-brand-cyan" : "text-warning")}>
            <Clock className="w-3 h-3" />
            última venda há {minDesde}min
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <HojeStat label="Faturamento" valor={`R$ ${fmt(r.faturamentoHoje)}`} tone="success"
          hint={deltaOntem != null ? `${deltaOntem >= 0 ? "+" : ""}${deltaOntem.toFixed(0)}% vs ontem` : "ainda sem comparativo"} />
        <HojeStat label="Vendas" valor={r.vendasHoje.toLocaleString("pt-BR")} tone="brand-cyan" hint={`${r.ciclosHoje} ciclos`} />
        <HojeStat label="Ticket médio" valor={`R$ ${fmt(r.ticketMedioHoje)}`} tone="brand-purple" />
        <HojeStat label="Clientes únicos" valor={r.clientesUnicosHoje.toString()} tone="warning" />
        <HojeStat label="Lavagens" valor={r.lavagensHoje.toString()} tone="brand-blue" />
        <HojeStat label="Secagens" valor={r.secagensHoje.toString()} tone="brand-blue" />
      </div>

      {r.vendasUltimaHora > 0 && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-brand-cyan/30 bg-brand-cyan/8 px-3 py-1.5">
          <Activity className="w-3.5 h-3.5 text-brand-cyan" />
          <span className="text-[11px] font-bold text-brand-cyan">Última hora:</span>
          <span className="text-[11px] font-mono font-bold">R$ {fmt(r.faturamentoUltimaHora)}</span>
          <span className="text-[10px] text-muted-foreground">· {r.vendasUltimaHora} vendas</span>
        </div>
      )}

      {/* Stream de últimas vendas */}
      {r.ultimasVendas.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
            <Receipt className="w-3 h-3" /> Últimas vendas
          </div>
          <div className="space-y-1 max-h-44 overflow-y-auto custom-scroll-thin">
            {r.ultimasVendas.slice(0, 8).map((v) => {
              const min = Math.round((Date.now() - new Date(v.data_venda).getTime()) / 60000);
              return (
                <div key={v.id} className="flex items-center gap-2 text-[11px] py-1 border-b border-border/30 last:border-0">
                  <span className="font-mono text-muted-foreground w-12">{new Date(v.data_venda).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="capitalize text-[10px] font-bold uppercase tracking-wider w-16"
                    style={{ color: v.tipo_servico === "lavagem" ? "var(--brand-cyan)" : v.tipo_servico === "secagem" ? "var(--brand-purple)" : "var(--muted-foreground)" }}>
                    {v.tipo_servico}
                  </span>
                  <span className="font-mono font-bold text-success min-w-[70px]">R$ {fmt(v.valor)}</span>
                  <span className="text-[10px] text-muted-foreground capitalize">{v.tipo_pagamento}</span>
                  {v.nome_cliente && <span className="truncate text-muted-foreground flex-1">· {v.nome_cliente.split(" ").slice(0, 2).join(" ")}</span>}
                  <span className="text-[9px] text-muted-foreground ml-auto">{min < 60 ? `${min}m` : `${Math.floor(min / 60)}h`}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {semVendas && (
        <div className="mt-4 inline-flex items-center gap-2 text-[12px] text-muted-foreground">
          <AlertTriangle className="w-3.5 h-3.5 text-warning" />
          Nenhuma venda registrada hoje ainda. Importe planilha MAXPAN ou aguarde sincronização.
          {multiUnidades && " · Filtro de unidades pode estar afetando a contagem."}
        </div>
      )}
    </div>
  );
}

function HojeStat({ label, valor, tone, hint }: { label: string; valor: string; tone: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 backdrop-blur p-3">
      <div className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">{label}</div>
      <div className={cn("font-display font-bold text-xl tabular-nums mt-0.5", `text-${tone}`)}>{valor}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

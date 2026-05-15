"use client";

import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Crown,
  Heart,
  Lightbulb,
  MessageSquare,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
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
import { StatusPill } from "@/components/ui/status-pill";
import { InsightCard } from "@/components/ui/insight-card";
import { Button } from "@/components/ui/button";
import { tooltipFormatter } from "@/lib/recharts-helpers";
import {
  MOCK_CLIENT_GROWTH,
  MOCK_CLIENT_RETENTION,
  MOCK_CLIENT_RFM,
  MOCK_TOP_CLIENTS,
} from "@/lib/mock-data";

export function ClientesView() {
  const total = MOCK_CLIENT_RFM.reduce((s, x) => s + x.count, 0);
  const ativos = total - (MOCK_CLIENT_RFM.find((s) => s.segment === "Dormentes")?.count ?? 0);
  const dormentes = MOCK_CLIENT_RFM.find((s) => s.segment === "Dormentes")?.count ?? 0;
  const emRisco = MOCK_CLIENT_RFM.find((s) => s.segment === "Em risco")?.count ?? 0;

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6">
      <PageHeader
        eyebrow="Clientes · Inteligência de Base"
        title="Base ativa, recorrência e fidelização"
        subtitle="Segmentação RFM · novos vs recorrentes · curva de retenção · top clientes · oportunidades de win-back via WhatsApp."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs h-8 border-border">
              <Search className="w-3 h-3 mr-1" /> Buscar cliente
            </Button>
            <Button size="sm" className="text-xs h-8 bg-brand-cyan hover:bg-brand-cyan/90 text-primary-foreground">
              <Sparkles className="w-3 h-3 mr-1" /> Sugerir win-back
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Base total" value={total.toString()} delta={{ value: 5.2, direction: "up" }} deltaLabel="últimos 30d" tone="cyan" icon={Users} />
        <KpiCard label="Ativos (90d)" value={ativos.toString()} delta={{ value: 3.4, direction: "up" }} deltaLabel="vs. trimestre ant." tone="success" icon={Heart} />
        <KpiCard label="Em risco" value={emRisco.toString()} delta={{ value: 12, direction: "up" }} deltaLabel="alerta CLOCK" tone="warning" icon={AlertTriangle} />
        <KpiCard label="Dormentes" value={dormentes.toString()} delta={{ value: 8.1, direction: "down" }} deltaLabel="recuperar via WA" tone="danger" icon={TrendingDown} />
      </div>

      {/* RFM + Growth */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard
          title="Segmentação RFM"
          subtitle="Recência · Frequência · Valor monetário"
          height={320}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 h-full gap-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={MOCK_CLIENT_RFM}
                  dataKey="count"
                  nameKey="segment"
                  innerRadius={48}
                  outerRadius={96}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {MOCK_CLIENT_RFM.map((s, i) => (
                    <Cell key={i} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12 }}
                  formatter={tooltipFormatter<number>((v, n) => [`${v} clientes`, n])}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 justify-center">
              {MOCK_CLIENT_RFM.map((s, i) => (
                <motion.div
                  key={s.segment}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center justify-between gap-2 text-[11px]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{s.segment}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{s.desc}</div>
                    </div>
                  </div>
                  <div className="font-mono font-bold shrink-0">{s.count}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </ChartCard>

        <div className="xl:col-span-2">
          <ChartCard
            title="Novos vs Recorrentes · 12 semanas"
            subtitle="Volume semanal — sustentabilidade da base"
            height={320}
            actions={
              <div className="flex items-center gap-3 text-[11px]">
                <LegendDot color="var(--brand-cyan)" /> Novos
                <LegendDot color="var(--brand-purple)" /> Recorrentes
              </div>
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_CLIENT_GROWTH} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="cliNovos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand-cyan)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--brand-cyan)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="cliRecor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand-purple)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--brand-purple)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="semana" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="recorrentes" stackId="1" stroke="var(--brand-purple)" strokeWidth={2} fill="url(#cliRecor)" />
                <Area type="monotone" dataKey="novos" stackId="1" stroke="var(--brand-cyan)" strokeWidth={2} fill="url(#cliNovos)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* Retention curve */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard
          title="Curva de retenção (cohort)"
          subtitle="% da base que retorna nos meses subsequentes"
          height={260}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={MOCK_CLIENT_RETENTION} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12 }}
                formatter={tooltipFormatter<number>((v) => `${v}% retenção`)}
              />
              <Line
                type="monotone"
                dataKey="retencao"
                stroke="var(--brand-cyan)"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "var(--brand-cyan)", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Quick actions panel */}
        <div className="xl:col-span-2">
          <ChartCard
            title="Oportunidades de ação · CLOCK"
            subtitle="Sugestões priorizadas por impacto estimado"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ActionRow
                icon={MessageSquare}
                tone="cyan"
                title="Win-back · 107 dormentes"
                detail="Disparar mensagem com cupom 30% via WhatsApp"
                impact="≈ R$ 1.124 receita estimada"
                cta="Disparar campanha"
              />
              <ActionRow
                icon={Crown}
                tone="purple"
                title="Reconhecer 87 campeões"
                detail="Mensagem personalizada + benefício exclusivo"
                impact="↑ 18% NPS estimado"
                cta="Criar mensagem"
              />
              <ActionRow
                icon={AlertTriangle}
                tone="warning"
                title="38 clientes em risco"
                detail="Frequência caiu nas últimas 4 semanas"
                impact="Prevenir churn de R$ 1.860"
                cta="Ver lista"
              />
              <ActionRow
                icon={UserPlus}
                tone="success"
                title="64 promissores"
                detail="Novos com 2+ visitas no primeiro mês"
                impact="Acelerar para 'leais'"
                cta="Plano de ativação"
              />
            </div>
          </ChartCard>
        </div>
      </div>

      {/* Top clients */}
      <ChartCard
        title="Top clientes · LTV"
        subtitle="Maior valor acumulado · todas as visitas registradas"
      >
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left font-semibold py-2 px-3">#</th>
                <th className="text-left font-semibold py-2 px-3">Cliente</th>
                <th className="text-left font-semibold py-2 px-3">Telefone</th>
                <th className="text-right font-semibold py-2 px-3">Visitas</th>
                <th className="text-right font-semibold py-2 px-3">LTV</th>
                <th className="text-left font-semibold py-2 px-3">Última</th>
                <th className="text-right font-semibold py-2 px-3">Segmento</th>
                <th className="text-right font-semibold py-2 px-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_TOP_CLIENTS.map((c, i) => (
                <motion.tr
                  key={c.phone}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="border-b border-border/60 hover:bg-secondary/30 transition-smooth"
                >
                  <td className="py-3 px-3 text-muted-foreground font-mono">{i + 1}</td>
                  <td className="py-3 px-3 font-semibold">{c.nome}</td>
                  <td className="py-3 px-3 font-mono text-muted-foreground">{c.phone}</td>
                  <td className="py-3 px-3 text-right font-mono">{c.visitas}</td>
                  <td className="py-3 px-3 text-right font-mono font-semibold">R$ {c.ltv.toLocaleString("pt-BR")}</td>
                  <td className="py-3 px-3 text-muted-foreground text-[11px]">{c.lastVisit}</td>
                  <td className="py-3 px-3 text-right">
                    <StatusPill
                      variant={
                        c.tag === "Campeão" ? "info" : c.tag === "Leal" ? "success" : "warning"
                      }
                      pulse={c.tag === "Em risco"}
                    >
                      {c.tag}
                    </StatusPill>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button className="text-brand-cyan font-semibold text-[11px] hover:underline">
                      WhatsApp →
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <InsightCard
          severity="info"
          icon={Lightbulb}
          title="Frequência média subiu para 2,3x/mês"
          body="Ganho de 0,4 visita/cliente nos últimos 60 dias — mesmo efeito do programa de cupons na operação. Manter ativo."
          cta="Ver evolução"
        />
        <InsightCard
          severity="warn"
          icon={AlertTriangle}
          title="38 leais migrando para 'em risco'"
          body="Sem visita há 21 dias. Janela ideal de win-back é dos 25 aos 40 dias — depois cai pra 18% recuperação."
          cta="Criar lista"
        />
        <InsightCard
          severity="success"
          icon={CheckCircle2}
          title="LTV médio cresceu 17,8% YoY"
          body="Mix premium e ticket médio puxando a base. Manter campanha de reposicionamento das secadoras 22kg."
          cta="Ver detalhamento"
        />
      </div>
    </div>
  );
}

/* ----- Action row ----- */
function ActionRow({
  icon: Icon,
  tone,
  title,
  detail,
  impact,
  cta,
}: {
  icon: any;
  tone: "cyan" | "purple" | "warning" | "success";
  title: string;
  detail: string;
  impact: string;
  cta: string;
}) {
  const toneMap = {
    cyan: "bg-brand-cyan/15 text-brand-cyan border-brand-cyan/25",
    purple: "bg-brand-purple/15 text-brand-purple border-brand-purple/25",
    warning: "bg-warning/15 text-warning border-warning/25",
    success: "bg-success/15 text-success border-success/25",
  } as const;
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-3 hover:border-border-strong transition-smooth">
      <div className="flex gap-3">
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${toneMap[tone]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[12px]">{title}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{detail}</div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-success font-mono">{impact}</span>
            <button className={`text-[11px] font-semibold ${toneMap[tone].split(" ")[1]} hover:underline`}>
              {cta} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

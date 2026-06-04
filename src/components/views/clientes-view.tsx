"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, CheckCircle2, Crown, Heart, Lightbulb, MessageSquare,
  Search, Sparkles, TrendingDown, TrendingUp, UserPlus, Users,
  Upload, Building2, Database, Calendar,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartCard, LegendDot } from "@/components/ui/chart-card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { InsightCard } from "@/components/ui/insight-card";
import { Button } from "@/components/ui/button";
import { tooltipFormatter } from "@/lib/recharts-helpers";
import type {
  ClientesKpis, SegmentoRFM, TopCliente, CrescimentoSemanal, ClienteRow,
} from "@/lib/clientes-queries";
import { ImportarClientesDialog } from "@/components/clientes/importar-clientes-dialog";

// Curva de retenção sintética (futuro: cohort real)
const RETENCAO_PLACEHOLDER = [
  { mes: "M0", retencao: 100 },
  { mes: "M1", retencao: 68 },
  { mes: "M2", retencao: 52 },
  { mes: "M3", retencao: 41 },
  { mes: "M4", retencao: 35 },
  { mes: "M5", retencao: 31 },
  { mes: "M6", retencao: 28 },
];

export function ClientesView({
  unidadeId,
  unidadeNome,
  kpis,
  segmentos,
  topClientes,
  crescimento,
  clientes,
  totalClientes,
  busca,
}: {
  unidadeId: string;
  unidadeNome: string;
  kpis: ClientesKpis;
  segmentos: SegmentoRFM[];
  topClientes: TopCliente[];
  crescimento: CrescimentoSemanal[];
  clientes: ClienteRow[];
  totalClientes: number;
  busca: string;
}) {
  const router = useRouter();
  const [importOpen, setImportOpen] = React.useState(false);
  const [buscaLocal, setBuscaLocal] = React.useState(busca);
  const baseVazia = totalClientes === 0;

  function submitBusca(e: React.FormEvent) {
    e.preventDefault();
    const url = buscaLocal.trim() ? `/clientes?q=${encodeURIComponent(buscaLocal.trim())}` : "/clientes";
    router.push(url);
  }

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6">
      <PageHeader
        eyebrow={`Clientes · Unidade ${unidadeNome}`}
        title="Base ativa, recorrência e fidelização"
        subtitle={
          baseVazia
            ? "Nenhum cliente cadastrado ainda nesta unidade. Importe a planilha pra começar."
            : `${totalClientes} cliente${totalClientes === 1 ? "" : "s"} · segmentação RFM · novos vs recorrentes · top por LTV · oportunidades de win-back.`
        }
        actions={
          <div className="flex items-center gap-2">
            <form onSubmit={submitBusca} className="hidden md:flex items-center gap-1">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-surface-glass border border-border focus-within:border-brand-cyan/40">
                <Search className="w-3 h-3 text-muted-foreground" />
                <input
                  value={buscaLocal}
                  onChange={(e) => setBuscaLocal(e.target.value)}
                  placeholder="Buscar nome, CPF, telefone..."
                  className="bg-transparent text-xs outline-none w-48"
                />
              </div>
            </form>
            <Button
              size="sm"
              className="text-xs h-8 bg-gradient-to-r from-brand-cyan to-brand-blue text-white hover:opacity-90"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="w-3 h-3 mr-1" /> Importar planilha
            </Button>
          </div>
        }
      />

      {/* Banner contexto + estado vazio */}
      {baseVazia && (
        <EstadoVazio unidadeNome={unidadeNome} onImportar={() => setImportOpen(true)} />
      )}

      {/* KPIs */}
      {!baseVazia && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Base total"
            value={kpis.total.toString()}
            delta={{ value: kpis.novosUltimos30d, direction: kpis.novosUltimos30d > 0 ? "up" : "neutral" }}
            deltaLabel={`+${kpis.novosUltimos30d} nos 30d`}
            tone="cyan"
            icon={Users}
          />
          <KpiCard
            label="Ativos (90d)"
            value={kpis.ativos90d.toString()}
            delta={{ value: pct(kpis.ativos90d, kpis.total), direction: "up" }}
            deltaLabel="% da base"
            tone="success"
            icon={Heart}
          />
          <KpiCard
            label="Em risco"
            value={kpis.emRisco.toString()}
            delta={{ value: pct(kpis.emRisco, kpis.total), direction: "up" }}
            deltaLabel="precisam win-back"
            tone="warning"
            icon={AlertTriangle}
          />
          <KpiCard
            label="Dormentes"
            value={kpis.dormentes.toString()}
            delta={{ value: pct(kpis.dormentes, kpis.total), direction: "down" }}
            deltaLabel="recuperar via WA"
            tone="danger"
            icon={TrendingDown}
          />
        </div>
      )}

      {/* RFM + Growth */}
      {!baseVazia && (
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
                    data={segmentos}
                    dataKey="count"
                    nameKey="segment"
                    innerRadius={48}
                    outerRadius={96}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {segmentos.map((s, i) => (
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
                {segmentos.map((s, i) => (
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
              subtitle="Sustentabilidade da base · semanas mais antigas à esquerda"
              height={320}
              actions={
                <div className="flex items-center gap-3 text-[11px]">
                  <LegendDot color="var(--brand-cyan)" /> Novos
                  <LegendDot color="var(--brand-purple)" /> Recorrentes
                </div>
              }
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={crescimento} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
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
      )}

      {/* Retention + actions */}
      {!baseVazia && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <ChartCard
            title="Curva de retenção (placeholder)"
            subtitle="Estimativa até implementarmos cohort real com base em ciclos"
            height={260}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={RETENCAO_PLACEHOLDER} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 12, fontSize: 12 }}
                  formatter={tooltipFormatter<number>((v) => `${v}% retenção`)}
                />
                <Line type="monotone" dataKey="retencao" stroke="var(--brand-cyan)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--brand-cyan)", strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="xl:col-span-2">
            <ChartCard
              title="Oportunidades de ação · CLOCK"
              subtitle="Sugestões priorizadas a partir do snapshot atual"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ActionRow icon={MessageSquare} tone="cyan"
                  title={`Win-back · ${kpis.dormentes} dormentes`}
                  detail="Disparar mensagem com cupom 30% via WhatsApp"
                  impact={`≈ R$ ${(kpis.dormentes * kpis.ticketMedio * 0.15).toFixed(0)} receita estimada`}
                  cta="Disparar campanha"
                />
                <ActionRow icon={Crown} tone="purple"
                  title={`Reconhecer top ${segmentos.find(s => s.segment === "Campeões")?.count ?? 0}`}
                  detail="Mensagem personalizada + benefício exclusivo"
                  impact="↑ NPS estimado"
                  cta="Criar mensagem"
                />
                <ActionRow icon={AlertTriangle} tone="warning"
                  title={`${kpis.emRisco} clientes em risco`}
                  detail="Frequência caiu nas últimas 4 semanas (25-60 dias)"
                  impact={`Prevenir churn ≈ R$ ${(kpis.emRisco * kpis.ticketMedio).toFixed(0)}`}
                  cta="Ver lista"
                />
                <ActionRow icon={UserPlus} tone="success"
                  title={`${kpis.novosUltimos30d} novos nos últimos 30d`}
                  detail="Cadastraram no totem — acelerar segunda compra"
                  impact="Acelerar para 'leais'"
                  cta="Plano de ativação"
                />
              </div>
            </ChartCard>
          </div>
        </div>
      )}

      {/* Top + listagem */}
      {!baseVazia && (
        <ChartCard
          title="Top clientes · LTV"
          subtitle="Maior valor acumulado · ordenado por compras totais"
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
                {topClientes.map((c, i) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-border/60 hover:bg-secondary/30 transition-smooth"
                  >
                    <td className="py-3 px-3 text-muted-foreground font-mono">{i + 1}</td>
                    <td className="py-3 px-3 font-semibold">{c.nome}</td>
                    <td className="py-3 px-3 font-mono text-muted-foreground">{c.phone}</td>
                    <td className="py-3 px-3 text-right font-mono">{c.visitas}</td>
                    <td className="py-3 px-3 text-right font-mono font-semibold">
                      R$ {c.ltv.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground text-[11px]">{c.lastVisit}</td>
                    <td className="py-3 px-3 text-right">
                      <StatusPill
                        variant={c.tag === "Campeão" ? "info" : c.tag === "Leal" ? "success" : c.tag === "Em risco" ? "warning" : "neutral"}
                        pulse={c.tag === "Em risco"}
                      >
                        {c.tag}
                      </StatusPill>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <a
                        href={c.phone && c.phone !== "—" ? `https://wa.me/55${c.phone.replace(/\D/g, "")}` : "#"}
                        target="_blank"
                        rel="noreferrer"
                        className={c.phone && c.phone !== "—"
                          ? "text-brand-cyan font-semibold text-[11px] hover:underline"
                          : "text-muted-foreground/40 text-[11px] pointer-events-none"}
                      >
                        WhatsApp →
                      </a>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      {/* Listagem completa (com busca) */}
      {!baseVazia && (
        <ChartCard
          title={busca ? `Busca: "${busca}"` : "Base completa"}
          subtitle={`${clientes.length} de ${totalClientes} cliente${totalClientes === 1 ? "" : "s"} nesta unidade${busca ? " (filtrados)" : ""}`}
        >
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left font-semibold py-2 px-3">Nome</th>
                  <th className="text-left font-semibold py-2 px-3">CPF</th>
                  <th className="text-left font-semibold py-2 px-3">Telefone</th>
                  <th className="text-left font-semibold py-2 px-3">E-mail</th>
                  <th className="text-right font-semibold py-2 px-3">Compras</th>
                  <th className="text-right font-semibold py-2 px-3">LTV</th>
                  <th className="text-left font-semibold py-2 px-3">Cadastro</th>
                  <th className="text-left font-semibold py-2 px-3">Última</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id} className="border-b border-border/40 hover:bg-secondary/20">
                    <td className="py-2 px-3 font-semibold truncate max-w-[200px]">{c.nome}</td>
                    <td className="py-2 px-3 font-mono text-muted-foreground">{c.cpf}</td>
                    <td className="py-2 px-3 font-mono text-muted-foreground">{c.telefone ?? "—"}</td>
                    <td className="py-2 px-3 text-muted-foreground truncate max-w-[180px]">{c.email ?? "—"}</td>
                    <td className="py-2 px-3 text-right font-mono">{c.compras_total_qtd}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">
                      R$ {Number(c.compras_total_valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground text-[11px]">
                      {c.cadastrado_em ? new Date(c.cadastrado_em).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground text-[11px]">
                      {c.ultima_compra_em ? new Date(c.ultima_compra_em).toLocaleDateString("pt-BR") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {clientes.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-[13px]">
                Nenhum resultado pra essa busca.
              </div>
            )}
          </div>
        </ChartCard>
      )}

      {/* Insights */}
      {!baseVazia && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <InsightCard
            severity="info"
            icon={Lightbulb}
            title={`LTV médio: R$ ${kpis.ltvMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            body={`Ticket médio por compra: R$ ${kpis.ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Snapshot da última planilha importada.`}
            cta="Ver evolução"
          />
          <InsightCard
            severity="warn"
            icon={AlertTriangle}
            title={`${kpis.emRisco} leais migrando para 'em risco'`}
            body="Sem compra entre 25 e 60 dias. Janela ideal de win-back é até 40 dias — depois cai pra 18% recuperação."
            cta="Criar lista"
          />
          <InsightCard
            severity="success"
            icon={CheckCircle2}
            title={`${pct(kpis.ativos90d, kpis.total)}% da base ativa nos últimos 90d`}
            body="Quanto mais alta essa taxa, menor o custo de aquisição efetivo. Acompanhar semanalmente."
            cta="Ver detalhamento"
          />
        </div>
      )}

      {/* Import dialog */}
      <ImportarClientesDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        unidadeId={unidadeId}
        unidadeNome={unidadeNome}
      />
    </div>
  );
}

function EstadoVazio({
  unidadeNome,
  onImportar,
}: {
  unidadeNome: string;
  onImportar: () => void;
}) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-brand-cyan/30 bg-gradient-to-br from-brand-cyan/5 to-brand-purple/5 p-10 text-center">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-brand-cyan/15 to-brand-purple/15 border border-brand-cyan/25 flex items-center justify-center mb-4">
        <Database className="w-7 h-7 text-brand-cyan" />
      </div>
      <h2 className="font-display text-xl font-bold mb-2">
        Base de clientes vazia · {unidadeNome}
      </h2>
      <p className="text-[13px] text-muted-foreground max-w-md mx-auto mb-5">
        Importe a planilha exportada do <strong>MAXLAV</strong> ou <strong>VM Tecnologia</strong> pra
        começar a ver KPIs, segmentação RFM e oportunidades de win-back.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Button
          size="lg"
          className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white hover:opacity-90"
          onClick={onImportar}
        >
          <Upload className="w-4 h-4 mr-2" /> Importar planilha
        </Button>
      </div>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left">
        <FeatureMini icon={Building2} title="Por unidade" body="Dados 100% isolados — Buritis ≠ Castelo ≠ Cabral." />
        <FeatureMini icon={Calendar} title="Snapshot datado" body="A planilha traz métricas até a data emitida (Emitido em)." />
        <FeatureMini icon={Sparkles} title="Pronto pra API" body="Quando MAXLAV liberar, a integração substitui o upload." />
      </div>
    </div>
  );
}

function FeatureMini({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="w-7 h-7 rounded-lg bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center mb-2">
        <Icon className="w-3.5 h-3.5 text-brand-cyan" />
      </div>
      <div className="font-semibold text-[12px]">{title}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{body}</div>
    </div>
  );
}

function ActionRow({
  icon: Icon, tone, title, detail, impact, cta,
}: {
  icon: React.ElementType;
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

function pct(num: number, denom: number): number {
  if (!denom) return 0;
  return Math.round((num / denom) * 100);
}

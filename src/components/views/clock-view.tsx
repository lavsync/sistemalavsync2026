"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  Clock,
  FileText,
  History,
  MessageSquare,
  Mic,
  Send,
  Sparkles,
  TrendingDown,
  Wallet,
  Wand2,
  Wrench,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ChartCard } from "@/components/ui/chart-card";
import { InsightCard } from "@/components/ui/insight-card";
import { Button } from "@/components/ui/button";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

const TIMELINE = [
  { value: 142, time: "06h" }, { value: 168, time: "08h" }, { value: 121, time: "10h" },
  { value: 245, time: "12h" }, { value: 189, time: "14h" }, { value: 207, time: "16h" },
  { value: 312, time: "18h" }, { value: 198, time: "20h" }, { value: 156, time: "22h" },
];

const HISTORY = [
  { time: "14:02", type: "insight", text: "Detectada queda de 18% projetada para fechamento de Maio.", severity: "danger" as const },
  { time: "13:45", type: "action", text: "Sugerida campanha de win-back para 107 inativos via WhatsApp.", severity: "info" as const },
  { time: "11:20", type: "alert", text: "PINPAD com 7 timeouts em 2h — investigação iniciada.", severity: "warn" as const },
  { time: "09:01", type: "summary", text: "Resumo matinal enviado para o WhatsApp do Daniel.", severity: "info" as const },
  { time: "07:30", type: "prediction", text: "Pico previsto entre 18h–22h com confiança 87%.", severity: "info" as const },
];

const sevToTone = (s: typeof HISTORY[number]["severity"]) => ({
  danger: "bg-danger/15 text-danger border-danger/30",
  warn: "bg-warning/15 text-warning border-warning/30",
  info: "bg-brand-cyan/15 text-brand-cyan border-brand-cyan/30",
}[s]);

export function ClockView() {
  return (
    <div className="px-6 lg:px-8 py-6 space-y-6">
      <PageHeader
        eyebrow="CLOCK AI · Copiloto Operacional"
        title={
          <>
            CLOCK está <span className="text-gradient-brand">ativo</span> e analisando sua operação.
          </> as unknown as string
        }
        subtitle="Inteligência contínua sobre faturamento, clientes, máquinas e marketing · 24/7 · resumos via WhatsApp · respostas em linguagem natural."
        actions={
          <>
            <Button variant="outline" size="sm" className="text-xs h-8">
              <FileText className="w-3 h-3 mr-1" /> Gerar relatório
            </Button>
            <Button size="sm" className="text-xs h-8 bg-brand-cyan hover:bg-brand-cyan/90 text-primary-foreground">
              <MessageSquare className="w-3 h-3 mr-1" /> Conectar WhatsApp
            </Button>
          </>
        }
      />

      {/* CLOCK ORB HERO */}
      <div className="card-premium relative rounded-2xl overflow-hidden">
        <div className="absolute inset-0 grid-fade opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/[0.04] via-transparent to-brand-purple/[0.06]" />

        <div className="relative grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8 p-8 items-center">
          {/* Orb */}
          <div className="flex justify-center">
            <motion.div
              className="relative"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <div className="w-44 h-44 rounded-full clock-orb" />
              <div className="absolute inset-0 rounded-full border border-brand-cyan/20 animate-ping" />
            </motion.div>
          </div>

          {/* Summary */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-success/10 border border-success/20 text-[10px] font-semibold uppercase tracking-wider text-success mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Online · processando 1.247 eventos/min
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight leading-snug">
              &ldquo;Hoje sua operação está <span className="text-success">95,2%</span> saudável.
              Receita parcial está <span className="text-warning">−24%</span> da meta diária.
              Recomendo disparar a campanha de win-back no horário de pico.&rdquo;
            </h2>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              Última análise há 38 segundos · próxima em 1m22s · cobertura: receita, ocupação, máquinas, clientes, energia, marketing, financeiro.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <Button size="sm" className="text-xs h-8 bg-brand-cyan hover:bg-brand-cyan/90 text-primary-foreground">
                <Sparkles className="w-3 h-3 mr-1" /> Ver plano de ação
              </Button>
              <Button variant="outline" size="sm" className="text-xs h-8">
                <Mic className="w-3 h-3 mr-1" /> Falar com CLOCK
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* CHAT + INSIGHTS GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Chat composer */}
        <ChartCard
          className="xl:col-span-2"
          title="Conversa com CLOCK"
          subtitle="Pergunte sobre qualquer indicador, cliente ou cenário"
          height={420}
          actions={<Button variant="ghost" size="sm" className="text-xs h-7"><History className="w-3 h-3 mr-1" /> Histórico</Button>}
        >
          <div className="flex flex-col h-full">
            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-auto pr-2">
              <ChatBubble role="user" text="qual máquina deu mais lucro em maio?" />
              <ChatBubble
                role="clock"
                text="Em maio até hoje, a SC-02 (Secadora 22kg) lidera com R$ 1.940 brutos · margem 64% após energia/química. A LV-04 está abaixo da média (R$ 412) com ocupação de 22% e alerta técnico em aberto. Quer que eu inclua isso no relatório semanal?"
              />
              <ChatBubble role="user" text="prepara o resumo para enviar amanhã 8h" />
              <ChatBubble
                role="clock"
                text="Feito. Resumo agendado para 14/05 08h00 com: faturamento por máquina, top 3 horários, alertas pendentes e 2 sugestões de ação. Confirmação será enviada pelo WhatsApp."
              />
            </div>

            {/* Composer */}
            <div className="mt-3 rounded-xl border border-border bg-surface-glass p-2.5">
              <div className="flex items-end gap-2">
                <textarea
                  rows={2}
                  placeholder="Pergunte algo como: 'qual a previsão de fechamento?', 'agende relatório semanal', 'simule cenário de aumento de ticket'..."
                  className="flex-1 bg-transparent text-xs outline-none resize-none placeholder:text-muted-foreground/70"
                />
                <Button size="icon" className="h-8 w-8 bg-brand-cyan hover:bg-brand-cyan/90 text-primary-foreground shrink-0">
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border">
                <PromptChip text="Resumir o dia" />
                <PromptChip text="Prever fechamento" />
                <PromptChip text="Sugerir ação" />
                <PromptChip text="Comparar com mês anterior" />
              </div>
            </div>
          </div>
        </ChartCard>

        {/* Activity timeline */}
        <ChartCard title="Histórico de inteligência" subtitle="Últimas 24 horas" height={420}>
          <div className="space-y-3 overflow-auto h-full pr-1">
            {HISTORY.map((h, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex gap-3"
              >
                <div className="text-[10px] font-mono text-muted-foreground pt-0.5 w-10 shrink-0">
                  {h.time}
                </div>
                <div className={`flex-1 rounded-lg border p-2.5 ${sevToTone(h.severity)}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-70">
                    {h.type}
                  </div>
                  <p className="text-[12px] leading-relaxed text-foreground">{h.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* PREDICTIONS + INSIGHTS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard
          className="xl:col-span-2"
          title="Previsões em tempo real"
          subtitle="Modelos de série temporal · ajuste contínuo"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PredictionTile
              label="Fechamento do dia"
              value="R$ 487"
              delta="−24% vs meta"
              trend="down"
              data={TIMELINE}
            />
            <PredictionTile
              label="Pico previsto"
              value="20h12"
              delta="confiança 87%"
              trend="up"
              data={TIMELINE.slice(2)}
            />
            <PredictionTile
              label="Próxima falha"
              value="LV-04"
              delta="janela 48h"
              trend="warn"
              data={TIMELINE.map(t => ({ ...t, value: t.value * 0.6 }))}
            />
          </div>
        </ChartCard>

        <ChartCard title="Ações sugeridas" subtitle="Plano executável de 5 itens" height={280}>
          <ul className="space-y-2">
            {[
              { icon: MessageSquare, t: "Disparar campanha win-back · 107 inativos", e: "+R$ 1.123/mês" },
              { icon: Wrench, t: "Agendar manutenção LV-04 · janela 03h", e: "evita downtime" },
              { icon: Wallet, t: "Renegociar aluguel · proposta R$ 2.500", e: "+R$ 1.500/mês" },
              { icon: BarChart3, t: "Teste A/B mix premium SC-01/SC-02", e: "+R$ 2.400/mês" },
              { icon: Zap, t: "Reduzir iluminação 03h–05h em 70%", e: "−R$ 220/mês" },
            ].map((a, i) => (
              <li key={i} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-secondary/40 transition-smooth cursor-pointer group">
                <div className="w-7 h-7 rounded-md bg-brand-cyan/12 text-brand-cyan flex items-center justify-center shrink-0">
                  <a.icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold leading-snug">{a.t}</div>
                  <div className="text-[10px] text-success font-mono mt-0.5">{a.e}</div>
                </div>
                <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-brand-cyan transition-smooth" />
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      {/* INSIGHTS GALLERY */}
      <div>
        <div className="flex items-end justify-between mb-3">
          <div>
            <h3 className="font-display font-semibold text-base tracking-tight">Análises de desvio</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Detectadas pela CLOCK nos últimos 7 dias</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <InsightCard severity="danger" icon={TrendingDown} title="Faturamento −18% projetado em Maio" body="Ritmo atual sustenta R$ 3.243 vs meta R$ 4.000. Causa principal: queda de 22% nas vendas no horário 18h–20h." cta="Ver análise completa" />
          <InsightCard severity="warn" icon={AlertTriangle} title="LV-04 com 31% mais health-checks" body="Padrão consistente com bobina de aquecimento desgastada. Janela de manutenção ideal: amanhã 03h00." cta="Agendar técnico" />
          <InsightCard severity="info" icon={Wand2} title="Cluster de 8 clientes premium identificado" body="Compram 3+ ciclos/semana com ticket R$ 28+. Programa de fidelidade pode aumentar LTV em 35%." cta="Criar programa" />
          <InsightCard severity="info" icon={Clock} title="Ociosidade entre 03h–05h custa R$ 1.890/mês" body="Energia base + aluguel rateado nesta janela sem retorno operacional. Standby automatizado economiza 60%." cta="Modelar standby" />
          <InsightCard severity="success" icon={BarChart3} title="Quartas-feiras superam projeção em +12%" body="Padrão consistente nas últimas 8 semanas. Aproveitar para programar campanhas e estoque de químicos." cta="Planejar quartas" />
          <InsightCard severity="info" icon={Bot} title="CLOCK aprendeu novo padrão sazonal" body="Modelo identificou ciclo quinzenal de pagamento que afeta picos de receita ±18%. Aplicado nas próximas previsões." cta="Ver modelo" />
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ role, text }: { role: "user" | "clock"; text: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-brand-cyan/12 border border-brand-cyan/20 px-3.5 py-2 text-[12px] text-foreground">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2 items-start">
      <div className="w-7 h-7 rounded-full clock-orb shrink-0" />
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-secondary/60 border border-border px-3.5 py-2 text-[12px] leading-relaxed">
        {text}
      </div>
    </div>
  );
}

function PromptChip({ text }: { text: string }) {
  return (
    <button className="text-[10px] px-2 py-0.5 rounded bg-secondary hover:bg-muted transition-smooth">
      {text}
    </button>
  );
}

function PredictionTile({
  label, value, delta, trend, data,
}: {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "warn";
  data: typeof TIMELINE;
}) {
  const color = trend === "down" ? "var(--danger)" : trend === "warn" ? "var(--warning)" : "var(--brand-cyan)";
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">{label}</div>
      <div className="font-mono font-bold text-2xl">{value}</div>
      <div className="text-[11px] mt-1" style={{ color }}>{delta}</div>
      <div className="h-12 mt-3 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#grad-${label})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

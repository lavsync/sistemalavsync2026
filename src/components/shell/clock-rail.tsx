"use client";

import { Sparkles, AlertTriangle, TrendingDown, Wand2, MessageSquare, Zap, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const insights = [
  {
    severity: "danger" as const,
    icon: TrendingDown,
    title: "Queda projetada de 18% em Mai/26",
    body: "CLOCK detectou desaceleração nas últimas 96h. Se nada mudar, fechamento será R$ 3.243.",
    action: "Ver simulação",
  },
  {
    severity: "warn" as const,
    icon: AlertTriangle,
    title: "Máquina LV-04 com risco de falha",
    body: "Aumento de 31% nos health-checks de comunicação. Janela de manutenção sugerida: amanhã 03h.",
    action: "Agendar técnico",
  },
  {
    severity: "info" as const,
    icon: Wand2,
    title: "107 clientes inativos · R$ 3.745 dormentes",
    body: "Campanha de win-back via WhatsApp pode reativar 30% (~R$ 1.123/mês recorrente).",
    action: "Disparar campanha",
  },
];

const severityClass = {
  danger: "border-danger/30 bg-danger/[0.04]",
  warn: "border-warning/30 bg-warning/[0.04]",
  info: "border-brand-cyan/30 bg-brand-cyan/[0.04]",
};
const severityIcon = {
  danger: "bg-danger/15 text-danger",
  warn: "bg-warning/15 text-warning",
  info: "bg-brand-cyan/15 text-brand-cyan",
};

export function ClockRail() {
  return (
    <aside className="hidden xl:flex w-[340px] shrink-0 flex-col border-l border-border bg-sidebar/40 sticky top-14 self-start h-[calc(100vh-3.5rem)] overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-start gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-full clock-orb" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-display font-bold text-sm">CLOCK AI</h3>
              <Sparkles className="w-3 h-3 text-brand-cyan" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Copiloto operacional · análise contínua
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Insights" value="3" tone="cyan" />
          <Stat label="Alertas" value="2" tone="warn" />
          <Stat label="Ações" value="5" tone="purple" />
        </div>
      </div>

      {/* Daily summary */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Resumo do dia
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">14:02</span>
        </div>
        <p className="text-xs leading-relaxed text-foreground/90">
          Operação está <span className="text-success font-semibold">95,2%</span> saudável.
          Receita parcial <span className="font-mono font-semibold">R$ 142,30</span> com{" "}
          <span className="font-mono font-semibold">7 vendas</span>.
          Pico previsto entre <span className="font-semibold">18h–22h</span>. Máquina LV-04 precisa de atenção esta semana.
        </p>
      </div>

      {/* Insights list */}
      <div className="flex-1 px-3 py-3 space-y-2">
        <div className="px-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Insights inteligentes
          </span>
          <button className="text-[10px] text-brand-cyan font-semibold hover:underline">
            Ver todos
          </button>
        </div>

        {insights.map((it, i) => {
          const Icon = it.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
              className={`group relative rounded-lg border ${severityClass[it.severity]} p-3 transition-smooth hover:border-border-strong cursor-pointer`}
            >
              <div className="flex gap-2.5">
                <div className={`w-7 h-7 rounded-md ${severityIcon[it.severity]} flex items-center justify-center shrink-0`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[12px] font-semibold leading-snug">{it.title}</h4>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{it.body}</p>
                  <button className="mt-2 text-[11px] text-brand-cyan font-semibold inline-flex items-center gap-0.5 hover:gap-1 transition-all">
                    {it.action} <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Composer */}
      <div className="p-4 border-t border-border bg-background/40">
        <div className="rounded-lg border border-border bg-surface-glass p-2.5">
          <div className="flex items-end gap-2">
            <textarea
              rows={2}
              placeholder="Pergunte ao CLOCK: 'qual máquina está mais ociosa?'"
              className="flex-1 bg-transparent text-xs outline-none resize-none placeholder:text-muted-foreground/70"
            />
            <Button size="icon" className="h-7 w-7 bg-brand-cyan hover:bg-brand-cyan/90 text-primary-foreground shrink-0">
              <Zap className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border">
            <button className="text-[10px] px-2 py-0.5 rounded bg-secondary hover:bg-muted transition-smooth">
              Resumir dia
            </button>
            <button className="text-[10px] px-2 py-0.5 rounded bg-secondary hover:bg-muted transition-smooth">
              Prever fechamento
            </button>
            <button className="text-[10px] px-2 py-0.5 rounded bg-secondary hover:bg-muted transition-smooth">
              Sugerir ação
            </button>
          </div>
        </div>
        <button className="mt-2 w-full flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-smooth py-1">
          <MessageSquare className="w-3 h-3" />
          Ativar notificações via WhatsApp
        </button>
      </div>
    </aside>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "cyan" | "warn" | "purple" }) {
  const toneClass = {
    cyan: "text-brand-cyan",
    warn: "text-warning",
    purple: "text-brand-purple",
  }[tone];
  return (
    <div className="rounded-md border border-border bg-card/50 px-2.5 py-2">
      <div className={`text-base font-bold font-mono ${toneClass}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5 font-medium">
        {label}
      </div>
    </div>
  );
}

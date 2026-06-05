"use client";

import * as React from "react";
import Image from "next/image";
import {
  Sparkles, AlertTriangle, TrendingDown, Wand2, MessageSquare, Zap,
  ChevronRight, PanelRightClose, PanelRightOpen, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "lavsync.copilot.collapsed";

const insights = [
  {
    severity: "danger" as const,
    icon: TrendingDown,
    title: "Queda projetada de 18% em Mai/26",
    body: "Copilot detectou desaceleração nas últimas 96h. Se nada mudar, fechamento será R$ 3.243.",
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

// ============ MAIN COMPONENT ============
// Desktop: aside lateral recolhível (h-screen).
// Mobile: FAB flutuante que abre como Sheet pela direita.
export function ClockRail() {
  const [collapsed, setCollapsed] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const stored = typeof window !== "undefined"
      ? window.localStorage.getItem(STORAGE_KEY)
      : null;
    if (stored === "1") setCollapsed(true);
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed, hydrated]);

  return (
    <>
      {/* ====== DESKTOP rail (xl+) ====== */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 56 : 340 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="hidden xl:flex shrink-0 flex-col border-l border-border bg-sidebar/40 sticky top-14 self-start h-[calc(100vh-3.5rem)] overflow-hidden"
        style={{ willChange: "width" }}
      >
        {collapsed ? (
          <CollapsedRail onExpand={() => setCollapsed(false)} />
        ) : (
          <FullRail onCollapse={() => setCollapsed(true)} />
        )}
      </motion.aside>

      {/* ====== MOBILE FAB (xl-) — flutuante bottom-right ====== */}
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Trigger asChild>
          <button
            aria-label="Abrir IA Copilot"
            className="xl:hidden fixed bottom-5 right-5 z-30 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_8px_28px_-6px_rgba(25,199,203,0.55)] touch-manipulation transition-transform active:scale-95"
            style={{
              background: "linear-gradient(135deg, #01385B 0%, #0F859A 35%, #19C7CB 70%, #73D8D8 100%)",
            }}
          >
            <Image
              src="/brand/icons/ia-copilot.png"
              alt="IA Copilot"
              width={56}
              height={56}
              className="w-9 h-9 object-contain drop-shadow"
            />
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-warning text-[10px] font-bold text-white">
              3
            </span>
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <AnimatePresence>
            {mobileOpen && (
              <>
                <Dialog.Overlay asChild forceMount>
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                  />
                </Dialog.Overlay>
                <Dialog.Content asChild forceMount>
                  <motion.div
                    initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    className="fixed inset-y-0 right-0 z-50 w-[92vw] max-w-[400px] bg-card border-l border-border shadow-2xl flex flex-col outline-none"
                  >
                    <Dialog.Title className="sr-only">IA Copilot LavSync</Dialog.Title>
                    <Dialog.Description className="sr-only">Assistente operacional inteligente</Dialog.Description>
                    <FullRail onCollapse={() => setMobileOpen(false)} mobile />
                  </motion.div>
                </Dialog.Content>
              </>
            )}
          </AnimatePresence>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

// ============ COLLAPSED RAIL (desktop) ============
function CollapsedRail({ onExpand }: { onExpand: () => void }) {
  return (
    <div className="h-full flex flex-col items-center py-4 gap-3">
      <button
        onClick={onExpand}
        aria-label="Expandir IA Copilot"
        className="w-10 h-10 rounded-xl flex items-center justify-center bg-brand-cyan/10 border border-brand-cyan/30 hover:bg-brand-cyan/20 transition-smooth"
      >
        <PanelRightOpen className="w-4 h-4 text-brand-cyan" />
      </button>

      <button
        onClick={onExpand}
        aria-label="IA Copilot"
        className="relative w-11 h-11 rounded-full flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #01385B 0%, #0F859A 35%, #19C7CB 70%, #73D8D8 100%)",
        }}
      >
        <Image
          src="/brand/icons/ia-copilot.png"
          alt="IA Copilot"
          width={44}
          height={44}
          className="w-7 h-7 object-contain"
        />
        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-warning text-[9px] font-bold text-white">
          3
        </span>
      </button>

      {/* Indicadores verticais */}
      <div className="mt-1 flex flex-col items-center gap-2 text-[9px] font-mono">
        <div className="w-8 text-center rounded bg-brand-cyan/10 text-brand-cyan py-1">3</div>
        <div className="w-8 text-center rounded bg-warning/10 text-warning py-1">2</div>
      </div>

      <div className="mt-auto rotate-180 text-[9px] uppercase tracking-[0.2em] font-semibold text-muted-foreground" style={{ writingMode: "vertical-rl" }}>
        IA Copilot
      </div>
    </div>
  );
}

// ============ FULL RAIL ============
function FullRail({ onCollapse, mobile = false }: { onCollapse: () => void; mobile?: boolean }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-start gap-3">
          <div
            className="relative w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #01385B 0%, #0F859A 35%, #19C7CB 70%, #73D8D8 100%)",
              boxShadow: "0 6px 20px -6px rgba(25, 199, 203, 0.5)",
            }}
          >
            <Image
              src="/brand/icons/ia-copilot.png"
              alt="IA Copilot"
              width={48}
              height={48}
              className="w-8 h-8 object-contain drop-shadow"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-display font-bold text-sm">IA Copilot</h3>
              <Sparkles className="w-3 h-3 text-brand-cyan" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Assistente operacional · análise contínua 24/7
            </p>
          </div>
          <button
            onClick={onCollapse}
            aria-label={mobile ? "Fechar" : "Recolher copilot"}
            className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-smooth"
          >
            {mobile ? <X className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
          </button>
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
      <div className="flex-1 px-3 py-3 space-y-2 overflow-y-auto custom-scroll-thin">
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
              className={cn(
                "group relative rounded-lg border p-3 transition-smooth hover:border-border-strong cursor-pointer",
                severityClass[it.severity],
              )}
            >
              <div className="flex gap-2.5">
                <div className={cn(
                  "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                  severityIcon[it.severity],
                )}>
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
              placeholder="Pergunte ao Copilot: 'qual máquina está mais ociosa?'"
              className="flex-1 bg-transparent text-xs outline-none resize-none placeholder:text-muted-foreground/70"
            />
            <Button size="icon" className="h-8 w-8 bg-brand-cyan hover:bg-brand-cyan/90 text-primary-foreground shrink-0">
              <Zap className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-border">
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
    </div>
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
      <div className={cn("text-base font-bold font-mono", toneClass)}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5 font-medium">
        {label}
      </div>
    </div>
  );
}

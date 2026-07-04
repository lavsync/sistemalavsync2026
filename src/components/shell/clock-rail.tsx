"use client";

// LavSync · CLOCK rail — o MESMO agente do módulo IA & Insights, embutido
// na lateral de todas as telas (voz, microfone, comando "pare", ações).
// Desktop: aside recolhível. Mobile: FAB que abre como sheet pela direita.
import * as React from "react";
import Image from "next/image";
import { Sparkles, PanelRightClose, PanelRightOpen, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { ClockChat } from "@/components/clock/clock-chat";

const STORAGE_KEY = "lavsync.copilot.collapsed";
const GRADIENTE = "linear-gradient(135deg, #01385B 0%, #0F859A 35%, #19C7CB 70%, #73D8D8 100%)";

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
        animate={{ width: collapsed ? 56 : 360 }}
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

      {/* ====== MOBILE FAB (xl-) ====== */}
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Trigger asChild>
          <button
            aria-label="Falar com o CLOCK"
            className="xl:hidden fixed bottom-5 right-5 z-30 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_8px_28px_-6px_rgba(25,199,203,0.55)] touch-manipulation transition-transform active:scale-95"
            style={{ background: GRADIENTE }}
          >
            <Image
              src="/brand/icons/ia-copilot.png"
              alt="CLOCK"
              width={56}
              height={56}
              className="w-9 h-9 object-contain drop-shadow"
            />
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
                    <Dialog.Title className="sr-only">CLOCK — IA do LavSync</Dialog.Title>
                    <Dialog.Description className="sr-only">Converse por voz ou texto com os dados ao vivo</Dialog.Description>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <span className="font-display font-bold text-sm inline-flex items-center gap-1.5">
                        CLOCK <Sparkles className="w-3 h-3 text-brand-cyan" />
                      </span>
                      <button onClick={() => setMobileOpen(false)} aria-label="Fechar"
                        className="p-1.5 rounded-md hover:bg-secondary">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 min-h-0">
                      <ClockChat embutido />
                    </div>
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
        aria-label="Expandir CLOCK"
        className="w-10 h-10 rounded-xl flex items-center justify-center bg-brand-cyan/10 border border-brand-cyan/30 hover:bg-brand-cyan/20 transition-smooth"
      >
        <PanelRightOpen className="w-4 h-4 text-brand-cyan" />
      </button>
      <button
        onClick={onExpand}
        aria-label="CLOCK"
        className="w-11 h-11 rounded-full flex items-center justify-center"
        style={{ background: GRADIENTE }}
      >
        <Image
          src="/brand/icons/ia-copilot.png"
          alt="CLOCK"
          width={44}
          height={44}
          className="w-7 h-7 object-contain"
        />
      </button>
      <div className="mt-auto rotate-180 text-[9px] uppercase tracking-[0.2em] font-semibold text-muted-foreground" style={{ writingMode: "vertical-rl" }}>
        CLOCK · IA
      </div>
    </div>
  );
}

// ============ FULL RAIL — o chat REAL do CLOCK ============
function FullRail({ onCollapse }: { onCollapse: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <span className="font-display font-bold text-sm inline-flex items-center gap-1.5">
          CLOCK <Sparkles className="w-3 h-3 text-brand-cyan" />
        </span>
        <button
          onClick={onCollapse}
          aria-label="Recolher CLOCK"
          className="p-1.5 rounded-md hover:bg-secondary transition-smooth"
        >
          <PanelRightClose className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <ClockChat embutido />
      </div>
    </div>
  );
}

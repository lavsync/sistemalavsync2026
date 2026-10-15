"use client";

// LavSync · CLOCK rail — view do MESMO estado do ClockProvider (raiz), embutida
// na lateral de todas as telas. Desktop: aside recolhível. Mobile: FAB que
// abre como sheet pela direita. Só UMA instância do chat fica montada por vez
// (desktop OU mobile), e as duas leem a mesma conversa do provider — trocar de
// página ou de tamanho de tela não perde histórico nem corta a voz.
import * as React from "react";
import Image from "next/image";
import { Sparkles, PanelRightClose, PanelRightOpen, X, Square } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { ClockChat } from "@/components/clock/clock-chat";
import { useClock, type EstadoClock } from "@/components/clock/clock-provider";
import { cn } from "@/lib/utils";

const GRADIENTE = "linear-gradient(135deg, #01385B 0%, #0F859A 35%, #19C7CB 70%, #73D8D8 100%)";
const QUERY_DESKTOP = "(min-width: 1280px)"; // breakpoint xl do Tailwind

const ROTULO_ESTADO: Record<EstadoClock, string> = {
  ocioso: "Pronto",
  ouvindo: "Ouvindo",
  pensando: "Pensando",
  falando: "Falando",
};

/** null até hidratar: evita montar o chat em dobro antes de saber o tamanho da tela. */
function useDesktop(): boolean | null {
  const [desktop, setDesktop] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    const mq = window.matchMedia(QUERY_DESKTOP);
    const atualizar = () => setDesktop(mq.matches);
    atualizar();
    mq.addEventListener("change", atualizar);
    return () => mq.removeEventListener("change", atualizar);
  }, []);
  return desktop;
}

export function ClockRail() {
  const { railRecolhido, setRailRecolhido, sheetAberto, setSheetAberto, estado, novidades, interromper } = useClock();
  const desktop = useDesktop();
  const pendentes = novidades.alertas.length + (novidades.briefing ? 1 : 0);

  // Ao virar desktop, o sheet mobile não faz sentido aberto
  React.useEffect(() => {
    if (desktop && sheetAberto) setSheetAberto(false);
  }, [desktop, sheetAberto, setSheetAberto]);

  return (
    <>
      {/* ====== DESKTOP rail (xl+) ====== */}
      <motion.aside
        initial={false}
        animate={{ width: railRecolhido ? 56 : 360 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="hidden xl:flex shrink-0 flex-col border-l border-border bg-sidebar/40 sticky top-14 self-start h-[calc(100vh-3.5rem)] overflow-hidden"
        style={{ willChange: "width" }}
      >
        {desktop && (railRecolhido ? (
          <CollapsedRail
            onExpand={() => setRailRecolhido(false)}
            estado={estado}
            pendentes={pendentes}
            onParar={interromper}
          />
        ) : (
          <FullRail onCollapse={() => setRailRecolhido(true)} estado={estado} />
        ))}
      </motion.aside>

      {/* ====== MOBILE FAB (xl-) ====== */}
      {desktop === false && (
        <Dialog.Root open={sheetAberto} onOpenChange={setSheetAberto}>
          <Dialog.Trigger asChild>
            <button
              aria-label="Falar com o CLOCK"
              className="fixed bottom-5 right-5 z-30 w-14 h-14 rounded-full flex items-center justify-center shadow-[0_8px_28px_-6px_rgba(25,199,203,0.55)] touch-manipulation transition-transform active:scale-95"
              style={{ background: GRADIENTE }}
            >
              <Image
                src="/brand/icons/ia-copilot.png"
                alt="CLOCK"
                width={56}
                height={56}
                className={cn("w-9 h-9 object-contain drop-shadow", estado !== "ocioso" && "animate-pulse")}
              />
              {pendentes > 0 && <ContadorNovidades total={pendentes} className="absolute -top-0.5 -right-0.5" />}
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <AnimatePresence>
              {sheetAberto && (
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
                          <IndicadorEstado estado={estado} />
                        </span>
                        <button onClick={() => setSheetAberto(false)} aria-label="Fechar"
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
      )}
    </>
  );
}

// ============ Indicador de estado (ouvindo / pensando / falando) ============
function IndicadorEstado({ estado }: { estado: EstadoClock }) {
  const cor =
    estado === "ouvindo" ? "bg-danger"
      : estado === "falando" ? "bg-brand-cyan"
        : estado === "pensando" ? "bg-warning"
          : "bg-success";
  return (
    <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      <span className={cn("w-1.5 h-1.5 rounded-full", cor, estado !== "ocioso" && "animate-pulse")} />
      {ROTULO_ESTADO[estado]}
    </span>
  );
}

function ContadorNovidades({ total, className }: { total: number; className?: string }) {
  return (
    <span
      aria-label={`${total} novidades do CLOCK`}
      className={cn(
        "min-w-[18px] h-[18px] px-1 rounded-full bg-warning text-white text-[10px] font-bold flex items-center justify-center",
        className,
      )}
    >
      {total > 9 ? "9+" : total}
    </span>
  );
}

// ============ COLLAPSED RAIL (desktop) ============
function CollapsedRail({
  onExpand, estado, pendentes, onParar,
}: { onExpand: () => void; estado: EstadoClock; pendentes: number; onParar: () => void }) {
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
        aria-label={`CLOCK · ${ROTULO_ESTADO[estado]}`}
        className="relative w-11 h-11 rounded-full flex items-center justify-center"
        style={{ background: GRADIENTE }}
      >
        <Image
          src="/brand/icons/ia-copilot.png"
          alt="CLOCK"
          width={44}
          height={44}
          className={cn("w-7 h-7 object-contain", estado !== "ocioso" && "animate-pulse")}
        />
        {pendentes > 0 && <ContadorNovidades total={pendentes} className="absolute -top-1 -right-1" />}
      </button>
      {(estado === "falando" || estado === "ouvindo") && (
        <button
          onClick={onParar}
          aria-label="Parar o CLOCK"
          title="Parar"
          className="w-9 h-9 rounded-lg flex items-center justify-center bg-secondary hover:bg-secondary/70 transition-smooth"
        >
          <Square className="w-3.5 h-3.5" />
        </button>
      )}
      <div className="mt-auto rotate-180 text-[9px] uppercase tracking-[0.2em] font-semibold text-muted-foreground" style={{ writingMode: "vertical-rl" }}>
        CLOCK · IA
      </div>
    </div>
  );
}

// ============ FULL RAIL — o chat REAL do CLOCK ============
function FullRail({ onCollapse, estado }: { onCollapse: () => void; estado: EstadoClock }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <span className="font-display font-bold text-sm inline-flex items-center gap-1.5">
          CLOCK <Sparkles className="w-3 h-3 text-brand-cyan" />
          <IndicadorEstado estado={estado} />
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

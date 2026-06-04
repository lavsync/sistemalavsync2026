"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { NAVIGATION, NAV_GROUPS } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * MobileNavTrigger — botão hambúrguer + Sheet (slide-in da esquerda).
 *
 * Visível apenas em < lg (1024px), reaproveita NAVIGATION/NAV_GROUPS
 * do mesmo source-of-truth da sidebar desktop.
 */
export function MobileNavTrigger() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // Fecha automaticamente ao navegar
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          aria-label="Abrir menu"
          className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-md bg-surface-glass border border-border hover:border-border-strong transition-smooth shrink-0"
        >
          <Menu className="w-4 h-4" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <AnimatePresence>
          {open && (
            <>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"
                />
              </Dialog.Overlay>

              <Dialog.Content asChild forceMount>
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed inset-y-0 left-0 z-50 w-[84vw] max-w-[320px] bg-mesh-dark border-r border-border shadow-2xl flex flex-col outline-none"
                >
                  <Dialog.Title className="sr-only">Menu de navegação</Dialog.Title>
                  <Dialog.Description className="sr-only">
                    Navegue entre os módulos do LavSync
                  </Dialog.Description>

                  {/* Header */}
                  <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/60">
                    <Link href="/" className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl sidebar-logo-glow flex items-center justify-center">
                        <svg
                          viewBox="0 0 24 24"
                          className="w-[16px] h-[16px] text-white"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 2.5c-3.5 4.5-6 7.5-6 11a6 6 0 0 0 12 0c0-3.5-2.5-6.5-6-11z" />
                          <circle cx="12" cy="14" r="2" fill="currentColor" />
                        </svg>
                      </div>
                      <div className="font-display font-bold text-[16px] leading-none tracking-tight text-white">
                        Lav
                        <span className="bg-gradient-to-r from-brand-cyan via-brand-blue to-brand-purple bg-clip-text text-transparent">
                          Sync
                        </span>
                      </div>
                    </Link>
                    <Dialog.Close asChild>
                      <button
                        aria-label="Fechar menu"
                        className="w-8 h-8 rounded-md flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-smooth"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </Dialog.Close>
                  </div>

                  {/* Nav */}
                  <nav className="flex-1 overflow-y-auto custom-scroll-thin px-3 py-4 space-y-5">
                    {NAV_GROUPS.map((group) => {
                      const items = NAVIGATION.filter(
                        (n) => n.group === group.key,
                      );
                      return (
                        <div key={group.key} className="space-y-1.5">
                          <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                            {group.label}
                          </div>
                          <div className="space-y-0.5">
                            {items.map((item) => {
                              const active = pathname === item.href;
                              return (
                                <Link
                                  key={item.href}
                                  href={item.href}
                                  className={cn(
                                    "group flex items-center gap-3 px-3 h-11 rounded-xl text-[14px] tracking-tight transition-smooth",
                                    active
                                      ? "bg-white/10 text-white font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                                      : "text-white/70 hover:text-white hover:bg-white/5",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "w-1.5 h-1.5 rounded-full transition-all",
                                      active
                                        ? "bg-white shadow-[0_0_10px_rgba(255,255,255,0.7)]"
                                        : item.accent
                                          ? "bg-brand-cyan shadow-[0_0_8px_rgba(34,211,238,0.7)]"
                                          : "bg-white/35 group-hover:bg-white/70",
                                    )}
                                  />
                                  <span className="flex-1 truncate">
                                    {item.label}
                                  </span>
                                  {item.badge && (
                                    <span
                                      className={cn(
                                        "shrink-0 inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 text-[10px] font-bold rounded-full",
                                        active
                                          ? "bg-white/20 text-white"
                                          : item.accent
                                            ? "bg-brand-cyan/15 text-brand-cyan"
                                            : "bg-white/8 text-white/70",
                                      )}
                                    >
                                      {item.badge}
                                    </span>
                                  )}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </nav>

                  {/* Footer hint */}
                  <div className="px-5 py-4 border-t border-border/60 text-[10px] text-white/40 uppercase tracking-[0.18em]">
                    LavSync v0.1 · Operations OS
                  </div>
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

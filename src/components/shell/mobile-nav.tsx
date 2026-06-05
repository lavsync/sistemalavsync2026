"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
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
          className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg bg-surface-glass border border-border hover:border-border-strong transition-smooth shrink-0 touch-manipulation"
        >
          <Menu className="w-5 h-5" />
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

                  {/* Header com logo oficial em destaque */}
                  <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-border/60">
                    <Link href="/" className="flex items-center">
                      <Image
                        src="/brand/logo/lavsync-horizontal-branco.png"
                        alt="LavSync"
                        width={220}
                        height={56}
                        priority
                        className="h-12 w-auto object-contain"
                      />
                    </Link>
                    <Dialog.Close asChild>
                      <button
                        aria-label="Fechar menu"
                        className="w-11 h-11 rounded-md flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-smooth touch-manipulation"
                      >
                        <X className="w-5 h-5" />
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
                                    "group flex items-center gap-3 px-3 h-12 rounded-xl text-[14px] tracking-tight transition-smooth touch-manipulation",
                                    active
                                      ? "bg-brand-cyan/15 text-brand-cyan font-semibold border-l-2 border-brand-cyan"
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
                  <div className="px-5 py-4 border-t border-border/60 text-[10px] text-brand-cyan/70 uppercase tracking-[0.18em]">
                    Operations OS · v1.0
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

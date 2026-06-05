"use client";

import * as React from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export function CrudShell({
  eyebrow, title, subtitle, total, novoLabel = "Novo",
  busca, onBuscaChange,
  children, dialog,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  total: number;
  novoLabel?: string;
  busca: string;
  onBuscaChange: (v: string) => void;
  children: React.ReactNode;
  dialog: {
    open: boolean;
    setOpen: (v: boolean) => void;
    titulo: string;
    descricao?: string;
    children: React.ReactNode;
    footer: React.ReactNode;
    maxWidth?: string;
  };
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Link href="/cadastros" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="w-3 h-3" /> Cadastros
        </Link>
        <span>·</span>
        <span className="text-foreground font-semibold">{title}</span>
      </div>

      <PageHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={`${total} ${subtitle}`}
        actions={
          <Button
            size="sm"
            className="text-xs h-9 bg-gradient-to-r from-brand-cyan to-brand-blue text-white"
            onClick={() => dialog.setOpen(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> {novoLabel}
          </Button>
        }
      />

      <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          placeholder="Buscar..."
          className="flex-1 bg-transparent text-[13px] outline-none"
        />
        {busca && (
          <button onClick={() => onBuscaChange("")} className="text-muted-foreground hover:text-danger">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {children}

      <Dialog.Root open={dialog.open} onOpenChange={dialog.setOpen}>
        <Dialog.Portal>
          <AnimatePresence>
            {dialog.open && (
              <>
                <Dialog.Overlay asChild forceMount>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
                </Dialog.Overlay>
                <Dialog.Content asChild forceMount>
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.97 }}
                    className="fixed inset-0 z-50 grid place-items-center p-4"
                  >
                    <div className={cn("w-full rounded-2xl bg-card border border-border shadow-2xl overflow-hidden max-h-[92vh] flex flex-col", dialog.maxWidth ?? "max-w-xl")}>
                      <div className="p-5 border-b border-border/60 flex items-start justify-between">
                        <div>
                          <Dialog.Title className="font-display text-lg font-bold">{dialog.titulo}</Dialog.Title>
                          {dialog.descricao && (
                            <Dialog.Description className="text-[12px] text-muted-foreground mt-1">{dialog.descricao}</Dialog.Description>
                          )}
                        </div>
                        <Dialog.Close asChild>
                          <button className="w-8 h-8 rounded-md hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4" /></button>
                        </Dialog.Close>
                      </div>
                      <div className="p-5 space-y-3 overflow-y-auto flex-1">{dialog.children}</div>
                      <div className="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-end gap-2">
                        {dialog.footer}
                      </div>
                    </div>
                  </motion.div>
                </Dialog.Content>
              </>
            )}
          </AnimatePresence>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

export function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1">
        {label} {required && <span className="text-danger">*</span>}
      </div>
      {children}
    </label>
  );
}

export function EstadoVazio({ titulo, descricao, onAcao, labelAcao }: { titulo: string; descricao: string; onAcao: () => void; labelAcao: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-muted/10 py-12 text-center">
      <div className="text-[14px] font-semibold mb-1">{titulo}</div>
      <div className="text-[12px] text-muted-foreground mb-4">{descricao}</div>
      <Button onClick={onAcao} className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white">
        <Plus className="w-4 h-4 mr-1" /> {labelAcao}
      </Button>
    </div>
  );
}

export function BusyButton({ busy, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <Button {...props} disabled={busy || props.disabled} className={cn("bg-gradient-to-r from-brand-cyan to-brand-blue text-white", props.className)}>
      {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
      {children}
    </Button>
  );
}

"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Building2, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { setUnidadeAtivaAction } from "@/lib/unidade-actions";

export type UnidadeOpt = { id: string; nome: string };

export function UnidadeSwitcher({
  unidades,
  ativaId,
}: {
  unidades: UnidadeOpt[];
  ativaId: string;
}) {
  const [pending, startTransition] = React.useTransition();
  const ativa = unidades.find((u) => u.id === ativaId) ?? unidades[0];

  function trocar(novaId: string) {
    if (novaId === ativaId) return;
    startTransition(async () => {
      await setUnidadeAtivaAction(novaId);
    });
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            "group flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-md border transition-smooth",
            "border-brand-cyan/25 bg-brand-cyan/8 hover:bg-brand-cyan/15 text-foreground",
            pending && "opacity-60 pointer-events-none",
          )}
          aria-label="Trocar unidade"
        >
          <Building2 className="w-3.5 h-3.5 text-brand-cyan shrink-0" />
          <div className="hidden sm:flex flex-col items-start leading-none">
            <span className="text-[9px] uppercase tracking-[0.18em] font-semibold text-brand-cyan">
              Unidade
            </span>
            <span className="text-[11px] font-bold mt-0.5">{ativa?.nome ?? "—"}</span>
          </div>
          <span className="sm:hidden text-[11px] font-bold">{ativa?.nome ?? "—"}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[200px] rounded-xl border border-border bg-popover shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150"
        >
          <DropdownMenu.Label className="px-2 py-1.5 text-[9px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
            Trocar unidade
          </DropdownMenu.Label>
          {unidades.map((u) => {
            const selected = u.id === ativaId;
            return (
              <DropdownMenu.Item
                key={u.id}
                onSelect={() => trocar(u.id)}
                className={cn(
                  "flex items-center gap-2 px-2 py-2 text-[12px] rounded-md cursor-pointer outline-none",
                  "hover:bg-secondary focus:bg-secondary",
                  selected && "bg-brand-cyan/10 text-brand-cyan font-semibold",
                )}
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1">{u.nome}</span>
                {selected && <Check className="w-3.5 h-3.5" />}
              </DropdownMenu.Item>
            );
          })}
          <DropdownMenu.Separator className="my-1 h-px bg-border/60" />
          <div className="px-2 py-1.5 text-[10px] text-muted-foreground">
            Dados isolados por unidade · CPF único dentro da unidade
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

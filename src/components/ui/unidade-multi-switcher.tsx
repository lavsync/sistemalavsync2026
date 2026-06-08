"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Building2, ChevronDown, Check, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Unidade } from "@/lib/unidade-multi";
import { serializarSelecao } from "@/lib/unidade-multi";

export function UnidadeMultiSwitcher({
  unidades,
  selecionadas,            // array de IDs selecionados (vazio = todas)
  todasMarcadas,
  rotulo,
  paramName = "unidade",
  className,
  variant = "header",      // "header" (claro) · "card" (escuro)
}: {
  unidades: Unidade[];
  selecionadas: string[];
  todasMarcadas: boolean;
  rotulo: string;
  paramName?: string;
  className?: string;
  variant?: "header" | "card";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function push(novoValor: string) {
    const next = new URLSearchParams(sp.toString());
    next.set(paramName, novoValor);
    router.push(`${pathname}?${next.toString()}`);
  }

  function toggle(id: string) {
    let novos: string[];
    if (todasMarcadas) {
      // Era "todas" → desmarcar uma vira "todas exceto essa" = lista com as outras
      novos = unidades.filter((u) => u.id !== id).map((u) => u.id);
    } else if (selecionadas.includes(id)) {
      novos = selecionadas.filter((s) => s !== id);
    } else {
      novos = [...selecionadas, id];
    }
    if (novos.length === 0) novos = unidades.map((u) => u.id); // não deixa zerar
    push(serializarSelecao(novos, unidades.length));
  }

  function selecionarTodas() {
    push("todas");
  }

  function apenasUm(id: string) {
    push(id);
  }

  const isHeader = variant === "header";
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-smooth",
            isHeader
              ? "bg-white/15 hover:bg-white/25 border border-white/20 text-white"
              : "bg-secondary hover:bg-secondary/70 border border-border text-foreground",
            className,
          )}
        >
          {todasMarcadas ? <Layers className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
          <span>{rotulo}</span>
          <ChevronDown className={cn("w-3 h-3", isHeader ? "opacity-70" : "opacity-50")} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={6}
          className="z-50 min-w-[240px] rounded-lg border border-border bg-popover p-1 shadow-xl"
        >
          <div className="px-2 py-1 text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">
            Selecione 1 ou mais
          </div>

          <DropdownMenu.Item
            onSelect={(e) => { e.preventDefault(); selecionarTodas(); }}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded text-[12px] cursor-pointer outline-none",
              todasMarcadas ? "bg-brand-cyan/15 text-brand-cyan font-semibold" : "hover:bg-secondary"
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="flex-1">Todas ({unidades.length})</span>
            {todasMarcadas && <Check className="w-3 h-3" />}
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-border" />

          {unidades.map((u) => {
            const marcada = todasMarcadas || selecionadas.includes(u.id);
            return (
              <DropdownMenu.Item
                key={u.id}
                onSelect={(e) => { e.preventDefault(); toggle(u.id); }}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded text-[12px] cursor-pointer outline-none",
                  marcada ? "text-foreground" : "text-muted-foreground hover:bg-secondary"
                )}
              >
                <span className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                  marcada ? "bg-brand-cyan border-brand-cyan" : "border-border"
                )}>
                  {marcada && <Check className="w-3 h-3 text-white" />}
                </span>
                <Building2 className="w-3 h-3 opacity-60" />
                <span className="flex-1">{u.nome}</span>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); apenasUm(u.id); }}
                  className="text-[9px] uppercase tracking-wider font-bold text-brand-cyan hover:underline"
                  title="Selecionar APENAS esta unidade"
                >
                  só
                </button>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

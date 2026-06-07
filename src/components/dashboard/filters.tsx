"use client";

import * as React from "react";
import { Building2, Calendar, ChevronDown, Check } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
import type { Periodo, Unidade } from "@/lib/dashboard/queries";

const PRESETS: Array<{ key: Periodo; label: string }> = [
  { key: "hoje",   label: "Hoje" },
  { key: "ontem",  label: "Ontem" },
  { key: "7d",     label: "Últimos 7 dias" },
  { key: "30d",    label: "Últimos 30 dias" },
  { key: "mes",    label: "Mês atual" },
  { key: "90d",    label: "Últimos 90 dias" },
  { key: "ano",    label: "Ano atual" },
];

export function DashboardFilters({
  unidades,
  unidadeAtiva,
  periodo,
  from,
  to,
  labelJanela,
}: {
  unidades: Unidade[];
  unidadeAtiva: string;
  periodo: Periodo;
  from?: string;
  to?: string;
  labelJanela: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [customOpen, setCustomOpen] = React.useState(false);
  const [fromIn, setFromIn] = React.useState(from ?? "");
  const [toIn, setToIn] = React.useState(to ?? "");

  function push(updates: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  function aplicarPeriodo(p: Periodo) {
    if (p === "custom") {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    push({ periodo: p, from: null, to: null });
  }

  function aplicarCustom() {
    if (!fromIn || !toIn) return;
    push({ periodo: "custom", from: fromIn, to: toIn });
    setCustomOpen(false);
  }

  const unidadeNome = unidades.find((u) => u.id === unidadeAtiva)?.nome ?? "—";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Unidade */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-white text-[12px] font-semibold transition-smooth">
            <Building2 className="w-3.5 h-3.5" />
            <span>{unidadeNome}</span>
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={6}
            className="z-50 min-w-[200px] rounded-lg border border-border bg-popover p-1 shadow-xl"
          >
            <div className="px-2 py-1 text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">Selecionar unidade</div>
            {unidades.map((u) => (
              <DropdownMenu.Item
                key={u.id}
                onSelect={() => push({ unidade: u.id })}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded text-[12px] cursor-pointer outline-none",
                  u.id === unidadeAtiva
                    ? "bg-brand-cyan/15 text-brand-cyan font-semibold"
                    : "hover:bg-secondary"
                )}
              >
                <Building2 className="w-3 h-3" />
                <span className="flex-1">{u.nome}</span>
                {u.id === unidadeAtiva && <Check className="w-3 h-3" />}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Período */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-white text-[12px] font-semibold transition-smooth">
            <Calendar className="w-3.5 h-3.5" />
            <span>{labelJanela}</span>
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            sideOffset={6}
            align="end"
            className="z-50 min-w-[220px] rounded-lg border border-border bg-popover p-1 shadow-xl"
          >
            <div className="px-2 py-1 text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">Período</div>
            {PRESETS.map((p) => (
              <DropdownMenu.Item
                key={p.key}
                onSelect={(e) => { e.preventDefault(); aplicarPeriodo(p.key); }}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded text-[12px] cursor-pointer outline-none",
                  p.key === periodo
                    ? "bg-brand-cyan/15 text-brand-cyan font-semibold"
                    : "hover:bg-secondary"
                )}
              >
                <span className="flex-1">{p.label}</span>
                {p.key === periodo && <Check className="w-3 h-3" />}
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item
              onSelect={(e) => { e.preventDefault(); aplicarPeriodo("custom"); }}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded text-[12px] cursor-pointer outline-none",
                periodo === "custom" ? "bg-brand-cyan/15 text-brand-cyan font-semibold" : "hover:bg-secondary"
              )}
            >
              <span className="flex-1">Personalizado…</span>
              {periodo === "custom" && <Check className="w-3 h-3" />}
            </DropdownMenu.Item>

            {customOpen && (
              <div className="px-2 py-2 mt-1 border-t border-border space-y-2" onClick={(e) => e.stopPropagation()}>
                <div>
                  <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">De</div>
                  <input type="date" value={fromIn} onChange={(e) => setFromIn(e.target.value)}
                    className="w-full form-input h-8 text-[12px]" />
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Até</div>
                  <input type="date" value={toIn} onChange={(e) => setToIn(e.target.value)}
                    className="w-full form-input h-8 text-[12px]" />
                </div>
                <button onClick={aplicarCustom}
                  className="w-full px-2 py-1.5 rounded bg-brand-cyan text-primary-foreground text-[11px] font-semibold">
                  Aplicar
                </button>
              </div>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

"use client";

// Seletor de unidades em CHIPS clicáveis (sem dropdown):
// um clique marca, outro desmarca, várias ao mesmo tempo; "Todas" seleciona
// tudo de uma vez. Cada clique aplica na hora (URL param → server re-render).
// Mantém o mesmo contrato de props/URL do modelo antigo.
import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Building2, Check, Layers, Loader2 } from "lucide-react";
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
  variant = "header",      // "header" (sobre gradiente) · "card" (sobre card)
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
  const [pendente, startTransition] = React.useTransition();
  void rotulo;

  function push(novoValor: string) {
    const next = new URLSearchParams(sp.toString());
    next.set(paramName, novoValor);
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  function toggle(id: string) {
    let novos: string[];
    if (todasMarcadas) {
      // Era "todas" → desmarcar uma vira "todas exceto essa"
      novos = unidades.filter((u) => u.id !== id).map((u) => u.id);
    } else if (selecionadas.includes(id)) {
      novos = selecionadas.filter((s) => s !== id);
    } else {
      novos = [...selecionadas, id];
    }
    if (novos.length === 0) novos = unidades.map((u) => u.id); // não deixa zerar
    push(serializarSelecao(novos, unidades.length));
  }

  const isHeader = variant === "header";
  const base = "inline-flex items-center gap-1.5 px-2.5 h-8 rounded-full text-[12px] font-semibold transition-smooth cursor-pointer select-none border";
  const ativo = isHeader
    ? "bg-white text-brand-deep border-white shadow-sm"
    : "bg-brand-cyan/15 text-brand-cyan border-brand-cyan/40";
  const inativo = isHeader
    ? "bg-white/10 text-white/80 border-white/25 hover:bg-white/20"
    : "bg-secondary/50 text-muted-foreground border-border hover:text-foreground";

  return (
    <div className={cn("inline-flex items-center gap-1.5 flex-wrap", className)}>
      <button
        onClick={() => push("todas")}
        title="Selecionar todas as unidades"
        className={cn(base, todasMarcadas ? ativo : inativo)}
      >
        <Layers className="w-3.5 h-3.5" />
        Todas
        {todasMarcadas && <Check className="w-3 h-3" />}
      </button>
      {unidades.map((u) => {
        const marcada = todasMarcadas || selecionadas.includes(u.id);
        return (
          <button
            key={u.id}
            onClick={() => toggle(u.id)}
            title={marcada ? `Desmarcar ${u.nome}` : `Marcar ${u.nome}`}
            className={cn(base, marcada ? ativo : inativo)}
          >
            <Building2 className="w-3.5 h-3.5" />
            {u.nome}
            {marcada && <Check className="w-3 h-3" />}
          </button>
        );
      })}
      {pendente && <Loader2 className={cn("w-3.5 h-3.5 animate-spin", isHeader ? "text-white/80" : "text-muted-foreground")} />}
    </div>
  );
}

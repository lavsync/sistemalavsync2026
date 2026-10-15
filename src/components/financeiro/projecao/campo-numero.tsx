"use client";

// LavSync · Projetado × Real — campo numérico pt-BR
//
// Mostra o valor formatado ("1.234,56", "5%") e só grava no blur/Enter, lendo o
// que foi digitado no padrão brasileiro. Esc desfaz a digitação. É "não
// controlado" de propósito: a `key` muda com o valor externo, então um recálculo
// pelas premissas atualiza o campo sem brigar com o cursor de quem digita.
import * as React from "react";
import { cn } from "@/lib/utils";
import { fmtNumero, parseNumeroBR } from "./formatos";

export function CampoNumero({ valor, onCommit, percentual = false, className, ariaLabel, title, min }: {
  valor: number;
  onCommit: (v: number) => void;
  /** Valor guardado como fração (0,05) e exibido/digitado em % (5). */
  percentual?: boolean;
  className?: string;
  ariaLabel?: string;
  title?: string;
  min?: number;
}) {
  const exibido = percentual ? fmtNumero(Math.round(valor * 100 * 100) / 100) : fmtNumero(valor);
  return (
    <input
      key={exibido}
      type="text"
      inputMode="decimal"
      defaultValue={exibido}
      aria-label={ariaLabel}
      title={title}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") { e.currentTarget.value = exibido; e.currentTarget.blur(); }
      }}
      onBlur={(e) => {
        const n = parseNumeroBR(e.currentTarget.value);
        if (n == null) { e.currentTarget.value = exibido; return; }
        let v = percentual ? n / 100 : n;
        if (min != null && v < min) v = min;
        const atual = percentual ? Math.round(valor * 10000) / 10000 : valor;
        if (Math.abs(v - atual) > 1e-9) onCommit(v);
        else e.currentTarget.value = exibido;
      }}
      className={cn("font-mono tabular-nums text-right", className)}
    />
  );
}

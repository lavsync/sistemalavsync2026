"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function mesAtualYM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function deltaMes(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const novoMes = m + delta;
  let ano = y, mes = novoMes;
  while (mes < 1) { mes += 12; ano -= 1; }
  while (mes > 12) { mes -= 12; ano += 1; }
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

function labelMes(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return `${MESES_PT[m - 1]} ${y}`;
}

export function PerformanceMesFiltro() {
  const router = useRouter();
  const sp = useSearchParams();
  const mesParam = sp.get("mes") || mesAtualYM();
  const ehMesAtual = mesParam === mesAtualYM();
  const podeAvancar = mesParam < mesAtualYM();

  function ir(novoMes: string) {
    const next = new URLSearchParams(sp.toString());
    if (novoMes === mesAtualYM()) next.delete("mes");
    else next.set("mes", novoMes);
    router.push(`/performance?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-cyan/25 bg-brand-cyan/5 px-3 py-2">
      <Calendar className="w-4 h-4 text-brand-cyan shrink-0" />
      <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-brand-cyan">Mês:</div>
      <div className="font-display font-bold text-[14px] capitalize mr-1">{labelMes(mesParam)}</div>

      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={() => ir(deltaMes(mesParam, -1))}
          className="px-2 py-1 rounded border border-border text-[11px] hover:bg-secondary inline-flex items-center gap-1"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="w-3 h-3" /> Anterior
        </button>

        <input
          type="month"
          value={mesParam}
          max={mesAtualYM()}
          onChange={(e) => e.target.value && ir(e.target.value)}
          className="form-input h-7 text-[12px] py-0 font-mono"
        />

        <button
          onClick={() => podeAvancar && ir(deltaMes(mesParam, 1))}
          disabled={!podeAvancar}
          className="px-2 py-1 rounded border border-border text-[11px] hover:bg-secondary inline-flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Próximo mês"
        >
          Próximo <ChevronRight className="w-3 h-3" />
        </button>

        <button
          onClick={() => ir(mesAtualYM())}
          disabled={ehMesAtual}
          className={cn(
            "px-2 py-1 rounded text-[11px] font-semibold inline-flex items-center gap-1",
            ehMesAtual
              ? "border border-border opacity-40 pointer-events-none"
              : "border border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan/15",
          )}
        >
          <CalendarCheck className="w-3 h-3" /> Mês atual
        </button>
      </div>
    </div>
  );
}

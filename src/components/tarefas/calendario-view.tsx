"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tarefa } from "@/lib/tarefas/queries";

const DIAS_PT = ["dom","seg","ter","qua","qui","sex","sáb"];
const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const PRI_COLOR: Record<Tarefa["prioridade"], string> = {
  baixa: "var(--muted-foreground)",
  media: "var(--brand-cyan)",
  alta: "var(--warning)",
  critica: "var(--danger)",
};

export function CalendarioView({ tarefas, onClick }: { tarefas: Tarefa[]; onClick?: (t: Tarefa) => void }) {
  const [ref, setRef] = React.useState(() => {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() };
  });

  const inicioMes = new Date(ref.ano, ref.mes, 1);
  const diaSemanaInicio = inicioMes.getDay();
  const totalDias = new Date(ref.ano, ref.mes + 1, 0).getDate();
  const hojeIso = new Date().toISOString().slice(0, 10);

  // Agrupa tarefas por dia (YYYY-MM-DD)
  const porDia = new Map<string, Tarefa[]>();
  for (const t of tarefas) {
    if (!t.prazo) continue;
    const dia = t.prazo.slice(0, 10);
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia)!.push(t);
  }

  // Cria células
  const celulas: Array<{ data: string; dia: number | null; outsideMonth: boolean }> = [];
  for (let i = 0; i < diaSemanaInicio; i++) celulas.push({ data: "", dia: null, outsideMonth: true });
  for (let d = 1; d <= totalDias; d++) {
    const dataIso = `${ref.ano}-${String(ref.mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    celulas.push({ data: dataIso, dia: d, outsideMonth: false });
  }

  function navegarMes(delta: number) {
    let novoMes = ref.mes + delta;
    let novoAno = ref.ano;
    if (novoMes < 0) { novoMes = 11; novoAno -= 1; }
    if (novoMes > 11) { novoMes = 0; novoAno += 1; }
    setRef({ ano: novoAno, mes: novoMes });
  }

  function hoje() {
    const d = new Date();
    setRef({ ano: d.getFullYear(), mes: d.getMonth() });
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="font-display font-bold text-[14px] inline-flex items-center gap-2">
          <CalIcon className="w-4 h-4 text-brand-cyan" />
          {MESES_PT[ref.mes]} {ref.ano}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => navegarMes(-1)} className="w-8 h-8 rounded border border-border hover:bg-secondary flex items-center justify-center">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={hoje} className="px-3 py-1.5 rounded border border-border hover:bg-secondary text-[12px] font-semibold">
            Hoje
          </button>
          <button onClick={() => navegarMes(1)} className="w-8 h-8 rounded border border-border hover:bg-secondary flex items-center justify-center">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border bg-muted/20">
        {DIAS_PT.map((d) => (
          <div key={d} className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-muted-foreground text-center">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(110px, 1fr)" }}>
        {celulas.map((c, i) => {
          const isHoje = c.data === hojeIso;
          const tarefasDoDia = c.data ? (porDia.get(c.data) ?? []) : [];
          return (
            <div key={i} className={cn(
              "border-r border-b border-border p-1.5 overflow-hidden",
              c.outsideMonth && "bg-muted/10",
              isHoje && "bg-warning/8 ring-1 ring-warning/30",
              i % 7 === 6 && "border-r-0",
            )}>
              {c.dia !== null && (
                <>
                  <div className={cn("text-[11px] font-bold mb-1", isHoje && "text-warning")}>
                    {c.dia}
                  </div>
                  <div className="space-y-1">
                    {tarefasDoDia.slice(0, 3).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => onClick?.(t)}
                        className="block w-full text-left rounded px-1.5 py-0.5 text-[10px] truncate hover:opacity-80"
                        style={{
                          background: `${PRI_COLOR[t.prioridade]}20`,
                          color: PRI_COLOR[t.prioridade],
                          borderLeft: `2px solid ${PRI_COLOR[t.prioridade]}`,
                        }}
                      >
                        {t.titulo}
                      </button>
                    ))}
                    {tarefasDoDia.length > 3 && (
                      <div className="text-[9px] text-muted-foreground font-bold">+{tarefasDoDia.length - 3} mais</div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

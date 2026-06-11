"use client";

import * as React from "react";
import { GanttChart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tarefa } from "@/lib/tarefas/queries";

const PRI_COLOR: Record<Tarefa["prioridade"], string> = {
  baixa: "var(--muted-foreground)",
  media: "var(--brand-cyan)",
  alta: "var(--warning)",
  critica: "var(--danger)",
};

export function GanttView({ tarefas, onClick }: { tarefas: Tarefa[]; onClick?: (t: Tarefa) => void }) {
  // Apenas tarefas com prazo definido
  const comPrazo = tarefas
    .filter((t) => t.prazo)
    .sort((a, b) => (a.prazo ?? "").localeCompare(b.prazo ?? ""));

  if (comPrazo.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-muted/10 p-12 text-center">
        <GanttChart className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <div className="text-[13px] font-semibold">Nenhuma tarefa com prazo</div>
        <div className="text-[11px] text-muted-foreground mt-1">
          Defina prazos pra ver as tarefas no Gantt.
        </div>
      </div>
    );
  }

  // Calcula janela: do menor prazo até o maior prazo
  const datas = comPrazo.map((t) => new Date(t.prazo!));
  const inicio = new Date(Math.min(...datas.map((d) => d.getTime())));
  const fim = new Date(Math.max(...datas.map((d) => d.getTime())));
  // Adiciona buffer
  inicio.setDate(inicio.getDate() - 2);
  fim.setDate(fim.getDate() + 2);

  const msPorDia = 24 * 60 * 60 * 1000;
  const totalDias = Math.max(7, Math.ceil((fim.getTime() - inicio.getTime()) / msPorDia));
  const larguraColuna = 30; // px por dia
  const larguraGantt = totalDias * larguraColuna;
  const hojeIso = new Date().toISOString().slice(0, 10);

  function pctDoDia(dataIso: string): number {
    return ((new Date(dataIso).getTime() - inicio.getTime()) / msPorDia) / totalDias;
  }

  // Cria escala (1 marca a cada 7 dias)
  const marcas: Array<{ dataIso: string; label: string; left: number }> = [];
  for (let i = 0; i <= totalDias; i += 7) {
    const d = new Date(inicio);
    d.setDate(d.getDate() + i);
    marcas.push({
      dataIso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      left: (i / totalDias) * 100,
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="font-display font-bold text-[14px] inline-flex items-center gap-2">
          <GanttChart className="w-4 h-4 text-brand-cyan" />
          Gantt · {comPrazo.length} tarefas
        </div>
        <div className="text-[11px] text-muted-foreground">
          {inicio.toLocaleDateString("pt-BR")} → {fim.toLocaleDateString("pt-BR")}
        </div>
      </div>

      <div className="flex">
        {/* Coluna fixa: nome */}
        <div className="w-64 shrink-0 border-r border-border">
          <div className="h-12 px-3 py-2 border-b border-border bg-muted/30">
            <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Tarefa</div>
          </div>
          {comPrazo.map((t) => (
            <button
              key={t.id}
              onClick={() => onClick?.(t)}
              className="block w-full h-12 px-3 py-1 text-left border-b border-border/40 hover:bg-secondary/30 transition-colors"
            >
              <div className="text-[11px] font-semibold truncate">{t.titulo}</div>
              <div className="text-[9px] text-muted-foreground truncate">
                {t.atribuida_para_nome ?? "Sem responsável"}
              </div>
            </button>
          ))}
        </div>

        {/* Gantt scrollável */}
        <div className="flex-1 overflow-x-auto">
          <div style={{ width: larguraGantt }}>
            {/* Cabeçalho com escala */}
            <div className="h-12 border-b border-border bg-muted/30 relative">
              {marcas.map((m, i) => (
                <div key={i}
                  className="absolute top-0 bottom-0 border-l border-border text-[9px] text-muted-foreground px-1 pt-1"
                  style={{ left: `${m.left}%` }}>
                  {m.label}
                </div>
              ))}
              {/* Marca de hoje */}
              {hojeIso >= inicio.toISOString().slice(0, 10) && hojeIso <= fim.toISOString().slice(0, 10) && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-warning"
                  style={{ left: `${pctDoDia(hojeIso) * 100}%` }}>
                  <div className="absolute -top-1 -left-3 text-[8px] uppercase font-bold tracking-wider text-warning bg-card px-1 rounded">hoje</div>
                </div>
              )}
            </div>

            {comPrazo.map((t) => {
              const dataPrazo = t.prazo!.slice(0, 10);
              // Estimativa: se tem iniciada_em, vai de iniciada até prazo; senão é evento único no prazo
              const iniDataIso = t.iniciada_em ? t.iniciada_em.slice(0, 10) : dataPrazo;
              const pctIni = Math.max(0, pctDoDia(iniDataIso));
              const pctFim = pctDoDia(dataPrazo);
              const largura = Math.max(0.5 / totalDias, pctFim - pctIni + 1 / totalDias) * 100;
              const atrasada = dataPrazo < hojeIso && t.status !== "concluida" && t.status !== "cancelada";

              return (
                <div key={t.id} className="h-12 border-b border-border/40 relative hover:bg-secondary/10">
                  <button
                    onClick={() => onClick?.(t)}
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 h-5 rounded text-[10px] font-bold px-2 truncate text-white shadow",
                      t.status === "concluida" && "opacity-60",
                    )}
                    style={{
                      left: `${pctIni * 100}%`,
                      width: `${largura}%`,
                      background: atrasada ? "var(--danger)" : PRI_COLOR[t.prioridade],
                      borderLeftWidth: 3,
                      borderLeftColor: PRI_COLOR[t.prioridade],
                    }}>
                    {t.titulo}
                  </button>
                  {/* Marca de hoje */}
                  {hojeIso >= inicio.toISOString().slice(0, 10) && hojeIso <= fim.toISOString().slice(0, 10) && (
                    <div className="absolute top-0 bottom-0 w-px bg-warning/40 pointer-events-none"
                      style={{ left: `${pctDoDia(hojeIso) * 100}%` }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

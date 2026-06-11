"use client";

import * as React from "react";
import {
  Activity, CheckCircle2, Play, Pause, X, AlertTriangle,
  Edit2, Plus, Clock, User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tarefa } from "@/lib/tarefas/queries";

type EventoObservador = {
  tarefaId: string;
  tarefaTitulo: string;
  timestamp: string;
  tipo: "criada" | "concluida" | "atualizada" | "iniciada" | "atrasada";
  atribuida_para_nome?: string | null;
};

export function ObservadorView({ tarefas }: { tarefas: Tarefa[] }) {
  // Sintetiza eventos a partir das tarefas
  const eventos: EventoObservador[] = [];
  const hojeIso = new Date().toISOString().slice(0, 10);

  for (const t of tarefas) {
    eventos.push({
      tarefaId: t.id,
      tarefaTitulo: t.titulo,
      timestamp: t.criado_em,
      tipo: "criada",
      atribuida_para_nome: t.atribuida_para_nome,
    });
    if (t.iniciada_em) {
      eventos.push({
        tarefaId: t.id,
        tarefaTitulo: t.titulo,
        timestamp: t.iniciada_em,
        tipo: "iniciada",
        atribuida_para_nome: t.atribuida_para_nome,
      });
    }
    if (t.concluida_em) {
      eventos.push({
        tarefaId: t.id,
        tarefaTitulo: t.titulo,
        timestamp: t.concluida_em,
        tipo: "concluida",
        atribuida_para_nome: t.atribuida_para_nome,
      });
    }
    if (t.prazo && t.prazo.slice(0, 10) < hojeIso && (t.status === "pendente" || t.status === "em_andamento")) {
      eventos.push({
        tarefaId: t.id,
        tarefaTitulo: t.titulo,
        timestamp: t.prazo,
        tipo: "atrasada",
        atribuida_para_nome: t.atribuida_para_nome,
      });
    }
  }

  eventos.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const recentes = eventos.slice(0, 100);

  const tipoIcon: Record<EventoObservador["tipo"], React.ElementType> = {
    criada: Plus, iniciada: Play, concluida: CheckCircle2, atualizada: Edit2, atrasada: AlertTriangle,
  };
  const tipoCor: Record<EventoObservador["tipo"], string> = {
    criada: "brand-cyan", iniciada: "brand-blue", concluida: "success", atualizada: "warning", atrasada: "danger",
  };
  const tipoLabel: Record<EventoObservador["tipo"], string> = {
    criada: "Tarefa criada",
    iniciada: "Tarefa iniciada",
    concluida: "Tarefa concluída",
    atualizada: "Tarefa atualizada",
    atrasada: "Tarefa atrasada",
  };

  function relativo(ts: string): string {
    const now = Date.now();
    const t = new Date(ts).getTime();
    const diff = (now - t) / 1000;
    if (diff < 0) return "futuro";
    if (diff < 60) return "agora há pouco";
    if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} dias atrás`;
    return new Date(ts).toLocaleDateString("pt-BR");
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="font-display font-bold text-[14px] inline-flex items-center gap-2">
          <Activity className="w-4 h-4 text-brand-cyan" /> Observador · feed de atividade
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          Eventos recentes em todas as tarefas. Útil pra acompanhar o time em tempo real.
        </div>
      </div>

      <div className="divide-y divide-border/40 max-h-[640px] overflow-y-auto">
        {recentes.map((e, i) => {
          const Icon = tipoIcon[e.tipo];
          const cor = tipoCor[e.tipo];
          return (
            <div key={`${e.tarefaId}-${e.tipo}-${i}`} className="flex items-start gap-3 px-5 py-3 hover:bg-secondary/20">
              <div className={cn("w-8 h-8 rounded-md border flex items-center justify-center shrink-0",
                `bg-${cor}/10 text-${cor} border-${cor}/30`)}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className={cn("text-[10px] font-bold uppercase tracking-wider", `text-${cor}`)}>
                    {tipoLabel[e.tipo]}
                  </span>
                  <span className="text-[10px] text-muted-foreground">·</span>
                  <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> {relativo(e.timestamp)}
                  </span>
                </div>
                <div className="font-semibold text-[12px] mt-0.5">{e.tarefaTitulo}</div>
                {e.atribuida_para_nome && (
                  <div className="text-[10px] text-muted-foreground inline-flex items-center gap-1 mt-0.5">
                    <User className="w-2.5 h-2.5" /> {e.atribuida_para_nome}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {recentes.length === 0 && (
          <div className="text-center text-[12px] text-muted-foreground py-12">
            Sem eventos ainda.
          </div>
        )}
      </div>
    </div>
  );
}

void Pause; void X;

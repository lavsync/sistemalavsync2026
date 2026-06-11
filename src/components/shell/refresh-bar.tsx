"use client";

import * as React from "react";
import { Radio, RefreshCw, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export function RefreshBar({
  ligado,
  restante,
  onAlternar,
  onRefreshAgora,
  ultima,
  variant = "default",
}: {
  ligado: boolean;
  restante: number;
  onAlternar: () => void;
  onRefreshAgora: () => void;
  ultima: string;
  variant?: "default" | "compact";
}) {
  const ultimaTxt = new Date(ultima).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  if (variant === "compact") {
    return (
      <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-card">
        <span className="relative flex w-2 h-2">
          <span className={cn("absolute inset-0 rounded-full", ligado ? "bg-success/70 animate-ping" : "bg-muted-foreground/50")} />
          <span className={cn("relative rounded-full w-2 h-2", ligado ? "bg-success" : "bg-muted-foreground")} />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {ligado ? `Atualiza em ${restante}s` : "Pausado"}
        </span>
        <button onClick={onAlternar} className="w-5 h-5 rounded hover:bg-secondary inline-flex items-center justify-center" title={ligado ? "Pausar" : "Retomar"}>
          {ligado ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
        </button>
        <button onClick={onRefreshAgora} className="w-5 h-5 rounded hover:bg-secondary inline-flex items-center justify-center" title="Atualizar agora">
          <RefreshCw className="w-2.5 h-2.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-success/30 bg-success/8">
      <span className="relative flex w-2 h-2">
        <span className={cn("absolute inset-0 rounded-full", ligado ? "bg-success animate-ping" : "bg-muted-foreground/40")} />
        <span className={cn("relative rounded-full w-2 h-2", ligado ? "bg-success" : "bg-muted-foreground")} />
      </span>
      <Radio className={cn("w-3 h-3", ligado ? "text-success animate-pulse" : "text-muted-foreground")} />
      <span className={cn("text-[10px] font-bold uppercase tracking-wider", ligado ? "text-success" : "text-muted-foreground")}>
        {ligado ? `AO VIVO · atualiza em ${restante}s` : "PAUSADO"}
      </span>
      <span className="text-[10px] text-muted-foreground">· última {ultimaTxt}</span>
      <button onClick={onAlternar} className="w-6 h-6 rounded hover:bg-success/15 inline-flex items-center justify-center transition-colors" title={ligado ? "Pausar" : "Retomar"}>
        {ligado ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
      </button>
      <button onClick={onRefreshAgora} className="w-6 h-6 rounded hover:bg-success/15 inline-flex items-center justify-center transition-colors" title="Atualizar agora">
        <RefreshCw className="w-3 h-3" />
      </button>
    </div>
  );
}

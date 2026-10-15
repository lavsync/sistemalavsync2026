"use client";

// LavSync · Projetado × Real — peças de interface compartilhadas pelas 3 áreas
// (seletor de unidade, caixa de avisos, mensagem de erro, estado vazio).
import * as React from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SeletorUnidade({ unidades, valor, onChange, incluirConsolidado = false, rotulo = "Unidade" }: {
  unidades: Array<{ id: string; nome: string }>;
  valor: string;
  onChange: (v: string) => void;
  incluirConsolidado?: boolean;
  rotulo?: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <span>{rotulo}</span>
      <select
        className="form-input w-auto h-8 py-0 text-foreground"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      >
        {incluirConsolidado && <option value="consolidado">Consolidado (todas)</option>}
        {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
      </select>
    </label>
  );
}

export function ListaAvisos({ avisos, titulo = "Avisos da leitura", className }: {
  avisos: string[];
  titulo?: string;
  className?: string;
}) {
  if (avisos.length === 0) return null;
  return (
    <div className={cn("rounded-xl border border-warning/30 bg-warning/[0.06] p-4", className)}>
      <div className="flex items-center gap-2 text-[13px] font-semibold text-warning">
        <AlertTriangle className="w-4 h-4" />
        {titulo} ({avisos.length})
      </div>
      <ul className="mt-2 space-y-1.5 text-[12px] text-foreground/90 list-disc pl-5">
        {avisos.map((a, i) => <li key={i}>{a}</li>)}
      </ul>
    </div>
  );
}

export function MensagemErro({ texto, onFechar }: { texto: string; onFechar?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.06] px-3 py-2 text-[12px] text-danger">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
      <span className="flex-1">{texto}</span>
      {onFechar && (
        <button type="button" onClick={onFechar} aria-label="Fechar aviso" className="shrink-0 hover:opacity-70">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function EstadoVazio({ icone: Icone, titulo, texto, acao }: {
  icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  texto: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="card-premium rounded-xl p-8 flex flex-col items-center text-center gap-3">
      <div className="w-11 h-11 rounded-xl bg-brand-cyan/12 text-brand-cyan flex items-center justify-center">
        <Icone className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-display font-semibold text-[15px]">{titulo}</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-md">{texto}</p>
      </div>
      {acao}
    </div>
  );
}

/** Extrai a mensagem de erro de um retorno {ok:false, erro} ou de uma exceção. */
export function mensagemDeErro(e: unknown, padrao: string): string {
  if (e && typeof e === "object") {
    const o = e as { erro?: unknown; message?: unknown };
    if (typeof o.erro === "string" && o.erro) return o.erro;
    if (typeof o.message === "string" && o.message) return o.message;
  }
  return padrao;
}

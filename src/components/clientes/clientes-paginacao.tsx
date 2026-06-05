"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClientesPaginacao({
  paginaAtual,
  totalPaginas,
  totalRegistros,
  pageSize,
}: {
  paginaAtual: number;
  totalPaginas: number;
  totalRegistros: number;
  pageSize: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function irPara(p: number) {
    const safe = Math.max(1, Math.min(totalPaginas, p));
    const next = new URLSearchParams(sp.toString());
    if (safe === 1) next.delete("page");
    else next.set("page", String(safe));
    router.push(`/clientes?${next.toString()}`);
  }

  if (totalPaginas <= 1) {
    return (
      <div className="px-4 py-2.5 border-t border-border/60 text-[11px] text-muted-foreground text-center">
        {totalRegistros} {totalRegistros === 1 ? "registro" : "registros"}
      </div>
    );
  }

  // Gerar lista compacta: 1 ... p-1 p p+1 ... N
  const paginas = gerarPaginas(paginaAtual, totalPaginas);

  const inicio = (paginaAtual - 1) * pageSize + 1;
  const fim = Math.min(paginaAtual * pageSize, totalRegistros);

  return (
    <div className="px-4 py-2.5 border-t border-border/60 flex flex-wrap items-center justify-between gap-3">
      <div className="text-[11px] text-muted-foreground">
        Mostrando{" "}
        <span className="font-mono font-semibold text-foreground">{inicio}–{fim}</span> de{" "}
        <span className="font-mono font-semibold text-foreground">{totalRegistros}</span>
      </div>
      <div className="flex items-center gap-1">
        <BotaoPag
          onClick={() => irPara(1)}
          disabled={paginaAtual <= 1}
          aria="Primeira página"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </BotaoPag>
        <BotaoPag
          onClick={() => irPara(paginaAtual - 1)}
          disabled={paginaAtual <= 1}
          aria="Página anterior"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </BotaoPag>
        {paginas.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-muted-foreground text-[11px]">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => irPara(p)}
              className={cn(
                "min-w-7 h-7 px-1.5 rounded-md text-[11px] font-semibold tabular-nums transition-smooth",
                p === paginaAtual
                  ? "bg-brand-cyan/15 border border-brand-cyan/40 text-brand-cyan"
                  : "border border-border hover:bg-secondary text-foreground",
              )}
              aria-current={p === paginaAtual ? "page" : undefined}
            >
              {p}
            </button>
          )
        )}
        <BotaoPag
          onClick={() => irPara(paginaAtual + 1)}
          disabled={paginaAtual >= totalPaginas}
          aria="Próxima página"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </BotaoPag>
        <BotaoPag
          onClick={() => irPara(totalPaginas)}
          disabled={paginaAtual >= totalPaginas}
          aria="Última página"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </BotaoPag>
      </div>
    </div>
  );
}

function BotaoPag({
  children, onClick, disabled, aria,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  aria: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={aria}
      className="w-7 h-7 inline-flex items-center justify-center rounded-md border border-border hover:bg-secondary disabled:opacity-40 disabled:pointer-events-none transition-smooth"
    >
      {children}
    </button>
  );
}

// 1 2 3 ... 7 [8] 9 ... 19 20
function gerarPaginas(atual: number, total: number): Array<number | "…"> {
  const out: Array<number | "…"> = [];
  const cercoLargo = 2; // quantas páginas mostrar ao redor da atual

  const adicionar = (n: number) => {
    if (n < 1 || n > total) return;
    if (out[out.length - 1] === n) return;
    out.push(n);
  };

  // primeira sempre
  adicionar(1);

  const inicio = Math.max(2, atual - cercoLargo);
  const fim = Math.min(total - 1, atual + cercoLargo);

  if (inicio > 2) out.push("…");
  for (let p = inicio; p <= fim; p++) adicionar(p);
  if (fim < total - 1) out.push("…");

  if (total > 1) adicionar(total);
  return out;
}

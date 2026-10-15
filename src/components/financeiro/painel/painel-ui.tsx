"use client";

// LavSync · Financeiro › Painel Geral — peças visuais compartilhadas
//
// Tokens de gráfico do painel (escopados em .painel-fin, claro e escuro),
// tooltip padrão, chips de delta e a sparkline. A paleta categórica foi
// validada (skill dataviz · validate_palette.js): claro sobre #FFFFFF e escuro
// sobre #0F1A2E passam faixa de luminosidade, croma, separação para daltonismo
// (ΔE ≥ 8 entre vizinhos) e contraste ≥ 3:1. O slot 1 é o ciano da marca.
import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export const COR = {
  s1: "var(--pf-s1)",   // ciano da marca — faturamento / série principal
  s2: "var(--pf-s2)",   // laranja — custos / resultado
  s3: "var(--pf-s3)",   // violeta — ponto de equilíbrio
  s4: "var(--pf-s4)",   // âmbar
  s5: "var(--pf-s5)",   // magenta
  s6: "var(--pf-s6)",   // azul — projetado franqueadora
  grade: "var(--pf-grade)",
  eixo: "var(--muted-foreground)",
  positivo: "var(--success)",
  negativo: "var(--danger)",
  apagado: "var(--pf-apagado)",
} as const;

export const SERIES_CATEGORICAS = [COR.s1, COR.s2, COR.s3, COR.s4, COR.s5, COR.s6];

const CSS = `
.painel-fin {
  --pf-s1: #0891A3; --pf-s2: #eb6834; --pf-s3: #4a3aa7; --pf-s4: #c98500; --pf-s5: #d55181; --pf-s6: #2a78d6;
  --pf-grade: #E2E8F0; --pf-apagado: #CBD5E1;
}
.dark .painel-fin {
  --pf-s1: #12A8B0; --pf-s2: #d95926; --pf-s3: #9085e9; --pf-s4: #c98500; --pf-s5: #d55181; --pf-s6: #3987e5;
  --pf-grade: rgba(255,255,255,0.08); --pf-apagado: #334155;
}
.painel-fin .recharts-surface:focus, .painel-fin .recharts-wrapper:focus, .painel-fin .recharts-sector:focus { outline: none; }
`;

export function PainelEstilos() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}

// ─── Formatação ──────────────────────────────────────────────────────────

export const fmtR = (n: number, casas = 0) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });

export const fmtRCompacto = (n: number) => {
  const a = Math.abs(n), s = n < 0 ? "−" : "";
  if (a >= 1_000_000) return `${s}R$ ${(a / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (a >= 1_000) return `${s}R$ ${(a / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${s}R$ ${a.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
};

export const fmtP = (n: number, casas = 1) =>
  `${n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

export const fmtN = (n: number, casas = 0) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

// ─── Tooltip padrão (valor primeiro, rótulo depois) ──────────────────────

export function CaixaTooltip({ titulo, linhas, rodape }: {
  titulo: string;
  linhas: Array<{ cor?: string; rotulo: string; valor: string; tracejado?: boolean }>;
  rodape?: string;
}) {
  return (
    <div className="rounded-lg border border-border-strong bg-popover text-popover-foreground shadow-xl px-3 py-2 text-[11px] min-w-[180px]">
      <div className="font-semibold mb-1.5">{titulo}</div>
      <div className="space-y-1">
        {linhas.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            {l.cor && (
              <span className="w-3 shrink-0" style={{ borderTop: `2px ${l.tracejado ? "dashed" : "solid"} ${l.cor}` }} />
            )}
            <span className="font-semibold tabular-nums">{l.valor}</span>
            <span className="text-muted-foreground">{l.rotulo}</span>
          </div>
        ))}
      </div>
      {rodape && <div className="mt-1.5 pt-1.5 border-t border-border text-muted-foreground">{rodape}</div>}
    </div>
  );
}

// ─── Delta colorido (direção × se subir é bom) ───────────────────────────

export function Delta({ valor, sufixo = "%", base, subirEhBom = true, casas = 1 }: {
  valor: number | null; sufixo?: string; base: string; subirEhBom?: boolean; casas?: number;
}) {
  if (valor == null || !Number.isFinite(valor)) return null;
  const neutro = Math.abs(valor) < 0.05;
  const bom = neutro ? null : (valor > 0) === subirEhBom;
  const Icone = neutro ? Minus : valor > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold border",
      bom === null && "text-muted-foreground border-border bg-muted/40",
      bom === true && "text-success border-success/30 bg-success/10",
      bom === false && "text-danger border-danger/30 bg-danger/10",
    )}>
      <Icone className="w-3 h-3" aria-hidden />
      {valor > 0 ? "+" : valor < 0 ? "−" : ""}{Math.abs(valor).toLocaleString("pt-BR", { maximumFractionDigits: casas })}{sufixo}
      <span className="font-normal text-muted-foreground ml-0.5">{base}</span>
    </span>
  );
}

// ─── Sparkline (12 pontos; tendência em tom apagado, mês atual em destaque) ─

export function Sparkline({ valores, rotulos, destaque, formatar, altura = 34 }: {
  valores: Array<number | null>;
  rotulos: string[];
  destaque?: number;            // índice do mês filtrado (padrão: o último)
  formatar: (n: number) => string;
  altura?: number;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const largura = 120;
  const pontos = valores.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null);
  if (pontos.length < 2) return <div style={{ height: altura }} aria-hidden />;
  const min = Math.min(...pontos.map((p) => p.v)), max = Math.max(...pontos.map((p) => p.v));
  const span = max - min || 1;
  const n = valores.length;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * (largura - 8) + 4);
  const y = (v: number) => altura - 4 - ((v - min) / span) * (altura - 8);
  const d = pontos.map((p, k) => `${k === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const iDest = destaque ?? n - 1;
  const vDest = valores[iDest];
  const ativo = hover != null ? pontos.find((p) => p.i === hover) : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${largura} ${altura}`} width="100%" height={altura} preserveAspectRatio="none" role="img"
        aria-label={`Tendência de ${rotulos[0]} a ${rotulos[rotulos.length - 1]}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const rel = ((e.clientX - r.left) / r.width) * largura;
          setHover(Math.max(0, Math.min(n - 1, Math.round(((rel - 4) / (largura - 8)) * (n - 1)))));
        }}>
        {min < 0 && max > 0 && <line x1={0} x2={largura} y1={y(0)} y2={y(0)} stroke={COR.grade} strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        <path d={d} fill="none" stroke="var(--muted-foreground)" strokeOpacity={0.55} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {vDest != null && <circle cx={x(iDest)} cy={y(vDest)} r={3} fill={COR.s1} stroke="var(--card)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
        {ativo && <line x1={x(ativo.i)} x2={x(ativo.i)} y1={0} y2={altura} stroke="var(--muted-foreground)" strokeOpacity={0.4} strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      </svg>
      {ativo && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border-strong bg-popover px-2 py-0.5 text-[10px] shadow-lg pointer-events-none z-10">
          <span className="font-semibold">{formatar(ativo.v)}</span> <span className="text-muted-foreground">{rotulos[ativo.i]}</span>
        </div>
      )}
    </div>
  );
}

// ─── Dica explicativa (hover e foco de teclado) ─────────────────────────

export function Dica({ texto }: { texto: string }) {
  return (
    <span className="relative group inline-flex">
      <button type="button" aria-label={texto} className="text-muted-foreground hover:text-foreground focus:text-foreground outline-none">
        <Info className="w-3.5 h-3.5" />
      </button>
      <span role="tooltip"
        className="pointer-events-none absolute right-0 top-5 z-20 w-64 rounded-lg border border-border-strong bg-popover p-2.5 text-[11px] leading-snug text-popover-foreground shadow-xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        {texto}
      </span>
    </span>
  );
}

// ─── Barra de progresso (meter) ─────────────────────────────────────────

export function Medidor({ pct, tom }: { pct: number; tom: "positivo" | "negativo" | "neutro" }) {
  const w = Math.max(0, Math.min(100, pct));
  const cor = tom === "positivo" ? "bg-success" : tom === "negativo" ? "bg-danger" : "bg-brand-cyan";
  const trilho = tom === "positivo" ? "bg-success/15" : tom === "negativo" ? "bg-danger/15" : "bg-brand-cyan/15";
  return (
    <div className={cn("h-1.5 w-full rounded-full overflow-hidden", trilho)} role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all duration-700", cor)} style={{ width: `${w}%` }} />
    </div>
  );
}

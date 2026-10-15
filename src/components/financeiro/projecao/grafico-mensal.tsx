"use client";

// LavSync · Projetado × Real — gráfico mensal
//
// Colunas = REAL (cor da marca), linha tracejada = PROJETADO da franqueadora.
// Forma e traço diferentes já separam as séries sem depender só da cor; as
// cores das séries foram validadas (separação para daltonismo) nos dois temas
// e moram em variáveis locais (--pvr-real / --pvr-proj) com versão clara e escura.
// Legenda clicável liga/desliga cada série; o tooltip traz real, projetado e
// % atingido do mês. Mês com real ESTIMADO (custo por % de referência) aparece
// com coluna mais clara e a marca "estimado" no tooltip.
import * as React from "react";
import {
  Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { fmtBRL, fmtBRLCompacto, fmtPct } from "./formatos";

export type PontoGrafico = {
  rotulo: string;     // "M3"
  calendario: string; // "out/25"
  real: number | null;
  projetado: number;
  estimado: boolean;
};

/** Cores das séries — locais ao gráfico, claro e escuro. */
export const ESTILO_SERIES = `
.pvr-viz { --pvr-real: #0F859A; --pvr-proj: #4A3AA7; }
.dark .pvr-viz { --pvr-real: #0FABB7; --pvr-proj: #9085E9; }
`;

type Serie = "real" | "projetado";

export function GraficoMensal({ dados, metrica }: { dados: PontoGrafico[]; metrica: "faturamento" | "resultado" }) {
  const [ocultas, setOcultas] = React.useState<Set<Serie>>(() => new Set());
  const alternar = (s: Serie) => setOcultas((o) => {
    const n = new Set(o);
    if (n.has(s)) n.delete(s); else n.add(s);
    return n;
  });
  const temNegativo = dados.some((d) => (d.real ?? 0) < 0 || d.projetado < 0);
  const temEstimado = dados.some((d) => d.real != null && d.estimado);

  return (
    <div className="pvr-viz flex flex-col h-full">
      <style>{ESTILO_SERIES}</style>
      <div className="flex flex-wrap items-center gap-2 mb-2 text-[11px]">
        <BotaoLegenda ativo={!ocultas.has("real")} onClick={() => alternar("real")} rotulo="Real">
          <span className="w-2.5 h-2.5 rounded-[2px]" style={{ background: "var(--pvr-real)" }} />
        </BotaoLegenda>
        <BotaoLegenda ativo={!ocultas.has("projetado")} onClick={() => alternar("projetado")} rotulo="Projetado pela franqueadora">
          <svg width="16" height="4" aria-hidden><line x1="0" y1="2" x2="16" y2="2" stroke="var(--pvr-proj)" strokeWidth="2" strokeDasharray="4 3" /></svg>
        </BotaoLegenda>
        {temEstimado && (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-[2px] opacity-45" style={{ background: "var(--pvr-real)" }} /> real com custo estimado
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="rotulo"
              stroke="var(--muted-foreground)"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: "var(--border-strong)" }}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={72}
              tickFormatter={(v: number) => fmtBRLCompacto(v)}
            />
            {temNegativo && <ReferenceLine y={0} stroke="var(--border-strong)" />}
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={<ConteudoTooltip metrica={metrica} />}
            />
            {!ocultas.has("real") && (
              <Bar dataKey="real" name="Real" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {dados.map((d, i) => (
                  <Cell key={i} fill="var(--pvr-real)" fillOpacity={d.estimado ? 0.45 : 1} />
                ))}
              </Bar>
            )}
            {!ocultas.has("projetado") && (
              <Line
                dataKey="projetado"
                name="Projetado"
                type="monotone"
                stroke="var(--pvr-proj)"
                strokeWidth={2}
                strokeDasharray="6 4"
                strokeLinecap="round"
                dot={false}
                activeDot={{ r: 4, fill: "var(--pvr-proj)", stroke: "var(--card)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function BotaoLegenda({ ativo, onClick, rotulo, children }: {
  ativo: boolean; onClick: () => void; rotulo: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      title={ativo ? `Ocultar ${rotulo.toLowerCase()}` : `Mostrar ${rotulo.toLowerCase()}`}
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-2 rounded-md border transition-colors",
        ativo ? "border-border text-foreground bg-card" : "border-dashed border-border text-muted-foreground opacity-60",
      )}
    >
      {children}
      <span className={cn(!ativo && "line-through")}>{rotulo}</span>
    </button>
  );
}

type PropsTooltip = {
  active?: boolean;
  payload?: Array<{ payload?: PontoGrafico }>;
  metrica: "faturamento" | "resultado";
};

function ConteudoTooltip({ active, payload, metrica }: PropsTooltip) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const pct = p.real != null && p.projetado !== 0 ? p.real / p.projetado : null;
  const gap = p.real != null ? p.real - p.projetado : null;
  return (
    <div className="rounded-lg border border-border-strong bg-popover text-popover-foreground shadow-lg px-3 py-2 text-[11px] min-w-[180px]">
      <div className="font-semibold text-[12px] mb-1.5">
        {p.rotulo.replace("M", "Mês ")} · {p.calendario}
        <span className="ml-1 font-normal text-muted-foreground">{metrica === "faturamento" ? "faturamento" : "resultado"}</span>
      </div>
      <Linha cor="var(--pvr-real)" tipo="barra" rotulo={p.estimado ? "Real (custo estimado)" : "Real"}
        valor={p.real != null ? fmtBRL(p.real) : "sem dado"} />
      <Linha cor="var(--pvr-proj)" tipo="linha" rotulo="Projetado" valor={fmtBRL(p.projetado)} />
      {pct != null && metrica === "faturamento" && (
        <div className="mt-1.5 pt-1.5 border-t border-border flex justify-between gap-3">
          <span className="text-muted-foreground">Atingido</span>
          <span className="font-mono font-semibold">{fmtPct(pct, 0)}</span>
        </div>
      )}
      {gap != null && (
        <div className={cn("flex justify-between gap-3", !(pct != null && metrica === "faturamento") && "mt-1.5 pt-1.5 border-t border-border")}>
          <span className="text-muted-foreground">Diferença</span>
          <span className="font-mono font-semibold">{gap > 0 ? "+" : ""}{fmtBRL(gap)}</span>
        </div>
      )}
    </div>
  );
}

function Linha({ cor, tipo, rotulo, valor }: { cor: string; tipo: "barra" | "linha"; rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        {tipo === "barra"
          ? <span className="w-2.5 h-[3px] rounded-full" style={{ background: cor }} />
          : <svg width="10" height="3" aria-hidden><line x1="0" y1="1.5" x2="10" y2="1.5" stroke={cor} strokeWidth="2" strokeDasharray="3 2" /></svg>}
        {rotulo}
      </span>
      <span className="font-mono font-semibold text-foreground">{valor}</span>
    </div>
  );
}

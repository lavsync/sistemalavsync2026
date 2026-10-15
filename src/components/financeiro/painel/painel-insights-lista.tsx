"use client";

// LavSync · Financeiro › Painel Geral — insights automáticos + CLOCK
//
// Mostra as frases do motor determinístico (painel-insights.ts) com tom,
// número, base de comparação e a ação sugerida. O botão "Perguntar ao CLOCK"
// manda uma pergunta pronta sobre o mês para o CLOCK v2 e abre o painel dele.
import * as React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, TrendingUp, TrendingDown, CircleDot } from "lucide-react";
import { useClock } from "@/components/clock/clock-provider";
import { cn } from "@/lib/utils";
import type { InsightPainel, PainelDados } from "@/lib/financeiro/painel/tipos";
import { perguntaClock } from "@/lib/financeiro/painel/painel-insights";

export function BotaoPerguntarClock({ d }: { d: PainelDados }) {
  const { enviar, setRailRecolhido, setSheetAberto } = useClock();
  return (
    <button type="button"
      onClick={() => {
        enviar(perguntaClock(d), "texto");
        setRailRecolhido(false);
        if (!window.matchMedia("(min-width: 1280px)").matches) setSheetAberto(true);
      }}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold text-white bg-gradient-to-r from-brand-cyan to-brand-blue hover:opacity-90 transition-smooth">
      <Sparkles className="w-3.5 h-3.5" aria-hidden />
      Perguntar ao CLOCK sobre este mês
    </button>
  );
}

const ICONE = { positivo: TrendingUp, negativo: TrendingDown, neutro: CircleDot } as const;
const ROTULO_TOM = { positivo: "Bom sinal", negativo: "Atenção", neutro: "Observação" } as const;

export function ListaInsights({ insights, d }: { insights: InsightPainel[]; d: PainelDados }) {
  const [todos, setTodos] = React.useState(false);
  const visiveis = todos ? insights : insights.slice(0, 6);
  return (
    <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="painel-insights-titulo">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 id="painel-insights-titulo" className="font-display font-semibold text-[15px] tracking-tight">Leitura do mês</h3>
          <p className="text-xs text-muted-foreground mt-1">Insights calculados a partir dos números acima — cada um com a base de comparação e o próximo passo.</p>
        </div>
        <BotaoPerguntarClock d={d} />
      </header>
      {insights.length === 0 ? (
        <p className="text-[12px] text-muted-foreground py-4">Nada fora do padrão neste mês.</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {visiveis.map((i) => {
            const Icone = ICONE[i.tom];
            return (
              <li key={i.id} className={cn("rounded-lg border p-3 flex gap-2.5",
                i.tom === "positivo" && "border-success/30 bg-success/5",
                i.tom === "negativo" && "border-danger/30 bg-danger/5",
                i.tom === "neutro" && "border-border bg-muted/30")}>
                <Icone className={cn("w-4 h-4 mt-0.5 shrink-0",
                  i.tom === "positivo" ? "text-success" : i.tom === "negativo" ? "text-danger" : "text-muted-foreground")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[12.5px] font-semibold">{i.titulo}</span>
                    <span className={cn("text-[10px] font-semibold uppercase tracking-wider",
                      i.tom === "positivo" ? "text-success" : i.tom === "negativo" ? "text-danger" : "text-muted-foreground")}>{ROTULO_TOM[i.tom]}</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">{i.texto}</p>
                  {i.acao && (
                    <Link href={i.acao.href} className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand-cyan hover:underline">
                      {i.acao.rotulo} <ArrowRight className="w-3 h-3" aria-hidden />
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {insights.length > 6 && (
        <button type="button" onClick={() => setTodos((v) => !v)} className="mt-3 text-[12px] font-semibold text-brand-cyan hover:underline">
          {todos ? "Mostrar menos" : `Ver todos os ${insights.length} insights`}
        </button>
      )}
    </section>
  );
}

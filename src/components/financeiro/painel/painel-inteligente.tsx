"use client";

// LavSync · Financeiro › Painel Geral inteligente
//
// Raiz do painel: filtro de escopo (unidade/consolidado) e de mês numa única
// linha acima de tudo, refletidos na URL (?mes=AAAA-MM, ?escopo=consolidado,
// mantendo ?aba= e ?unidade=). Os dados do mês chegam prontos do servidor
// (carregar-painel.ts); trocar de mês navega na mesma rota e o painel anterior
// fica visível, esmaecido, até o novo chegar (sem pular layout). Insights,
// tooltips, drill da cascata e liga/desliga de séries rodam no cliente.
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Building2, Layers, Loader2, History } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PainelDados } from "@/lib/financeiro/painel/tipos";
import { gerarInsights } from "@/lib/financeiro/painel/painel-insights";
import { PainelEstilos } from "./painel-ui";
import { PainelKpis } from "./painel-kpis";
import {
  GraficoCascata, GraficoEvolucao, GraficoComposicao, GraficoDias, MixServicos, ComparativoUnidades,
  type GrupoCascata,
} from "./painel-graficos";
import { ListaInsights } from "./painel-insights-lista";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const somaMeses = (k: string, n: number) => {
  const [a, m] = k.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export function PainelInteligente({ dados, unidadeId }: { dados: PainelDados; unidadeId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendente, iniciar] = React.useTransition();
  const [grupo, setGrupo] = React.useState<GrupoCascata | null>(null);
  const d = dados;
  const insights = React.useMemo(() => gerarInsights(d), [d]);

  // Novo mês/escopo = drill zerado (ajuste no render, sem efeito)
  const [chaveVista, setChaveVista] = React.useState(`${d.mes}|${d.escopo.rotulo}`);
  if (chaveVista !== `${d.mes}|${d.escopo.rotulo}`) { setChaveVista(`${d.mes}|${d.escopo.rotulo}`); setGrupo(null); }

  const navegar = React.useCallback((m: { mes?: string; escopo?: "consolidado" | null }) => {
    const p = new URLSearchParams(window.location.search);
    p.set("aba", "painel");
    if (m.mes) p.set("mes", m.mes);
    if (m.escopo !== undefined) { if (m.escopo) p.set("escopo", m.escopo); else p.delete("escopo"); }
    iniciar(() => router.push(`${pathname}?${p.toString()}`, { scroll: false }));
  }, [pathname, router]);

  const abrirUnidade = React.useCallback((id: string) => {
    if (id === unidadeId) { navegar({ escopo: null }); return; }
    // Trocar de unidade recarrega a tela inteira (as outras abas dependem dela)
    const p = new URLSearchParams(window.location.search);
    p.set("aba", "painel"); p.set("unidade", id); p.delete("escopo");
    window.location.href = `${pathname}?${p.toString()}`;
  }, [navegar, pathname, unidadeId]);

  const irMes = (mes: string) => { if (mes !== d.mes && mes <= d.mes_atual) navegar({ mes }); };

  return (
    <div className="painel-fin space-y-4">
      <PainelEstilos />

      {/* Filtros — uma linha, acima de tudo o que escopam */}
      <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-x-4 gap-y-2.5">
        {d.unidades.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Escopo">
            <Chip ativo={d.escopo.tipo === "consolidado"} onClick={() => navegar({ escopo: "consolidado" })} icone={Layers}>Consolidado</Chip>
            {d.unidades.map((u) => (
              <Chip key={u.id} ativo={d.escopo.tipo === "unidade" && d.escopo.unidade_id === u.id} onClick={() => abrirUnidade(u.id)} icone={Building2}>{u.nome}</Chip>
            ))}
          </div>
        )}
        <FiltroMes d={d} onMes={irMes} />
        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground" aria-live="polite">
          {pendente && <><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Carregando…</>}
        </div>
      </div>

      <div className={cn("space-y-4 transition-opacity duration-200", pendente && "opacity-50 pointer-events-none")} aria-busy={pendente}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            {d.titulo}
            <span className="ml-2 text-[12px] font-normal text-muted-foreground">
              {d.escopo.rotulo}{d.mes_corrente ? " · mês em andamento" : ""}
            </span>
          </h2>
          {d.projecao_nome && <span className="text-[11px] text-muted-foreground">Projetado: {d.projecao_nome}</span>}
        </div>

        <PainelKpis d={d} />
        <ListaInsights insights={insights} d={d} />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <GraficoEvolucao d={d} onMes={irMes} />
          <GraficoCascata d={d} ativo={grupo} onAtivo={setGrupo} />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <GraficoComposicao d={d} />
          <MixServicos d={d} />
        </div>
        <GraficoDias d={d} />
        {d.escopo.tipo === "consolidado" && d.comparativo && d.comparativo.length > 1 && (
          <ComparativoUnidades d={d} onUnidade={abrirUnidade} />
        )}
      </div>
    </div>
  );
}

function FiltroMes({ d, onMes }: { d: PainelDados; onMes: (mes: string) => void }) {
  const [ano, mes] = d.mes.split("-").map(Number);
  const [anoAtual, mesAtual] = d.mes_atual.split("-").map(Number);
  const anoMin = Math.min(ano, d.primeiro_mes ? Number(d.primeiro_mes.slice(0, 4)) : anoAtual - 2);
  const anos = Array.from({ length: anoAtual - anoMin + 1 }, (_, i) => anoAtual - i);
  const chave = (a: number, m: number) => `${a}-${String(m).padStart(2, "0")}`;
  const proximo = somaMeses(d.mes, 1);
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Mês de referência">
      <CalendarDays className="w-4 h-4 text-muted-foreground" aria-hidden />
      <button type="button" aria-label="Mês anterior" onClick={() => onMes(somaMeses(d.mes, -1))}
        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border hover:bg-secondary transition-smooth">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <select aria-label="Mês" className="form-input w-auto h-8 py-0" value={mes}
        onChange={(e) => { const m = Number(e.target.value); const k = chave(ano, m); onMes(k > d.mes_atual ? d.mes_atual : k); }}>
        {MESES.map((nome, i) => (
          <option key={nome} value={i + 1} disabled={ano === anoAtual && i + 1 > mesAtual}>{nome}</option>
        ))}
      </select>
      <select aria-label="Ano" className="form-input w-auto h-8 py-0" value={ano}
        onChange={(e) => { const a = Number(e.target.value); const k = chave(a, mes); onMes(k > d.mes_atual ? d.mes_atual : k); }}>
        {anos.map((a) => <option key={a} value={a}>{a}</option>)}
      </select>
      <button type="button" aria-label="Próximo mês" disabled={proximo > d.mes_atual} onClick={() => onMes(proximo)}
        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border hover:bg-secondary transition-smooth disabled:opacity-40 disabled:pointer-events-none">
        <ChevronRight className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => onMes(d.mes_atual)} aria-pressed={d.mes === d.mes_atual}
        className={cn("h-8 px-2.5 rounded-lg border text-[11.5px] font-semibold transition-smooth",
          d.mes === d.mes_atual ? "border-brand-cyan bg-brand-cyan/10 text-brand-cyan" : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary")}>
        Mês atual
      </button>
      <button type="button" onClick={() => onMes(d.ultimo_fechado)} aria-pressed={d.mes === d.ultimo_fechado}
        className={cn("h-8 px-2.5 rounded-lg border text-[11.5px] font-semibold transition-smooth inline-flex items-center gap-1",
          d.mes === d.ultimo_fechado ? "border-brand-cyan bg-brand-cyan/10 text-brand-cyan" : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary")}>
        <History className="w-3.5 h-3.5" aria-hidden /> Último fechado
      </button>
    </div>
  );
}

function Chip({ ativo, onClick, icone: Icone, children }: { ativo: boolean; onClick: () => void; icone: React.ElementType; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      className={cn("h-8 px-3 rounded-full text-[12px] font-semibold border transition-smooth inline-flex items-center gap-1.5",
        ativo ? "bg-brand-cyan text-primary-foreground border-brand-cyan" : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary")}>
      <Icone className="w-3 h-3" aria-hidden /> {children}
    </button>
  );
}

/** Esqueleto do painel (enquanto o servidor monta o primeiro carregamento). */
export function PainelEsqueleto() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden>
      <div className="h-14 rounded-xl bg-muted" />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-36 rounded-2xl bg-muted" />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="h-80 rounded-xl bg-muted" /><div className="h-80 rounded-xl bg-muted" />
      </div>
    </div>
  );
}

"use client";

// LavSync · Financeiro › Painel Geral — KPIs do mês
//
// Oito cartões: número grande, deltas com base nomeada (mês anterior, mesmo
// mês do ano passado, projetado da franqueadora), sparkline de 12 meses e uma
// dica explicando a conta. Sem dado = traço e o motivo, nunca número inventado.
import * as React from "react";
import Link from "next/link";
import {
  TrendingUp, Wallet, Target, WashingMachine, Coins, Receipt, PiggyBank, ShieldCheck, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PainelDados } from "@/lib/financeiro/painel/tipos";
import { rotuloMes } from "@/lib/financeiro/painel/painel-insights";
import { Delta, Dica, Medidor, Sparkline, fmtN, fmtP, fmtR, fmtRCompacto } from "./painel-ui";

const varPct = (a: number, b: number): number | null => (b ? ((a - b) / Math.abs(b)) * 100 : null);

function Cartao({ icone: Icone, rotulo, dica, valor, valorTom, sub, deltas, rodape, children, className }: {
  icone: React.ElementType; rotulo: string; dica: string;
  valor: React.ReactNode; valorTom?: "positivo" | "negativo";
  sub?: React.ReactNode; deltas?: React.ReactNode; rodape?: React.ReactNode; children?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 flex flex-col gap-2 min-w-0", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground min-w-0">
          <Icone className="w-3.5 h-3.5 shrink-0 text-brand-cyan" aria-hidden />
          <span className="truncate">{rotulo}</span>
        </div>
        <Dica texto={dica} />
      </div>
      <div className={cn("font-display text-[26px] leading-none font-semibold tracking-tight",
        valorTom === "positivo" && "text-success", valorTom === "negativo" && "text-danger")}>
        {valor}
      </div>
      {sub && <div className="text-[11.5px] text-muted-foreground leading-snug">{sub}</div>}
      {deltas && <div className="flex flex-wrap gap-1">{deltas}</div>}
      {children}
      {rodape && <div className="mt-auto pt-1 text-[11px] text-muted-foreground">{rodape}</div>}
    </div>
  );
}

const Traco = () => <span className="text-muted-foreground">—</span>;

export function PainelKpis({ d }: { d: PainelDados }) {
  const a = d.atual, ant = d.anterior, ano = d.ano_anterior;
  const rot = d.serie.map((s) => s.rotulo);
  const rAnt = rotuloMes(ant.mes), rAno = rotuloMes(ano.mes);
  const linkConfig = `/financeiro?${new URLSearchParams({ aba: "config", ...(d.escopo.tipo === "unidade" ? { unidade: d.escopo.unidade_id } : {}) }).toString()}`;

  // Mês corrente: comparar o mês PARCIAL com meses cheios engana. A base de
  // faturamento e equilíbrio vira a previsão de fechamento (mesma regra do
  // motor de insights); resultado, margem e ciclos não têm previsão, então
  // ficam sem delta até o mês fechar.
  const parcial = d.mes_corrente;
  const fatBase: number | null = parcial ? (d.fechamento?.faturamento_previsto ?? null) : a.tem ? a.faturamento : null;
  const pref = parcial ? "previsão " : "";

  // Faturamento
  const fatDeltas = fatBase != null ? (
    <>
      {ant.tem && <Delta valor={varPct(fatBase, ant.faturamento)} base={`${pref}vs ${rAnt}`} />}
      {ano.tem && <Delta valor={varPct(fatBase, ano.faturamento)} base={`${pref}vs ${rAno}`} />}
      {d.projetado && d.projetado.faturamento > 0 && <Delta valor={varPct(fatBase, d.projetado.faturamento)} base={`${pref}vs projetado`} />}
    </>
  ) : null;

  // Resultado e margem (só mês fechado)
  const ppMargem = !parcial && a.margem != null && ant.margem != null ? a.margem - ant.margem : null;

  // Ponto de equilíbrio (no mês corrente, contra a previsão de fechamento)
  const pe = d.ponto_equilibrio;
  const difPe = pe != null && fatBase != null ? fatBase - pe : null;
  const pctPe = pe && pe > 0 && fatBase != null ? (fatBase / pe) * 100 : null;

  // Ciclos
  const c = d.ciclos;
  const cAnt = d.ciclos_anterior;

  // Despesas
  const despPct = a.tem && a.faturamento > 0 ? (a.despesas / a.faturamento) * 100 : null;
  const custosTotais = d.linhas.reduce((s, l) => s + l.valor, 0);
  const maior = d.linhas[0];

  // Payback
  const pb = d.payback;

  // Qualidade
  const ql = d.qualidade;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <Cartao icone={TrendingUp} rotulo={d.mes_corrente ? "Faturamento até hoje" : "Faturamento"}
        dica="Soma das vendas aprovadas no mês (fuso de Brasília). Sem vendas, vale o faturamento lançado à mão. Deltas comparam com o mês anterior, o mesmo mês do ano passado e o projetado da franqueadora; no mês em andamento quem é comparada é a previsão de fechamento."
        valor={a.tem ? fmtR(a.faturamento) : <Traco />}
        sub={d.mes_corrente && d.fechamento
          ? <>Previsão de fechamento <b className="text-foreground">{fmtR(d.fechamento.faturamento_previsto)}</b> no ritmo de {fmtR(d.fechamento.ritmo_diario)}/dia</>
          : !a.tem ? "Sem faturamento no mês" : undefined}
        deltas={fatDeltas}>
        <Sparkline valores={d.serie.map((s) => (s.tem ? s.faturamento : null))} rotulos={rot} formatar={(n) => fmtR(n)} />
      </Cartao>

      <Cartao icone={Wallet} rotulo="Resultado líquido"
        dica="Faturamento menos Simples, custo do serviço, royalties, custos fixos e variáveis — o mesmo DRE da aba DRE Mensal. Valores pagos substituem os estimados."
        valor={a.tem ? fmtR(a.resultado) : <Traco />}
        valorTom={a.tem ? (a.resultado >= 0 ? "positivo" : "negativo") : undefined}
        sub={a.margem != null ? <>Margem líquida <b className="text-foreground">{fmtP(a.margem)}</b></> : undefined}
        deltas={a.tem && !parcial ? (
          <>
            {ppMargem != null && <Delta valor={ppMargem} sufixo=" p.p." base={`margem vs ${rAnt}`} />}
            {ant.tem && <Delta valor={varPct(a.resultado, ant.resultado)} base={`vs ${rAnt}`} />}
          </>
        ) : null}>
        <Sparkline valores={d.serie.map((s) => (s.tem ? s.resultado : null))} rotulos={rot} formatar={(n) => fmtR(n)} />
      </Cartao>

      <Cartao icone={Target} rotulo="Ponto de equilíbrio"
        dica="Faturamento mínimo do mês para o resultado líquido ficar em zero, pela estrutura de custos cadastrada (fixos, variáveis, royalties e Simples da faixa do mês). No consolidado é a soma das unidades. No mês em andamento a comparação usa a previsão de fechamento."
        valor={pe != null ? fmtR(pe) : <Traco />}
        sub={difPe == null
          ? (pe == null ? "Cadastre a inauguração e os custos da unidade"
            : parcial ? "Mês começou hoje: sem dia completo para prever o fechamento"
            : "Sem faturamento no mês")
          : parcial
            ? (difPe >= 0
              ? <>Previsão fecha <b className="text-success">{fmtR(difPe)} acima</b> do equilíbrio</>
              : <>Previsão fecha <b className="text-danger">{fmtR(-difPe)} abaixo</b> do equilíbrio</>)
          : difPe >= 0 ? <><b className="text-success">{fmtR(difPe)} acima</b> do equilíbrio</>
          : <>Faltam <b className="text-danger">{fmtR(-difPe)}</b> para o equilíbrio</>}
        rodape={pctPe != null ? (parcial ? `previsão cobre ${fmtP(pctPe, 0)} do necessário` : `${fmtP(pctPe, 0)} do necessário realizado`) : undefined}>
        {pctPe != null && <Medidor pct={pctPe} tom={pctPe >= 100 ? "positivo" : "negativo"} />}
      </Cartao>

      <Cartao icone={WashingMachine} rotulo="Ciclos e ticket por ciclo"
        dica="Ciclos vendidos no mês (lavagem + secagem; combo conta os dois; vendas sem tipo de serviço entram no total e aparecem como 'sem tipo'). Ticket por ciclo = faturamento das vendas ÷ ciclos — a métrica única usada em todo o sistema. No mês em andamento os deltas só aparecem depois que o mês fecha."
        valor={c ? fmtN(c.total) : <Traco />}
        sub={c ? <>Ticket por ciclo <b className="text-foreground">{c.ticket_ciclo != null ? fmtR(c.ticket_ciclo, 2) : "—"}</b> · {fmtN(c.lavagem)} lav. · {fmtN(c.secagem)} sec.{c.indefinido > 0 && <> · {fmtN(c.indefinido)} sem tipo</>}</> : "Sem vendas registradas no mês"}
        deltas={c && cAnt && !parcial ? (
          <>
            <Delta valor={varPct(c.total, cAnt.total)} base={`ciclos vs ${rAnt}`} />
            {c.ticket_ciclo != null && cAnt.ticket_ciclo != null && <Delta valor={varPct(c.ticket_ciclo, cAnt.ticket_ciclo)} base="ticket" />}
          </>
        ) : null}>
        <Sparkline valores={d.serie.map((s) => s.ciclos)} rotulos={rot} formatar={(n) => `${fmtN(n)} ciclos`} />
      </Cartao>

      <Cartao icone={Coins} rotulo="Custo e margem por ciclo"
        dica="Custo dos insumos por ciclo (sabão, amaciante, energia e água rateada) da engenharia de custos. Margem de contribuição por ciclo = (faturamento das vendas − insumos) ÷ ciclos. Considera só os ciclos com tipo de serviço (lavagem, secagem ou combo)."
        valor={c?.custo_ciclo != null ? fmtR(c.custo_ciclo, 2) : <Traco />}
        sub={c?.mc_ciclo != null
          ? <>Margem de contribuição <b className="text-foreground">{fmtR(c.mc_ciclo, 2)}</b>/ciclo{c.mc_pct != null && <> · {fmtP(c.mc_pct)}</>}</>
          : c ? "Engenharia de custos não cadastrada" : "Sem vendas registradas no mês"}
        rodape={c && c.unidades_sem_engenharia.length > 0
          ? <Link href={linkConfig} className="inline-flex items-center gap-1 text-brand-cyan hover:underline">Sem engenharia: {c.unidades_sem_engenharia.join(", ")} <ArrowRight className="w-3 h-3" /></Link>
          : undefined} />

      <Cartao icone={Receipt} rotulo="Despesas operacionais"
        dica="Royalties + custos fixos + custos variáveis do mês (sem Simples e sem custo do serviço). O maior custo considera todas as linhas do DRE, inclusive Simples e CSP."
        valor={a.tem ? fmtR(a.despesas) : <Traco />}
        sub={despPct != null ? <><b className="text-foreground">{fmtP(despPct)}</b> do faturamento</> : undefined}
        rodape={maior && custosTotais > 0 ? <>Maior custo: <b className="text-foreground">{maior.descricao}</b> · {fmtP((maior.valor / custosTotais) * 100, 0)} dos custos</> : undefined}>
        <Sparkline valores={d.serie.map((s) => s.despesas_pct)} rotulos={rot} formatar={(n) => `${fmtP(n)} do fat.`} />
      </Cartao>

      <Cartao icone={PiggyBank} rotulo="Payback"
        dica="Resultado líquido real acumulado desde a inauguração até o último mês fechado do período filtrado, sobre o investimento total. Meses restantes = falta recuperar ÷ média do resultado dos últimos 3 meses fechados."
        valor={pb.investimento > 0 ? fmtP(pb.pct) : <Traco />}
        sub={pb.investimento <= 0 ? "Cadastre o investimento na aba Investimento"
          : pb.falta <= 0 ? <b className="text-success">Investimento recuperado</b>
          : pb.meses_restantes != null && pb.mes_estimado
            ? <>~{pb.meses_restantes} {pb.meses_restantes === 1 ? "mês" : "meses"} no ritmo de {fmtRCompacto(pb.ritmo_3m ?? 0)}/mês · <b className="text-foreground">{rotuloMes(pb.mes_estimado)}</b></>
            : <>Faltam {fmtR(pb.falta)} · ritmo atual não paga o investimento</>}
        rodape={pb.investimento > 0 ? (
          <>{fmtR(pb.acumulado)} de {fmtR(pb.investimento)}{pb.projetado_mes ? <> · projetado {rotuloMes(pb.projetado_mes)}</> : null}</>
        ) : undefined}>
        {pb.investimento > 0 && <Medidor pct={pb.pct} tom={pb.pct >= 100 ? "positivo" : "neutro"} />}
      </Cartao>

      <Cartao icone={ShieldCheck} rotulo="Qualidade do dado"
        dica="Quanto dos custos lançáveis do mês (custo do serviço, fixos e variáveis) já está com o valor pago lançado. O resto é estimativa pelo percentual ou valor de referência cadastrado."
        valor={ql.total > 0 ? fmtP(ql.pct_pago, 0) : <Traco />}
        sub={ql.total > 0 ? <>dos custos com valor pago · {fmtR(ql.estimado + ql.parcial)} estimado</> : "Sem custos no mês"}
        rodape={ql.total > 0 && ql.pct_pago < 100
          ? <Link href={linkConfig} className="inline-flex items-center gap-1 text-brand-cyan hover:underline">Lançar valores pagos <ArrowRight className="w-3 h-3" /></Link>
          : undefined}>
        {ql.total > 0 && (
          <div className="flex h-1.5 w-full gap-[2px] rounded-full overflow-hidden" aria-hidden>
            <div className="bg-success h-full" style={{ width: `${(ql.pago / ql.total) * 100}%` }} />
            {ql.parcial > 0 && <div className="bg-warning h-full" style={{ width: `${(ql.parcial / ql.total) * 100}%` }} />}
            <div className="bg-muted-foreground/30 h-full flex-1" />
          </div>
        )}
      </Cartao>
    </div>
  );
}

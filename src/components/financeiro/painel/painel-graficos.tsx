"use client";

// LavSync · Financeiro › Painel Geral — infográficos interativos
//
// Cascata do DRE (clique destaca as linhas no detalhamento), evolução de 12
// meses (legenda liga/desliga séries; clique seleciona o mês), margem líquida
// em gráfico próprio (um eixo por gráfico — nunca eixo duplo), composição dos
// custos (donut com raio percentual, R$ ou %), faturamento por dia e por dia
// da semana, mix lavagem × secagem e o ranking das unidades no consolidado.
// Cores pelos tokens do painel (painel-ui.tsx); texto sempre em tinta neutra.
import * as React from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Building2, ChevronRight, WashingMachine, Wind } from "lucide-react";
import { ChartCard } from "@/components/ui/chart-card";
import { cn } from "@/lib/utils";
import type { PainelDados, LinhaCustoPainel } from "@/lib/financeiro/painel/tipos";
import { rotuloMes } from "@/lib/financeiro/painel/painel-insights";
import { COR, SERIES_CATEGORICAS, CaixaTooltip, fmtN, fmtP, fmtR, fmtRCompacto } from "./painel-ui";

/** Rótulo dentro de barra colorida: tinta escura passa AA sobre os slots 1 e 2 nos dois temas. */
const TINTA_NO_PREENCHIMENTO = "#0B1220";

const eixo = { stroke: COR.eixo, fontSize: 10, tickLine: false, axisLine: false } as const;
const indice = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
};

// ═══ Cascata do DRE ════════════════════════════════════════════════════

export type GrupoCascata = "fat" | "simples" | "csp" | "roy" | "fixos" | "variaveis" | "res";

const GRUPO_DA_LINHA: Record<LinhaCustoPainel["grupo"], GrupoCascata> = {
  simples: "simples", csp: "csp", royalties: "roy", fixo: "fixos", variavel: "variaveis",
};

export function GraficoCascata({ d, ativo, onAtivo }: {
  d: PainelDados; ativo: GrupoCascata | null; onAtivo: (g: GrupoCascata | null) => void;
}) {
  const a = d.atual;
  const fat = a.faturamento;
  const passos: Array<{ g: GrupoCascata; nome: string; valor: number }> = [
    { g: "simples", nome: "Simples", valor: a.simples },
    { g: "csp", nome: "CSP", valor: a.csp },
    { g: "roy", nome: "Royalties", valor: a.royalties },
    { g: "fixos", nome: "Fixos", valor: a.fixos },
    { g: "variaveis", nome: "Variáveis", valor: a.variaveis },
  ];
  let topo = fat;
  const dados = [
    { g: "fat" as GrupoCascata, nome: "Faturamento", faixa: [0, fat] as [number, number], valor: fat, sinal: 1 },
    ...passos.map((p) => {
      const faixa: [number, number] = [topo - p.valor, topo];
      topo -= p.valor;
      return { g: p.g, nome: p.nome, faixa, valor: p.valor, sinal: -1 };
    }),
    { g: "res" as GrupoCascata, nome: "Resultado", faixa: (a.resultado >= 0 ? [0, a.resultado] : [a.resultado, 0]) as [number, number], valor: a.resultado, sinal: 0 },
  ];
  const corDe = (g: GrupoCascata, v: number) => (g === "fat" ? COR.s1 : g === "res" ? (v >= 0 ? COR.positivo : COR.negativo) : COR.s2);

  const linhasPorGrupo = new Map<GrupoCascata, LinhaCustoPainel[]>();
  for (const l of d.linhas) {
    const g = GRUPO_DA_LINHA[l.grupo];
    linhasPorGrupo.set(g, [...(linhasPorGrupo.get(g) ?? []), l]);
  }

  return (
    <ChartCard title="Cascata do resultado" height="auto"
      subtitle={`Do faturamento ao resultado de ${rotuloMes(d.mes)} · clique numa barra para ver as linhas`}>
      {!a.tem ? <SemDados texto="Sem faturamento no mês." /> : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                onClick={(s) => { const i = indice(s?.activeIndex); if (i != null) { const g = dados[i].g; onAtivo(ativo === g ? null : g); } }}>
                <CartesianGrid stroke={COR.grade} vertical={false} />
                <XAxis dataKey="nome" {...eixo} interval={0} />
                <YAxis {...eixo} tickFormatter={fmtRCompacto} width={64} />
                <ReferenceLine y={0} stroke={COR.eixo} strokeOpacity={0.5} />
                <Tooltip cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as (typeof dados)[number];
                    return <CaixaTooltip titulo={p.nome} linhas={[
                      { cor: corDe(p.g, p.valor), rotulo: p.sinal < 0 ? "saída" : "valor", valor: `${p.sinal < 0 ? "−" : ""}${fmtR(p.valor)}` },
                      { rotulo: "do faturamento", valor: fat > 0 ? fmtP((Math.abs(p.valor) / fat) * 100) : "—" },
                    ]} rodape={p.g !== "fat" && p.g !== "res" ? "Clique para ver as linhas" : undefined} />;
                  }} />
                <Bar dataKey="faixa" maxBarSize={44} radius={[4, 4, 4, 4]} cursor="pointer" isAnimationActive={false}>
                  {dados.map((p) => (
                    <Cell key={p.g} fill={corDe(p.g, p.valor)} fillOpacity={ativo && ativo !== p.g ? 0.35 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="lg:col-span-2 max-h-[280px] overflow-y-auto pr-1">
            <table className="w-full text-[11.5px]">
              <caption className="sr-only">Linhas do DRE do mês</caption>
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-1 font-semibold">Linha</th>
                  <th className="py-1 font-semibold text-right">R$</th>
                  <th className="py-1 font-semibold text-right">% fat.</th>
                </tr>
              </thead>
              <tbody>
                {dados.map((p) => {
                  const filhos = linhasPorGrupo.get(p.g) ?? [];
                  const aceso = !ativo || ativo === p.g;
                  return (
                    <React.Fragment key={p.g}>
                      <tr onClick={() => onAtivo(ativo === p.g ? null : p.g)}
                        className={cn("cursor-pointer border-t border-border transition-opacity", !aceso && "opacity-40", ativo === p.g && "bg-muted/60")}>
                        <td className="py-1.5 font-semibold">{p.nome}</td>
                        <td className="py-1.5 text-right tabular-nums font-semibold">{p.sinal < 0 ? "−" : ""}{fmtR(p.valor)}</td>
                        <td className="py-1.5 text-right tabular-nums text-muted-foreground">{fat > 0 ? fmtP((Math.abs(p.valor) / fat) * 100) : "—"}</td>
                      </tr>
                      {ativo === p.g && filhos.map((l) => (
                        <tr key={l.chave} className="text-muted-foreground">
                          <td className="py-1 pl-3">
                            {l.descricao}
                            <span className={cn("ml-1.5 text-[9.5px] font-semibold uppercase",
                              l.origem === "real" ? "text-success" : l.origem === "parcial" ? "text-warning" : "text-muted-foreground")}>
                              {l.origem === "real" ? "pago" : l.origem === "parcial" ? "parcial" : l.origem === "calculado" ? "calculado" : "estimado"}
                            </span>
                          </td>
                          <td className="py-1 text-right tabular-nums">{fmtR(l.valor)}</td>
                          <td className="py-1 text-right tabular-nums">{fat > 0 ? fmtP((l.valor / fat) * 100) : "—"}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

// ═══ Evolução 12 meses ═════════════════════════════════════════════════

type SerieId = "faturamento" | "resultado" | "ponto_equilibrio" | "projetado_faturamento";

export function GraficoEvolucao({ d, onMes }: { d: PainelDados; onMes: (mes: string) => void }) {
  const temProj = d.serie.some((s) => s.projetado_faturamento != null);
  const temPe = d.serie.some((s) => s.ponto_equilibrio != null);
  const series: Array<{ id: SerieId; nome: string; cor: string; tipo: "barra" | "linha" | "tracejada" }> = [
    { id: "faturamento", nome: "Faturamento", cor: COR.s1, tipo: "barra" },
    { id: "resultado", nome: "Resultado líquido", cor: COR.s2, tipo: "linha" },
    ...(temPe ? [{ id: "ponto_equilibrio" as const, nome: "Ponto de equilíbrio", cor: COR.s3, tipo: "tracejada" as const }] : []),
    ...(temProj ? [{ id: "projetado_faturamento" as const, nome: "Projetado franqueadora", cor: COR.s6, tipo: "tracejada" as const }] : []),
  ];
  const [ocultas, setOcultas] = React.useState<Set<SerieId>>(new Set());
  const alternar = (id: SerieId) => setOcultas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const dados = d.serie.map((s) => ({ ...s, faturamento: s.tem ? s.faturamento : null, resultado: s.tem ? s.resultado : null }));
  const clique = (s: { activeIndex?: unknown } | null) => { const i = indice(s?.activeIndex); if (i != null && dados[i]) onMes(dados[i].mes); };
  const tooltip = ({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as (typeof dados)[number];
    const linhas: Array<{ cor?: string; rotulo: string; valor: string; tracejado?: boolean }> =
      series.filter((s) => !ocultas.has(s.id)).map((s) => {
        const v = p[s.id];
        return { cor: s.cor, rotulo: s.nome, valor: v == null ? "—" : fmtR(v), tracejado: s.tipo === "tracejada" };
      });
    if (p.margem != null) linhas.push({ rotulo: "margem líquida", valor: fmtP(p.margem) });
    return <CaixaTooltip titulo={p.rotulo} linhas={linhas} rodape={p.mes === d.mes ? "Mês selecionado" : "Clique para abrir este mês"} />;
  };

  return (
    <ChartCard title="Evolução de 12 meses" height="auto"
      subtitle={`${rotuloMes(d.serie[0].mes)} a ${rotuloMes(d.mes)} · clique numa barra para abrir o mês`}
      legend={
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Séries do gráfico">
          {series.map((s) => (
            <button key={s.id} type="button" aria-pressed={!ocultas.has(s.id)} onClick={() => alternar(s.id)}
              className={cn("inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-smooth",
                ocultas.has(s.id) ? "border-border text-muted-foreground/60 line-through" : "border-border-strong text-foreground hover:bg-secondary")}>
              {s.tipo === "barra"
                ? <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: s.cor }} />
                : <span className="w-3.5" style={{ borderTop: `2px ${s.tipo === "tracejada" ? "dashed" : "solid"} ${s.cor}` }} />}
              {s.nome}
            </button>
          ))}
        </div>
      }>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} onClick={clique}>
            <CartesianGrid stroke={COR.grade} vertical={false} />
            <XAxis dataKey="rotulo" {...eixo} />
            <YAxis {...eixo} tickFormatter={fmtRCompacto} width={64} />
            <ReferenceLine y={0} stroke={COR.eixo} strokeOpacity={0.5} />
            <Tooltip cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }} content={tooltip} />
            {!ocultas.has("faturamento") && (
              <Bar dataKey="faturamento" name="Faturamento" maxBarSize={24} radius={[4, 4, 0, 0]} cursor="pointer" isAnimationActive={false}>
                {dados.map((p) => <Cell key={p.mes} fill={COR.s1} fillOpacity={p.mes === d.mes ? 1 : 0.45} />)}
              </Bar>
            )}
            {!ocultas.has("ponto_equilibrio") && temPe && (
              <Line dataKey="ponto_equilibrio" name="Ponto de equilíbrio" type="stepAfter" stroke={COR.s3} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
            )}
            {!ocultas.has("projetado_faturamento") && temProj && (
              <Line dataKey="projetado_faturamento" name="Projetado franqueadora" type="monotone" stroke={COR.s6} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} connectNulls />
            )}
            {!ocultas.has("resultado") && (
              <Line dataKey="resultado" name="Resultado líquido" type="monotone" stroke={COR.s2} strokeWidth={2}
                dot={{ r: 3, fill: COR.s2, stroke: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
                isAnimationActive={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Margem em gráfico próprio — um eixo por gráfico */}
      <div className="mt-4 pt-3 border-t border-border">
        <div className="text-[11px] font-semibold text-muted-foreground mb-1">Margem líquida (% do faturamento)</div>
        <div className="h-[110px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dados} margin={{ top: 6, right: 8, left: 0, bottom: 0 }} onClick={clique}>
              <CartesianGrid stroke={COR.grade} vertical={false} />
              <XAxis dataKey="rotulo" {...eixo} hide />
              <YAxis {...eixo} width={64} tickFormatter={(v) => `${fmtN(Number(v))}%`} />
              <ReferenceLine y={0} stroke={COR.eixo} strokeOpacity={0.5} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as (typeof dados)[number];
                return <CaixaTooltip titulo={p.rotulo} linhas={[{ cor: COR.s1, rotulo: "margem líquida", valor: p.margem != null ? fmtP(p.margem) : "—" }]} />;
              }} />
              <Line dataKey="margem" type="monotone" stroke={COR.s1} strokeWidth={2} isAnimationActive={false}
                dot={(props: { cx?: number; cy?: number; payload?: { mes: string }; index?: number }) => (
                  <circle key={props.index} cx={props.cx} cy={props.cy} r={props.payload?.mes === d.mes ? 4.5 : 2.5}
                    fill={COR.s1} stroke="var(--card)" strokeWidth={2} />
                )} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  );
}

// ═══ Composição dos custos (donut, raio percentual) ═══════════════════

export function GraficoComposicao({ d }: { d: PainelDados }) {
  const [modo, setModo] = React.useState<"reais" | "pct">("reais");
  const total = d.linhas.reduce((s, l) => s + l.valor, 0);
  const top = d.linhas.slice(0, 5);
  const resto = d.linhas.slice(5);
  const fatias = [
    ...top.map((l) => ({ nome: l.descricao, valor: l.valor, anterior: l.anterior, anteriorParcial: null as { com: number; total: number } | null })),
    ...(resto.length > 0 ? [{
      nome: `Outros (${resto.length})`,
      valor: resto.reduce((s, l) => s + l.valor, 0),
      // Só compara quando TODAS as linhas agrupadas tinham valor no mês anterior
      // (somar null como 0 subestimaria a base)
      anterior: resto.every((l) => l.anterior != null) ? resto.reduce((s, l) => s + (l.anterior ?? 0), 0) : null,
      anteriorParcial: resto.some((l) => l.anterior != null) && resto.some((l) => l.anterior == null)
        ? { com: resto.filter((l) => l.anterior != null).length, total: resto.length } : null,
    }] : []),
  ];
  const fmt = (v: number) => (modo === "reais" ? fmtR(v) : fmtP(total > 0 ? (v / total) * 100 : 0));

  return (
    <ChartCard title="Composição dos custos" height="auto"
      subtitle={`Para onde foi o dinheiro em ${rotuloMes(d.mes)} · comparação com ${rotuloMes(d.anterior.mes)} no tooltip`}
      actions={
        <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5" role="group" aria-label="Unidade de exibição">
          {(["reais", "pct"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={modo === m} onClick={() => setModo(m)}
              className={cn("px-2.5 h-7 rounded-md text-[11px] font-semibold transition-smooth",
                modo === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {m === "reais" ? "R$" : "%"}
            </button>
          ))}
        </div>
      }>
      {fatias.length === 0 ? <SemDados texto="Sem custos no mês." /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div className="relative h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as (typeof fatias)[number];
                  const i = fatias.indexOf(p);
                  const dif = p.anterior != null ? p.valor - p.anterior : null;
                  return <CaixaTooltip titulo={p.nome} linhas={[
                    { cor: SERIES_CATEGORICAS[i], rotulo: "no mês", valor: fmtR(p.valor) },
                    { rotulo: "dos custos", valor: fmtP(total > 0 ? (p.valor / total) * 100 : 0) },
                    ...(p.anterior != null ? [{ rotulo: `em ${rotuloMes(d.anterior.mes)}`, valor: fmtR(p.anterior) }] : []),
                  ]} rodape={dif != null ? `${dif >= 0 ? "+" : "−"}${fmtR(Math.abs(dif))} vs mês anterior`
                    : p.anteriorParcial ? `Sem comparação: só ${p.anteriorParcial.com} de ${p.anteriorParcial.total} linhas tinham valor no mês anterior`
                    : "Sem valor no mês anterior"} />;
                }} />
                <Pie data={fatias} dataKey="valor" nameKey="nome" innerRadius="62%" outerRadius="90%"
                  stroke="var(--card)" strokeWidth={2} isAnimationActive={false}>
                  {fatias.map((f, i) => <Cell key={f.nome} fill={SERIES_CATEGORICAS[i]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Custos</div>
              <div className="font-display text-lg font-semibold">{fmtRCompacto(total)}</div>
              {d.atual.faturamento > 0 && <div className="text-[10.5px] text-muted-foreground">{fmtP((total / d.atual.faturamento) * 100, 0)} do fat.</div>}
            </div>
          </div>
          <ul className="space-y-1.5 text-[12px]">
            {fatias.map((f, i) => (
              <li key={f.nome} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: SERIES_CATEGORICAS[i] }} />
                <span className="truncate flex-1 text-muted-foreground">{f.nome}</span>
                <span className="font-semibold tabular-nums">{fmt(f.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}

// ═══ Faturamento por dia + dia da semana ═══════════════════════════════

export function GraficoDias({ d }: { d: PainelDados }) {
  // Hoje (parcial) aparece no gráfico, mas fica fora de média, melhor e pior dia
  const passados = d.dias.filter((x) => !x.futuro && !x.parcial);
  const hojeParcial = d.dias.find((x) => x.parcial) ?? null;
  const comVenda = passados.filter((x) => x.faturamento > 0);
  const algumaVenda = comVenda.length > 0 || (hojeParcial?.faturamento ?? 0) > 0;
  const media = passados.length > 0 ? passados.reduce((s, x) => s + x.faturamento, 0) / passados.length : 0;
  const melhor = comVenda.length > 0 ? comVenda.reduce((m, x) => (x.faturamento > m.faturamento ? x : m)) : null;
  const pior = comVenda.length > 1 ? passados.reduce((m, x) => (x.faturamento < m.faturamento ? x : m)) : null;
  const dados = d.dias.map((x) => ({ ...x, valor: x.futuro ? null : x.faturamento }));
  const maxSemana = Math.max(0, ...d.dias_semana.map((x) => x.media));
  const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

  return (
    <ChartCard title="Faturamento por dia" height="auto"
      subtitle={!algumaVenda ? "Sem vendas registradas no mês" : passados.length === 0 ? "Primeiro dia do mês em andamento" : `Média ${fmtR(media)}/dia em ${passados.length} ${passados.length === 1 ? "dia" : "dias"}`
        + (melhor ? ` · melhor ${dataCurta(melhor.data)} (${fmtR(melhor.faturamento)})` : "")
        + (pior ? ` · pior ${dataCurta(pior.data)} (${fmtR(pior.faturamento)})` : "")
        + (hojeParcial ? " · hoje em andamento, fora da média" : "")}>
      {!algumaVenda ? <SemDados texto="As vendas diárias aparecem aqui assim que houver registro no mês." /> : (
        <>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
                <CartesianGrid stroke={COR.grade} vertical={false} />
                <XAxis dataKey="dia" {...eixo} interval="preserveStartEnd" minTickGap={8} />
                <YAxis {...eixo} tickFormatter={fmtRCompacto} width={64} />
                <Tooltip cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }} content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as (typeof dados)[number];
                  return <CaixaTooltip titulo={`${dataCurta(p.data)} · ${SEMANA[p.dow]}${p.parcial ? " · hoje (parcial)" : ""}`} linhas={p.futuro
                    ? [{ rotulo: "", valor: "Dia ainda não chegou" }]
                    : p.parcial
                    ? [{ cor: COR.s1, rotulo: "até agora", valor: fmtR(p.faturamento) }, { rotulo: "ciclos", valor: fmtN(p.ciclos) }]
                    : [{ cor: COR.s1, rotulo: "faturamento", valor: fmtR(p.faturamento) }, { rotulo: "ciclos", valor: fmtN(p.ciclos) },
                       { rotulo: "vs média", valor: media > 0 ? `${p.faturamento >= media ? "+" : "−"}${fmtP(Math.abs((p.faturamento / media - 1) * 100), 0)}` : "—" }]} />;
                }} />
                <ReferenceLine y={media} stroke={COR.eixo} strokeDasharray="4 4"
                  label={{ value: "média", position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 10 }} />
                <Bar dataKey="valor" maxBarSize={12} radius={[3, 3, 0, 0]} isAnimationActive={false}>
                  {dados.map((x) => (
                    <Cell key={x.dia} fill={COR.s1} fillOpacity={x.parcial ? 0.3 : melhor && x.dia === melhor.dia ? 1 : pior && x.dia === pior.dia ? 0.35 : 0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Faixa de calor por dia da semana (média por ocorrência) */}
          <div className="mt-4">
            <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">Média por dia da semana</div>
            <div className="grid grid-cols-7 gap-[2px] rounded-lg overflow-hidden" role="list">
              {d.dias_semana.map((x) => {
                const t = maxSemana > 0 ? x.media / maxSemana : 0;
                return (
                  <div key={x.dow} role="listitem" tabIndex={0}
                    title={`${SEMANA[x.dow]}: média ${fmtR(x.media)} em ${x.ocorrencias} ${x.ocorrencias === 1 ? "dia" : "dias"} · total ${fmtR(x.total)}`}
                    className="px-1 py-2 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ background: x.ocorrencias === 0 ? "var(--muted)" : `color-mix(in oklab, ${COR.s1} ${Math.round(8 + t * 52)}%, var(--card))` }}>
                    {/* Intensidade limitada a 60% para a tinta do tema manter contraste AA nos dois temas */}
                    <div className="text-[10px] font-medium text-foreground/80">{x.rotulo}</div>
                    <div className="text-[11px] font-semibold tabular-nums text-foreground">
                      {x.ocorrencias === 0 ? "—" : fmtRCompacto(x.media)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </ChartCard>
  );
}

// ═══ Mix lavagem × secagem ═════════════════════════════════════════════

export function MixServicos({ d }: { d: PainelDados }) {
  const m = d.mix;
  const linhas = m ? [
    { rotulo: "Ciclos", lav: m.lavagem.ciclos, sec: m.secagem.ciclos, fmt: (n: number) => fmtN(n) },
    { rotulo: "Faturamento", lav: m.lavagem.faturamento, sec: m.secagem.faturamento, fmt: (n: number) => fmtR(n) },
  ] : [];
  return (
    <ChartCard title="Mix lavagem × secagem" height="auto"
      subtitle={(m?.combo_rateado ? "Vendas combo rateadas 50/50 entre os dois serviços" : "Participação de cada serviço no mês")
        + (m && m.indefinido.ciclos > 0 ? ` · fora do mix: ${fmtN(m.indefinido.ciclos)} ciclos sem tipo de serviço (${fmtR(m.indefinido.faturamento)})` : "")}>
      {!m ? <SemDados texto="Sem vendas registradas no mês." /> : (
        <div className="space-y-4">
          <div className="flex gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: COR.s1 }} /><WashingMachine className="w-3 h-3" />Lavagem</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: COR.s2 }} /><Wind className="w-3 h-3" />Secagem</span>
          </div>
          {linhas.map((l) => {
            const tot = l.lav + l.sec;
            const pl = tot > 0 ? (l.lav / tot) * 100 : 0;
            return (
              <div key={l.rotulo}>
                <div className="flex justify-between text-[11.5px] mb-1">
                  <span className="font-semibold">{l.rotulo}</span>
                  <span className="text-muted-foreground tabular-nums">{l.fmt(tot)}</span>
                </div>
                <div className="flex h-7 w-full gap-[2px] rounded-md overflow-hidden" role="img"
                  aria-label={`${l.rotulo}: lavagem ${l.fmt(l.lav)} (${fmtP(pl, 0)}), secagem ${l.fmt(l.sec)} (${fmtP(100 - pl, 0)})`}>
                  {l.lav > 0 && (
                    <div className="h-full flex items-center px-2 text-[11px] font-semibold whitespace-nowrap"
                      style={{ width: `${pl}%`, background: COR.s1, color: TINTA_NO_PREENCHIMENTO }} title={`Lavagem ${l.fmt(l.lav)}`}>
                      {pl >= 18 ? fmtP(pl, 0) : ""}
                    </div>
                  )}
                  {l.sec > 0 && (
                    <div className="h-full flex items-center justify-end px-2 text-[11px] font-semibold whitespace-nowrap"
                      style={{ width: `${100 - pl}%`, background: COR.s2, color: TINTA_NO_PREENCHIMENTO }} title={`Secagem ${l.fmt(l.sec)}`}>
                      {100 - pl >= 18 ? fmtP(100 - pl, 0) : ""}
                    </div>
                  )}
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground mt-1 tabular-nums">
                  <span>{l.fmt(l.lav)}</span><span>{l.fmt(l.sec)}</span>
                </div>
              </div>
            );
          })}
          {m.lavagem.ciclos > 0 && m.secagem.ciclos > 0 && (
            <p className="text-[11.5px] text-muted-foreground">
              {fmtN(m.secagem.ciclos / m.lavagem.ciclos, 2)} secagem por lavagem · ticket médio lavagem {fmtR(m.lavagem.faturamento / m.lavagem.ciclos, 2)} · secagem {fmtR(m.secagem.faturamento / m.secagem.ciclos, 2)}
            </p>
          )}
        </div>
      )}
    </ChartCard>
  );
}

// ═══ Comparativo das unidades (consolidado) ════════════════════════════

export function ComparativoUnidades({ d, onUnidade }: { d: PainelDados; onUnidade: (id: string) => void }) {
  const lista = d.comparativo ?? [];
  const max = Math.max(1, ...lista.map((u) => u.faturamento));
  return (
    <ChartCard title="Comparativo das unidades" height="auto"
      subtitle={`Ranking de faturamento em ${rotuloMes(d.mes)} · clique numa unidade para abrir o painel dela`}>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full min-w-[560px] text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="py-1.5 px-1 font-semibold">Unidade</th>
              <th className="py-1.5 px-1 font-semibold w-[38%]">Faturamento</th>
              <th className="py-1.5 px-1 font-semibold text-right">Resultado</th>
              <th className="py-1.5 px-1 font-semibold text-right">Margem</th>
              <th className="py-1.5 px-1 font-semibold text-right">Equilíbrio</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.unidade_id} onClick={() => onUnidade(u.unidade_id)} tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") onUnidade(u.unidade_id); }}
                className="border-t border-border cursor-pointer hover:bg-muted/50 outline-none focus-visible:bg-muted/50">
                <td className="py-2 px-1 font-semibold whitespace-nowrap"><Building2 className="inline w-3.5 h-3.5 mr-1.5 text-muted-foreground" />{u.nome}</td>
                <td className="py-2 px-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 rounded-r-[4px]" style={{ width: `${(u.faturamento / max) * 100}%`, minWidth: u.faturamento > 0 ? 3 : 0, background: COR.s1 }} />
                    <span className="tabular-nums whitespace-nowrap">{u.tem ? fmtRCompacto(u.faturamento) : "—"}</span>
                  </div>
                </td>
                <td className={cn("py-2 px-1 text-right tabular-nums font-semibold", u.tem && (u.resultado >= 0 ? "text-success" : "text-danger"))}>{u.tem ? fmtR(u.resultado) : "—"}</td>
                <td className="py-2 px-1 text-right tabular-nums">{u.margem != null ? fmtP(u.margem) : "—"}</td>
                <td className="py-2 px-1 text-right tabular-nums">
                  {u.pct_equilibrio != null
                    ? <span className={u.pct_equilibrio >= 100 ? "text-success font-semibold" : "text-danger font-semibold"}>{fmtP(u.pct_equilibrio, 0)}</span>
                    : "—"}
                </td>
                <td className="py-2 px-1 text-muted-foreground"><ChevronRight className="w-3.5 h-3.5" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

function SemDados({ texto }: { texto: string }) {
  return <div className="py-10 text-center text-[12px] text-muted-foreground">{texto}</div>;
}

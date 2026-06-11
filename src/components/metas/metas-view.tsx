"use client";

import * as React from "react";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  ReferenceLine, Line, ComposedChart, Area,
} from "recharts";
import {
  Target, TrendingUp, FileText, Building2, Sparkles,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Projecao60Meses, UnidadeSwitcher } from "@/components/financeiro/financeiro-view";
import {
  calcularDRE, projetar60Meses, calcularPayback,
} from "@/lib/financeiro/engine";
import type { CustoFixo, CustoVariavel, ProjecaoMes, DREResultado } from "@/lib/financeiro/engine";
import type { UnidadeConfig, InvestimentoCategoria } from "@/lib/financeiro/queries";

const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const fmtBRL = (n: number, dec = 2) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
const fmtBRLk = (n: number) =>
  Math.abs(n) >= 1000 ? `R$${(n / 1000).toFixed(1).replace(".", ",")}k` : `R$${n.toFixed(0)}`;

type Unidade = { id: string; nome: string };

export type MetasData = {
  unidades: Unidade[];
  unidade_id: string;
  config: UnidadeConfig | null;
  investimento: InvestimentoCategoria[];
  custos_fixos: CustoFixo[];
  custos_variaveis: CustoVariavel[];
};

export function MetasView(props: MetasData) {
  const [unidadeAtiva, setUnidadeAtiva] = React.useState(props.unidade_id);
  const [tab, setTab] = React.useState("faturamento");

  const investimentoTotal = props.investimento.reduce(
    (s, c) => s + c.itens.reduce((a, b) => a + b.valor_projetado, 0), 0);

  const projecao = React.useMemo(() => projetar60Meses({
    mes_inicio: props.config?.mes_inauguracao ?? new Date().getMonth() + 1,
    ano_inicio: props.config?.ano_inauguracao ?? new Date().getFullYear(),
    potencial_faturamento: props.config?.potencial_faturamento ?? 42000,
    custos_fixos: props.custos_fixos,
    custos_variaveis: props.custos_variaveis,
    investimento_total: investimentoTotal,
    lancamentos: new Map(),  // só projetado em /metas
  }), [props.config, props.custos_fixos, props.custos_variaveis, investimentoTotal]);

  const payback = React.useMemo(
    () => calcularPayback(projecao, investimentoTotal),
    [projecao, investimentoTotal]
  );

  // Mês atual (1..60)
  const hoje = new Date();
  const mesAtualIdx = React.useMemo(() => {
    if (!props.config?.ano_inauguracao || !props.config?.mes_inauguracao) return 1;
    const diff = (hoje.getFullYear() - props.config.ano_inauguracao) * 12
      + (hoje.getMonth() + 1 - props.config.mes_inauguracao) + 1;
    return Math.max(1, Math.min(60, diff));
  }, [props.config, hoje]);

  return (
    <div className="space-y-5">
      {/* HERO */}
      <div className="fin-hero rounded-3xl p-6 lg:p-8 fin-fadeup-1">
        <div className="fin-orb fin-orb-1" />
        <div className="fin-orb fin-orb-2" />
        <div className="fin-orb fin-orb-3" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-cyan/15 border border-brand-cyan/30 mb-3">
              <Target className="w-3 h-3 text-brand-cyan" />
              <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-brand-cyan">Metas · planejamento 5 anos</span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-white">Metas e projeções</h1>
            <p className="text-[13px] text-white/65 mt-1">Faturamento, DRE e plano de 60 meses — visão de planejamento.</p>
          </div>
          <UnidadeSwitcher
            unidades={props.unidades}
            ativa={unidadeAtiva}
            onChange={(id) => {
              setUnidadeAtiva(id);
              const url = new URL(window.location.href);
              url.searchParams.set("unidade", id);
              window.location.href = url.toString();
            }}
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 fin-fadeup-2">
        <MiniKPI label="Potencial mensal" valor={fmtBRL(props.config?.potencial_faturamento ?? 0)} sub="meta mês N" />
        <MiniKPI label="Faturamento 60m" valor={fmtBRL(projecao.reduce((s, p) => s + p.faturamento_projetado, 0))} sub="acumulado projetado" />
        <MiniKPI label="Resultado 60m" valor={fmtBRL(projecao.reduce((s, p) => s + p.resultado_projetado, 0))} sub="acumulado projetado" tone="success" />
        <MiniKPI label="Payback projetado" valor={payback.mes_payback_projetado ? `${payback.mes_payback_projetado} m` : "—"} sub={`Meta ${props.config?.meta_payback_meses ?? 21} m`} tone="cyan" />
      </div>

      {/* TABS */}
      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 fin-fadeup-2">
          <TabBtn value="faturamento" icon={TrendingUp} label="Faturamento Projetado" />
          <TabBtn value="dre"         icon={FileText}    label="DRE Projetado Mensal" />
          <TabBtn value="60m"         icon={Target}      label="Projeção 5 Anos" />
        </Tabs.List>

        <Tabs.Content value="faturamento" className="outline-none mt-5">
          <FaturamentoProjetadoChart projecao={projecao} mesAtualIdx={mesAtualIdx} />
        </Tabs.Content>

        <Tabs.Content value="dre" className="outline-none mt-5 space-y-4">
          <DREProjetadoMensal
            projecao={projecao}
            custosFixos={props.custos_fixos}
            custosVariaveis={props.custos_variaveis}
            investimentoTotal={investimentoTotal}
            mesAtualIdx={mesAtualIdx}
          />
        </Tabs.Content>

        <Tabs.Content value="60m" className="outline-none mt-5">
          <Projecao60Meses projecao={projecao} mesAtualIdx={mesAtualIdx} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

function TabBtn({ value, icon: Icon, label }: { value: string; icon: React.ElementType; label: string }) {
  return (
    <Tabs.Trigger
      value={value}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-[12px] font-semibold text-muted-foreground data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-cyan data-[state=active]:to-brand-blue data-[state=active]:text-white hover:text-foreground transition-smooth"
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </Tabs.Trigger>
  );
}

function MiniKPI({ label, valor, sub, tone = "default" }: {
  label: string; valor: string; sub: string; tone?: "default" | "success" | "cyan";
}) {
  const col = tone === "success" ? "text-success" : tone === "cyan" ? "text-brand-cyan" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</div>
      <div className={cn("font-display text-2xl font-bold mt-1 tabular-nums", col)}>{valor}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// GRÁFICO FATURAMENTO PROJETADO (60 meses)
// ────────────────────────────────────────────────────────────
function FaturamentoProjetadoChart({ projecao, mesAtualIdx }: { projecao: ProjecaoMes[]; mesAtualIdx: number }) {
  const [janela, setJanela] = React.useState<12 | 24 | 36 | 60>(60);

  const chartData = React.useMemo(() => {
    const slice = projecao.slice(0, janela);
    let acumulado = 0;
    return slice.map((p) => {
      acumulado += p.faturamento_projetado;
      return {
        rotulo: p.rotulo,
        faturamento: p.faturamento_projetado,
        resultado: p.resultado_projetado,
        acumulado,
        mes_index: p.mes_index,
        atingiuMeta: p.pct_da_meta != null && p.pct_da_meta >= 100,
      };
    });
  }, [projecao, janela]);

  const fatTotal = chartData.reduce((s, d) => s + d.faturamento, 0);
  const fatMedio = chartData.length > 0 ? fatTotal / chartData.length : 0;
  const fatMaximo = Math.max(...chartData.map((d) => d.faturamento));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="font-display font-bold text-[15px] inline-flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-cyan" />
              Faturamento projetado — {janela} meses
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Total <span className="font-mono font-bold text-brand-cyan">{fmtBRL(fatTotal)}</span>
              {" · "}Médio <span className="font-mono font-bold">{fmtBRL(fatMedio)}/mês</span>
              {" · "}Pico <span className="font-mono font-bold text-success">{fmtBRL(fatMaximo)}</span>
            </div>
          </div>
          <div className="inline-flex border border-border rounded-md overflow-hidden">
            {([12, 24, 36, 60] as const).map((j) => (
              <button
                key={j}
                onClick={() => setJanela(j)}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-semibold transition-smooth",
                  janela === j
                    ? "bg-gradient-to-r from-brand-cyan to-brand-blue text-white"
                    : "bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {j}m
              </button>
            ))}
          </div>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradFatProj" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand-cyan)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="var(--brand-cyan)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="rotulo" stroke="var(--muted-foreground)" fontSize={9}
                tickLine={false} axisLine={false}
                interval={janela <= 12 ? 0 : janela <= 24 ? 1 : janela <= 36 ? 2 : 5} />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={fmtBRLk} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 11 }}
                formatter={(v, name) => [fmtBRL(Number(v ?? 0)), String(name) === "faturamento" ? "Faturamento" : String(name) === "resultado" ? "Resultado" : "Acumulado"]}
              />
              {mesAtualIdx <= janela && (
                <ReferenceLine
                  x={projecao[mesAtualIdx - 1]?.rotulo}
                  stroke="var(--warning)" strokeDasharray="4 4"
                  label={{ value: "hoje", position: "top", fill: "var(--warning)", fontSize: 10 }}
                />
              )}
              <Bar dataKey="faturamento" fill="url(#gradFatProj)" radius={[6, 6, 0, 0]} name="faturamento" />
              <Line type="monotone" dataKey="resultado" stroke="var(--success)" strokeWidth={2} dot={false} name="resultado" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 text-[10px] text-muted-foreground flex items-center gap-4 flex-wrap">
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-brand-cyan" />Faturamento projetado</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-1 rounded bg-success" />Resultado líquido projetado</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-1 border-t border-dashed border-warning" />Mês atual</span>
        </div>
      </div>

      {/* Acumulado */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="font-display font-bold text-[15px] inline-flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-brand-purple" /> Acumulado projetado
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 14, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradAcum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand-purple)" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="var(--brand-purple)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="rotulo" stroke="var(--muted-foreground)" fontSize={9}
                tickLine={false} axisLine={false}
                interval={janela <= 12 ? 0 : janela <= 24 ? 1 : janela <= 36 ? 2 : 5} />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={fmtBRLk} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 11 }}
                formatter={(v) => fmtBRL(Number(v ?? 0))} />
              <Area type="monotone" dataKey="acumulado" stroke="var(--brand-purple)" strokeWidth={2} fill="url(#gradAcum)" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// DRE PROJETADO MENSAL (read-only, sem fields editáveis)
// ────────────────────────────────────────────────────────────
function DREProjetadoMensal({
  projecao, custosFixos, custosVariaveis, investimentoTotal, mesAtualIdx,
}: {
  projecao: ProjecaoMes[];
  custosFixos: CustoFixo[];
  custosVariaveis: CustoVariavel[];
  investimentoTotal: number;
  mesAtualIdx: number;
}) {
  const [mesIdx, setMesIdx] = React.useState(mesAtualIdx);
  const mes = projecao[mesIdx - 1];
  if (!mes) return null;

  const fatHist = projecao.slice(0, mesIdx).map((p) => p.faturamento_projetado);
  const rbt12 = fatHist.slice(-12).reduce((s, v) => s + v, 0);
  const dre = calcularDRE({
    faturamento: mes.faturamento_projetado,
    rbt12,
    mes_index: mesIdx,
    custos_fixos: custosFixos,
    custos_variaveis: custosVariaveis,
    investimento_total: investimentoTotal,
  });

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
        <div className="font-display font-bold inline-flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-brand-cyan" />
          DRE projetado · Mês {mesIdx} · {MESES_PT[mes.mes - 1]}/{mes.ano}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setMesIdx(Math.max(1, mesIdx - 1))} className="w-8 h-8 rounded border border-border hover:bg-secondary flex items-center justify-center" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
          <select value={mesIdx} onChange={(e) => setMesIdx(parseInt(e.target.value, 10))} className="form-input h-8 py-0 text-[12px] font-mono">
            {projecao.map((p) => <option key={p.mes_index} value={p.mes_index}>Mês {p.mes_index} · {MESES_PT[p.mes - 1]}/{p.ano}</option>)}
          </select>
          <button onClick={() => setMesIdx(Math.min(60, mesIdx + 1))} className="w-8 h-8 rounded border border-border hover:bg-secondary flex items-center justify-center" aria-label="Próximo mês"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <DRECard dre={dre} mesIdx={mesIdx} />
    </>
  );
}

function DRECard({ dre, mesIdx }: { dre: DREResultado; mesIdx: number }) {
  const Linha = ({ label, valor, tone, bold, indent }: {
    label: string; valor: number; tone?: "success" | "danger" | "muted"; bold?: boolean; indent?: boolean;
  }) => (
    <div className={cn(
      "flex items-baseline justify-between gap-2 py-1.5 px-3 text-[12px]",
      bold ? "font-display font-bold border-t border-border/60 mt-1" : "",
      indent ? "pl-8 text-muted-foreground" : "",
    )}>
      <span>{label}</span>
      <span className={cn(
        "font-mono tabular-nums",
        tone === "success" && "text-success",
        tone === "danger" && "text-danger",
        tone === "muted" && "text-muted-foreground",
      )}>{fmtBRL(valor)}</span>
    </div>
  );

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-brand-cyan/8 to-brand-blue/8 flex items-center justify-between">
        <div>
          <div className="font-display font-bold text-[13px]">DRE Projetado — Mês {mesIdx}</div>
          <div className="text-[10px] text-muted-foreground">Demonstração do resultado do exercício</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Margem operacional</div>
          <div className={cn("text-2xl font-display font-bold", dre.margem_operacional >= 0 ? "text-success" : "text-danger")}>
            {dre.margem_operacional.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="py-2">
        <Linha label="(=) Receita bruta" valor={dre.faturamento_bruto} bold />
        <Linha label="(–) Simples Nacional" valor={-dre.simples_nacional} tone="danger" indent />
        <Linha label="(=) Receita líquida" valor={dre.receita_liquida} bold />
        <Linha label="(–) CSP — Custo do serviço" valor={-dre.custo_servico_total} tone="danger" indent />
        {dre.detalhe_csp.map((d, i) => (
          <Linha key={`csp-${i}`} label={`• ${d.descricao}`} valor={-d.valor} tone="muted" indent />
        ))}
        <Linha label="(=) Resultado bruto" valor={dre.resultado_bruto} bold />
        <Linha label="(–) Royalties" valor={-dre.royalties} tone="danger" indent />
        <Linha label="(–) Custos fixos" valor={-dre.custos_fixos_total} tone="danger" indent />
        {dre.detalhe_fixos.map((d, i) => (
          <Linha key={`fix-${i}`} label={`• ${d.descricao}`} valor={-d.valor} tone="muted" indent />
        ))}
        {dre.custos_variaveis_total > 0 && (
          <>
            <Linha label="(–) Custos variáveis" valor={-dre.custos_variaveis_total} tone="danger" indent />
            {dre.detalhe_variaveis.map((d, i) => (
              <Linha key={`var-${i}`} label={`• ${d.descricao}`} valor={-d.valor} tone="muted" indent />
            ))}
          </>
        )}
        <Linha
          label="(=) RESULTADO LÍQUIDO"
          valor={dre.resultado_liquido}
          tone={dre.resultado_liquido >= 0 ? "success" : "danger"}
          bold
        />
      </div>
    </div>
  );
}

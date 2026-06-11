"use client";

import * as React from "react";
import * as Tabs from "@radix-ui/react-tabs";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
  ReferenceLine,
} from "recharts";
import {
  LayoutDashboard, Briefcase, FileText, TrendingUp, Settings,
  Building2, ChevronLeft, ChevronRight, Plus, Trash2, Save, Wand2,
  Wallet, Award, Percent, AlertTriangle, CheckCircle2,
  Download, X, Check, Loader2, ArrowRight, Coins, Calendar, Filter,
  WashingMachine, Wind, Zap, Droplets, Beaker, FlaskConical, DollarSign, Clock, Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Counter } from "./counter";
import { Button } from "@/components/ui/button";
import type { CustoFixo, CustoVariavel, ProjecaoMes } from "@/lib/financeiro/engine";
import {
  calcularDRE, projetar60Meses, calcularPayback, calcularBreakEven,
} from "@/lib/financeiro/engine";
import type {
  UnidadeConfig, InvestimentoCategoria, LancamentoMes,
} from "@/lib/financeiro/queries";
import type { EngenhariaCustos, MargemUnidade } from "@/lib/financeiro/margem-engine";
import { calcularCustoLavagem, calcularCustoSecagem, calcularOverheadEletrico } from "@/lib/financeiro/margem-engine";
import { salvarEngenhariaCustos } from "@/lib/financeiro/margem-actions";
import {
  atualizarConfigUnidade, atualizarValorRealInvestimento,
  criarCategoriaInvestimento, deletarCategoriaInvestimento,
  criarItemInvestimento, deletarItemInvestimento,
  lancarFaturamentoMes,
  salvarCustoFixo, deletarCustoFixo,
  salvarCustoVariavel, deletarCustoVariavel,
} from "@/lib/financeiro/actions";
import { LancarDespesasDialog } from "./lancar-despesas-dialog";

// Lookup de despesa real pra um custo (fixo ou variável) por nome.
// Tenta match exato por descrição, depois match por sinônimo de categoria.
const SINONIMOS_DESPESA: Record<string, string[]> = {
  "aluguel":          ["aluguel", "aluguel e iptu", "iptu"],
  "energia eletrica": ["energia", "energia eletrica", "luz", "energia elétrica"],
  "agua e esgoto":    ["agua", "agua e esgoto", "água", "água e esgoto"],
  "internet":         ["telefone e internet", "telefone", "internet", "telecom"],
  "marketing":        ["marketing", "publicidade", "publicidade local", "propaganda", "fundo de propaganda", "marketing inaugural"],
  "manutencao":       ["manutencao", "manutenção", "reparos"],
  "produtos quimicos": ["sabao", "amaciante", "csp", "sabao e amaciante", "produtos quimicos", "produtos químicos"],
  "impostos":         ["impostos", "simples nacional", "iss", "icms"],
  "folha de pagamento": ["folha", "salarios", "salário", "folha de pagamento"],
};
function normTxt(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}
function mapearDespesaReal(custoDescricao: string, dm: DespesasMesData): number | null {
  const n = normTxt(custoDescricao);
  if (dm.por_descricao[n] != null) return dm.por_descricao[n];
  for (const [catKey, sins] of Object.entries(SINONIMOS_DESPESA)) {
    for (const sin of sins) {
      if (n.includes(sin) && dm.por_categoria[catKey] != null) {
        return dm.por_categoria[catKey];
      }
    }
  }
  return null;
}

const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const fmtBRL = (n: number, decimals = 2) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

const fmtBRLk = (n: number) =>
  Math.abs(n) >= 1000 ? `R$${(n / 1000).toFixed(1).replace(".", ",")}k` : `R$${n.toFixed(0)}`;

type Unidade = { id: string; nome: string };

export type DespesaItem = {
  id: string;
  categoria_nome: string;
  descricao: string;
  valor: number;
  vencimento: string;
  pago_em: string | null;
};

export type DespesasMesData = {
  ano: number;
  mes: number;
  itens: DespesaItem[];
  por_categoria: Record<string, number>;   // chave normalizada → soma
  por_descricao: Record<string, number>;   // chave normalizada → soma
  total: number;
};

export type FinanceiroData = {
  unidades: Unidade[];
  unidade_id: string;
  config: UnidadeConfig | null;
  investimento: InvestimentoCategoria[];
  custos_fixos: CustoFixo[];
  custos_variaveis: CustoVariavel[];
  lancamentos: LancamentoMes[];
  despesas_mes: DespesasMesData;
  engenharia: EngenhariaCustos | null;
  margem: MargemUnidade | null;
};

export function FinanceiroView(props: FinanceiroData) {
  const [unidadeAtiva, setUnidadeAtiva] = React.useState(props.unidade_id);
  const [tab, setTab] = React.useState("painel");

  // Re-renderiza quando trocamos de unidade (via server props vindas da page)
  const data = props;

  const investimentoTotalProjetado = data.investimento.reduce(
    (s, c) => s + c.itens.reduce((a, b) => a + b.valor_projetado, 0), 0);
  const investimentoTotalReal = data.investimento.reduce(
    (s, c) => s + c.itens.reduce((a, b) => a + (b.valor_real ?? 0), 0), 0);

  const lancamentosMap = React.useMemo(() => {
    const m = new Map<number, number>();
    for (const l of data.lancamentos) if (l.faturamento_real != null) m.set(l.mes_index, l.faturamento_real);
    return m;
  }, [data.lancamentos]);

  const projecao = React.useMemo(() => projetar60Meses({
    mes_inicio: data.config?.mes_inauguracao ?? new Date().getMonth() + 1,
    ano_inicio: data.config?.ano_inauguracao ?? new Date().getFullYear(),
    potencial_faturamento: data.config?.potencial_faturamento ?? 42000,
    custos_fixos: data.custos_fixos,
    custos_variaveis: data.custos_variaveis,
    investimento_total: investimentoTotalProjetado,
    lancamentos: lancamentosMap,
  }), [data.config, data.custos_fixos, data.custos_variaveis, investimentoTotalProjetado, lancamentosMap]);

  const payback = React.useMemo(
    () => calcularPayback(projecao, investimentoTotalProjetado),
    [projecao, investimentoTotalProjetado]
  );

  // Mês atual relativo ao início
  const hoje = new Date();
  const mesAtualIdx = React.useMemo(() => {
    if (!data.config?.ano_inauguracao || !data.config?.mes_inauguracao) return 1;
    const diff = (hoje.getFullYear() - data.config.ano_inauguracao) * 12 + (hoje.getMonth() + 1 - data.config.mes_inauguracao) + 1;
    return Math.max(1, Math.min(60, diff));
  }, [data.config, hoje]);

  return (
    <div className="space-y-5">
      {/* ===== Hero com orbs animados ===== */}
      <div className="fin-hero rounded-3xl p-6 lg:p-8 fin-fadeup-1">
        <div className="fin-orb fin-orb-1" />
        <div className="fin-orb fin-orb-2" />
        <div className="fin-orb fin-orb-3" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-cyan/15 border border-brand-cyan/30 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse" />
              <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-brand-cyan">Financeiro · viabilidade + execução</span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-white">Painel financeiro</h1>
            <p className="text-[13px] text-white/65 mt-1">Projeção, execução e payback da sua unidade — em tempo real.</p>
          </div>

          {/* Seletor de unidade */}
          <UnidadeSwitcher
            unidades={data.unidades}
            ativa={unidadeAtiva}
            onChange={(id) => {
              setUnidadeAtiva(id);
              // Disparar reload da página com nova unidade
              const url = new URL(window.location.href);
              url.searchParams.set("unidade", id);
              window.location.href = url.toString();
            }}
          />
        </div>
      </div>

      {/* ===== Tabs ===== */}
      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 fin-fadeup-2">
          <TabBtn value="painel"    icon={LayoutDashboard} label="Painel Geral" />
          <TabBtn value="invest"    icon={Briefcase}       label="Investimento" />
          <TabBtn value="dre"       icon={FileText}        label="DRE Mensal" />
          <TabBtn value="config"    icon={Settings}        label="Configurações" />
        </Tabs.List>

        {/* PAINEL GERAL */}
        <Tabs.Content value="painel" className="outline-none mt-5 space-y-5">
          <PainelGeral
            projecao={projecao}
            payback={payback}
            mesAtualIdx={mesAtualIdx}
            data={data}
            investimentoTotal={investimentoTotalProjetado}
            margem={data.margem}
          />
        </Tabs.Content>

        {/* INVESTIMENTO */}
        <Tabs.Content value="invest" className="outline-none mt-5 space-y-5">
          <Investimento
            unidadeId={unidadeAtiva}
            categorias={data.investimento}
            projetadoTotal={investimentoTotalProjetado}
            realTotal={investimentoTotalReal}
          />
        </Tabs.Content>

        {/* DRE MENSAL */}
        <Tabs.Content value="dre" className="outline-none mt-5 space-y-5">
          <DREMensal
            unidadeId={unidadeAtiva}
            projecao={projecao}
            data={data}
            investimentoTotal={investimentoTotalProjetado}
            mesAtualIdx={mesAtualIdx}
          />
        </Tabs.Content>

        {/* CONFIGURAÇÕES */}
        <Tabs.Content value="config" className="outline-none mt-5 space-y-5">
          <Configuracoes
            unidadeId={unidadeAtiva}
            unidadeNome={data.unidades.find((u) => u.id === unidadeAtiva)?.nome ?? "Unidade"}
            config={data.config}
            custosFixos={data.custos_fixos}
            custosVariaveis={data.custos_variaveis}
            projecao={projecao}
          />
          {data.engenharia && <EngenhariaCustosEditor unidadeId={unidadeAtiva} engenharia={data.engenharia} />}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

function TabBtn({ value, icon: Icon, label }: { value: string; icon: React.ElementType; label: string }) {
  return (
    <Tabs.Trigger value={value}
      className="group inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-semibold transition-smooth data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-cyan data-[state=active]:to-brand-blue data-[state=active]:text-white data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-secondary data-[state=inactive]:hover:text-foreground">
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </Tabs.Trigger>
  );
}

// ────────────────────────────────────────────────────────────
// Seletor unidade
// ────────────────────────────────────────────────────────────
export function UnidadeSwitcher({ unidades, ativa, onChange }: { unidades: Unidade[]; ativa: string; onChange: (id: string) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 backdrop-blur p-1">
      {unidades.map((u) => (
        <button key={u.id} onClick={() => onChange(u.id)}
          className={cn("px-3 py-1.5 rounded-md text-[12px] font-semibold transition-smooth inline-flex items-center gap-1.5",
            ativa === u.id ? "bg-brand-cyan text-primary-foreground" : "text-white/65 hover:text-white hover:bg-white/5")}>
          <Building2 className="w-3 h-3" />
          {u.nome}
        </button>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// PAINEL GERAL
// ────────────────────────────────────────────────────────────
function PainelGeral({ projecao, payback, mesAtualIdx, data, investimentoTotal, margem }: {
  projecao: ProjecaoMes[]; payback: ReturnType<typeof calcularPayback>;
  mesAtualIdx: number; data: FinanceiroData; investimentoTotal: number;
  margem: MargemUnidade | null;
}) {
  const mesAtual = projecao[mesAtualIdx - 1];
  const fatRealMes = mesAtual?.faturamento_real ?? 0;
  const resultadoMes = mesAtual?.resultado_real ?? 0;

  // Break-even pra referência no gráfico (usa custos da unidade)
  const fatHist = projecao.slice(0, mesAtualIdx).map((p) => p.faturamento_real ?? 0);
  const rbt12 = fatHist.slice(-12).reduce((s, v) => s + v, 0);
  const breakEven = calcularBreakEven({
    custos_fixos: data.custos_fixos,
    custos_variaveis: data.custos_variaveis,
    mes_index: mesAtualIdx,
    rbt12,
    investimento_total: investimentoTotal,
  });

  // Filtro de meses (multi-select). Vazio = janela auto (atual ± 4).
  const [mesesSelecionados, setMesesSelecionados] = React.useState<Set<number>>(new Set());

  const projecaoFiltrada = React.useMemo(() => {
    if (mesesSelecionados.size > 0) {
      return projecao.filter((p) => mesesSelecionados.has(p.mes_index))
        .sort((a, b) => a.mes_index - b.mes_index);
    }
    // Mostra só meses com vendas reais; senão cai pra janela atual ± 4
    const comReal = projecao.filter((p) => p.faturamento_real != null);
    if (comReal.length > 0) return comReal;
    const ini = Math.max(0, mesAtualIdx - 5);
    const fim = Math.min(60, ini + 9);
    return projecao.slice(ini, fim);
  }, [projecao, mesesSelecionados, mesAtualIdx]);

  const chartData = projecaoFiltrada.map((p) => ({
    rotulo: p.rotulo,
    real: p.faturamento_real ?? 0,
    mes_index: p.mes_index,
  }));

  const totalReal = chartData.reduce((s, d) => s + d.real, 0);
  const mediaReal = chartData.length > 0 ? totalReal / chartData.length : 0;
  const maxReal = chartData.length > 0 ? Math.max(...chartData.map((d) => d.real)) : 0;

  // DRE do mês atual com despesas reais lançadas (mesma lógica da aba DRE Mensal).
  // Source da verdade pro card "Despesas DRE".
  const overridesPainel = React.useMemo(() => {
    if (data.despesas_mes.ano !== mesAtual?.ano || data.despesas_mes.mes !== mesAtual?.mes) return undefined;
    const m = new Map<string, number>();
    for (const cf of data.custos_fixos) {
      const v = mapearDespesaReal(cf.descricao, data.despesas_mes);
      if (v != null) m.set(cf.descricao, v);
    }
    for (const cv of data.custos_variaveis) {
      const v = mapearDespesaReal(cv.descricao, data.despesas_mes);
      if (v != null) m.set(cv.descricao, v);
    }
    return m;
  }, [data.custos_fixos, data.custos_variaveis, data.despesas_mes, mesAtual?.ano, mesAtual?.mes]);

  const dreMesPainel = React.useMemo(() => {
    if (!mesAtual || fatRealMes <= 0) return null;
    return calcularDRE({
      faturamento: fatRealMes,
      rbt12,
      mes_index: mesAtualIdx,
      custos_fixos: data.custos_fixos,
      custos_variaveis: data.custos_variaveis,
      investimento_total: investimentoTotal,
      despesas_reais_overrides: overridesPainel,
    });
  }, [mesAtual, fatRealMes, rbt12, mesAtualIdx, data.custos_fixos, data.custos_variaveis, investimentoTotal, overridesPainel]);

  const despesasDRE = dreMesPainel
    ? dreMesPainel.simples_nacional + dreMesPainel.custo_servico_total + dreMesPainel.despesas_total
    : 0;
  const margemMes = fatRealMes > 0 ? (resultadoMes / fatRealMes) * 100 : 0;

  return (
    <>
      {/* KPIs reais */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard fadeup={1} icon={TrendingUp} label="Faturamento mês"
          valor={fatRealMes}
          hint={fatRealMes > 0 ? `${MESES_PT[mesAtual?.mes ? mesAtual.mes - 1 : 0]}/${mesAtual?.ano ?? "—"}` : "Sem vendas no mês"}
          tone={fatRealMes > 0 ? "success" : "purple"} />
        <KpiCard fadeup={2} icon={Wallet} label="Resultado líquido mês"
          valor={resultadoMes}
          hint={fatRealMes > 0 ? `Margem ${margemMes.toFixed(1)}%` : "Aguardando vendas"}
          tone={fatRealMes <= 0 ? "purple" : resultadoMes >= 0 ? "success" : "danger"} />
        <KpiCard fadeup={3} icon={Award} label="Despesas DRE (mês)"
          valor={despesasDRE}
          hint={despesasDRE > 0 ? "Simples + custos fixos + variáveis + CSP" : "Sem dados no mês"}
          tone={despesasDRE === 0 ? "purple" : "warning"} />
        <KpiCard fadeup={4} icon={Percent} label="% recuperação investimento"
          valor={payback.pct_recuperado}
          suffix="%"
          decimals={1}
          hint={`Acumulado ${fmtBRL(payback.lucro_acumulado)}`}
          tone="cyan" />
      </div>

      {/* Margem de Contribuição */}
      {margem && <MargemContribuicaoCard margem={margem} mes={mesAtual?.mes ?? new Date().getMonth() + 1} ano={mesAtual?.ano ?? new Date().getFullYear()} />}

      {/* Gráfico: Faturamento Real por mês */}
      <div className="rounded-2xl border border-border bg-card p-5 fin-card-lift">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="font-display font-bold text-[15px]">Faturamento Real por mês</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {mesesSelecionados.size > 0
                ? `${mesesSelecionados.size} ${mesesSelecionados.size === 1 ? "mês" : "meses"} selecionado${mesesSelecionados.size === 1 ? "" : "s"}`
                : "Todos os meses com vendas"}
              {totalReal > 0 && (
                <>
                  {" · Total "}
                  <span className="font-mono font-bold text-success">{fmtBRL(totalReal)}</span>
                  {" · Médio "}
                  <span className="font-mono font-bold">{fmtBRL(mediaReal)}/mês</span>
                  {" · Pico "}
                  <span className="font-mono font-bold text-success">{fmtBRL(maxReal)}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FiltroMeses projecao={projecao} selecionados={mesesSelecionados} onChange={setMesesSelecionados} />
          </div>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 14, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="rotulo" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={fmtBRLk} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 11 }}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                formatter={(v) => [fmtBRL(Number(v ?? 0)), "Faturamento"]}
                labelStyle={{ fontWeight: 700, marginBottom: 4 }}
              />
              <ReferenceLine y={breakEven} stroke="var(--warning)" strokeDasharray="5 5"
                label={{ value: `Break-even ${fmtBRLk(breakEven)}`, position: "right", fill: "var(--warning)", fontSize: 10 }} />
              <Bar dataKey="real" name="Faturamento" radius={[6, 6, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={
                    d.real === 0 ? "var(--muted)" :
                    d.real >= breakEven ? "var(--success)" : "var(--brand-cyan)"
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 text-[10px] text-muted-foreground flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-success" />Acima do break-even</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-brand-cyan" />Abaixo do break-even</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-muted" />Sem vendas</span>
        </div>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Filtro de meses (multi-select via dropdown com checkboxes)
// ────────────────────────────────────────────────────────────
function FiltroMeses({
  projecao, selecionados, onChange,
}: {
  projecao: ProjecaoMes[];
  selecionados: Set<number>;
  onChange: (s: Set<number>) => void;
}) {
  function toggle(mesIdx: number) {
    const novo = new Set(selecionados);
    if (novo.has(mesIdx)) novo.delete(mesIdx);
    else novo.add(mesIdx);
    onChange(novo);
  }
  function selecionarUltimos(n: number) {
    const ultimoComReal = [...projecao].reverse().find((p) => p.faturamento_real != null)?.mes_index
      ?? projecao.find((p) => p.mes === new Date().getMonth() + 1 && p.ano === new Date().getFullYear())?.mes_index
      ?? 1;
    const ini = Math.max(1, ultimoComReal - n + 1);
    const novo = new Set<number>();
    for (let i = ini; i <= ultimoComReal; i++) novo.add(i);
    onChange(novo);
  }
  function selecionarAno(ano: number) {
    const novo = new Set<number>();
    for (const p of projecao) if (p.ano === ano) novo.add(p.mes_index);
    onChange(novo);
  }
  function limpar() {
    onChange(new Set());
  }

  const anos = Array.from(new Set(projecao.map((p) => p.ano))).sort();
  const label = selecionados.size === 0
    ? "Todos os meses (auto)"
    : selecionados.size === 1
    ? (() => {
        const p = projecao.find((x) => selecionados.has(x.mes_index));
        return p ? `${MESES_PT[p.mes - 1].slice(0, 3)}/${String(p.ano).slice(-2)}` : "1 mês";
      })()
    : `${selecionados.size} meses`;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card text-[12px] font-semibold hover:border-brand-cyan transition-smooth">
          <Filter className="w-3.5 h-3.5 text-brand-cyan" />
          {label}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 max-h-[450px] w-[260px] overflow-y-auto rounded-xl border border-border bg-popover shadow-2xl p-1 animate-in fade-in zoom-in-95"
        >
          {/* Atalhos */}
          <div className="px-2 py-1.5 border-b border-border/40">
            <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Atalhos</div>
            <div className="grid grid-cols-3 gap-1">
              <button onClick={() => selecionarUltimos(3)} className="text-[10px] px-2 py-1 rounded border border-border hover:bg-secondary">3m</button>
              <button onClick={() => selecionarUltimos(6)} className="text-[10px] px-2 py-1 rounded border border-border hover:bg-secondary">6m</button>
              <button onClick={() => selecionarUltimos(12)} className="text-[10px] px-2 py-1 rounded border border-border hover:bg-secondary">12m</button>
            </div>
          </div>

          {/* Por ano */}
          <div className="px-2 py-1.5 border-b border-border/40">
            <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Por ano</div>
            <div className="flex flex-wrap gap-1">
              {anos.map((a) => (
                <button key={a} onClick={() => selecionarAno(a)} className="text-[10px] px-2 py-1 rounded border border-border hover:bg-secondary">
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de meses */}
          <div className="py-1">
            {projecao.map((p) => {
              const ativo = selecionados.has(p.mes_index);
              const temReal = p.faturamento_real != null;
              return (
                <button
                  key={p.mes_index}
                  onClick={() => toggle(p.mes_index)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[11px] rounded-md hover:bg-secondary transition-smooth",
                    ativo && "bg-brand-cyan/10",
                  )}
                >
                  <div className={cn(
                    "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0",
                    ativo ? "border-brand-cyan bg-brand-cyan text-white" : "border-border",
                  )}>
                    {ativo && <Check className="w-2.5 h-2.5" />}
                  </div>
                  <Calendar className="w-3 h-3 text-muted-foreground" />
                  <span className="font-mono flex-1">
                    {MESES_PT[p.mes - 1].slice(0, 3)}/{p.ano}
                  </span>
                  {temReal && (
                    <span className="text-[9px] font-bold text-success">●</span>
                  )}
                </button>
              );
            })}
          </div>

          {selecionados.size > 0 && (
            <div className="border-t border-border/40 p-1.5">
              <button
                onClick={limpar}
                className="w-full text-[11px] px-2 py-1.5 rounded-md text-danger hover:bg-danger/10 font-semibold"
              >
                Limpar seleção
              </button>
            </div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function KpiCard({ icon: Icon, label, valor, hint, tone, suffix = "", decimals = 2, fadeup = 1 }: {
  icon: React.ElementType; label: string; valor: number; hint: string; tone: "success" | "danger" | "warning" | "cyan" | "purple";
  suffix?: string; decimals?: number; fadeup?: 1 | 2 | 3 | 4;
}) {
  const map = {
    success: { iconBg: "bg-success/15 border-success/30 text-success", textCol: "text-success" },
    danger:  { iconBg: "bg-danger/15 border-danger/30 text-danger",    textCol: "text-danger" },
    warning: { iconBg: "bg-warning/15 border-warning/30 text-warning", textCol: "text-warning" },
    cyan:    { iconBg: "bg-brand-cyan/15 border-brand-cyan/30 text-brand-cyan", textCol: "text-brand-cyan" },
    purple:  { iconBg: "bg-brand-purple/15 border-brand-purple/30 text-brand-purple", textCol: "text-brand-purple" },
  }[tone];
  const isPct = suffix === "%";
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 fin-card-lift", `fin-fadeup-${fadeup}`)}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</div>
        <div className={cn("w-9 h-9 rounded-lg border flex items-center justify-center", map.iconBg)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className={cn("font-display text-2xl md:text-3xl font-bold mt-2 tabular-nums", map.textCol)}>
        <Counter value={valor} prefix={isPct ? "" : "R$ "} suffix={isPct ? "%" : ""}
          decimals={isPct ? decimals : decimals} duration={1400} />
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}

/* PaybackBar removido — usava payback projetado vs real (Daniel pediu só Real) */

// ────────────────────────────────────────────────────────────
// INVESTIMENTO
// ────────────────────────────────────────────────────────────
function Investimento({ unidadeId, categorias, projetadoTotal, realTotal }: {
  unidadeId: string; categorias: InvestimentoCategoria[]; projetadoTotal: number; realTotal: number;
}) {
  void projetadoTotal;
  const itensTotal = categorias.reduce((s, c) => s + c.itens.length, 0);
  const itensComReal = categorias.reduce((s, c) => s + c.itens.filter((i) => i.valor_real != null).length, 0);
  const faltaLancar = itensTotal - itensComReal;
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SimpleStat icon={Wallet}    label="Investimento real" valor={realTotal > 0 ? fmtBRL(realTotal) : "—"} tone="success" />
        <SimpleStat icon={Briefcase} label="Itens lançados"    valor={`${itensComReal} / ${itensTotal}`} tone="brand-cyan" />
        <SimpleStat icon={Percent}   label="Falta lançar"      valor={faltaLancar === 0 ? "0 · completo" : `${faltaLancar} ${faltaLancar === 1 ? "item" : "itens"}`}
          tone={faltaLancar === 0 ? "success" : "warning"} />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {categorias.map((cat) => (
          <CategoriaInvestimento key={cat.id} categoria={cat} unidadeId={unidadeId} />
        ))}
        <NovaCategoria unidadeId={unidadeId} />
      </div>
    </>
  );
}

function CategoriaInvestimento({ categoria, unidadeId }: { categoria: InvestimentoCategoria; unidadeId: string }) {
  const [aberto, setAberto] = React.useState(false);
  const [novoItem, setNovoItem] = React.useState(false);
  const [itemDesc, setItemDesc] = React.useState("");
  const [itemVal, setItemVal] = React.useState("");
  const projetado = categoria.itens.reduce((s, i) => s + i.valor_projetado, 0);
  const real = categoria.itens.reduce((s, i) => s + (i.valor_real ?? 0), 0);
  const comReal = categoria.itens.some((i) => i.valor_real != null);

  async function addItem() {
    const v = parseFloat(itemVal.replace(",", "."));
    if (!itemDesc.trim() || isNaN(v)) return;
    await criarItemInvestimento(categoria.id, unidadeId, { descricao: itemDesc, valor_projetado: v });
    setItemDesc(""); setItemVal(""); setNovoItem(false);
  }

  async function delCat() {
    if (!confirm(`Excluir categoria "${categoria.nome}" e todos os ${categoria.itens.length} itens?`)) return;
    await deletarCategoriaInvestimento(categoria.id);
  }

  return (
    <div className="border-b border-border last:border-b-0">
      <button onClick={() => setAberto((v) => !v)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-secondary/30 transition-smooth text-left">
        <div className="w-9 h-9 rounded-lg bg-brand-cyan/15 border border-brand-cyan/30 flex items-center justify-center shrink-0">
          <Coins className="w-4 h-4 text-brand-cyan" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-[13px]">{categoria.nome}</div>
          <div className="text-[10px] text-muted-foreground">{categoria.itens.length} {categoria.itens.length === 1 ? "item" : "itens"}</div>
        </div>
        <div className="text-right shrink-0 w-28">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Investido</div>
          <div className={cn("font-mono font-bold", comReal ? "text-success" : "text-muted-foreground")}>
            {comReal ? fmtBRL(real) : "—"}
          </div>
        </div>
        <ChevronRight className={cn("w-4 h-4 transition-transform text-muted-foreground", aberto && "rotate-90")} />
      </button>

      {aberto && (
        <div className="bg-muted/20 px-4 py-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left py-1.5 px-2 font-semibold">Descrição</th>
                <th className="text-right py-1.5 px-2 font-semibold">Investido (Real)</th>
                <th className="text-right py-1.5 px-2 font-semibold w-12">Ação</th>
              </tr>
            </thead>
            <tbody>
              {categoria.itens.map((it) => (
                <ItemInvestimento key={it.id} item={it} />
              ))}
            </tbody>
          </table>

          {novoItem ? (
            <div className="mt-2 flex items-center gap-2">
              <input value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} placeholder="Descrição do item" className="form-input flex-1 text-[12px]" autoFocus />
              <input value={itemVal} onChange={(e) => setItemVal(e.target.value)} placeholder="0,00" className="form-input w-28 text-[12px] font-mono" />
              <button onClick={addItem} className="px-3 py-1.5 rounded bg-brand-cyan text-primary-foreground text-[11px] font-semibold">Adicionar</button>
              <button onClick={() => setNovoItem(false)} className="px-2 py-1.5 rounded text-muted-foreground hover:text-foreground text-[11px]">Cancelar</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-2">
              <button onClick={() => setNovoItem(true)} className="text-[11px] text-brand-cyan font-semibold hover:underline inline-flex items-center gap-1">
                <Plus className="w-3 h-3" /> Item
              </button>
              <button onClick={delCat} className="ml-auto text-[11px] text-danger hover:underline inline-flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Excluir categoria
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ItemInvestimento({ item }: { item: InvestimentoCategoria["itens"][number] }) {
  const [real, setReal] = React.useState(item.valor_real != null ? item.valor_real.toString().replace(".", ",") : "");
  const [saving, setSaving] = React.useState(false);

  async function salvar() {
    setSaving(true);
    const v = real.trim() === "" ? null : parseFloat(real.replace(",", "."));
    if (real.trim() !== "" && isNaN(v as number)) { setSaving(false); return; }
    await atualizarValorRealInvestimento(item.id, v);
    setSaving(false);
  }

  return (
    <tr className="border-b border-border/40">
      <td className="py-1.5 px-2">{item.descricao}</td>
      <td className="py-1.5 px-2 text-right">
        <input value={real} onChange={(e) => setReal(e.target.value)} onBlur={salvar}
          placeholder="0,00" className="form-input w-32 text-[11px] font-mono text-right py-1" />
      </td>
      <td className="py-1.5 px-2 text-right">
        <button onClick={async () => { if (confirm(`Excluir "${item.descricao}"?`)) await deletarItemInvestimento(item.id); }}
          className="w-6 h-6 rounded text-muted-foreground hover:text-danger hover:bg-danger/10 inline-flex items-center justify-center" aria-label="Excluir">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
        </button>
      </td>
    </tr>
  );
}

// ────────────────────────────────────────────────────────────
// MARGEM DE CONTRIBUIÇÃO — engenharia de custos
// ────────────────────────────────────────────────────────────
function MargemContribuicaoCard({ margem, mes, ano }: {
  margem: MargemUnidade; mes: number; ano: number;
}) {
  const margemLavTone = margem.margemPercLavagem >= 70 ? "success" : margem.margemPercLavagem >= 50 ? "warning" : "danger";
  const margemSecTone = margem.margemPercSecagem >= 70 ? "success" : margem.margemPercSecagem >= 50 ? "warning" : "danger";
  const margemMesTone = margem.margemContribuicaoPctMes >= 70 ? "success" : margem.margemContribuicaoPctMes >= 50 ? "warning" : "danger";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 fin-card-lift">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="font-display font-bold text-[15px] inline-flex items-center gap-2">
            <Coins className="w-4 h-4 text-brand-cyan" />
            Margem de contribuição · {MESES_PT[mes - 1]}/{ano}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Faturamento – custos variáveis dos insumos por ciclo
          </div>
        </div>
        <div className={cn(
          "px-3 py-2 rounded-lg text-center min-w-[140px]",
          margemMesTone === "success" && "bg-success/10 border border-success/30",
          margemMesTone === "warning" && "bg-warning/10 border border-warning/30",
          margemMesTone === "danger"  && "bg-danger/10 border border-danger/30",
        )}>
          <div className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">Margem mês</div>
          <div className={cn("font-display text-2xl font-bold tabular-nums leading-tight",
            margemMesTone === "success" && "text-success",
            margemMesTone === "warning" && "text-warning",
            margemMesTone === "danger"  && "text-danger",
          )}>
            {fmtBRL(margem.margemContribuicaoMes)}
          </div>
          <div className="text-[10px] font-mono font-bold text-muted-foreground">
            {margem.margemContribuicaoPctMes.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <MargemServicoCard
          icone={WashingMachine}
          titulo="Lavagem"
          ciclosMes={margem.ciclosLavagemMes}
          custoCiclo={margem.custoLavagem}
          margemUnit={margem.margemUnitariaLavagem}
          margemPct={margem.margemPercLavagem}
          margemTone={margemLavTone}
          precoCiclo={margem.custoLavagem.total + margem.margemUnitariaLavagem}
          faturamentoMes={margem.faturamentoLavagemMes}
          custoTotalMes={margem.custoLavagem.total * margem.ciclosLavagemMes}
        />
        <MargemServicoCard
          icone={Wind}
          titulo="Secagem"
          ciclosMes={margem.ciclosSecagemMes}
          custoCiclo={margem.custoSecagem}
          margemUnit={margem.margemUnitariaSecagem}
          margemPct={margem.margemPercSecagem}
          margemTone={margemSecTone}
          precoCiclo={margem.custoSecagem.total + margem.margemUnitariaSecagem}
          faturamentoMes={margem.faturamentoSecagemMes}
          custoTotalMes={margem.custoSecagem.total * margem.ciclosSecagemMes}
        />
      </div>

      <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
        <MiniInfo label="Ciclos lavagem" valor={margem.ciclosLavagemMes.toString()} />
        <MiniInfo label="Ciclos secagem" valor={margem.ciclosSecagemMes.toString()} />
        <MiniInfo label="Custo lavagem mês" valor={fmtBRL(margem.custoLavagem.total * margem.ciclosLavagemMes)} tone="danger" />
        <MiniInfo label="Custo secagem mês" valor={fmtBRL(margem.custoSecagem.total * margem.ciclosSecagemMes)} tone="danger" />
        <MiniInfo label="Custo variável mês" valor={fmtBRL(margem.custoTotalInsumosMes)} tone="danger" />
        <MiniInfo label="Overhead elétrico mês" valor={fmtBRL(margem.overheadCustoMes)} hint={`${margem.overheadKwhMes.toFixed(0)} kWh`} />
      </div>
    </div>
  );
}

function MargemServicoCard({
  icone: Icone, titulo, ciclosMes, custoCiclo, margemUnit, margemPct, margemTone, precoCiclo, faturamentoMes, custoTotalMes,
}: {
  icone: React.ElementType;
  titulo: string;
  ciclosMes: number;
  custoCiclo: { total: number; componentes: Array<{ rotulo: string; valor: number; cor: string }> };
  margemUnit: number;
  margemPct: number;
  margemTone: "success" | "warning" | "danger";
  precoCiclo: number;
  faturamentoMes: number;
  custoTotalMes: number;
}) {
  // Largura de cada bloco da barra proporcional ao custo
  const totalRow = precoCiclo;
  return (
    <div className="rounded-xl border border-border bg-muted/10 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <div className="font-display font-bold text-[14px] inline-flex items-center gap-1.5">
          <Icone className="w-4 h-4 text-brand-cyan" />
          {titulo}
        </div>
        <div className={cn("font-display font-bold text-[15px] tabular-nums",
          margemTone === "success" && "text-success",
          margemTone === "warning" && "text-warning",
          margemTone === "danger"  && "text-danger",
        )}>
          {margemPct.toFixed(1)}%
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px] mb-3">
        <div>
          <div className="text-muted-foreground">Preço ciclo</div>
          <div className="font-mono font-bold">{fmtBRL(precoCiclo)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Custo ciclo</div>
          <div className="font-mono font-bold text-danger">{fmtBRL(custoCiclo.total)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Margem ciclo</div>
          <div className={cn("font-mono font-bold",
            margemTone === "success" && "text-success",
            margemTone === "warning" && "text-warning",
            margemTone === "danger"  && "text-danger",
          )}>{fmtBRL(margemUnit)}</div>
        </div>
      </div>

      {/* Barra empilhada de composição do custo */}
      <div className="space-y-1.5">
        <div className="flex h-6 rounded-md overflow-hidden border border-border">
          {custoCiclo.componentes.map((c, i) => (
            <div key={i}
              style={{ width: `${totalRow > 0 ? (c.valor / totalRow) * 100 : 0}%`, background: c.cor }}
              title={`${c.rotulo}: ${fmtBRL(c.valor)}`}
            />
          ))}
          <div
            style={{ width: `${totalRow > 0 ? (margemUnit / totalRow) * 100 : 0}%`, background: "var(--success)" }}
            title={`Margem: ${fmtBRL(margemUnit)}`}
          />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
          {custoCiclo.componentes.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-muted-foreground">
              <span className="w-2 h-2 rounded-sm" style={{ background: c.cor }} />
              {c.rotulo} <span className="font-mono">{fmtBRL(c.valor)}</span>
            </span>
          ))}
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <span className="w-2 h-2 rounded-sm bg-success" />
            Margem <span className="font-mono">{fmtBRL(margemUnit)}</span>
          </span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <div className="text-muted-foreground text-[9px] uppercase tracking-wider">Ciclos / mês</div>
          <div className="font-mono font-bold">{ciclosMes}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-[9px] uppercase tracking-wider">Custo no mês</div>
          <div className="font-mono font-bold text-danger">{fmtBRL(custoTotalMes)}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-[9px] uppercase tracking-wider">Faturamento</div>
          <div className="font-mono font-bold text-success">{fmtBRL(faturamentoMes)}</div>
        </div>
      </div>
    </div>
  );
}

function MiniInfo({ label, valor, hint, tone }: { label: string; valor: string; hint?: string; tone?: "danger" | "success" }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">{label}</div>
      <div className={cn("font-mono font-bold tabular-nums",
        tone === "danger" && "text-danger",
        tone === "success" && "text-success",
      )}>{valor}</div>
      {hint && <div className="text-[9px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// EDITOR ENGENHARIA DE CUSTOS
// ────────────────────────────────────────────────────────────
function EngenhariaCustosEditor({ unidadeId, engenharia }: {
  unidadeId: string; engenharia: EngenhariaCustos;
}) {
  const [c, setC] = React.useState<EngenhariaCustos>(engenharia);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => { setC(engenharia); }, [engenharia]);

  function patch<K extends keyof EngenhariaCustos>(k: K, v: EngenhariaCustos[K]) {
    setC((s) => ({ ...s, [k]: v }));
  }

  async function salvar() {
    setSaving(true);
    await salvarEngenhariaCustos(unidadeId, c);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const custoLav = calcularCustoLavagem(c, Math.max(1, 100));  // simulação 100 ciclos
  const custoSec = calcularCustoSecagem(c);
  const overhead = calcularOverheadEletrico(c);
  const margemLav = c.preco_lavagem - custoLav.total;
  const margemSec = c.preco_secagem - custoSec.total;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-brand-cyan/8 to-brand-blue/8 flex items-center gap-3">
        <Coins className="w-5 h-5 text-brand-cyan" />
        <div className="flex-1">
          <div className="font-display font-bold text-[14px]">Engenharia de Custos da unidade</div>
          <div className="text-[11px] text-muted-foreground">Parâmetros pra calcular margem de contribuição por ciclo</div>
        </div>
        <Button size="sm" onClick={salvar} disabled={saving} className="bg-brand-cyan text-primary-foreground">
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4 mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          {saved ? "Salvo" : "Salvar"}
        </Button>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Sabão */}
        <Section icone={FlaskConical} title="Sabão Omo Profissional" preview={`R$ ${custoInsumoCiclo(c.ml_sabao_por_ciclo, c.preco_galao_sabao_litros, c.preco_galao_sabao_valor).toFixed(4)}/ciclo`}>
          <Campo label="Volume galão (L)" value={c.preco_galao_sabao_litros} onChange={(v) => patch("preco_galao_sabao_litros", v)} suffix="L" />
          <Campo label="Preço galão (R$)" value={c.preco_galao_sabao_valor} onChange={(v) => patch("preco_galao_sabao_valor", v)} prefix="R$" />
          <Campo label="Consumo por ciclo (mL)" value={c.ml_sabao_por_ciclo} onChange={(v) => patch("ml_sabao_por_ciclo", v)} suffix="mL" />
        </Section>

        {/* Amaciante */}
        <Section icone={Beaker} title="Amaciante Confort Profissional" preview={`R$ ${custoInsumoCiclo(c.ml_amaciante_por_ciclo, c.preco_galao_amaciante_litros, c.preco_galao_amaciante_valor).toFixed(4)}/ciclo`}>
          <Campo label="Volume galão (L)" value={c.preco_galao_amaciante_litros} onChange={(v) => patch("preco_galao_amaciante_litros", v)} suffix="L" />
          <Campo label="Preço galão (R$)" value={c.preco_galao_amaciante_valor} onChange={(v) => patch("preco_galao_amaciante_valor", v)} prefix="R$" />
          <Campo label="Consumo por ciclo (mL)" value={c.ml_amaciante_por_ciclo} onChange={(v) => patch("ml_amaciante_por_ciclo", v)} suffix="mL" />
        </Section>

        {/* Energia */}
        <Section icone={Zap} title="Energia elétrica" preview={`Lav R$ ${(c.kwh_por_ciclo_lavagem * c.tarifa_kwh).toFixed(4)} · Sec R$ ${(c.kwh_por_ciclo_secagem * c.tarifa_kwh).toFixed(2)}`}>
          <Campo label="Tarifa kWh" value={c.tarifa_kwh} onChange={(v) => patch("tarifa_kwh", v)} prefix="R$" decimals={4} />
          <Campo label="kWh por lavagem" value={c.kwh_por_ciclo_lavagem} onChange={(v) => patch("kwh_por_ciclo_lavagem", v)} suffix="kWh" decimals={3} />
          <Campo label="kWh por secagem" value={c.kwh_por_ciclo_secagem} onChange={(v) => patch("kwh_por_ciclo_secagem", v)} suffix="kWh" decimals={3} />
        </Section>

        {/* Água */}
        <Section icone={Droplets} title="Água" preview="Rateada pelo total de ciclos de lavagem do mês">
          <Campo label="Conta mensal" value={c.conta_agua_mensal} onChange={(v) => patch("conta_agua_mensal", v)} prefix="R$" />
        </Section>

        {/* Preços de venda */}
        <Section icone={DollarSign} title="Preços de venda">
          <Campo label="Lavagem" value={c.preco_lavagem} onChange={(v) => patch("preco_lavagem", v)} prefix="R$" />
          <Campo label="Secagem" value={c.preco_secagem} onChange={(v) => patch("preco_secagem", v)} prefix="R$" />
        </Section>

        {/* Operação */}
        <Section icone={Clock} title="Operação" preview={`${overhead.kwhMes.toFixed(0)} kWh/mês overhead = R$ ${overhead.custoMes.toFixed(2)}`}>
          <Campo label="Horas de operação por dia" value={c.horas_operacao_dia} onChange={(v) => patch("horas_operacao_dia", v)} suffix="h" />
          <Campo label="Dias de operação por mês" value={c.dias_operacao_mes} onChange={(v) => patch("dias_operacao_mes", v)} suffix="d" decimals={0} />
        </Section>
      </div>

      {/* Equipamentos sempre ligados */}
      <div className="px-5 pb-5">
        <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-2">
            <Coins className="w-4 h-4 text-warning" />
            <div className="font-display font-bold text-[13px] inline-flex items-center gap-1.5"><Plug className="w-3.5 h-3.5 text-warning" /> Equipamentos sempre ligados (consumo overhead)</div>
            <div className="ml-auto text-[11px] text-muted-foreground">
              Total: <span className="font-mono font-bold text-warning">{overhead.kwhDia.toFixed(2)} kWh/dia</span>
              {" → "}
              <span className="font-mono font-bold text-warning">R$ {overhead.custoMes.toFixed(2)}/mês</span>
            </div>
          </div>
          <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <Equip label={`Ar-condicionado ${c.ar_condicionado_btus.toLocaleString("pt-BR")} BTUs`} kwh={c.ar_condicionado_kwh_hora}
              onChange={(v) => patch("ar_condicionado_kwh_hora", v)} />
            <Equip label={`Lâmpadas (${c.lampadas_qtd}x)`} kwh={c.lampada_kwh_hora}
              onChange={(v) => patch("lampada_kwh_hora", v)}
              qtd={c.lampadas_qtd} onChangeQtd={(v) => patch("lampadas_qtd", v)} />
            <Equip label={`Câmeras (${c.cameras_qtd}x)`} kwh={c.camera_kwh_hora}
              onChange={(v) => patch("camera_kwh_hora", v)}
              qtd={c.cameras_qtd} onChangeQtd={(v) => patch("cameras_qtd", v)} />
            <Equip label="TV 32''" kwh={c.tv_kwh_hora} onChange={(v) => patch("tv_kwh_hora", v)} />
            <Equip label="Totem de pagamento" kwh={c.totem_kwh_hora} onChange={(v) => patch("totem_kwh_hora", v)} />
            <Equip label="Internet/telefonia" kwh={c.internet_kwh_hora} onChange={(v) => patch("internet_kwh_hora", v)} />
          </div>
        </div>
      </div>

      {/* Preview consolidado */}
      <div className="px-5 pb-5">
        <div className="rounded-xl border-2 border-brand-cyan/30 bg-brand-cyan/5 p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <PreviewBox titulo="Custo lavagem" valor={custoLav.total} tone="danger" />
          <PreviewBox titulo="Margem lavagem" valor={margemLav} suffix={`(${((margemLav / c.preco_lavagem) * 100).toFixed(0)}%)`} tone={margemLav > 8 ? "success" : margemLav > 4 ? "warning" : "danger"} />
          <PreviewBox titulo="Custo secagem" valor={custoSec.total} tone="danger" />
          <PreviewBox titulo="Margem secagem" valor={margemSec} suffix={`(${((margemSec / c.preco_secagem) * 100).toFixed(0)}%)`} tone={margemSec > 8 ? "success" : margemSec > 4 ? "warning" : "danger"} />
        </div>
      </div>
    </div>
  );
}

function custoInsumoCiclo(ml: number, litros: number, valor: number): number {
  if (litros <= 0) return 0;
  return (ml / (litros * 1000)) * valor;
}

function Section({ icone: Icone, title, preview, children }: {
  icone?: React.ElementType; title: string; preview?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/10 p-4">
      <div className="flex items-baseline justify-between mb-3 gap-3">
        <div className="font-display font-bold text-[13px] inline-flex items-center gap-1.5">
          {Icone && <Icone className="w-3.5 h-3.5 text-brand-cyan" />}
          {title}
        </div>
        {preview && <div className="text-[10px] text-muted-foreground font-mono">{preview}</div>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Campo({ label, value, onChange, prefix, suffix, decimals = 2 }: {
  label: string; value: number; onChange: (v: number) => void;
  prefix?: string; suffix?: string; decimals?: number;
}) {
  const [local, setLocal] = React.useState(value.toString().replace(".", ","));
  React.useEffect(() => { setLocal(value.toString().replace(".", ",")); }, [value]);
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-muted-foreground flex-1">{label}</label>
      <div className="inline-flex items-center gap-1">
        {prefix && <span className="text-[10px] text-muted-foreground">{prefix}</span>}
        <input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => {
            const v = parseFloat(local.replace(",", "."));
            if (!isNaN(v)) onChange(v);
          }}
          className="form-input h-7 w-24 text-[11px] font-mono text-right py-0"
        />
        {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
      </div>
      <span className="hidden">{decimals}</span>
    </div>
  );
}

function Equip({ label, kwh, onChange, qtd, onChangeQtd }: {
  label: string; kwh: number; onChange: (v: number) => void;
  qtd?: number; onChangeQtd?: (v: number) => void;
}) {
  return (
    <div className="rounded-lg bg-card border border-border p-2.5 space-y-1.5">
      <div className="text-[11px] font-semibold">{label}</div>
      <Campo label="kWh/h" value={kwh} onChange={onChange} suffix="kWh" decimals={4} />
      {onChangeQtd && qtd != null && (
        <Campo label="Quantidade" value={qtd} onChange={onChangeQtd} decimals={0} />
      )}
    </div>
  );
}

function PreviewBox({ titulo, valor, suffix, tone }: {
  titulo: string; valor: number; suffix?: string; tone: "success" | "warning" | "danger";
}) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{titulo}</div>
      <div className={cn("font-display text-xl font-bold tabular-nums mt-1",
        tone === "success" && "text-success",
        tone === "warning" && "text-warning",
        tone === "danger"  && "text-danger",
      )}>
        R$ {valor.toFixed(2).replace(".", ",")}
      </div>
      {suffix && <div className="text-[10px] text-muted-foreground font-mono">{suffix}</div>}
    </div>
  );
}

function NovaCategoria({ unidadeId }: { unidadeId: string }) {
  const [aberto, setAberto] = React.useState(false);
  const [nome, setNome] = React.useState("");
  async function criar() {
    if (!nome.trim()) return;
    await criarCategoriaInvestimento(unidadeId, nome);
    setNome(""); setAberto(false);
  }
  return aberto ? (
    <div className="px-4 py-3 flex items-center gap-2 bg-muted/30">
      <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da categoria" className="form-input flex-1" autoFocus />
      <button onClick={criar} className="px-3 py-2 rounded bg-brand-cyan text-primary-foreground text-[12px] font-semibold">Criar</button>
      <button onClick={() => setAberto(false)} className="px-2 py-2 text-muted-foreground hover:text-foreground text-[12px]">Cancelar</button>
    </div>
  ) : (
    <button onClick={() => setAberto(true)} className="w-full px-4 py-3 text-left text-[12px] text-brand-cyan font-semibold hover:bg-brand-cyan/5 inline-flex items-center gap-1">
      <Plus className="w-4 h-4" /> Nova categoria de investimento
    </button>
  );
}

function SimpleStat({ icon: Icon, label, valor, tone }: { icon: React.ElementType; label: string; valor: string; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</div>
        <Icon className={cn("w-4 h-4", `text-${tone}`)} />
      </div>
      <div className={cn("font-display font-bold text-2xl mt-1", `text-${tone}`)}>{valor}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// DRE MENSAL
// ────────────────────────────────────────────────────────────
function DREMensal({ unidadeId, projecao, data, investimentoTotal, mesAtualIdx }: {
  unidadeId: string; projecao: ProjecaoMes[]; data: FinanceiroData; investimentoTotal: number; mesAtualIdx: number;
}) {
  const [mesIdx, setMesIdx] = React.useState(mesAtualIdx);
  const mes = projecao[mesIdx - 1];
  const lanc = data.lancamentos.find((l) => l.mes_index === mesIdx);
  const [fatReal, setFatReal] = React.useState(lanc?.faturamento_real?.toString().replace(".", ",") ?? "");
  const [saving, setSaving] = React.useState(false);
  const [despesasOpen, setDespesasOpen] = React.useState(false);

  React.useEffect(() => {
    const l = data.lancamentos.find((l) => l.mes_index === mesIdx);
    setFatReal(l?.faturamento_real?.toString().replace(".", ",") ?? "");
  }, [mesIdx, data.lancamentos]);

  if (!mes) return null;
  const fatHist = projecao.slice(0, mesIdx).map((p) => p.faturamento_real ?? 0);
  const rbt12 = fatHist.slice(-12).reduce((s, v) => s + v, 0);

  // Overrides de despesas reais — só quando o mês selecionado bate com data.despesas_mes
  const overrides = React.useMemo(() => {
    if (data.despesas_mes.ano !== mes.ano || data.despesas_mes.mes !== mes.mes) return undefined;
    const m = new Map<string, number>();
    for (const cf of data.custos_fixos) {
      const v = mapearDespesaReal(cf.descricao, data.despesas_mes);
      if (v != null) m.set(cf.descricao, v);
    }
    for (const cv of data.custos_variaveis) {
      const v = mapearDespesaReal(cv.descricao, data.despesas_mes);
      if (v != null) m.set(cv.descricao, v);
    }
    return m;
  }, [data.custos_fixos, data.custos_variaveis, data.despesas_mes, mes.ano, mes.mes]);

  const fatRealNum = fatReal.trim() ? parseFloat(fatReal.replace(",", ".")) : null;
  const dreReal = fatRealNum != null ? calcularDRE({
    faturamento: fatRealNum, rbt12, mes_index: mesIdx,
    custos_fixos: data.custos_fixos, custos_variaveis: data.custos_variaveis,
    investimento_total: investimentoTotal,
    despesas_reais_overrides: overrides,
  }) : null;

  async function salvar() {
    setSaving(true);
    const v = fatReal.trim() ? parseFloat(fatReal.replace(",", ".")) : null;
    await lancarFaturamentoMes({
      unidade_id: unidadeId,
      mes_index: mesIdx,
      ano: mes.ano,
      mes: mes.mes,
      faturamento_real: v,
    });
    setSaving(false);
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
        <div className="font-display font-bold inline-flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-brand-cyan" /> DRE Real — Mês {mesIdx} · {MESES_PT[mes.mes - 1]}/{mes.ano}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setMesIdx(Math.max(1, mesIdx - 1))} className="w-8 h-8 rounded border border-border hover:bg-secondary flex items-center justify-center" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
          <select value={mesIdx} onChange={(e) => setMesIdx(parseInt(e.target.value, 10))} className="form-input h-8 py-0 text-[12px] font-mono">
            {projecao.map((p) => <option key={p.mes_index} value={p.mes_index}>Mês {p.mes_index} · {MESES_PT[p.mes - 1]}/{p.ano}</option>)}
          </select>
          <button onClick={() => setMesIdx(Math.min(60, mesIdx + 1))} className="w-8 h-8 rounded border border-border hover:bg-secondary flex items-center justify-center" aria-label="Próximo mês"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
        <span className="text-[11px] text-muted-foreground">Faturamento real:</span>
        <input value={fatReal} onChange={(e) => setFatReal(e.target.value)} placeholder="0,00" className="form-input w-40 font-mono" />
        {lanc?.fonte === "vendas" && (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md bg-success/15 text-success border border-success/30">
            <Zap className="w-3 h-3" /> Auto · vendas reais{lanc.qtd_vendas ? ` · ${lanc.qtd_vendas} vendas` : ""}{lanc.ciclos ? ` · ${lanc.ciclos} ciclos` : ""}
          </span>
        )}
        <Button size="sm" onClick={salvar} disabled={saving || lanc?.fonte === "vendas"} className="bg-brand-cyan text-primary-foreground">
          {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />} Salvar
        </Button>
        <Button size="sm" variant="outline" disabled={lanc?.fonte === "vendas"} onClick={async () => { setFatReal(""); await lancarFaturamentoMes({ unidade_id: unidadeId, mes_index: mesIdx, ano: mes.ano, mes: mes.mes, faturamento_real: null }); }}>Limpar</Button>
        {data.despesas_mes.ano === mes.ano && data.despesas_mes.mes === mes.mes && (
          <Button size="sm" variant="outline"
            onClick={() => setDespesasOpen(true)}
            className="border-brand-cyan/40 text-brand-cyan hover:bg-brand-cyan/10">
            <Wallet className="w-3.5 h-3.5 mr-1" />
            Lançar despesas do mês{data.despesas_mes.total > 0 ? ` (${fmtBRL(data.despesas_mes.total)} já lançado)` : ""}
          </Button>
        )}
        {dreReal && <AlertaResultado resultado={dreReal.resultado_liquido} margem={dreReal.margem_operacional} />}
      </div>

      <LancarDespesasDialog
        open={despesasOpen}
        onOpenChange={setDespesasOpen}
        unidadeId={unidadeId}
        unidadeNome={data.unidades.find((u) => u.id === unidadeId)?.nome ?? ""}
        ano={mes.ano}
        mes={mes.mes}
        custosFixos={data.custos_fixos}
        custosVariaveis={data.custos_variaveis}
        faturamentoReal={fatRealNum}
        porDescricaoExistente={data.despesas_mes.por_descricao}
        porCategoriaExistente={data.despesas_mes.por_categoria}
      />

      {dreReal ? (
        <DRECard titulo="DRE Real do mês" tone="success" dre={dreReal} />
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-border bg-muted/10 p-8 text-center flex flex-col items-center justify-center">
          <FileText className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <div className="text-[14px] font-semibold">Sem faturamento real no mês</div>
          <div className="text-[12px] text-muted-foreground mt-1">Importe vendas em Cadastros → Importações ou digite o valor acima.</div>
        </div>
      )}
    </>
  );
}

function AlertaResultado({ resultado, margem }: { resultado: number; margem: number }) {
  let label = "Excelente", tone = "success", Icon = CheckCircle2;
  if (resultado < 0) { label = "Alerta crítico"; tone = "danger"; Icon = AlertTriangle; }
  else if (margem < 5) { label = "Atenção"; tone = "warning"; Icon = AlertTriangle; }
  else if (margem < 15) { label = "Dentro da meta"; tone = "brand-cyan"; Icon = CheckCircle2; }
  return (
    <span className={cn("ml-auto inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold",
      `bg-${tone}/15 text-${tone} border border-${tone}/30`)}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

function DRECard({ titulo, tone, dre }: { titulo: string; tone: string; dre: ReturnType<typeof calcularDRE> }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className={cn("text-[10px] uppercase tracking-[0.18em] font-semibold mb-3 flex items-center gap-1", `text-${tone}`)}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" /> {titulo}
      </div>
      <DRELinhaR label="(+) Faturamento Bruto"  valor={dre.faturamento_bruto} bold subtle />
      <DRELinhaR label="(−) Simples Nacional"    valor={-dre.simples_nacional} red />
      <DRELinhaR label="(=) Receita Líquida"     valor={dre.receita_liquida} bold borderTop />
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mt-3 mb-1">Custo do Serviço (CSP)</div>
      {dre.detalhe_csp.map((d, i) => <DRELinhaR key={i} label={`(−) ${d.descricao}`} valor={-d.valor} red small isReal={d.is_real} />)}
      <DRELinhaR label="(=) Resultado Bruto" valor={dre.resultado_bruto} bold borderTop />
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mt-3 mb-1">Despesas operacionais</div>
      <DRELinhaR label="(−) Royalties (Franchising)" valor={-dre.royalties} red small />
      <div className="text-[10px] font-semibold mt-1.5">Custos fixos</div>
      {dre.detalhe_fixos.map((d, i) => <DRELinhaR key={i} label={`(−) ${d.descricao}`} valor={-d.valor} red small isReal={d.is_real} />)}
      <div className="text-[10px] font-semibold mt-1.5">Custos variáveis</div>
      {dre.detalhe_variaveis.map((d, i) => <DRELinhaR key={i} label={`(−) ${d.descricao}`} valor={-d.valor} red small isReal={d.is_real} />)}
      <DRELinhaR label="(−) Total Despesas" valor={-dre.despesas_total} red bold borderTop />
      <DRELinhaR label="(=) RESULTADO LÍQUIDO" valor={dre.resultado_liquido}
        red={dre.resultado_liquido < 0}
        bold className="text-base mt-1 pt-2 border-t-2 border-foreground/20" />
      <div className="mt-3 pt-2 border-t border-border space-y-1">
        <DRELinhaSimples label="Margem Operacional" valor={`${dre.margem_operacional.toFixed(1)}%`} tone={dre.margem_operacional >= 15 ? "success" : dre.margem_operacional > 0 ? "warning" : "danger"} />
        <DRELinhaSimples label="ROI sobre Investimento" valor={`${dre.roi_sobre_investimento.toFixed(2)}%`} tone={dre.roi_sobre_investimento >= 1 ? "success" : "danger"} />
      </div>
    </div>
  );
}

function DRELinhaR({ label, valor, bold, red, small, subtle, borderTop, className, isReal }: {
  label: string; valor: number; bold?: boolean; red?: boolean; small?: boolean; subtle?: boolean; borderTop?: boolean; className?: string; isReal?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between py-1", borderTop && "border-t border-border mt-1 pt-1.5", className)}>
      <span className={cn("text-[12px] inline-flex items-center gap-1.5", small && "text-[11px]", subtle && "text-muted-foreground", bold && "font-semibold")}>
        {label}
        {isReal && <span className="px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-success/15 text-success border border-success/30">real</span>}
      </span>
      <span className={cn("font-mono tabular-nums text-[12px]", small && "text-[11px]", red && "text-danger", bold && "font-bold")}>
        {valor < 0 ? `(${fmtBRL(Math.abs(valor))})` : fmtBRL(valor)}
      </span>
    </div>
  );
}

function DRELinhaSimples({ label, valor, tone }: { label: string; valor: string; tone: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-bold", `text-${tone}`)}>{valor}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// PROJEÇÃO 60 MESES
// ────────────────────────────────────────────────────────────
export function Projecao60Meses({ projecao, mesAtualIdx }: { projecao: ProjecaoMes[]; mesAtualIdx: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <div className="font-display font-bold text-[15px] inline-flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-brand-cyan" /> Projeção 5 anos (60 meses)</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Linha amarela = mês atual · investimento deduzido do fluxo acumulado</div>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scroll-thin">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card z-10 border-b border-border">
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left py-2 px-3 font-semibold">Mês</th>
              <th className="text-left py-2 px-3 font-semibold">Período</th>
              <th className="text-right py-2 px-3 font-semibold">% Meta</th>
              <th className="text-right py-2 px-3 font-semibold">Projetado</th>
              <th className="text-right py-2 px-3 font-semibold">Real</th>
              <th className="text-right py-2 px-3 font-semibold">Variação</th>
              <th className="text-right py-2 px-3 font-semibold">Resultado</th>
              <th className="text-right py-2 px-3 font-semibold">Fluxo acum.</th>
            </tr>
          </thead>
          <tbody>
            {projecao.map((p) => {
              const isAtual = p.mes_index === mesAtualIdx;
              const variacao = p.faturamento_real != null
                ? ((p.faturamento_real - p.faturamento_projetado) / p.faturamento_projetado) * 100 : null;
              return (
                <tr key={p.mes_index} className={cn(
                  "border-b border-border/40 text-[11px]",
                  isAtual && "bg-warning/10 border-warning/40",
                  p.fluxo_acumulado >= 0 && !isAtual && "bg-success/[0.03]",
                )}>
                  <td className="py-1.5 px-3 font-mono font-bold tabular-nums">{p.mes_index}</td>
                  <td className="py-1.5 px-3 font-mono text-muted-foreground">{p.rotulo}</td>
                  <td className="py-1.5 px-3 text-right font-mono">{p.pct_da_meta != null ? `${p.pct_da_meta.toFixed(0)}%` : "—"}</td>
                  <td className="py-1.5 px-3 text-right font-mono">{fmtBRLk(p.faturamento_projetado)}</td>
                  <td className="py-1.5 px-3 text-right font-mono font-semibold">{p.faturamento_real != null ? fmtBRLk(p.faturamento_real) : "—"}</td>
                  <td className={cn("py-1.5 px-3 text-right font-mono",
                    variacao != null && (variacao >= 0 ? "text-success" : "text-danger"))}>
                    {variacao != null ? `${variacao >= 0 ? "+" : ""}${variacao.toFixed(0)}%` : "—"}
                  </td>
                  <td className={cn("py-1.5 px-3 text-right font-mono",
                    (p.resultado_real ?? p.resultado_projetado) >= 0 ? "text-success" : "text-danger")}>
                    {fmtBRLk(p.resultado_real ?? p.resultado_projetado)}
                  </td>
                  <td className={cn("py-1.5 px-3 text-right font-mono font-bold",
                    p.fluxo_acumulado >= 0 ? "text-success" : "text-danger")}>
                    {fmtBRLk(p.fluxo_acumulado)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// CONFIGURAÇÕES
// ────────────────────────────────────────────────────────────
function Configuracoes({ unidadeId, unidadeNome, config, custosFixos, custosVariaveis, projecao }: {
  unidadeId: string; unidadeNome: string; config: UnidadeConfig | null;
  custosFixos: CustoFixo[]; custosVariaveis: CustoVariavel[]; projecao: ProjecaoMes[];
}) {
  const [c, setC] = React.useState({
    responsavel_nome: config?.responsavel_nome ?? "",
    tipo_unidade: config?.tipo_unidade ?? "franquia",
    mes_inauguracao: config?.mes_inauguracao?.toString() ?? "",
    ano_inauguracao: config?.ano_inauguracao?.toString() ?? "",
    potencial_faturamento: config?.potencial_faturamento?.toString() ?? "42000",
    aluguel_iptu: config?.aluguel_iptu?.toString() ?? "4000",
    meta_payback_meses: config?.meta_payback_meses?.toString() ?? "21",
  });
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  async function salvar() {
    setSaving(true);
    await atualizarConfigUnidade(unidadeId, {
      responsavel_nome: c.responsavel_nome || null,
      tipo_unidade: c.tipo_unidade,
      mes_inauguracao: c.mes_inauguracao ? parseInt(c.mes_inauguracao, 10) : null,
      ano_inauguracao: c.ano_inauguracao ? parseInt(c.ano_inauguracao, 10) : null,
      potencial_faturamento: parseFloat(c.potencial_faturamento.replace(",", ".")) || 42000,
      aluguel_iptu: c.aluguel_iptu ? parseFloat(c.aluguel_iptu.replace(",", ".")) : null,
      meta_payback_meses: parseInt(c.meta_payback_meses, 10) || 21,
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function exportCSV() {
    const rows = [
      ["Mês", "Período", "% Meta", "Projetado", "Real", "Variação %", "Resultado", "Fluxo Acum."],
      ...projecao.map((p) => [
        p.mes_index,
        p.rotulo,
        p.pct_da_meta?.toFixed(1) ?? "",
        p.faturamento_projetado.toFixed(2),
        p.faturamento_real?.toFixed(2) ?? "",
        p.faturamento_real != null ? (((p.faturamento_real - p.faturamento_projetado) / p.faturamento_projetado) * 100).toFixed(1) : "",
        (p.resultado_real ?? p.resultado_projetado).toFixed(2),
        p.fluxo_acumulado.toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `lavsync-${unidadeNome}-projecao.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Config básica */}
      <div className="rounded-2xl border border-border bg-card p-5 fin-card-lift">
        <div className="font-display font-bold inline-flex items-center gap-1.5 mb-4"><Settings className="w-4 h-4 text-brand-cyan" /> Configurações da unidade</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Nome da unidade"><input value={unidadeNome} disabled className="form-input opacity-60" /></Field>
          <Field label="Responsável / Franqueado"><input value={c.responsavel_nome} onChange={(e) => setC({ ...c, responsavel_nome: e.target.value })} placeholder="Nome completo" className="form-input" /></Field>
          <Field label="Tipo de unidade"><select value={c.tipo_unidade} onChange={(e) => setC({ ...c, tipo_unidade: e.target.value })} className="form-input"><option value="franquia">Franquia</option><option value="propria">Própria</option></select></Field>
          <Field label="Mês de inauguração"><select value={c.mes_inauguracao} onChange={(e) => setC({ ...c, mes_inauguracao: e.target.value })} className="form-input"><option value="">—</option>{MESES_PT.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></Field>
          <Field label="Ano de inauguração"><input type="number" value={c.ano_inauguracao} onChange={(e) => setC({ ...c, ano_inauguracao: e.target.value })} className="form-input font-mono" /></Field>
          <Field label="Potencial máx. faturamento (R$/mês)"><input value={c.potencial_faturamento} onChange={(e) => setC({ ...c, potencial_faturamento: e.target.value })} className="form-input font-mono" /></Field>
          <Field label="Aluguel + IPTU (R$/mês)"><input value={c.aluguel_iptu} onChange={(e) => setC({ ...c, aluguel_iptu: e.target.value })} className="form-input font-mono" /></Field>
          <Field label="Meta de payback (meses)"><input type="number" value={c.meta_payback_meses} onChange={(e) => setC({ ...c, meta_payback_meses: e.target.value })} className="form-input font-mono" /></Field>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button onClick={salvar} disabled={saving} className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white">
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5 mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            {saved ? "Salvo!" : "Salvar configurações"}
          </Button>
          <Button variant="outline" onClick={exportCSV}><Download className="w-3.5 h-3.5 mr-1" /> Exportar CSV (60 meses)</Button>
        </div>
      </div>

      {/* Custos fixos */}
      <CustosFixosEditor unidadeId={unidadeId} custos={custosFixos} />

      {/* Custos variáveis */}
      <CustosVariaveisEditor unidadeId={unidadeId} custos={custosVariaveis} />

      {/* Premissas */}
      <div className="rounded-2xl border border-border bg-muted/20 p-4 text-[11px] text-muted-foreground">
        <div className="font-display font-bold text-foreground mb-2 inline-flex items-center gap-1.5"><Wand2 className="w-3.5 h-3.5 text-brand-cyan" /> Premissas — Simples Nacional Anexo III</div>
        <p>Alíquotas progressivas calculadas automaticamente sobre RBT12 (receita bruta dos últimos 12 meses):</p>
        <p className="font-mono mt-1.5 leading-relaxed">
          até R$ 180k/ano → 6% · R$ 180–360k → 11,2% (PD R$9.360) · R$ 360–720k → 13,5% (PD R$17.640) · R$ 720k–1,8M → 16% (PD R$35.640)
        </p>
        <p className="mt-2">Royalties seguem o mínimo definido (R$1.000 a partir do mês 3 por padrão). Publicidade local inaugural usa valor maior nos primeiros 3 meses.</p>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

function CustosFixosEditor({ unidadeId, custos }: { unidadeId: string; custos: CustoFixo[] }) {
  const [novoOpen, setNovoOpen] = React.useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="font-display font-bold inline-flex items-center gap-1.5"><Wallet className="w-4 h-4 text-brand-cyan" /> Custos fixos mensais</div>
        <Button size="sm" onClick={() => setNovoOpen(true)} className="bg-brand-cyan text-primary-foreground"><Plus className="w-3 h-3 mr-1" /> Adicionar</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-[9px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/20">
            <th className="text-left py-2 px-3 font-semibold">Descrição</th>
            <th className="text-right py-2 px-3 font-semibold">R$/mês</th>
            <th className="text-right py-2 px-3 font-semibold">Inaugural</th>
            <th className="text-right py-2 px-3 font-semibold">Meses</th>
            <th className="text-center py-2 px-3 font-semibold">Ativo</th>
            <th className="text-right py-2 px-3 font-semibold">Ações</th>
          </tr></thead>
          <tbody>
            {custos.map((c) => <CustoFixoRow key={c.id} custo={c} unidadeId={unidadeId} />)}
            {novoOpen && <CustoFixoRow custo={null} unidadeId={unidadeId} onClose={() => setNovoOpen(false)} />}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustoFixoRow({ custo, unidadeId, onClose }: { custo: CustoFixo | null; unidadeId: string; onClose?: () => void }) {
  const [editing, setEditing] = React.useState(custo == null);
  const [d, setD] = React.useState({
    descricao: custo?.descricao ?? "",
    valor_mensal: custo?.valor_mensal?.toString() ?? "",
    valor_inaugural: custo?.valor_inaugural?.toString() ?? "",
    meses_inaugural: custo?.meses_inaugural?.toString() ?? "",
    ativo: custo?.ativo ?? true,
  });
  async function salvar() {
    await salvarCustoFixo(unidadeId, {
      id: custo?.id,
      descricao: d.descricao,
      valor_mensal: parseFloat(d.valor_mensal.replace(",", ".")) || 0,
      valor_inaugural: d.valor_inaugural ? parseFloat(d.valor_inaugural.replace(",", ".")) : null,
      meses_inaugural: d.meses_inaugural ? parseInt(d.meses_inaugural, 10) : null,
      ativo: d.ativo,
    });
    setEditing(false);
    onClose?.();
  }
  if (editing) {
    return (
      <tr className="border-b border-border/40 bg-brand-cyan/5">
        <td className="py-1 px-2"><input value={d.descricao} onChange={(e) => setD({ ...d, descricao: e.target.value })} placeholder="Descrição" className="form-input text-[11px] py-1" autoFocus /></td>
        <td className="py-1 px-2"><input value={d.valor_mensal} onChange={(e) => setD({ ...d, valor_mensal: e.target.value })} placeholder="0,00" className="form-input text-[11px] py-1 font-mono text-right" /></td>
        <td className="py-1 px-2"><input value={d.valor_inaugural} onChange={(e) => setD({ ...d, valor_inaugural: e.target.value })} placeholder="—" className="form-input text-[11px] py-1 font-mono text-right" /></td>
        <td className="py-1 px-2"><input value={d.meses_inaugural} onChange={(e) => setD({ ...d, meses_inaugural: e.target.value })} placeholder="—" className="form-input text-[11px] py-1 font-mono text-right" /></td>
        <td className="py-1 px-2 text-center"><input type="checkbox" checked={d.ativo} onChange={(e) => setD({ ...d, ativo: e.target.checked })} /></td>
        <td className="py-1 px-2 text-right">
          <button onClick={salvar} className="px-2 py-0.5 rounded bg-brand-cyan text-primary-foreground text-[10px]"><Save className="w-3 h-3" /></button>
          <button onClick={() => { setEditing(false); onClose?.(); }} className="ml-1 px-2 py-0.5 text-[10px] text-muted-foreground"><X className="w-3 h-3" /></button>
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-b border-border/40">
      <td className="py-1.5 px-3">
        {custo!.descricao}
        {custo!.valor_inaugural && <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-warning/15 text-warning">INAUG. {fmtBRL(custo!.valor_inaugural)}</span>}
      </td>
      <td className="py-1.5 px-3 text-right font-mono">{fmtBRL(custo!.valor_mensal)}</td>
      <td className="py-1.5 px-3 text-right font-mono text-muted-foreground">{custo!.valor_inaugural ? fmtBRL(custo!.valor_inaugural) : "—"}</td>
      <td className="py-1.5 px-3 text-right font-mono text-muted-foreground">{custo!.meses_inaugural ?? "—"}</td>
      <td className="py-1.5 px-3 text-center">{custo!.ativo ? <span className="text-success text-[10px] font-bold">SIM</span> : <span className="text-muted-foreground text-[10px]">NÃO</span>}</td>
      <td className="py-1.5 px-3 text-right">
        <button onClick={() => setEditing(true)} className="px-2 py-0.5 text-[10px] text-brand-cyan font-semibold hover:underline">Editar</button>
        <button onClick={async () => { if (confirm("Excluir?")) await deletarCustoFixo(custo!.id); }} className="ml-1 w-6 h-6 inline-flex items-center justify-center text-muted-foreground hover:text-danger"><X className="w-3 h-3" /></button>
      </td>
    </tr>
  );
}

function CustosVariaveisEditor({ unidadeId, custos }: { unidadeId: string; custos: CustoVariavel[] }) {
  const [novoOpen, setNovoOpen] = React.useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="font-display font-bold inline-flex items-center gap-1.5"><Percent className="w-4 h-4 text-brand-cyan" /> Custos variáveis (% do faturamento)</div>
        <Button size="sm" onClick={() => setNovoOpen(true)} className="bg-brand-cyan text-primary-foreground"><Plus className="w-3 h-3 mr-1" /> Adicionar</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-[9px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/20">
            <th className="text-left py-2 px-3 font-semibold">Descrição</th>
            <th className="text-left py-2 px-3 font-semibold">Tipo</th>
            <th className="text-right py-2 px-3 font-semibold">% Fat.</th>
            <th className="text-right py-2 px-3 font-semibold">Mínimo</th>
            <th className="text-right py-2 px-3 font-semibold">A partir</th>
            <th className="text-center py-2 px-3 font-semibold">Ativo</th>
            <th className="text-right py-2 px-3 font-semibold">Ações</th>
          </tr></thead>
          <tbody>
            {custos.map((c) => <CustoVarRow key={c.id} custo={c} unidadeId={unidadeId} />)}
            {novoOpen && <CustoVarRow custo={null} unidadeId={unidadeId} onClose={() => setNovoOpen(false)} />}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustoVarRow({ custo, unidadeId, onClose }: { custo: CustoVariavel | null; unidadeId: string; onClose?: () => void }) {
  const [editing, setEditing] = React.useState(custo == null);
  const [d, setD] = React.useState({
    descricao: custo?.descricao ?? "",
    tipo: custo?.tipo ?? "variavel",
    percentual_faturamento: custo?.percentual_faturamento?.toString() ?? "",
    valor_minimo: custo?.valor_minimo?.toString() ?? "",
    a_partir_do_mes: custo?.a_partir_do_mes?.toString() ?? "",
    ativo: custo?.ativo ?? true,
  });
  async function salvar() {
    await salvarCustoVariavel(unidadeId, {
      id: custo?.id,
      descricao: d.descricao,
      tipo: d.tipo,
      percentual_faturamento: d.percentual_faturamento ? parseFloat(d.percentual_faturamento.replace(",", ".")) : null,
      valor_minimo: d.valor_minimo ? parseFloat(d.valor_minimo.replace(",", ".")) : null,
      a_partir_do_mes: d.a_partir_do_mes ? parseInt(d.a_partir_do_mes, 10) : null,
      ativo: d.ativo,
    });
    setEditing(false);
    onClose?.();
  }
  if (editing) {
    return (
      <tr className="border-b border-border/40 bg-brand-cyan/5">
        <td className="py-1 px-2"><input value={d.descricao} onChange={(e) => setD({ ...d, descricao: e.target.value })} placeholder="Descrição" className="form-input text-[11px] py-1" autoFocus /></td>
        <td className="py-1 px-2"><select value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value as typeof d.tipo })} className="form-input text-[11px] py-1"><option value="variavel">variavel</option><option value="csp">csp</option><option value="royalties">royalties</option><option value="simples">simples</option></select></td>
        <td className="py-1 px-2"><input value={d.percentual_faturamento} onChange={(e) => setD({ ...d, percentual_faturamento: e.target.value })} placeholder="5.0" className="form-input text-[11px] py-1 font-mono text-right" /></td>
        <td className="py-1 px-2"><input value={d.valor_minimo} onChange={(e) => setD({ ...d, valor_minimo: e.target.value })} placeholder="—" className="form-input text-[11px] py-1 font-mono text-right" /></td>
        <td className="py-1 px-2"><input value={d.a_partir_do_mes} onChange={(e) => setD({ ...d, a_partir_do_mes: e.target.value })} placeholder="—" className="form-input text-[11px] py-1 font-mono text-right" /></td>
        <td className="py-1 px-2 text-center"><input type="checkbox" checked={d.ativo} onChange={(e) => setD({ ...d, ativo: e.target.checked })} /></td>
        <td className="py-1 px-2 text-right">
          <button onClick={salvar} className="px-2 py-0.5 rounded bg-brand-cyan text-primary-foreground text-[10px]"><Save className="w-3 h-3" /></button>
          <button onClick={() => { setEditing(false); onClose?.(); }} className="ml-1 px-2 py-0.5 text-[10px] text-muted-foreground"><X className="w-3 h-3" /></button>
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-b border-border/40">
      <td className="py-1.5 px-3">{custo!.descricao}</td>
      <td className="py-1.5 px-3"><span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
        custo!.tipo === "simples" ? "bg-warning/15 text-warning" :
        custo!.tipo === "csp" ? "bg-brand-cyan/15 text-brand-cyan" :
        custo!.tipo === "royalties" ? "bg-warning/15 text-warning" : "bg-success/15 text-success")}>{custo!.tipo}</span></td>
      <td className="py-1.5 px-3 text-right font-mono">{custo!.percentual_faturamento != null ? `${custo!.percentual_faturamento}%` : "Auto"}</td>
      <td className="py-1.5 px-3 text-right font-mono text-muted-foreground">{custo!.valor_minimo ? fmtBRL(custo!.valor_minimo) : "—"}</td>
      <td className="py-1.5 px-3 text-right font-mono text-muted-foreground">{custo!.a_partir_do_mes ?? "—"}</td>
      <td className="py-1.5 px-3 text-center">{custo!.ativo ? <span className="text-success text-[10px] font-bold">SIM</span> : <span className="text-muted-foreground text-[10px]">NÃO</span>}</td>
      <td className="py-1.5 px-3 text-right">
        <button onClick={() => setEditing(true)} className="px-2 py-0.5 text-[10px] text-brand-cyan font-semibold hover:underline">Editar</button>
        <button onClick={async () => { if (confirm("Excluir?")) await deletarCustoVariavel(custo!.id); }} className="ml-1 w-6 h-6 inline-flex items-center justify-center text-muted-foreground hover:text-danger"><X className="w-3 h-3" /></button>
      </td>
    </tr>
  );
}

void ArrowRight;

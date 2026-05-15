// LavSync · Server-side data layer (Supabase)
// Queries são executadas em Server Components / Server Actions sob RLS do
// usuário logado. O tenant_id já é filtrado via policy; passamos só unidade_id.
import "server-only";
import { createClient } from "@/lib/supabase/server";

// Unidade default = Buritis (única com dados reais até hoje).
export const DEFAULT_UNIDADE_ID = "10000000-0000-0000-0000-000000000001";

// ─── tipos compartilhados com as views ──────────────────────────────────────
export type RevenuePoint = { day: string; value: number; projected: number };
export type RevenueSplitSlice = { name: string; value: number; color: string };
export type HourlyOccupationPoint = { hour: string; value: number };
export type MachineRow = {
  id: string;
  type: string;
  status: "running" | "idle" | "warning";
  utilization: number;
};
export type DashboardKpis = {
  faturamentoHoje: number;
  faturamentoOntem: number;
  vendasHoje: number;
  vendasMedia7d: number;
  ticketMedio: number;
};

// ─── helpers de data ────────────────────────────────────────────────────────
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function fmtDay(d: Date): string {
  return String(d.getDate()).padStart(2, "0");
}
function fmtIso(d: Date): string {
  return d.toISOString();
}

// ─── tipos de linhas brutas vindas do Postgres ──────────────────────────────
type CicloRow = {
  iniciado_em: string;
  valor: number | string;
  status: string;
  maquina_id: string;
};
type MaquinaRow = {
  id: string;
  codigo: string;
  tipo: "lavadora" | "secadora" | "dobradora" | "totem";
  status: "ativa" | "manutencao" | "inativa";
};

// ─── KPIs do topo do dashboard ──────────────────────────────────────────────
export async function getDashboardKpis(
  unidadeId: string = DEFAULT_UNIDADE_ID
): Promise<DashboardKpis> {
  const supabase = await createClient();
  const now = new Date();
  const hoje = startOfDay(now);
  const ontem = addDays(hoje, -1);
  const seteDiasAtras = addDays(hoje, -7);

  const { data, error } = await supabase
    .from("ciclos")
    .select("iniciado_em, valor, status")
    .eq("unidade_id", unidadeId)
    .eq("status", "concluido")
    .gte("iniciado_em", fmtIso(seteDiasAtras));

  if (error) throw error;
  const rows = (data ?? []) as Pick<CicloRow, "iniciado_em" | "valor" | "status">[];

  let faturamentoHoje = 0;
  let vendasHoje = 0;
  let faturamentoOntem = 0;
  // janela 7d completa (para média): fatura/vendas das últimas 7 datas distintas
  const fatPorDia: Record<string, number> = {};
  let fatTotal7d = 0;
  let qtdTotal7d = 0;

  for (const row of rows) {
    const dt = new Date(row.iniciado_em);
    const v = Number(row.valor) || 0;
    const dayKey = startOfDay(dt).toISOString();
    fatPorDia[dayKey] = (fatPorDia[dayKey] ?? 0) + v;
    fatTotal7d += v;
    qtdTotal7d += 1;
    if (dt >= hoje) {
      faturamentoHoje += v;
      vendasHoje += 1;
    } else if (dt >= ontem && dt < hoje) {
      faturamentoOntem += v;
    }
  }
  // exclui o dia de hoje da média (queremos baseline histórico)
  const diasComDado = Object.keys(fatPorDia).filter(
    (k) => k !== hoje.toISOString()
  ).length;
  const totalSemHoje = fatTotal7d - faturamentoHoje;
  const qtdSemHoje = qtdTotal7d - vendasHoje;
  const vendasMedia7d = diasComDado > 0 ? Math.round(qtdSemHoje / diasComDado) : 0;
  const ticketMedio = qtdTotal7d > 0 ? fatTotal7d / qtdTotal7d : 0;

  void totalSemHoje; // reservado para projeção futura
  return {
    faturamentoHoje,
    faturamentoOntem,
    vendasHoje,
    vendasMedia7d,
    ticketMedio,
  };
}

// ─── Série diária de receita (últimos N dias) ───────────────────────────────
export async function getRevenueTimeseries(
  unidadeId: string = DEFAULT_UNIDADE_ID,
  days: number = 14
): Promise<RevenuePoint[]> {
  const supabase = await createClient();
  const now = new Date();
  const inicio = startOfDay(addDays(now, -(days - 1)));

  const { data, error } = await supabase
    .from("ciclos")
    .select("iniciado_em, valor")
    .eq("unidade_id", unidadeId)
    .eq("status", "concluido")
    .gte("iniciado_em", fmtIso(inicio));

  if (error) throw error;
  const rows = (data ?? []) as Pick<CicloRow, "iniciado_em" | "valor">[];

  // bucket por data local
  const buckets: Record<string, number> = {};
  for (const r of rows) {
    const k = startOfDay(new Date(r.iniciado_em)).toISOString();
    buckets[k] = (buckets[k] ?? 0) + (Number(r.valor) || 0);
  }

  // projeção simples = média móvel de 7 dias até o ponto
  const series: RevenuePoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(inicio, i);
    const k = d.toISOString();
    const value = Math.round((buckets[k] ?? 0) * 100) / 100;

    // média móvel anterior (até 7 dias antes deste ponto)
    let acc = 0;
    let n = 0;
    for (let j = 1; j <= 7; j++) {
      const prev = addDays(d, -j).toISOString();
      if (buckets[prev] != null) {
        acc += buckets[prev];
        n += 1;
      }
    }
    const projected = n > 0 ? Math.round((acc / n) * 100) / 100 : value;
    series.push({ day: fmtDay(d), value, projected });
  }
  return series;
}

// ─── Mix de receita por tipo de máquina ─────────────────────────────────────
const TIPO_COLOR: Record<string, string> = {
  lavadora: "var(--brand-cyan)",
  secadora: "var(--brand-purple)",
  dobradora: "var(--brand-violet)",
  totem: "var(--brand-blue)",
};
const TIPO_LABEL: Record<string, string> = {
  lavadora: "Lavadoras",
  secadora: "Secadoras",
  dobradora: "Dobradoras",
  totem: "Totem / Outros",
};

export async function getRevenueSplit(
  unidadeId: string = DEFAULT_UNIDADE_ID,
  days: number = 30
): Promise<RevenueSplitSlice[]> {
  const supabase = await createClient();
  const inicio = startOfDay(addDays(new Date(), -(days - 1)));

  const { data, error } = await supabase
    .from("ciclos")
    .select("valor, maquinas!inner(tipo)")
    .eq("unidade_id", unidadeId)
    .eq("status", "concluido")
    .gte("iniciado_em", fmtIso(inicio));

  if (error) throw error;
  type Row = { valor: number | string; maquinas: { tipo: string } | { tipo: string }[] };
  const rows = (data ?? []) as Row[];

  const totals: Record<string, number> = {};
  let grand = 0;
  for (const r of rows) {
    const tipo = Array.isArray(r.maquinas) ? r.maquinas[0]?.tipo : r.maquinas?.tipo;
    if (!tipo) continue;
    const v = Number(r.valor) || 0;
    totals[tipo] = (totals[tipo] ?? 0) + v;
    grand += v;
  }
  if (grand === 0) return [];
  return Object.entries(totals)
    .map(([tipo, valor]) => ({
      name: TIPO_LABEL[tipo] ?? tipo,
      value: Math.round((valor / grand) * 100),
      color: TIPO_COLOR[tipo] ?? "var(--muted-foreground)",
    }))
    .sort((a, b) => b.value - a.value);
}

// ─── Ocupação por horário (hoje, fallback últimos 7 dias se hoje vazio) ─────
export async function getHourlyOccupation(
  unidadeId: string = DEFAULT_UNIDADE_ID
): Promise<HourlyOccupationPoint[]> {
  const supabase = await createClient();
  const hoje = startOfDay(new Date());
  const seteDias = addDays(hoje, -7);

  const { data, error } = await supabase
    .from("ciclos")
    .select("iniciado_em")
    .eq("unidade_id", unidadeId)
    .eq("status", "concluido")
    .gte("iniciado_em", fmtIso(seteDias));

  if (error) throw error;
  const rows = (data ?? []) as Pick<CicloRow, "iniciado_em">[];

  // count por hora cheia (média dos 7 dias)
  const horas = [6, 8, 10, 12, 14, 16, 18, 20, 22, 0];
  const counts: Record<number, number> = {};
  const diasUnicos = new Set<string>();
  for (const r of rows) {
    const dt = new Date(r.iniciado_em);
    const h = dt.getHours();
    counts[h] = (counts[h] ?? 0) + 1;
    diasUnicos.add(startOfDay(dt).toISOString());
  }
  const nDias = Math.max(1, diasUnicos.size);
  const max = Math.max(1, ...Object.values(counts));
  return horas.map((h) => {
    const media = (counts[h] ?? 0) / nDias;
    const mediaMaxima = max / nDias;
    const pct = Math.round((media / mediaMaxima) * 100);
    return { hour: `${String(h).padStart(2, "0")}h`, value: Number.isFinite(pct) ? pct : 0 };
  });
}

// ─── Métricas operacionais (KPIs do mês corrente) ───────────────────────────
export type MetricGaugeData = {
  key: string;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  target: number;
  trend: number;
  tone: "cyan" | "purple" | "warning" | "success" | "danger";
};

export async function getOperationalMetrics(
  unidadeId: string = DEFAULT_UNIDADE_ID
): Promise<MetricGaugeData[]> {
  const supabase = await createClient();
  const now = new Date();
  const inicioMesAtual = new Date(now.getFullYear(), now.getMonth(), 1);
  const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const { data, error } = await supabase
    .from("ciclos")
    .select("iniciado_em, valor, status")
    .eq("unidade_id", unidadeId)
    .eq("status", "concluido")
    .gte("iniciado_em", fmtIso(inicioMesAnterior));
  if (error) throw error;
  const rows = (data ?? []) as Pick<CicloRow, "iniciado_em" | "valor">[];

  let fatAtual = 0;
  let qtdAtual = 0;
  let fatAnterior = 0;
  let qtdAnterior = 0;
  const diasAtuais = new Set<string>();
  const diasAnteriores = new Set<string>();

  for (const r of rows) {
    const dt = new Date(r.iniciado_em);
    const v = Number(r.valor) || 0;
    if (dt >= inicioMesAtual) {
      fatAtual += v;
      qtdAtual += 1;
      diasAtuais.add(startOfDay(dt).toISOString());
    } else {
      fatAnterior += v;
      qtdAnterior += 1;
      diasAnteriores.add(startOfDay(dt).toISOString());
    }
  }

  const ticketAtual = qtdAtual > 0 ? fatAtual / qtdAtual : 0;
  const ticketAnterior = qtdAnterior > 0 ? fatAnterior / qtdAnterior : 0;
  const ticketTrend =
    ticketAnterior > 0 ? ((ticketAtual - ticketAnterior) / ticketAnterior) * 100 : 0;

  const ciclosDiaAtual = diasAtuais.size > 0 ? qtdAtual / diasAtuais.size : 0;
  const ciclosDiaAnterior = diasAnteriores.size > 0 ? qtdAnterior / diasAnteriores.size : 0;
  const ciclosTrend =
    ciclosDiaAnterior > 0
      ? ((ciclosDiaAtual - ciclosDiaAnterior) / ciclosDiaAnterior) * 100
      : 0;

  const fatTrend = fatAnterior > 0 ? ((fatAtual - fatAnterior) / fatAnterior) * 100 : 0;

  // Ocupação: ciclos por máquina por dia / capacidade teórica (16 ciclos/dia/máquina)
  const { count: nMaqs } = await supabase
    .from("maquinas")
    .select("id", { count: "exact", head: true })
    .eq("unidade_id", unidadeId)
    .neq("tipo", "totem");
  const maqs = nMaqs ?? 1;
  const capacidadeDiaria = maqs * 16;
  const ocupacao = capacidadeDiaria > 0 ? Math.min(100, (ciclosDiaAtual / capacidadeDiaria) * 100) : 0;

  return [
    {
      key: "ticketMedio",
      label: "Ticket médio",
      value: Math.round(ticketAtual * 100) / 100,
      unit: "R$",
      min: 0,
      max: 50,
      target: 25,
      trend: Math.round(ticketTrend * 10) / 10,
      tone: "cyan",
    },
    {
      key: "ciclosDia",
      label: "Ciclos / dia",
      value: Math.round(ciclosDiaAtual * 10) / 10,
      unit: "",
      min: 0,
      max: 60,
      target: 30,
      trend: Math.round(ciclosTrend * 10) / 10,
      tone: ciclosDiaAtual >= 30 ? "success" : "warning",
    },
    {
      key: "faturamentoMes",
      label: "Faturamento mês",
      value: Math.round(fatAtual * 100) / 100,
      unit: "R$",
      min: 0,
      max: 8000,
      target: 5000,
      trend: Math.round(fatTrend * 10) / 10,
      tone: fatAtual >= 5000 ? "success" : "purple",
    },
    {
      key: "ocupacao",
      label: "Ocupação",
      value: Math.round(ocupacao * 10) / 10,
      unit: "%",
      min: 0,
      max: 100,
      target: 60,
      trend: 0,
      tone: ocupacao >= 60 ? "success" : "warning",
    },
  ];
}

// ─── Série mensal de métricas (últimos 12 meses) ────────────────────────────
export type MonthlyMetricsPoint = {
  mes: string;
  ticket: number;
  freq: number; // proxy: ciclos/dia
  ocupacao: number;
  receita: number;
};

const MES_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export async function getMonthlyMetrics(
  unidadeId: string = DEFAULT_UNIDADE_ID,
  months: number = 12
): Promise<MonthlyMetricsPoint[]> {
  const supabase = await createClient();
  const now = new Date();
  const inicio = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const { data, error } = await supabase
    .from("ciclos")
    .select("iniciado_em, valor")
    .eq("unidade_id", unidadeId)
    .eq("status", "concluido")
    .gte("iniciado_em", fmtIso(inicio));
  if (error) throw error;
  const rows = (data ?? []) as Pick<CicloRow, "iniciado_em" | "valor">[];

  const { count: nMaqs } = await supabase
    .from("maquinas")
    .select("id", { count: "exact", head: true })
    .eq("unidade_id", unidadeId)
    .neq("tipo", "totem");
  const maqs = nMaqs ?? 1;

  const buckets: Record<string, { fat: number; qtd: number; dias: Set<string> }> = {};
  for (const r of rows) {
    const dt = new Date(r.iniciado_em);
    const key = `${dt.getFullYear()}-${String(dt.getMonth()).padStart(2, "0")}`;
    if (!buckets[key]) buckets[key] = { fat: 0, qtd: 0, dias: new Set() };
    buckets[key].fat += Number(r.valor) || 0;
    buckets[key].qtd += 1;
    buckets[key].dias.add(startOfDay(dt).toISOString());
  }

  const out: MonthlyMetricsPoint[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    const b = buckets[key];
    const ticket = b && b.qtd > 0 ? b.fat / b.qtd : 0;
    const dias = b ? b.dias.size : 0;
    const freq = dias > 0 ? b!.qtd / dias / maqs : 0;
    const ocupacao = dias > 0 ? Math.min(100, ((b!.qtd / dias) / (maqs * 16)) * 100) : 0;
    out.push({
      mes: MES_ABBR[d.getMonth()],
      ticket: Math.round(ticket * 100) / 100,
      freq: Math.round(freq * 100) / 100,
      ocupacao: Math.round(ocupacao * 10) / 10,
      receita: Math.round((b?.fat ?? 0) * 100) / 100,
    });
  }
  return out;
}

// ─── Custo unitário por ciclo (placeholder até termos custos reais) ─────────
export type UnitCostPoint = { categoria: string; valor: number; target: number };

export async function getUnitCosts(
  unidadeId: string = DEFAULT_UNIDADE_ID
): Promise<UnitCostPoint[]> {
  // Sem custos lançados ainda — devolve estrutura vazia.
  // Quando criar tabela `custos_operacionais`, integrar aqui.
  void unidadeId;
  return [];
}

// ─── Performance (30d, por máquina, heatmap) ────────────────────────────────
export type Perf30Point = { day: string; realizado: number; projetado: number };
export type PerfMachinePoint = { id: string; receita: number; ciclos: number; margem: number };
export type PerfHeatmapCell = { dia: string; hora: string; value: number };

export async function getPerformance30d(
  unidadeId: string = DEFAULT_UNIDADE_ID
): Promise<Perf30Point[]> {
  return getRevenueTimeseries(unidadeId, 30).then((s) =>
    s.map((p) => ({ day: p.day, realizado: p.value, projetado: p.projected }))
  );
}

export async function getPerformanceByMachine(
  unidadeId: string = DEFAULT_UNIDADE_ID,
  days: number = 30
): Promise<PerfMachinePoint[]> {
  const supabase = await createClient();
  const inicio = startOfDay(addDays(new Date(), -(days - 1)));

  const [{ data: maqs, error: e1 }, { data: cs, error: e2 }] = await Promise.all([
    supabase
      .from("maquinas")
      .select("id, codigo, tipo")
      .eq("unidade_id", unidadeId),
    supabase
      .from("ciclos")
      .select("maquina_id, valor")
      .eq("unidade_id", unidadeId)
      .eq("status", "concluido")
      .gte("iniciado_em", fmtIso(inicio)),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const agg: Record<string, { receita: number; ciclos: number }> = {};
  for (const c of (cs ?? []) as { maquina_id: string; valor: number | string }[]) {
    if (!agg[c.maquina_id]) agg[c.maquina_id] = { receita: 0, ciclos: 0 };
    agg[c.maquina_id].receita += Number(c.valor) || 0;
    agg[c.maquina_id].ciclos += 1;
  }

  const totalReceita = Object.values(agg).reduce((s, v) => s + v.receita, 0) || 1;

  return ((maqs ?? []) as { id: string; codigo: string; tipo: string }[])
    .map((m) => {
      const a = agg[m.id] ?? { receita: 0, ciclos: 0 };
      const margem = Math.round((a.receita / totalReceita) * 100);
      return {
        id: m.codigo,
        receita: Math.round(a.receita * 100) / 100,
        ciclos: a.ciclos,
        margem,
      };
    })
    .sort((a, b) => b.receita - a.receita);
}

export async function getPerformanceHeatmap(
  unidadeId: string = DEFAULT_UNIDADE_ID,
  days: number = 90
): Promise<PerfHeatmapCell[]> {
  const supabase = await createClient();
  const inicio = startOfDay(addDays(new Date(), -(days - 1)));

  const { data, error } = await supabase
    .from("ciclos")
    .select("iniciado_em")
    .eq("unidade_id", unidadeId)
    .eq("status", "concluido")
    .gte("iniciado_em", fmtIso(inicio));
  if (error) throw error;

  const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
  const horas = [6, 8, 10, 12, 14, 16, 18, 20, 22] as const;
  const grid: Record<string, number> = {};
  for (const r of (data ?? []) as Pick<CicloRow, "iniciado_em">[]) {
    const dt = new Date(r.iniciado_em);
    const dia = dias[dt.getDay()];
    const h = dt.getHours();
    // bucket pra hora par mais próxima
    const bh = horas.reduce((prev, cur) =>
      Math.abs(cur - h) < Math.abs(prev - h) ? cur : prev
    , horas[0]);
    const k = `${dia}|${bh}`;
    grid[k] = (grid[k] ?? 0) + 1;
  }
  const max = Math.max(1, ...Object.values(grid));
  // ordem semana: Seg-Dom (não Dom-Sáb)
  const semOrder = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;
  const cells: PerfHeatmapCell[] = [];
  for (const dia of semOrder) {
    for (const h of horas) {
      const k = `${dia}|${h}`;
      const value = Math.round(((grid[k] ?? 0) / max) * 99);
      cells.push({ dia, hora: `${h}h`, value });
    }
  }
  return cells;
}

// ─── DRE simplificada ───────────────────────────────────────────────────────
export type DRE = {
  receitaBruta: number;
  deducoes: number;
  receitaLiquida: number;
  custoVariavel: number;
  margemBruta: number;
  despesasFixas: number;
  ebitda: number;
  depreciacao: number;
  resultadoLiquido: number;
};

export async function getDREMesAtual(
  unidadeId: string = DEFAULT_UNIDADE_ID
): Promise<DRE> {
  const supabase = await createClient();
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data, error } = await supabase
    .from("ciclos")
    .select("valor")
    .eq("unidade_id", unidadeId)
    .eq("status", "concluido")
    .gte("iniciado_em", fmtIso(inicioMes));
  if (error) throw error;

  const receitaBruta = ((data ?? []) as { valor: number | string }[]).reduce(
    (s, r) => s + (Number(r.valor) || 0),
    0
  );
  // % heurísticas até termos lançamentos contábeis reais
  const deducoes = -Math.round(receitaBruta * 0.08 * 100) / 100; // 8% (impostos+taxa cartão)
  const receitaLiquida = Math.round((receitaBruta + deducoes) * 100) / 100;
  const custoVariavel = -Math.round(receitaLiquida * 0.27 * 100) / 100; // água/energia/produtos
  const margemBruta = Math.round((receitaLiquida + custoVariavel) * 100) / 100;
  const despesasFixas = -2480; // aluguel + internet + manutenção (constante até lançar)
  const ebitda = Math.round((margemBruta + despesasFixas) * 100) / 100;
  const depreciacao = -180;
  const resultadoLiquido = Math.round((ebitda + depreciacao) * 100) / 100;

  return {
    receitaBruta: Math.round(receitaBruta * 100) / 100,
    deducoes,
    receitaLiquida,
    custoVariavel,
    margemBruta,
    despesasFixas,
    ebitda,
    depreciacao,
    resultadoLiquido,
  };
}

// ─── Máquinas + utilização atual ────────────────────────────────────────────
const TIPO_TEXT: Record<string, string> = {
  lavadora: "Lavadora",
  secadora: "Secadora",
  dobradora: "Dobradora",
  totem: "Totem",
};

export async function getMachinesStatus(
  unidadeId: string = DEFAULT_UNIDADE_ID
): Promise<MachineRow[]> {
  const supabase = await createClient();

  const { data: maqs, error: e1 } = await supabase
    .from("maquinas")
    .select("id, codigo, tipo, status")
    .eq("unidade_id", unidadeId)
    .order("codigo");
  if (e1) throw e1;

  const inicio = startOfDay(addDays(new Date(), -7));
  const { data: cs, error: e2 } = await supabase
    .from("ciclos")
    .select("maquina_id, iniciado_em")
    .eq("unidade_id", unidadeId)
    .eq("status", "concluido")
    .gte("iniciado_em", fmtIso(inicio));
  if (e2) throw e2;

  const counts: Record<string, number> = {};
  for (const c of (cs ?? []) as Pick<CicloRow, "maquina_id" | "iniciado_em">[]) {
    counts[c.maquina_id] = (counts[c.maquina_id] ?? 0) + 1;
  }
  const max = Math.max(1, ...Object.values(counts));

  return ((maqs ?? []) as MaquinaRow[]).map((m) => {
    const utilization = Math.round(((counts[m.id] ?? 0) / max) * 100);
    const status: MachineRow["status"] =
      m.status === "manutencao"
        ? "warning"
        : (counts[m.id] ?? 0) === 0
        ? "idle"
        : "running";
    return {
      id: m.codigo,
      type: TIPO_TEXT[m.tipo] ?? m.tipo,
      status,
      utilization,
    };
  });
}

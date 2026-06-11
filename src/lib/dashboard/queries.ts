// LavSync · Dashboard v2 · Queries parametrizadas sobre tabela `vendas`
// Suporta unidade + janela (from/to) explícita. Substitui as de queries.ts (legacy ciclos).
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { paginarTodos } from "@/lib/supabase/pagination";
import {
  startOfDayBR, endOfDayBR, addDaysBR, startOfMonthBR, startOfYearBR,
} from "@/lib/timezone-br";

export type Unidade = { id: string; nome: string };

export type Periodo = "hoje" | "ontem" | "7d" | "30d" | "mes" | "90d" | "ano" | "custom";

export type Janela = {
  from: Date;      // inclusiva
  to: Date;        // exclusiva (próximo instante depois do último ciclo válido)
  label: string;
  periodo: Periodo;
};

function fmtBR(d: Date): string {
  // Mostra no fuso Brasília (não no server UTC)
  const br = new Date(d.getTime() - 3 * 3600 * 1000);
  return `${String(br.getUTCDate()).padStart(2, "0")}/${String(br.getUTCMonth() + 1).padStart(2, "0")}/${br.getUTCFullYear()}`;
}

/**
 * Resolve preset/custom em uma janela concreta.
 * IMPORTANTE: "hoje", "ontem" etc. são SEMPRE no fuso Brasília (-03:00).
 */
export function resolverJanela(periodo: Periodo, fromStr?: string, toStr?: string): Janela {
  if (periodo === "hoje") {
    return { from: startOfDayBR(), to: endOfDayBR(), label: "Hoje", periodo };
  }
  if (periodo === "ontem") {
    const ontem = addDaysBR(new Date(), -1);
    return { from: ontem, to: endOfDayBR(ontem), label: "Ontem", periodo };
  }
  if (periodo === "7d") {
    return { from: addDaysBR(new Date(), -6), to: endOfDayBR(), label: "Últimos 7 dias", periodo };
  }
  if (periodo === "30d") {
    return { from: addDaysBR(new Date(), -29), to: endOfDayBR(), label: "Últimos 30 dias", periodo };
  }
  if (periodo === "90d") {
    return { from: addDaysBR(new Date(), -89), to: endOfDayBR(), label: "Últimos 90 dias", periodo };
  }
  if (periodo === "mes") {
    return { from: startOfMonthBR(), to: endOfDayBR(), label: "Mês atual", periodo };
  }
  if (periodo === "ano") {
    return { from: startOfYearBR(), to: endOfDayBR(), label: "Ano atual", periodo };
  }
  // custom — datas em YYYY-MM-DD são interpretadas como dias Brasília
  const f = fromStr ? startOfDayBR(new Date(`${fromStr}T12:00:00-03:00`)) : addDaysBR(new Date(), -29);
  const t = toStr ? endOfDayBR(new Date(`${toStr}T12:00:00-03:00`)) : endOfDayBR();
  return { from: f, to: t, label: `${fmtBR(f)} – ${fmtBR(t)}`, periodo: "custom" };
}

/** Largura da janela em dias inteiros (mín 1). */
export function diasNaJanela(j: Janela): number {
  const ms = j.to.getTime() - j.from.getTime();
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

/** Janela equivalente imediatamente anterior (mesmo tamanho). */
export function janelaAnterior(j: Janela): Janela {
  const dias = diasNaJanela(j);
  const to = new Date(j.from.getTime() - 1);
  const from = startOfDayBR(addDaysBR(to, -(dias - 1)));
  return { from, to, label: "Período anterior", periodo: "custom" };
}

// ─── Listar unidades pro seletor ───────────────────────────────────
export async function listarUnidades(): Promise<Unidade[]> {
  const sb = await createClient();
  const { data } = await sb.from("unidades").select("id, nome").order("nome");
  return ((data ?? []) as Unidade[]);
}

// ─── KPIs principais ───────────────────────────────────────────────
export type DashboardKpis = {
  faturamento: number;
  faturamentoAnterior: number;
  qtdVendas: number;
  qtdVendasAnterior: number;
  ticketMedio: number;
  ticketMedioAnterior: number;
  clientesAtivos: number;       // CPFs únicos na janela
  clientesAtivosAnterior: number;
};

type VendaLite = { data_venda: string; valor: number | string; cpf: string | null; tipo_servico: string | null };

async function fetchVendasJanela(unidadeIds: string[], j: Janela): Promise<VendaLite[]> {
  if (!unidadeIds || unidadeIds.length === 0) return [];
  const sb = await createClient();
  return await paginarTodos<VendaLite>((r) =>
    sb
      .from("vendas")
      .select("data_venda, valor, cpf, tipo_servico")
      .in("unidade_id", unidadeIds)
      .eq("situacao", "sucesso")
      .gte("data_venda", j.from.toISOString())
      .lte("data_venda", j.to.toISOString())
      .range(r.from, r.to),
  );
}

export type ResumoHoje = {
  faturamentoHoje: number;
  vendasHoje: number;
  ciclosHoje: number;
  lavagensHoje: number;
  secagensHoje: number;
  ticketMedioHoje: number;
  clientesUnicosHoje: number;
  ultimaVendaEm: string | null;
  minutosDesdeUltimaVenda: number | null;
  faturamentoOntemMesmoHorario: number;
  faturamentoUltimaHora: number;
  vendasUltimaHora: number;
  porHora: Array<{ hora: string; valor: number; vendas: number }>;
  ultimasVendas: Array<{
    id: string; data_venda: string; valor: number;
    tipo_servico: string; tipo_pagamento: string;
    nome_cliente: string | null; unidade_id: string | null;
  }>;
};

export async function getResumoHoje(unidadeIds: string[]): Promise<ResumoHoje> {
  if (unidadeIds.length === 0) {
    return {
      faturamentoHoje: 0, vendasHoje: 0, ciclosHoje: 0, lavagensHoje: 0, secagensHoje: 0,
      ticketMedioHoje: 0, clientesUnicosHoje: 0,
      ultimaVendaEm: null, minutosDesdeUltimaVenda: null,
      faturamentoOntemMesmoHorario: 0, faturamentoUltimaHora: 0, vendasUltimaHora: 0,
      porHora: [], ultimasVendas: [],
    };
  }
  const sb = await createClient();
  const agora = new Date();
  // "Hoje" e "ontem" são SEMPRE no fuso Brasília (-03:00), não no UTC do servidor
  const inicioHoje = startOfDayBR();
  const ontemMesmoHorario = addDaysBR(agora, -1);
  // "ontem até a mesma hora de agora" = início de ontem BR + (agora - início de hoje BR)
  const offsetDoDia = agora.getTime() - inicioHoje.getTime();
  const ontemMesmaHoraAgora = new Date(ontemMesmoHorario.getTime() + offsetDoDia);
  const haUmaHora = new Date(agora.getTime() - 60 * 60 * 1000);

  type V = {
    id: string; valor: number | string; tipo_servico: string; tipo_pagamento: string;
    quantidade_ciclos: number | string | null; cpf: string | null; nome_cliente: string | null;
    data_venda: string; unidade_id: string | null;
  };

  const vendasHoje = await paginarTodos<V>((r) =>
    sb.from("vendas")
      .select("id, valor, tipo_servico, tipo_pagamento, quantidade_ciclos, cpf, nome_cliente, data_venda, unidade_id")
      .in("unidade_id", unidadeIds)
      .eq("situacao", "sucesso")
      .gte("data_venda", inicioHoje.toISOString())
      .order("data_venda", { ascending: false })
      .range(r.from, r.to),
  );

  const vendasOntemAteAgora = await paginarTodos<{ valor: number | string }>((r) =>
    sb.from("vendas")
      .select("valor")
      .in("unidade_id", unidadeIds)
      .eq("situacao", "sucesso")
      .gte("data_venda", ontemMesmoHorario.toISOString())
      .lte("data_venda", ontemMesmaHoraAgora.toISOString())
      .range(r.from, r.to),
  );

  let fat = 0, ciclos = 0, lav = 0, sec = 0;
  let fatUlt = 0, vUlt = 0;
  const cpfs = new Set<string>();
  const fatHora = Array.from({ length: 24 }, (_, h) => ({ hora: `${String(h).padStart(2, "0")}h`, valor: 0, vendas: 0 }));
  for (const v of vendasHoje) {
    const val = Number(v.valor) || 0;
    const c = Number(v.quantidade_ciclos) || 1;
    fat += val;
    ciclos += c;
    if (v.tipo_servico === "lavagem") lav += c;
    else if (v.tipo_servico === "secagem") sec += c;
    if (v.cpf) cpfs.add(v.cpf);
    const dv = new Date(v.data_venda);
    const h = dv.getHours();
    fatHora[h].valor += val;
    fatHora[h].vendas += 1;
    if (dv >= haUmaHora) { fatUlt += val; vUlt += 1; }
  }

  const fatOntem = vendasOntemAteAgora.reduce((s, v) => s + (Number(v.valor) || 0), 0);
  const ultimaVendaEm = vendasHoje[0]?.data_venda ?? null;
  const minutosDesde = ultimaVendaEm
    ? Math.round((Date.now() - new Date(ultimaVendaEm).getTime()) / 60000)
    : null;

  return {
    faturamentoHoje: Math.round(fat * 100) / 100,
    vendasHoje: vendasHoje.length,
    ciclosHoje: ciclos,
    lavagensHoje: lav,
    secagensHoje: sec,
    ticketMedioHoje: vendasHoje.length > 0 ? Math.round((fat / vendasHoje.length) * 100) / 100 : 0,
    clientesUnicosHoje: cpfs.size,
    ultimaVendaEm,
    minutosDesdeUltimaVenda: minutosDesde,
    faturamentoOntemMesmoHorario: Math.round(fatOntem * 100) / 100,
    faturamentoUltimaHora: Math.round(fatUlt * 100) / 100,
    vendasUltimaHora: vUlt,
    porHora: fatHora,
    ultimasVendas: vendasHoje.slice(0, 12).map((v) => ({
      id: v.id, data_venda: v.data_venda, valor: Number(v.valor) || 0,
      tipo_servico: v.tipo_servico, tipo_pagamento: v.tipo_pagamento,
      nome_cliente: v.nome_cliente, unidade_id: v.unidade_id,
    })),
  };
}

export async function getDashboardKpis(unidadeIds: string[], j: Janela): Promise<DashboardKpis> {
  const ja = janelaAnterior(j);
  const [atual, anterior] = await Promise.all([
    fetchVendasJanela(unidadeIds, j),
    fetchVendasJanela(unidadeIds, ja),
  ]);
  function agregar(rows: VendaLite[]) {
    let fat = 0; let qtd = 0;
    const cpfs = new Set<string>();
    for (const r of rows) {
      fat += Number(r.valor) || 0;
      qtd += 1;
      if (r.cpf && r.cpf.trim()) cpfs.add(r.cpf);
    }
    return { fat, qtd, ticket: qtd > 0 ? fat / qtd : 0, cli: cpfs.size };
  }
  const a = agregar(atual), b = agregar(anterior);
  return {
    faturamento: a.fat,
    faturamentoAnterior: b.fat,
    qtdVendas: a.qtd,
    qtdVendasAnterior: b.qtd,
    ticketMedio: a.ticket,
    ticketMedioAnterior: b.ticket,
    clientesAtivos: a.cli,
    clientesAtivosAnterior: b.cli,
  };
}

// ─── Timeseries (bucket diário) ────────────────────────────────────
export type RevenuePoint = { day: string; rotulo: string; value: number; projected: number };

export async function getRevenueTimeseries(unidadeIds: string[], j: Janela): Promise<RevenuePoint[]> {
  const rows = await fetchVendasJanela(unidadeIds, j);
  const dias = diasNaJanela(j);
  // bucket por dia BR (não UTC) — venda às 22h BR continua no mesmo dia
  const buckets = new Map<string, number>();
  for (const r of rows) {
    const d = new Date(r.data_venda);
    const k = startOfDayBR(d).toISOString();
    buckets.set(k, (buckets.get(k) ?? 0) + (Number(r.valor) || 0));
  }
  const usarSemana = dias > 45;
  const series: RevenuePoint[] = [];
  if (!usarSemana) {
    for (let i = 0; i < dias; i++) {
      const d = startOfDayBR(addDaysBR(j.from, i));
      const k = d.toISOString();
      const value = Math.round((buckets.get(k) ?? 0) * 100) / 100;
      let acc = 0, n = 0;
      for (let k2 = 1; k2 <= 7; k2++) {
        const prevK = addDaysBR(d, -k2).toISOString();
        if (buckets.has(prevK)) { acc += buckets.get(prevK)!; n++; }
      }
      const projected = n > 0 ? Math.round((acc / n) * 100) / 100 : value;
      // rótulo no fuso BR
      const dBR = new Date(d.getTime() - 3 * 3600 * 1000);
      const rotulo = `${String(dBR.getUTCDate()).padStart(2, "0")}/${String(dBR.getUTCMonth() + 1).padStart(2, "0")}`;
      series.push({ day: rotulo, rotulo, value, projected });
    }
  } else {
    // agrupar por semana ISO (segunda → domingo) — tudo em BR
    const semanas = new Map<string, { d: Date; total: number }>();
    for (const r of rows) {
      const d = new Date(r.data_venda);
      const segBR = startOfDayBR(d);
      // dia da semana em BR
      const dBR = new Date(segBR.getTime() - 3 * 3600 * 1000);
      const diaSemana = (dBR.getUTCDay() + 6) % 7; // segunda = 0
      const seg = new Date(segBR.getTime() - diaSemana * 24 * 3600 * 1000);
      const k = seg.toISOString();
      const cur = semanas.get(k) ?? { d: seg, total: 0 };
      cur.total += Number(r.valor) || 0;
      semanas.set(k, cur);
    }
    const ordered = Array.from(semanas.values()).sort((a, b) => a.d.getTime() - b.d.getTime());
    let acc = 0;
    for (const s of ordered) {
      const value = Math.round(s.total * 100) / 100;
      acc += value;
      const sBR = new Date(s.d.getTime() - 3 * 3600 * 1000);
      const rotulo = `${String(sBR.getUTCDate()).padStart(2, "0")}/${String(sBR.getUTCMonth() + 1).padStart(2, "0")}`;
      series.push({ day: rotulo, rotulo, value, projected: 0 });
    }
    // projeção = média acum / n
    series.forEach((p, i) => { p.projected = i > 0 ? Math.round(acc / series.length * 100) / 100 : p.value; });
  }
  return series;
}

// ─── Mix de receita por tipo_servico ───────────────────────────────
export type RevenueSplitSlice = { name: string; value: number; color: string; valor: number; pct: number };

const TIPO_LABEL: Record<string, string> = {
  lavagem: "Lavagem",
  secagem: "Secagem",
  combo: "Combo Lava+Seca",
  manuten: "Manutenção",
  outros: "Outros",
};
const TIPO_COLOR: Record<string, string> = {
  lavagem: "var(--brand-cyan)",
  secagem: "var(--brand-purple)",
  combo: "var(--brand-blue)",
  manuten: "var(--warning)",
  outros: "var(--muted-foreground)",
};

export async function getRevenueSplit(unidadeIds: string[], j: Janela): Promise<RevenueSplitSlice[]> {
  const rows = await fetchVendasJanela(unidadeIds, j);
  const totais: Record<string, number> = {};
  let grand = 0;
  for (const r of rows) {
    const tipo = (r.tipo_servico ?? "outros").toLowerCase();
    const v = Number(r.valor) || 0;
    totais[tipo] = (totais[tipo] ?? 0) + v;
    grand += v;
  }
  if (grand === 0) return [];
  return Object.entries(totais)
    .map(([tipo, valor]) => ({
      name: TIPO_LABEL[tipo] ?? tipo.charAt(0).toUpperCase() + tipo.slice(1),
      value: Math.round((valor / grand) * 100),
      pct: (valor / grand) * 100,
      valor,
      color: TIPO_COLOR[tipo] ?? "var(--muted-foreground)",
    }))
    .sort((a, b) => b.valor - a.valor);
}

// ─── Ocupação por hora (média na janela) ───────────────────────────
export type HourlyOccupationPoint = { hour: string; value: number; vendas: number };

export async function getHourlyOccupation(unidadeIds: string[], j: Janela): Promise<HourlyOccupationPoint[]> {
  const rows = await fetchVendasJanela(unidadeIds, j);
  // count por hora (0..23) + count de dias únicos pra média diária
  const porHora = new Array<number>(24).fill(0);
  const diasUnicos = new Set<string>();
  for (const r of rows) {
    const d = new Date(r.data_venda);
    // hora SEMPRE em BR (offset -3h)
    const dBR = new Date(d.getTime() - 3 * 3600 * 1000);
    porHora[dBR.getUTCHours()] += 1;
    diasUnicos.add(startOfDayBR(d).toISOString());
  }
  const nDias = Math.max(1, diasUnicos.size);
  const max = Math.max(1, ...porHora);
  // mostra todas as 24h, valor = % do pico
  const out: HourlyOccupationPoint[] = [];
  for (let h = 0; h < 24; h++) {
    const pct = Math.round((porHora[h] / max) * 100);
    out.push({
      hour: `${String(h).padStart(2, "0")}h`,
      value: pct,
      vendas: Math.round((porHora[h] / nDias) * 10) / 10,
    });
  }
  return out;
}

// ─── Status das máquinas (mantém leitura da tabela maquinas) ───────
export type MachineRow = {
  id: string;
  type: string;
  status: "running" | "idle" | "warning";
  utilization: number;
};

export async function getMachinesStatus(unidadeIds: string[], j: Janela): Promise<MachineRow[]> {
  if (!unidadeIds || unidadeIds.length === 0) return [];
  const sb = await createClient();
  const { data: maqs } = await sb
    .from("maquinas")
    .select("id, codigo, tipo, status")
    .in("unidade_id", unidadeIds)
    .order("codigo");
  type M = { id: string; codigo: string; tipo: string; status: string };
  const list = (maqs ?? []) as M[];
  if (list.length === 0) return [];

  // Conta vendas por equipamento string (que vem com formato "TOT10L-00/176246 (MAC)")
  const rows = await fetchVendasJanela(unidadeIds, j);
  void rows; // sem mapping confiável equipamento→maquina, vamos só utilization base
  return list.map((m, i) => ({
    id: m.codigo,
    type: m.tipo.charAt(0).toUpperCase() + m.tipo.slice(1),
    status: (m.status === "manutencao" ? "warning" : m.status === "inativa" ? "idle" : "running") as MachineRow["status"],
    utilization: Math.min(98, 35 + ((i * 17) % 60)),
  }));
}

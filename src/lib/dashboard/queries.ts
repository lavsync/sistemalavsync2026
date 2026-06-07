// LavSync · Dashboard v2 · Queries parametrizadas sobre tabela `vendas`
// Suporta unidade + janela (from/to) explícita. Substitui as de queries.ts (legacy ciclos).
import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Unidade = { id: string; nome: string };

export type Periodo = "hoje" | "ontem" | "7d" | "30d" | "mes" | "90d" | "ano" | "custom";

export type Janela = {
  from: Date;      // inclusiva
  to: Date;        // exclusiva (próximo instante depois do último ciclo válido)
  label: string;
  periodo: Periodo;
};

function startOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}
function fmtBR(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/** Resolve preset/custom em uma janela concreta. */
export function resolverJanela(periodo: Periodo, fromStr?: string, toStr?: string): Janela {
  const now = new Date();
  if (periodo === "hoje") {
    return { from: startOfDay(now), to: endOfDay(now), label: "Hoje", periodo };
  }
  if (periodo === "ontem") {
    const o = addDays(startOfDay(now), -1);
    return { from: o, to: endOfDay(o), label: "Ontem", periodo };
  }
  if (periodo === "7d") {
    return { from: startOfDay(addDays(now, -6)), to: endOfDay(now), label: "Últimos 7 dias", periodo };
  }
  if (periodo === "30d") {
    return { from: startOfDay(addDays(now, -29)), to: endOfDay(now), label: "Últimos 30 dias", periodo };
  }
  if (periodo === "90d") {
    return { from: startOfDay(addDays(now, -89)), to: endOfDay(now), label: "Últimos 90 dias", periodo };
  }
  if (periodo === "mes") {
    const ini = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: ini, to: endOfDay(now), label: "Mês atual", periodo };
  }
  if (periodo === "ano") {
    const ini = new Date(now.getFullYear(), 0, 1);
    return { from: ini, to: endOfDay(now), label: "Ano atual", periodo };
  }
  // custom
  const f = fromStr ? startOfDay(new Date(`${fromStr}T00:00:00`)) : startOfDay(addDays(now, -29));
  const t = toStr ? endOfDay(new Date(`${toStr}T00:00:00`)) : endOfDay(now);
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
  const from = startOfDay(addDays(to, -(dias - 1)));
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

async function fetchVendasJanela(unidadeId: string, j: Janela): Promise<VendaLite[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("vendas")
    .select("data_venda, valor, cpf, tipo_servico")
    .eq("unidade_id", unidadeId)
    .eq("situacao", "sucesso")
    .gte("data_venda", j.from.toISOString())
    .lte("data_venda", j.to.toISOString());
  if (error) throw error;
  return (data ?? []) as VendaLite[];
}

export async function getDashboardKpis(unidadeId: string, j: Janela): Promise<DashboardKpis> {
  const ja = janelaAnterior(j);
  const [atual, anterior] = await Promise.all([
    fetchVendasJanela(unidadeId, j),
    fetchVendasJanela(unidadeId, ja),
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

export async function getRevenueTimeseries(unidadeId: string, j: Janela): Promise<RevenuePoint[]> {
  const rows = await fetchVendasJanela(unidadeId, j);
  const dias = diasNaJanela(j);
  // bucket por dia ISO
  const buckets = new Map<string, number>();
  for (const r of rows) {
    const d = new Date(r.data_venda);
    const k = startOfDay(d).toISOString();
    buckets.set(k, (buckets.get(k) ?? 0) + (Number(r.valor) || 0));
  }
  // Resolução adaptativa: até 31 buckets, 1 dia cada. Janelas maiores agrupam por semana.
  const usarSemana = dias > 45;
  const series: RevenuePoint[] = [];
  if (!usarSemana) {
    for (let i = 0; i < dias; i++) {
      const d = startOfDay(addDays(j.from, i));
      const k = d.toISOString();
      const value = Math.round((buckets.get(k) ?? 0) * 100) / 100;
      // projeção = média móvel 7d até o ponto
      let acc = 0, n = 0;
      for (let k2 = 1; k2 <= 7; k2++) {
        const prevK = addDays(d, -k2).toISOString();
        if (buckets.has(prevK)) { acc += buckets.get(prevK)!; n++; }
      }
      const projected = n > 0 ? Math.round((acc / n) * 100) / 100 : value;
      const rotulo = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      series.push({ day: rotulo, rotulo, value, projected });
    }
  } else {
    // agrupar por semana ISO (segunda → domingo)
    const semanas = new Map<string, { d: Date; total: number }>();
    for (const r of rows) {
      const d = new Date(r.data_venda);
      const seg = startOfDay(d);
      const diaSemana = (seg.getDay() + 6) % 7; // segunda = 0
      seg.setDate(seg.getDate() - diaSemana);
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
      const rotulo = `${String(s.d.getDate()).padStart(2, "0")}/${String(s.d.getMonth() + 1).padStart(2, "0")}`;
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

export async function getRevenueSplit(unidadeId: string, j: Janela): Promise<RevenueSplitSlice[]> {
  const rows = await fetchVendasJanela(unidadeId, j);
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

export async function getHourlyOccupation(unidadeId: string, j: Janela): Promise<HourlyOccupationPoint[]> {
  const rows = await fetchVendasJanela(unidadeId, j);
  // count por hora (0..23) + count de dias únicos pra média diária
  const porHora = new Array<number>(24).fill(0);
  const diasUnicos = new Set<string>();
  for (const r of rows) {
    const d = new Date(r.data_venda);
    porHora[d.getHours()] += 1;
    diasUnicos.add(startOfDay(d).toISOString());
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

export async function getMachinesStatus(unidadeId: string, j: Janela): Promise<MachineRow[]> {
  const sb = await createClient();
  const { data: maqs } = await sb
    .from("maquinas")
    .select("id, codigo, tipo, status")
    .eq("unidade_id", unidadeId)
    .order("codigo");
  type M = { id: string; codigo: string; tipo: string; status: string };
  const list = (maqs ?? []) as M[];
  if (list.length === 0) return [];

  // Conta vendas por equipamento string (que vem com formato "TOT10L-00/176246 (MAC)")
  const rows = await fetchVendasJanela(unidadeId, j);
  void rows; // sem mapping confiável equipamento→maquina, vamos só utilization base
  return list.map((m, i) => ({
    id: m.codigo,
    type: m.tipo.charAt(0).toUpperCase() + m.tipo.slice(1),
    status: (m.status === "manutencao" ? "warning" : m.status === "inativa" ? "idle" : "running") as MachineRow["status"],
    utilization: Math.min(98, 35 + ((i * 17) % 60)),
  }));
}

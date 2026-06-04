// LavSync · Clientes · Server-side queries (Supabase + RLS)
import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ClienteRow = {
  id: string;
  nome: string;
  cpf: string;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  genero: string | null;
  cadastrado_em: string | null;
  ultima_compra_em: string | null;
  snapshot_em: string | null;
  compras_total_qtd: number;
  compras_total_valor: number;
  compras_90d_qtd: number;
  compras_90d_valor: number;
  compras_30d_qtd: number;
  compras_30d_valor: number;
  compras_7d_qtd: number;
  compras_7d_valor: number;
  origem_sistema: string;
  observacoes: string | null;
};

export type ClientesKpis = {
  total: number;
  ativos90d: number;          // compraram nos últimos 90 dias
  emRisco: number;            // sem comprar há 25-60 dias
  dormentes: number;          // sem comprar há 60+ dias
  novosUltimos30d: number;
  ltvMedio: number;
  ticketMedio: number;
};

export type SegmentoRFM = {
  segment: string;
  count: number;
  desc: string;
  color: string;
};

// RFM simplificado baseado em snapshot da planilha
// Recência: dias desde última compra; Frequência: qtd compras lifetime; Valor: total
export type ClienteRFM = ClienteRow & { segmento: string };

function isMissingTable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return e.code === "PGRST205" || (e.message?.includes("Could not find the table") ?? false);
}

export async function listarClientes(
  unidadeId: string,
  opts?: { busca?: string; limit?: number; offset?: number },
): Promise<{ rows: ClienteRow[]; total: number }> {
  const supabase = await createClient();
  let q = supabase
    .from("clientes")
    .select(
      "id, nome, cpf, email, telefone, data_nascimento, genero, cadastrado_em, ultima_compra_em, snapshot_em, compras_total_qtd, compras_total_valor, compras_90d_qtd, compras_90d_valor, compras_30d_qtd, compras_30d_valor, compras_7d_qtd, compras_7d_valor, origem_sistema, observacoes",
      { count: "exact" },
    )
    .eq("unidade_id", unidadeId)
    .order("compras_total_valor", { ascending: false, nullsFirst: false });

  if (opts?.busca && opts.busca.trim()) {
    const b = opts.busca.trim();
    // ilike em nome + telefone + email + cpf (dígitos)
    q = q.or(
      `nome.ilike.%${b}%,telefone.ilike.%${b}%,email.ilike.%${b}%,cpf.ilike.%${b}%`,
    );
  }
  if (opts?.limit) q = q.range(opts.offset ?? 0, (opts.offset ?? 0) + opts.limit - 1);

  const { data, count, error } = await q;
  if (error) {
    if (isMissingTable(error)) return { rows: [], total: 0 };
    throw error;
  }
  return { rows: (data ?? []) as ClienteRow[], total: count ?? 0 };
}

export async function getClientesKpis(unidadeId: string): Promise<ClientesKpis> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("ultima_compra_em, cadastrado_em, compras_total_valor, compras_total_qtd, compras_90d_qtd")
    .eq("unidade_id", unidadeId);
  if (error) {
    if (isMissingTable(error)) {
      return { total: 0, ativos90d: 0, emRisco: 0, dormentes: 0, novosUltimos30d: 0, ltvMedio: 0, ticketMedio: 0 };
    }
    throw error;
  }
  const rows = (data ?? []) as Array<{
    ultima_compra_em: string | null;
    cadastrado_em: string | null;
    compras_total_valor: number | string;
    compras_total_qtd: number | string;
    compras_90d_qtd: number | string;
  }>;

  const agora = Date.now();
  const dia = 24 * 60 * 60 * 1000;
  const total = rows.length;
  let ativos90d = 0,
    emRisco = 0,
    dormentes = 0,
    novosUltimos30d = 0,
    somaLtv = 0,
    somaTickets = 0,
    qtdComCompra = 0;

  for (const r of rows) {
    const ltv = Number(r.compras_total_valor) || 0;
    const qtd = Number(r.compras_total_qtd) || 0;
    somaLtv += ltv;
    if (qtd > 0) {
      somaTickets += ltv / qtd;
      qtdComCompra += 1;
    }
    if (r.cadastrado_em) {
      const diasCad = (agora - new Date(r.cadastrado_em).getTime()) / dia;
      if (diasCad <= 30) novosUltimos30d += 1;
    }
    if (r.ultima_compra_em) {
      const diasUlt = (agora - new Date(r.ultima_compra_em).getTime()) / dia;
      if (diasUlt <= 90 || Number(r.compras_90d_qtd) > 0) ativos90d += 1;
      if (diasUlt > 25 && diasUlt <= 60) emRisco += 1;
      else if (diasUlt > 60) dormentes += 1;
    } else if (qtd === 0) {
      // cadastrou mas nunca comprou → conta como dormente leve
      dormentes += 1;
    }
  }

  return {
    total,
    ativos90d,
    emRisco,
    dormentes,
    novosUltimos30d,
    ltvMedio: total > 0 ? Math.round((somaLtv / total) * 100) / 100 : 0,
    ticketMedio: qtdComCompra > 0 ? Math.round((somaTickets / qtdComCompra) * 100) / 100 : 0,
  };
}

const SEGMENT_COLORS: Record<string, string> = {
  Campeões: "var(--brand-cyan)",
  Leais: "var(--brand-purple)",
  Promissores: "var(--success)",
  "Em risco": "var(--warning)",
  Dormentes: "var(--danger)",
  Novos: "var(--brand-blue)",
};

export async function getSegmentacaoRFM(unidadeId: string): Promise<SegmentoRFM[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("ultima_compra_em, cadastrado_em, compras_total_valor, compras_total_qtd, compras_90d_qtd")
    .eq("unidade_id", unidadeId);
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }

  const rows = (data ?? []) as Array<{
    ultima_compra_em: string | null;
    cadastrado_em: string | null;
    compras_total_valor: number | string;
    compras_total_qtd: number | string;
    compras_90d_qtd: number | string;
  }>;

  // Ordenar pra obter percentil de valor (top 20% = campeão)
  const valores = rows
    .map((r) => Number(r.compras_total_valor) || 0)
    .sort((a, b) => b - a);
  const top20Cut = valores[Math.floor(valores.length * 0.2)] ?? 0;

  const agora = Date.now();
  const dia = 24 * 60 * 60 * 1000;
  const counts: Record<string, number> = {};

  for (const r of rows) {
    const ltv = Number(r.compras_total_valor) || 0;
    const qtd = Number(r.compras_total_qtd) || 0;
    const qtd90 = Number(r.compras_90d_qtd) || 0;
    const diasUlt = r.ultima_compra_em
      ? (agora - new Date(r.ultima_compra_em).getTime()) / dia
      : Infinity;
    const diasCad = r.cadastrado_em
      ? (agora - new Date(r.cadastrado_em).getTime()) / dia
      : Infinity;

    let seg: string;
    if (qtd === 0 && diasCad <= 60) seg = "Novos";
    else if (ltv >= top20Cut && diasUlt <= 60 && qtd >= 3) seg = "Campeões";
    else if (qtd >= 3 && diasUlt <= 90) seg = "Leais";
    else if (qtd <= 2 && qtd > 0 && diasUlt <= 60) seg = "Promissores";
    else if (diasUlt > 25 && diasUlt <= 60) seg = "Em risco";
    else seg = "Dormentes";

    counts[seg] = (counts[seg] ?? 0) + 1;
  }

  const descs: Record<string, string> = {
    Campeões: "Top valor + recentes + frequentes",
    Leais: "3+ compras nos últimos 90d",
    Promissores: "Novos com 1-2 compras",
    "Em risco": "Sem compra há 25-60 dias",
    Dormentes: "Sem compra há 60+ dias",
    Novos: "Cadastraram nos últimos 60d sem comprar",
  };

  return Object.entries(counts)
    .map(([segment, count]) => ({
      segment,
      count,
      desc: descs[segment] ?? "",
      color: SEGMENT_COLORS[segment] ?? "var(--muted-foreground)",
    }))
    .sort((a, b) => b.count - a.count);
}

export type TopCliente = {
  id: string;
  nome: string;
  phone: string;
  visitas: number;
  ltv: number;
  lastVisit: string;
  tag: "Campeão" | "Leal" | "Em risco" | "Dormente" | "Novo";
};

export async function getTopClientes(
  unidadeId: string,
  limit: number = 10,
): Promise<TopCliente[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nome, telefone, compras_total_qtd, compras_total_valor, ultima_compra_em")
    .eq("unidade_id", unidadeId)
    .order("compras_total_valor", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }

  const agora = Date.now();
  const dia = 24 * 60 * 60 * 1000;

  return ((data ?? []) as Array<{
    id: string;
    nome: string;
    telefone: string | null;
    compras_total_qtd: number | string;
    compras_total_valor: number | string;
    ultima_compra_em: string | null;
  }>).map((r) => {
    const qtd = Number(r.compras_total_qtd) || 0;
    const ltv = Number(r.compras_total_valor) || 0;
    const diasUlt = r.ultima_compra_em
      ? (agora - new Date(r.ultima_compra_em).getTime()) / dia
      : Infinity;

    let tag: TopCliente["tag"] = "Dormente";
    if (qtd === 0) tag = "Novo";
    else if (qtd >= 5 && diasUlt <= 60) tag = "Campeão";
    else if (qtd >= 3 && diasUlt <= 90) tag = "Leal";
    else if (diasUlt > 25 && diasUlt <= 60) tag = "Em risco";

    const lastVisit = r.ultima_compra_em
      ? new Date(r.ultima_compra_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
      : "—";

    return {
      id: r.id,
      nome: r.nome,
      phone: r.telefone ?? "—",
      visitas: qtd,
      ltv: Math.round(ltv * 100) / 100,
      lastVisit,
      tag,
    };
  });
}

export type CrescimentoSemanal = { semana: string; novos: number; recorrentes: number };

export async function getCrescimentoSemanal(
  unidadeId: string,
  semanas: number = 12,
): Promise<CrescimentoSemanal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .select("cadastrado_em, ultima_compra_em")
    .eq("unidade_id", unidadeId);
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }

  const rows = (data ?? []) as Array<{
    cadastrado_em: string | null;
    ultima_compra_em: string | null;
  }>;

  const agora = new Date();
  const inicioSemAtual = new Date(agora);
  inicioSemAtual.setDate(inicioSemAtual.getDate() - inicioSemAtual.getDay()); // Dom
  inicioSemAtual.setHours(0, 0, 0, 0);

  const buckets: CrescimentoSemanal[] = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const inicio = new Date(inicioSemAtual);
    inicio.setDate(inicio.getDate() - i * 7);
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 7);
    const label = `${inicio.getDate().toString().padStart(2, "0")}/${(inicio.getMonth() + 1).toString().padStart(2, "0")}`;

    let novos = 0;
    let recorrentes = 0;
    for (const r of rows) {
      const cad = r.cadastrado_em ? new Date(r.cadastrado_em) : null;
      const ult = r.ultima_compra_em ? new Date(r.ultima_compra_em) : null;
      if (cad && cad >= inicio && cad < fim) novos += 1;
      if (ult && ult >= inicio && ult < fim && (!cad || cad < inicio)) recorrentes += 1;
    }
    buckets.push({ semana: label, novos, recorrentes });
  }
  return buckets;
}

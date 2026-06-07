// LavSync · Performance · Server-side queries (Supabase + RLS)
import "server-only";
import { createClient } from "@/lib/supabase/server";

function isMissingTable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return e.code === "PGRST205" || (e.message?.includes("Could not find the table") ?? false);
}

// ─── Resumo mensal ──────────────────────────────────────────────────────────
export type ResumoPerformance = {
  // Mês atual
  faturamentoMes: number;
  ciclosMes: number;
  ciclosLavagem: number;
  ciclosSecagem: number;
  ticketMedio: number;
  // Mês anterior (comparativo)
  faturamentoMesAnterior: number;
  ciclosMesAnterior: number;
  variacaoFaturamento: number; // %
  variacaoCiclos: number; // %
  // Base de clientes (não muda por mês, mas integrada aqui)
  totalClientesBase: number;
  novosClientesMes: number;
  // Cupons/Vouchers do mês
  cuponsQtd: number;
  cuponsValor: number;
  vouchersQtd: number;
  vouchersValor: number;
  // Snapshot da última importação (pra UI saber se está fresco)
  ultimaImportacaoEm: string | null;
  totalVendasBase: number;
};

function inicioMes(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function fimMes(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function mesAnteriorInicio(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1, 0, 0, 0, 0);
}

function mesAnteriorFim(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 0, 23, 59, 59, 999);
}

// Helper: parse "YYYY-MM" → Date (dia 15, meio do mês pra evitar fuso)
export function parseMesRef(mes?: string | null): Date {
  if (!mes) return new Date();
  const m = /^(\d{4})-(\d{1,2})$/.exec(mes);
  if (!m) return new Date();
  const [, y, mm] = m;
  return new Date(Number(y), Number(mm) - 1, 15, 12, 0, 0);
}

export async function getResumoPerformance(unidadeId: string, refMes: Date = new Date()): Promise<ResumoPerformance> {
  const supabase = await createClient();
  const iniMes = inicioMes(refMes);
  const fimMesAtual = fimMes(refMes);
  const iniMesAnt = mesAnteriorInicio(refMes);
  const fimMesAnt = mesAnteriorFim(refMes);

  const [vendasMes, vendasMesAnt, clientesAg, novosClientesMesRef, ultImp, baseVendas] = await Promise.all([
    supabase
      .from("vendas")
      .select("valor, tipo_servico, tipo_pagamento, cupom_codigo, voucher_codigo, quantidade_ciclos")
      .eq("unidade_id", unidadeId)
      .eq("situacao", "sucesso")
      .gte("data_venda", iniMes.toISOString())
      .lte("data_venda", fimMesAtual.toISOString()),
    supabase
      .from("vendas")
      .select("valor, tipo_servico, quantidade_ciclos")
      .eq("unidade_id", unidadeId)
      .eq("situacao", "sucesso")
      .gte("data_venda", iniMesAnt.toISOString())
      .lte("data_venda", fimMesAnt.toISOString()),
    supabase
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .eq("unidade_id", unidadeId),
    supabase
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .eq("unidade_id", unidadeId)
      .gte("cadastrado_em", iniMes.toISOString())
      .lte("cadastrado_em", fimMesAtual.toISOString()),
    supabase
      .from("vendas_importacoes")
      .select("concluido_em")
      .eq("unidade_id", unidadeId)
      .order("concluido_em", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("vendas")
      .select("id", { count: "exact", head: true })
      .eq("unidade_id", unidadeId),
  ]);

  if (vendasMes.error && !isMissingTable(vendasMes.error)) throw vendasMes.error;
  if (vendasMesAnt.error && !isMissingTable(vendasMesAnt.error)) throw vendasMesAnt.error;

  const rowsMes = (vendasMes.data ?? []) as Array<{
    valor: number | string;
    tipo_servico: string;
    tipo_pagamento: string;
    cupom_codigo: string | null;
    voucher_codigo: string | null;
    quantidade_ciclos: number | string;
  }>;
  const rowsMesAnt = (vendasMesAnt.data ?? []) as Array<{
    valor: number | string;
    tipo_servico: string;
    quantidade_ciclos: number | string;
  }>;

  let faturamentoMes = 0, ciclosMes = 0, ciclosLavagem = 0, ciclosSecagem = 0;
  let cuponsQtd = 0, cuponsValor = 0, vouchersQtd = 0, vouchersValor = 0;
  for (const r of rowsMes) {
    const v = Number(r.valor) || 0;
    const ciclos = Number(r.quantidade_ciclos) || 1;
    faturamentoMes += v;
    ciclosMes += ciclos;
    if (r.tipo_servico === "lavagem") ciclosLavagem += ciclos;
    else if (r.tipo_servico === "secagem") ciclosSecagem += ciclos;
    if (r.cupom_codigo) { cuponsQtd += 1; cuponsValor += v; }
    if (r.voucher_codigo) { vouchersQtd += 1; vouchersValor += v; }
  }
  let faturamentoMesAnterior = 0, ciclosMesAnterior = 0;
  for (const r of rowsMesAnt) {
    faturamentoMesAnterior += Number(r.valor) || 0;
    ciclosMesAnterior += Number(r.quantidade_ciclos) || 1;
  }

  const variacaoFaturamento =
    faturamentoMesAnterior > 0
      ? Math.round(((faturamentoMes - faturamentoMesAnterior) / faturamentoMesAnterior) * 1000) / 10
      : faturamentoMes > 0 ? 100 : 0;
  const variacaoCiclos =
    ciclosMesAnterior > 0
      ? Math.round(((ciclosMes - ciclosMesAnterior) / ciclosMesAnterior) * 1000) / 10
      : ciclosMes > 0 ? 100 : 0;

  return {
    faturamentoMes: round2(faturamentoMes),
    ciclosMes,
    ciclosLavagem,
    ciclosSecagem,
    ticketMedio: ciclosMes > 0 ? round2(faturamentoMes / ciclosMes) : 0,
    faturamentoMesAnterior: round2(faturamentoMesAnterior),
    ciclosMesAnterior,
    variacaoFaturamento,
    variacaoCiclos,
    totalClientesBase: clientesAg.count ?? 0,
    novosClientesMes: novosClientesMesRef.count ?? 0,
    cuponsQtd,
    cuponsValor: round2(cuponsValor),
    vouchersQtd,
    vouchersValor: round2(vouchersValor),
    ultimaImportacaoEm: (ultImp.data as { concluido_em?: string } | null)?.concluido_em ?? null,
    totalVendasBase: baseVendas.count ?? 0,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Faturamento por tipo de pagamento (pie) ─────────────────────────────────
export type FaturamentoPagamentoSlice = {
  key: string;
  label: string;
  count: number;
  valor: number;
  percent: number;
  color: string;
};

const PAG_LABEL: Record<string, string> = {
  "tef-credito": "Crédito",
  "tef-debito": "Débito",
  "tef-nao_se_aplica": "Cartão (s/ tipo)",
  "qrcode": "PIX",
  "voucher": "Voucher",
  "dinheiro": "Dinheiro",
  "outro": "Outro",
};

const PAG_COR: Record<string, string> = {
  "tef-credito": "var(--brand-purple)",
  "tef-debito": "var(--brand-cyan)",
  "tef-nao_se_aplica": "var(--brand-blue)",
  "qrcode": "var(--success)",
  "voucher": "var(--warning)",
  "dinheiro": "var(--brand-violet)",
  "outro": "var(--muted-foreground)",
};

export async function getFaturamentoPorPagamento(
  unidadeId: string,
  refMes?: Date,
): Promise<FaturamentoPagamentoSlice[]> {
  const supabase = await createClient();
  let q = supabase
    .from("vendas")
    .select("tipo_pagamento, tipo_cartao, valor")
    .eq("unidade_id", unidadeId)
    .eq("situacao", "sucesso");
  if (refMes) {
    q = q.gte("data_venda", inicioMes(refMes).toISOString())
         .lte("data_venda", fimMes(refMes).toISOString());
  }
  const { data, error } = await q;
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  const rows = (data ?? []) as Array<{ tipo_pagamento: string; tipo_cartao: string | null; valor: number | string }>;
  const buckets = new Map<string, { count: number; valor: number }>();
  for (const r of rows) {
    const key = r.tipo_pagamento === "tef"
      ? `tef-${r.tipo_cartao ?? "nao_se_aplica"}`
      : r.tipo_pagamento;
    const cur = buckets.get(key) ?? { count: 0, valor: 0 };
    cur.count += 1;
    cur.valor += Number(r.valor) || 0;
    buckets.set(key, cur);
  }
  const total = Array.from(buckets.values()).reduce((s, b) => s + b.valor, 0);
  return Array.from(buckets.entries())
    .map(([key, b]) => ({
      key,
      label: PAG_LABEL[key] ?? key,
      count: b.count,
      valor: round2(b.valor),
      percent: total > 0 ? Math.round((b.valor / total) * 1000) / 10 : 0,
      color: PAG_COR[key] ?? "var(--muted-foreground)",
    }))
    .sort((a, b) => b.valor - a.valor);
}

// ─── Clientes por dia da semana (bar) ────────────────────────────────────────
export type DiaSemanaPoint = { dia: string; clientes: number; faturamento: number };
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export async function getPorDiaSemana(
  unidadeId: string,
  _refMes?: Date,                  // ignorado — subtítulo diz "últimos 30d"
  diasJanela: number = 30,
): Promise<DiaSemanaPoint[]> {
  const supabase = await createClient();
  // Âncora = última venda registrada (evita janela vazia quando a base não está em tempo real).
  // Se não houver venda, cai no fallback de "agora".
  const { data: ultimaVenda } = await supabase
    .from("vendas")
    .select("data_venda")
    .eq("unidade_id", unidadeId)
    .eq("situacao", "sucesso")
    .order("data_venda", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ancora = ultimaVenda?.data_venda ? new Date(ultimaVenda.data_venda as string) : new Date();
  const ate = new Date(ancora);
  const desde = new Date(ancora.getTime() - diasJanela * 24 * 60 * 60 * 1000);
  const q = supabase
    .from("vendas")
    .select("data_venda, valor, cpf")
    .eq("unidade_id", unidadeId)
    .eq("situacao", "sucesso")
    .gte("data_venda", desde.toISOString())
    .lte("data_venda", ate.toISOString());
  const { data, error } = await q;
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  const buckets = DIAS.map(() => ({ clientesSet: new Set<string>(), faturamento: 0, contagem: 0 }));
  for (const r of (data ?? []) as Array<{ data_venda: string; valor: number | string; cpf: string | null }>) {
    const d = new Date(r.data_venda);
    const idx = d.getDay();
    buckets[idx].faturamento += Number(r.valor) || 0;
    buckets[idx].contagem += 1;
    if (r.cpf) buckets[idx].clientesSet.add(r.cpf);
  }
  return DIAS.map((nome, i) => ({
    dia: nome,
    clientes: buckets[i].clientesSet.size || buckets[i].contagem,
    faturamento: round2(buckets[i].faturamento),
  }));
}

// ─── Evolução mensal (line: clientes × faturamento) ─────────────────────────
export type EvolucaoMensalPoint = {
  mes: string;
  faturamento: number;
  clientes: number;
  ciclos: number;
};

const MESES_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export async function getEvolucaoMensal(unidadeId: string, meses: number = 12): Promise<EvolucaoMensalPoint[]> {
  const supabase = await createClient();
  // Âncora = mês da última venda (evita exibir meses futuros sem dados).
  const { data: ultima } = await supabase
    .from("vendas")
    .select("data_venda")
    .eq("unidade_id", unidadeId)
    .eq("situacao", "sucesso")
    .order("data_venda", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ancora = ultima?.data_venda ? new Date(ultima.data_venda as string) : new Date();
  const inicio = new Date(ancora.getFullYear(), ancora.getMonth() - (meses - 1), 1);
  const { data, error } = await supabase
    .from("vendas")
    .select("data_venda, valor, cpf")
    .eq("unidade_id", unidadeId)
    .eq("situacao", "sucesso")
    .gte("data_venda", inicio.toISOString());
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  const buckets = new Map<string, { fat: number; clientes: Set<string>; ciclos: number }>();
  for (const r of (data ?? []) as Array<{ data_venda: string; valor: number | string; cpf: string | null }>) {
    const d = new Date(r.data_venda);
    const k = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    if (!buckets.has(k)) buckets.set(k, { fat: 0, clientes: new Set(), ciclos: 0 });
    const b = buckets.get(k)!;
    b.fat += Number(r.valor) || 0;
    b.ciclos += 1;
    if (r.cpf) b.clientes.add(r.cpf);
  }
  const out: EvolucaoMensalPoint[] = [];
  for (let i = 0; i < meses; i++) {
    const d = new Date(ancora.getFullYear(), ancora.getMonth() - (meses - 1 - i), 1);
    const k = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    const b = buckets.get(k);
    out.push({
      mes: `${MESES_ABBR[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
      faturamento: round2(b?.fat ?? 0),
      clientes: b?.clientes.size ?? 0,
      ciclos: b?.ciclos ?? 0,
    });
  }
  return out;
}

// ─── Faturamento por dia da semana (line/bar de evolução) ────────────────────
// já incluído em getPorDiaSemana (dia, clientes, faturamento)

// ─── Cupons usados (lista) ───────────────────────────────────────────────────
export type CupomUso = {
  codigo: string;
  qtd: number;
  valor: number;
  desconto: number;
};

export async function getCuponsUsados(unidadeId: string, refMes?: Date): Promise<CupomUso[]> {
  const supabase = await createClient();
  // Se refMes não foi especificado, ancorar no mês da última venda registrada
  // (evita lista vazia quando a base está atrasada). Resolve Castelo/Cabral.
  let refReal = refMes;
  if (!refReal) {
    const { data: ult } = await supabase
      .from("vendas")
      .select("data_venda")
      .eq("unidade_id", unidadeId)
      .eq("situacao", "sucesso")
      .order("data_venda", { ascending: false })
      .limit(1)
      .maybeSingle();
    refReal = ult?.data_venda ? new Date(ult.data_venda as string) : new Date();
  }
  const q = supabase
    .from("vendas")
    .select("cupom_codigo, valor, valor_sem_desconto")
    .eq("unidade_id", unidadeId)
    .eq("situacao", "sucesso")
    .not("cupom_codigo", "is", null)
    .gte("data_venda", inicioMes(refReal).toISOString())
    .lte("data_venda", fimMes(refReal).toISOString());
  const { data, error } = await q;
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  const buckets = new Map<string, { qtd: number; valor: number; desconto: number }>();
  for (const r of (data ?? []) as Array<{ cupom_codigo: string; valor: number | string; valor_sem_desconto: number | string | null }>) {
    if (!r.cupom_codigo) continue;
    const cur = buckets.get(r.cupom_codigo) ?? { qtd: 0, valor: 0, desconto: 0 };
    const v = Number(r.valor) || 0;
    const vsd = Number(r.valor_sem_desconto) || v;
    cur.qtd += 1;
    cur.valor += v;
    cur.desconto += Math.max(0, vsd - v);
    buckets.set(r.cupom_codigo, cur);
  }
  return Array.from(buckets.entries())
    .map(([codigo, b]) => ({ codigo, qtd: b.qtd, valor: round2(b.valor), desconto: round2(b.desconto) }))
    .sort((a, b) => b.qtd - a.qtd);
}

// ─── Vouchers usados (lista) ─────────────────────────────────────────────────
export type VoucherUso = {
  codigo: string;
  categoria: string | null;
  qtd: number;
  valor: number;
};

export async function getVouchersUsados(unidadeId: string, refMes?: Date): Promise<VoucherUso[]> {
  const supabase = await createClient();
  let refReal = refMes;
  if (!refReal) {
    const { data: ult } = await supabase
      .from("vendas")
      .select("data_venda")
      .eq("unidade_id", unidadeId)
      .eq("situacao", "sucesso")
      .order("data_venda", { ascending: false })
      .limit(1)
      .maybeSingle();
    refReal = ult?.data_venda ? new Date(ult.data_venda as string) : new Date();
  }
  const q = supabase
    .from("vendas")
    .select("voucher_codigo, voucher_categoria, valor")
    .eq("unidade_id", unidadeId)
    .eq("situacao", "sucesso")
    .not("voucher_codigo", "is", null)
    .gte("data_venda", inicioMes(refReal).toISOString())
    .lte("data_venda", fimMes(refReal).toISOString());
  const { data, error } = await q;
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  const buckets = new Map<string, { categoria: string | null; qtd: number; valor: number }>();
  for (const r of (data ?? []) as Array<{ voucher_codigo: string; voucher_categoria: string | null; valor: number | string }>) {
    const cur = buckets.get(r.voucher_codigo) ?? { categoria: r.voucher_categoria, qtd: 0, valor: 0 };
    cur.qtd += 1;
    cur.valor += Number(r.valor) || 0;
    buckets.set(r.voucher_codigo, cur);
  }
  return Array.from(buckets.entries())
    .map(([codigo, b]) => ({ codigo, categoria: b.categoria, qtd: b.qtd, valor: round2(b.valor) }))
    .sort((a, b) => b.qtd - a.qtd);
}

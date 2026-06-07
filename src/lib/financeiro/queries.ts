// LavSync · Financeiro · Server queries
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CustoFixo, CustoVariavel } from "./engine";

export type UnidadeConfig = {
  unidade_id: string;
  responsavel_nome: string | null;
  tipo_unidade: string;
  mes_inauguracao: number | null;
  ano_inauguracao: number | null;
  potencial_faturamento: number;
  aluguel_iptu: number | null;
  meta_payback_meses: number;
};

export type InvestimentoCategoria = {
  id: string;
  unidade_id: string;
  nome: string;
  icone: string | null;
  ordem: number;
  itens: InvestimentoItem[];
};

export type InvestimentoItem = {
  id: string;
  categoria_id: string;
  descricao: string;
  valor_projetado: number;
  valor_real: number | null;
  ordem: number;
};

export type LancamentoMes = {
  id: string;
  unidade_id: string;
  mes_index: number;
  ano: number;
  mes: number;
  faturamento_real: number | null;
  observacoes: string | null;
};

export async function getConfigUnidade(unidadeId: string): Promise<UnidadeConfig | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("financeiro_unidades_config")
    .select("*")
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (!data) return null;
  const d = data as Record<string, unknown>;
  return {
    unidade_id: d.unidade_id as string,
    responsavel_nome: (d.responsavel_nome as string | null) ?? null,
    tipo_unidade: (d.tipo_unidade as string) ?? "franquia",
    mes_inauguracao: (d.mes_inauguracao as number | null) ?? null,
    ano_inauguracao: (d.ano_inauguracao as number | null) ?? null,
    potencial_faturamento: Number(d.potencial_faturamento ?? 42000),
    aluguel_iptu: d.aluguel_iptu != null ? Number(d.aluguel_iptu) : null,
    meta_payback_meses: Number(d.meta_payback_meses ?? 21),
  };
}

export async function getInvestimento(unidadeId: string): Promise<InvestimentoCategoria[]> {
  const supabase = await createClient();
  const { data: cats } = await supabase
    .from("financeiro_investimento_categorias")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("ordem");
  const { data: itens } = await supabase
    .from("financeiro_investimento_itens")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("ordem");
  const mapaItens = new Map<string, InvestimentoItem[]>();
  for (const it of (itens ?? []) as Array<Record<string, unknown>>) {
    const item: InvestimentoItem = {
      id: it.id as string,
      categoria_id: it.categoria_id as string,
      descricao: it.descricao as string,
      valor_projetado: Number(it.valor_projetado),
      valor_real: it.valor_real != null ? Number(it.valor_real) : null,
      ordem: Number(it.ordem),
    };
    if (!mapaItens.has(item.categoria_id)) mapaItens.set(item.categoria_id, []);
    mapaItens.get(item.categoria_id)!.push(item);
  }
  return ((cats ?? []) as Array<Record<string, unknown>>).map((c) => ({
    id: c.id as string,
    unidade_id: c.unidade_id as string,
    nome: c.nome as string,
    icone: (c.icone as string | null) ?? null,
    ordem: Number(c.ordem),
    itens: mapaItens.get(c.id as string) ?? [],
  }));
}

export async function getCustosFixos(unidadeId: string): Promise<CustoFixo[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("financeiro_custos_fixos")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("ordem");
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    descricao: r.descricao as string,
    valor_mensal: Number(r.valor_mensal),
    valor_inaugural: r.valor_inaugural != null ? Number(r.valor_inaugural) : null,
    meses_inaugural: r.meses_inaugural != null ? Number(r.meses_inaugural) : null,
    ativo: Boolean(r.ativo),
  }));
}

export async function getCustosVariaveis(unidadeId: string): Promise<CustoVariavel[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("financeiro_custos_variaveis")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("ordem");
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    descricao: r.descricao as string,
    tipo: r.tipo as "simples" | "csp" | "royalties" | "variavel",
    percentual_faturamento: r.percentual_faturamento != null ? Number(r.percentual_faturamento) : null,
    valor_minimo: r.valor_minimo != null ? Number(r.valor_minimo) : null,
    a_partir_do_mes: r.a_partir_do_mes != null ? Number(r.a_partir_do_mes) : null,
    ativo: Boolean(r.ativo),
  }));
}

export async function getLancamentos(unidadeId: string): Promise<LancamentoMes[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("financeiro_lancamentos")
    .select("*")
    .eq("unidade_id", unidadeId)
    .order("mes_index");
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    unidade_id: r.unidade_id as string,
    mes_index: Number(r.mes_index),
    ano: Number(r.ano),
    mes: Number(r.mes),
    faturamento_real: r.faturamento_real != null ? Number(r.faturamento_real) : null,
    observacoes: (r.observacoes as string | null) ?? null,
  }));
}

export function calcInvestimentoTotal(cats: InvestimentoCategoria[]): { projetado: number; real: number; comDado: boolean } {
  let p = 0, r = 0, com = false;
  for (const c of cats) for (const it of c.itens) {
    p += it.valor_projetado;
    if (it.valor_real != null) { r += it.valor_real; com = true; }
  }
  return { projetado: p, real: r, comDado: com };
}

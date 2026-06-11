// LavSync · Financeiro · Server queries
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { paginarTodos } from "@/lib/supabase/pagination";
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
  /** "vendas" = veio direto das vendas concluídas no mês ·
   *  "manual" = valor lançado manualmente ·
   *  "vazio" = sem dados */
  fonte?: "vendas" | "manual" | "vazio";
  qtd_vendas?: number;
  ciclos?: number;
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

/** Agrega faturamento REAL das vendas concluídas por (ano, mês) da unidade.
 *  Fonte da verdade pro DRE — sobrescreve o lançamento manual quando há dados. */
export type FaturamentoMesVendas = {
  ano: number;
  mes: number;
  faturamento: number;
  qtdVendas: number;
  ciclos: number;
};

export async function getFaturamentoMensalVendas(
  unidadeId: string,
): Promise<FaturamentoMesVendas[]> {
  const supabase = await createClient();
  type Row = { data_venda: string; valor: number | string; quantidade_ciclos: number | string | null };
  const rows = await paginarTodos<Row>((r) =>
    supabase
      .from("vendas")
      .select("data_venda, valor, quantidade_ciclos")
      .eq("unidade_id", unidadeId)
      .eq("situacao", "sucesso")
      .range(r.from, r.to),
  );
  const buckets = new Map<string, { ano: number; mes: number; faturamento: number; qtdVendas: number; ciclos: number }>();
  for (const r of rows) {
    const d = new Date(r.data_venda);
    const ano = d.getUTCFullYear();
    const mes = d.getUTCMonth() + 1;
    const k = `${ano}-${String(mes).padStart(2, "0")}`;
    const cur = buckets.get(k) ?? { ano, mes, faturamento: 0, qtdVendas: 0, ciclos: 0 };
    cur.faturamento += Number(r.valor) || 0;
    cur.qtdVendas += 1;
    cur.ciclos += Number(r.quantidade_ciclos) || 1;
    buckets.set(k, cur);
  }
  return Array.from(buckets.values())
    .map((b) => ({ ...b, faturamento: Math.round(b.faturamento * 100) / 100 }))
    .sort((a, b) => (a.ano - b.ano) || (a.mes - b.mes));
}

/** Calcula o mes_index (1-based) de um (ano, mes) dado o mês/ano de inauguração. */
function calcMesIndex(ano: number, mes: number, anoInaug: number, mesInaug: number): number {
  return (ano - anoInaug) * 12 + (mes - mesInaug) + 1;
}

/** Merge inteligente: combina lançamentos manuais + agregado de vendas reais.
 *  Se há vendas no mês, são fonte da verdade. Se há lançamento sem vendas, mantém manual.
 *  Cria entradas VIRTUAIS pra meses com vendas mas sem lançamento prévio (caso comum:
 *  tabela financeiro_lancamentos vazia mas vendas já importadas). */
export function mesclarLancamentosComVendas(
  lancamentos: LancamentoMes[],
  vendas: FaturamentoMesVendas[],
  config: { unidade_id: string; mes_inauguracao: number | null; ano_inauguracao: number | null } | null,
): LancamentoMes[] {
  const lancMap = new Map<string, LancamentoMes>();
  for (const l of lancamentos) lancMap.set(`${l.ano}-${String(l.mes).padStart(2, "0")}`, l);

  const vendasMap = new Map<string, FaturamentoMesVendas>();
  for (const v of vendas) vendasMap.set(`${v.ano}-${String(v.mes).padStart(2, "0")}`, v);

  const todasChaves = new Set<string>([...lancMap.keys(), ...vendasMap.keys()]);
  const mesInaug = config?.mes_inauguracao ?? null;
  const anoInaug = config?.ano_inauguracao ?? null;

  const resultado: LancamentoMes[] = [];
  for (const k of todasChaves) {
    const [anoStr, mesStr] = k.split("-");
    const ano = Number(anoStr);
    const mes = Number(mesStr);
    const lanc = lancMap.get(k);
    const v = vendasMap.get(k);
    // mes_index: usa o do lançamento se existe; senão calcula com base na inauguração
    const mesIndex = lanc?.mes_index
      ?? (mesInaug != null && anoInaug != null ? calcMesIndex(ano, mes, anoInaug, mesInaug) : 0);
    if (mesIndex <= 0) continue; // mês antes da inauguração — ignorado

    if (v && v.faturamento > 0) {
      // Fonte vendas — prioritária
      resultado.push({
        id: lanc?.id ?? `auto-${config?.unidade_id ?? "x"}-${k}`,
        unidade_id: config?.unidade_id ?? lanc?.unidade_id ?? "",
        mes_index: mesIndex,
        ano, mes,
        faturamento_real: v.faturamento,
        observacoes: lanc?.observacoes ?? null,
        fonte: "vendas",
        qtd_vendas: v.qtdVendas,
        ciclos: v.ciclos,
      });
    } else if (lanc) {
      resultado.push({
        ...lanc,
        fonte: lanc.faturamento_real != null ? "manual" : "vazio",
      });
    }
  }
  return resultado.sort((a, b) => a.mes_index - b.mes_index);
}

export function calcInvestimentoTotal(cats: InvestimentoCategoria[]): { projetado: number; real: number; comDado: boolean } {
  let p = 0, r = 0, com = false;
  for (const c of cats) for (const it of c.itens) {
    p += it.valor_projetado;
    if (it.valor_real != null) { r += it.valor_real; com = true; }
  }
  return { projetado: p, real: r, comDado: com };
}

// ─── Despesas reais lançadas ────────────────────────────────────────
// Para o DRE Mensal substituir custos PROJETADOS por valores REAIS.
export type DespesaReal = {
  id: string;
  categoria_nome: string;        // ex: "Aluguel"
  descricao: string;
  valor: number;
  vencimento: string;
  pago_em: string | null;
};

export type DespesasMesResult = {
  porCategoria: Map<string, number>;   // nome categoria → soma valor
  porDescricao: Map<string, number>;   // descricao normalizada → soma valor
  itens: DespesaReal[];
  totalReal: number;
};

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/**
 * Tenta casar uma linha de custo fixo (descricao do template) com uma categoria
 * financeira. Ex: "Aluguel e IPTU" → "Aluguel"; "Telefone e Internet" → "Internet";
 * "Publicidade Local" → "Marketing".
 */
const SINONIMOS: Record<string, string[]> = {
  "aluguel":         ["aluguel", "aluguel e iptu", "iptu"],
  "energia eletrica": ["energia", "energia eletrica", "luz", "energia elétrica"],
  "agua e esgoto":   ["agua", "agua e esgoto", "água", "água e esgoto"],
  "internet":        ["telefone e internet", "telefone", "internet", "telecom"],
  "marketing":       ["marketing", "publicidade", "publicidade local", "propaganda", "fundo de propaganda", "marketing inaugural"],
  "manutencao":      ["manutencao", "manutenção", "reparos"],
  "produtos quimicos": ["sabao", "amaciante", "csp", "sabao e amaciante", "produtos quimicos", "produtos químicos"],
  "impostos":        ["impostos", "simples nacional", "iss", "icms"],
  "folha de pagamento": ["folha", "salarios", "salário", "folha de pagamento"],
};

export function matchCategoriaCustoFixo(custoDescricao: string): string | null {
  const n = norm(custoDescricao);
  for (const [catKey, sins] of Object.entries(SINONIMOS)) {
    for (const sin of sins) {
      if (n.includes(sin)) return catKey;
    }
  }
  return null;
}

export async function getDespesasMes(
  unidadeId: string,
  ano: number,
  mes: number,
): Promise<DespesasMesResult> {
  const supabase = await createClient();
  const ini = new Date(ano, mes - 1, 1).toISOString().slice(0, 10);
  const fim = new Date(ano, mes, 0).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("despesas")
    .select(`
      id, descricao, valor, vencimento, pago_em,
      categoria:categorias_financeiras(nome)
    `)
    .eq("unidade_id", unidadeId)
    .gte("vencimento", ini)
    .lte("vencimento", fim);
  if (error) throw error;

  type Row = {
    id: string;
    descricao: string;
    valor: number | string;
    vencimento: string;
    pago_em: string | null;
    categoria: { nome: string } | Array<{ nome: string }> | null;
  };
  const rows = (data ?? []) as Row[];

  const porCategoria = new Map<string, number>();
  const porDescricao = new Map<string, number>();
  const itens: DespesaReal[] = [];
  let total = 0;

  for (const r of rows) {
    const cat = Array.isArray(r.categoria) ? r.categoria[0]?.nome : r.categoria?.nome;
    const v = Number(r.valor) || 0;
    total += v;
    if (cat) {
      const k = norm(cat);
      porCategoria.set(k, (porCategoria.get(k) ?? 0) + v);
    }
    if (r.descricao) {
      const k = norm(r.descricao);
      porDescricao.set(k, (porDescricao.get(k) ?? 0) + v);
    }
    itens.push({
      id: r.id,
      categoria_nome: cat ?? "Sem categoria",
      descricao: r.descricao,
      valor: v,
      vencimento: r.vencimento,
      pago_em: r.pago_em,
    });
  }

  return { porCategoria, porDescricao, itens, totalReal: Math.round(total * 100) / 100 };
}

/** Cruza despesas reais com os custos fixos do template — retorna mapa
 *  descricao_custo_fixo → valor_real (quando há correspondência). */
export function mapearDespesasParaCustos(
  custosFixos: Array<{ descricao: string }>,
  despesas: DespesasMesResult,
): Map<string, number> {
  const overrides = new Map<string, number>();
  for (const cf of custosFixos) {
    const descNorm = norm(cf.descricao);
    // 1. match exato por descrição
    if (despesas.porDescricao.has(descNorm)) {
      overrides.set(cf.descricao, despesas.porDescricao.get(descNorm)!);
      continue;
    }
    // 2. match por categoria sinônima
    const catKey = matchCategoriaCustoFixo(cf.descricao);
    if (catKey && despesas.porCategoria.has(catKey)) {
      overrides.set(cf.descricao, despesas.porCategoria.get(catKey)!);
    }
  }
  return overrides;
}

// LavSync · Financeiro · Projetado da franqueadora — tipos e chaves canônicas
//
// Contrato entre o Squad Projeção-dados (importação, cálculo, comparativo) e
// o Squad Projeção-tela (editor e comparação). Puro: cliente e servidor.
//
// Convenção de sinais em LinhaProjecao.valores (igual à planilha da
// franqueadora): receita, deduções e custos em MAGNITUDE POSITIVA (o grupo
// diz que subtrai); "resultado" e "fluxo_acumulado" com sinal;
// "percentual_potencial" em fração 0..1. Campos *_pct das premissas em
// PONTOS PERCENTUAIS (5 = 5%), como os percentuais do motor do DRE; a rampa
// em fração 0..1.

export type GrupoProjecao = "receita" | "deducao" | "csp" | "franchising" | "pessoal" | "terceiros" | "marketing" | "gerais" | "resultado" | "indicador";

export type LinhaProjecao = { chave: string; descricao: string; grupo: GrupoProjecao; ordem: number; valores: number[] /* 60 meses */; editado?: boolean; conferir?: boolean };

export type PremissasProjecao = { potencial_faturamento: number; rampa: number[] /* 60, fração 0..1 */; csp_pct: number; royalties_pct: number; royalties_minimo: number; royalties_minimo_a_partir_mes: number; fundo_propaganda_fixo: number; aluguel: number; energia_pct: number; agua_pct: number; telefone: number; contador: number; software: number; seguro: number; taxa_cartao_pct: number; servicos_bancarios: number; publicidade_local: number; publicidade_inaugural: number; publicidade_inaugural_meses: number; materiais: number; pessoal: number; metodo_simples: "franqueadora" | "legal" };

export type InvestimentoProjecao = { total: number; capital_giro: number; categorias: Array<{ nome: string; valor: number; itens: Array<{ descricao: string; unitario: number; quantidade: number; total: number }> }> };

export type Projecao = { id?: string; unidade_id: string; nome: string; origem: "importacao" | "manual"; arquivo_path?: string | null; arquivo_nome?: string | null; mes1_ano: number; mes1_mes: number; premissas: PremissasProjecao | null; investimento: InvestimentoProjecao | null; linhas: LinhaProjecao[]; avisos: string[]; ativa: boolean };

export type ComparativoMes = { mes_index: number; chave_mes: string /* AAAA-MM */; projetado: { faturamento: number; resultado: number; linhas: Record<string, number> }; real: { faturamento: number; resultado: number; linhas: Record<string, number>; estimado: boolean } | null };

export type ComparativoProjecao = { escopo: string; unidades: string[]; meses: ComparativoMes[]; acumulado: { fat_proj: number; fat_real: number; res_proj: number; res_real: number; pct_atingido: number }; payback: { projetado_mes: number | null; real_estimado_mes: number | null; investimento: number }; insights: Array<{ tom: "positivo" | "negativo" | "neutro"; texto: string; href?: string }>; simples_divergente: boolean; /** Consolidado: unidades do escopo SEM projeção ativa (fora das somas). */ unidades_sem_projecao?: string[] };

// ─── Chaves canônicas (alinhadas às linhas do nosso DRE) ──────────────────

export const N_MESES = 60;

export type ChaveCanonica =
  | "faturamento" | "simples" | "csp" | "royalties" | "fundo_propaganda" | "pessoal"
  | "aluguel" | "energia" | "agua" | "telefone" | "contador" | "software" | "seguro"
  | "taxa_cartao" | "servicos_bancarios" | "marketing_local" | "materiais" | "outras_despesas"
  | "resultado" | "fluxo_acumulado" | "percentual_potencial";

/** Ordem de exibição, grupo e rótulo padrão de cada chave canônica. */
export const CHAVES_CANONICAS: ReadonlyArray<{ chave: ChaveCanonica; grupo: GrupoProjecao; descricao: string }> = [
  { chave: "percentual_potencial", grupo: "indicador", descricao: "% do potencial atingido" },
  { chave: "faturamento", grupo: "receita", descricao: "Faturamento bruto" },
  { chave: "simples", grupo: "deducao", descricao: "Simples Nacional" },
  { chave: "csp", grupo: "csp", descricao: "Custo do serviço prestado" },
  { chave: "royalties", grupo: "franchising", descricao: "Royalties" },
  { chave: "fundo_propaganda", grupo: "franchising", descricao: "Fundo de propaganda" },
  { chave: "pessoal", grupo: "pessoal", descricao: "Pessoal" },
  { chave: "aluguel", grupo: "terceiros", descricao: "Aluguel e IPTU" },
  { chave: "energia", grupo: "terceiros", descricao: "Energia" },
  { chave: "agua", grupo: "terceiros", descricao: "Água" },
  { chave: "telefone", grupo: "terceiros", descricao: "Telefone e internet" },
  { chave: "contador", grupo: "terceiros", descricao: "Contador" },
  { chave: "software", grupo: "terceiros", descricao: "Software" },
  { chave: "seguro", grupo: "terceiros", descricao: "Seguro" },
  { chave: "taxa_cartao", grupo: "terceiros", descricao: "Taxa de cartão" },
  { chave: "servicos_bancarios", grupo: "terceiros", descricao: "Serviços bancários" },
  { chave: "marketing_local", grupo: "marketing", descricao: "Publicidade local" },
  { chave: "materiais", grupo: "gerais", descricao: "Materiais de uso e consumo" },
  { chave: "outras_despesas", grupo: "gerais", descricao: "Outras despesas" },
  { chave: "resultado", grupo: "resultado", descricao: "Resultado operacional" },
  { chave: "fluxo_acumulado", grupo: "indicador", descricao: "Fluxo de caixa acumulado" },
];

const POR_CHAVE = new Map(CHAVES_CANONICAS.map((c, i) => [c.chave as string, { ...c, ordem: i * 10 }]));

/** Grupos que SUBTRAEM do faturamento para chegar ao resultado. */
export const GRUPOS_CUSTO: ReadonlyArray<GrupoProjecao> = ["deducao", "csp", "franchising", "pessoal", "terceiros", "marketing", "gerais"];

export function ehChaveCanonica(chave: string): chave is ChaveCanonica {
  return POR_CHAVE.has(chave);
}

export function infoChave(chave: string): { grupo: GrupoProjecao; descricao: string; ordem: number } | null {
  return POR_CHAVE.get(chave) ?? null;
}

/** "Taxa de Publicidade Local" → "outros:taxa-de-publicidade-local" */
export function chaveOutros(descricao: string): string {
  const slug = descricao.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `outros:${slug || "linha"}`;
}

/** Ordem de uma linha "outros:*": logo depois das canônicas do mesmo grupo. */
export function ordemOutros(grupo: GrupoProjecao, seq: number): number {
  let max = 0;
  for (const c of POR_CHAVE.values()) if (c.grupo === grupo) max = Math.max(max, c.ordem);
  return max + 1 + Math.min(seq, 8);
}

/** Série de 60 meses a partir de qualquer array (corta ou completa com zero). */
export function serie60(v: ArrayLike<number | null | undefined> | null | undefined): number[] {
  return Array.from({ length: N_MESES }, (_, i) => {
    const x = Number(v?.[i] ?? 0);
    return Number.isFinite(x) ? x : 0;
  });
}

/** "AAAA-MM" do mês `indice` (1..N) de uma projeção que começa em ano/mês. */
export function chaveMesDoIndice(mes1Ano: number, mes1Mes: number, indice: number): string {
  const t = mes1Ano * 12 + (mes1Mes - 1) + (indice - 1);
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/** Índice 1-based de "AAAA-MM" numa projeção que começa em ano/mês (pode cair fora de 1..60). */
export function indiceDoMes(mes1Ano: number, mes1Mes: number, chaveMes: string): number {
  const [a, m] = chaveMes.split("-").map(Number);
  return (a - mes1Ano) * 12 + (m - mes1Mes) + 1;
}

// LavSync · Clube de Vantagens · Queries
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { NivelClube } from "./niveis";

export type Classificacao = {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  cliente_cpf: string;
  unidade_id: string;
  unidade_nome: string;
  mes_ref: string;           // YYYY-MM-DD (1º dia mês)
  mes_aplicacao: string;
  ciclos_mes: number;
  ciclos_lavagem: number;
  ciclos_secagem: number;
  faturamento_mes: number;
  nivel: NivelClube;
  desconto_pct: number;
  pontos_acumulado: number;
};

export type ResumoClube = {
  total: number;
  porNivel: Record<NivelClube, number>;
  fatProjetadoDesconto: number;     // R$ que será dado em desconto no mês_aplicacao
  topMembros: Classificacao[];
};

export async function listarClassificacoes(
  unidadeIds: string[],
  mesAplicacao: string,    // YYYY-MM-01
): Promise<Classificacao[]> {
  const sb = await createClient();
  let q = sb.from("clube_classificacoes")
    .select(`
      id, cliente_id, unidade_id, mes_ref, mes_aplicacao,
      ciclos_mes, ciclos_lavagem, ciclos_secagem, faturamento_mes,
      nivel, desconto_pct,
      cliente:clientes(nome, telefone, cpf),
      unidade:unidades(nome)
    `)
    .eq("mes_aplicacao", mesAplicacao)
    .neq("nivel", "nao_classificado")
    .order("ciclos_mes", { ascending: false });
  if (unidadeIds.length > 0) q = q.in("unidade_id", unidadeIds);
  const { data, error } = await q;
  if (error) throw error;

  type Raw = {
    id: string; cliente_id: string; unidade_id: string;
    mes_ref: string; mes_aplicacao: string;
    ciclos_mes: number; ciclos_lavagem: number; ciclos_secagem: number;
    faturamento_mes: number | string;
    nivel: string; desconto_pct: number | string;
    cliente: { nome: string; telefone: string | null; cpf: string } | Array<{ nome: string; telefone: string | null; cpf: string }> | null;
    unidade: { nome: string } | Array<{ nome: string }> | null;
  };
  const rows = (data ?? []) as unknown as Raw[];
  // Buscar pontos totais
  const ids = rows.map((r) => r.cliente_id);
  const pontosMap = new Map<string, number>();
  if (ids.length > 0) {
    const { data: p } = await sb.from("clube_pontos").select("cliente_id, total_acumulado").in("cliente_id", ids);
    for (const x of (p ?? []) as Array<{ cliente_id: string; total_acumulado: number }>) {
      pontosMap.set(x.cliente_id, x.total_acumulado);
    }
  }

  return rows.map((r) => {
    const un = Array.isArray(r.unidade) ? r.unidade[0] : r.unidade;
    const cli = Array.isArray(r.cliente) ? r.cliente[0] : r.cliente;
    return {
      id: r.id,
      cliente_id: r.cliente_id,
      cliente_nome: cli?.nome ?? "—",
      cliente_telefone: cli?.telefone ?? null,
      cliente_cpf: cli?.cpf ?? "",
      unidade_id: r.unidade_id,
      unidade_nome: un?.nome ?? "—",
      mes_ref: r.mes_ref,
      mes_aplicacao: r.mes_aplicacao,
      ciclos_mes: r.ciclos_mes,
      ciclos_lavagem: r.ciclos_lavagem,
      ciclos_secagem: r.ciclos_secagem,
      faturamento_mes: Number(r.faturamento_mes),
      nivel: r.nivel as NivelClube,
      desconto_pct: Number(r.desconto_pct),
      pontos_acumulado: pontosMap.get(r.cliente_id) ?? 0,
    };
  });
}

export async function resumoClube(unidadeIds: string[], mesAplicacao: string): Promise<ResumoClube> {
  const classif = await listarClassificacoes(unidadeIds, mesAplicacao);
  const porNivel: Record<NivelClube, number> = {
    nao_classificado: 0, bronze: 0, prata: 0, ouro: 0, diamante: 0,
  };
  let fatProj = 0;
  for (const c of classif) {
    porNivel[c.nivel] += 1;
    // Projetar desconto: ciclo médio * 17 * desconto_pct (estimativa simples)
    // Sem dados de comportamento no mês_aplicacao ainda, faz por faturamento_mes_ref como proxy
    fatProj += c.faturamento_mes * (c.desconto_pct / 100);
  }
  return {
    total: classif.length,
    porNivel,
    fatProjetadoDesconto: Math.round(fatProj * 100) / 100,
    topMembros: classif.slice(0, 10),
  };
}

/** Lista os meses disponíveis (com classificação) pra dropdown */
export async function listarMesesDisponiveis(): Promise<string[]> {
  const sb = await createClient();
  const { data } = await sb.from("clube_classificacoes")
    .select("mes_aplicacao")
    .order("mes_aplicacao", { ascending: false });
  const set = new Set<string>();
  for (const r of (data ?? []) as Array<{ mes_aplicacao: string }>) {
    set.add(r.mes_aplicacao);
  }
  return Array.from(set);
}

export type TemplateMensagem = {
  id: string;
  tipo: string;
  nivel_alvo: string | null;
  titulo: string;
  mensagem: string;
  ativo: boolean;
  ordem: number;
};

export async function listarTemplates(): Promise<TemplateMensagem[]> {
  const sb = await createClient();
  const { data, error } = await sb.from("clube_templates_mensagem")
    .select("*")
    .order("ordem");
  if (error) throw error;
  return (data ?? []) as TemplateMensagem[];
}

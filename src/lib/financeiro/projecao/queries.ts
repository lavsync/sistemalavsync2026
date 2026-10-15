// LavSync · Financeiro · Projetado da franqueadora — leitura do banco (server)
//
// Recebe o client Supabase de quem chama (sessão com RLS na tela/Painel;
// service role só depois do gate). Linhas sempre normalizadas para 60 meses.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serie60, type GrupoProjecao, type InvestimentoProjecao, type LinhaProjecao, type PremissasProjecao, type Projecao } from "./tipos";

export const BUCKET_PROJECOES = "projecoes-franqueadora";

type RowProjecao = {
  id: string; unidade_id: string; nome: string; origem: "importacao" | "manual";
  arquivo_path: string | null; arquivo_nome: string | null; mes1_ano: number; mes1_mes: number;
  premissas: PremissasProjecao | null; investimento: InvestimentoProjecao | null;
  observacoes_ia: unknown; ativa: boolean; atualizado_em: string;
};
type RowLinha = { chave: string; descricao: string; grupo: GrupoProjecao; ordem: number; valores: Array<number | string> | null; editado: boolean; conferir: boolean };

const COLS = "id, unidade_id, nome, origem, arquivo_path, arquivo_nome, mes1_ano, mes1_mes, premissas, investimento, observacoes_ia, ativa, atualizado_em";

function montar(p: RowProjecao, linhas: RowLinha[]): Projecao {
  return {
    id: p.id, unidade_id: p.unidade_id, nome: p.nome, origem: p.origem,
    arquivo_path: p.arquivo_path, arquivo_nome: p.arquivo_nome,
    mes1_ano: p.mes1_ano, mes1_mes: p.mes1_mes,
    premissas: p.premissas ? { ...p.premissas, rampa: serie60(p.premissas.rampa) } : null,
    investimento: p.investimento,
    linhas: linhas.map((l): LinhaProjecao => ({
      chave: l.chave, descricao: l.descricao, grupo: l.grupo, ordem: l.ordem,
      valores: serie60((l.valores ?? []).map(Number)),
      ...(l.editado ? { editado: true } : {}), ...(l.conferir ? { conferir: true } : {}),
    })).sort((a, b) => a.ordem - b.ordem),
    avisos: Array.isArray(p.observacoes_ia) ? (p.observacoes_ia as unknown[]).map(String) : [],
    ativa: p.ativa,
  };
}

async function linhasDe(sb: SupabaseClient, projecaoId: string): Promise<RowLinha[]> {
  const { data, error } = await sb.from("financeiro_projecao_linhas")
    .select("chave, descricao, grupo, ordem, valores, editado, conferir")
    .eq("projecao_id", projecaoId).order("ordem");
  if (error) throw new Error(error.message);
  return (data ?? []) as RowLinha[];
}

/** Projeção ATIVA da franqueadora para a unidade (null se não houver). */
export async function getProjecaoAtiva(sb: SupabaseClient, unidadeId: string): Promise<Projecao | null> {
  const { data, error } = await sb.from("financeiro_projecoes").select(COLS)
    .eq("unidade_id", unidadeId).eq("ativa", true).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const p = data as RowProjecao;
  return montar(p, await linhasDe(sb, p.id));
}

/** Projeção por id (null se não existir ou a RLS não deixar ver). */
export async function getProjecao(sb: SupabaseClient, id: string): Promise<Projecao | null> {
  const { data, error } = await sb.from("financeiro_projecoes").select(COLS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const p = data as RowProjecao;
  return montar(p, await linhasDe(sb, p.id));
}

export type ProjecaoResumo = Pick<Projecao, "id" | "nome" | "origem" | "arquivo_nome" | "ativa" | "mes1_ano" | "mes1_mes"> & { atualizado_em: string };

export async function listarProjecoesDaUnidade(sb: SupabaseClient, unidadeId: string): Promise<ProjecaoResumo[]> {
  const { data, error } = await sb.from("financeiro_projecoes")
    .select("id, nome, origem, arquivo_nome, ativa, mes1_ano, mes1_mes, atualizado_em")
    .eq("unidade_id", unidadeId).order("ativa", { ascending: false }).order("atualizado_em", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjecaoResumo[];
}

"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Apaga uma importação E todas as vendas que ela criou (via importacao_id).
 * Retorna a contagem de vendas removidas.
 */
export async function excluirImportacao(id: string): Promise<{ vendasRemovidas: number }> {
  const sb = await createClient();
  // Primeiro apaga vendas vinculadas
  const { data: del, error: e1 } = await sb
    .from("vendas")
    .delete({ count: "exact" })
    .eq("importacao_id", id)
    .select("id");
  if (e1) throw e1;
  const vendasRemovidas = (del?.length ?? 0);

  const { error: e2 } = await sb.from("vendas_importacoes").delete().eq("id", id);
  if (e2) throw e2;

  revalidatePath("/performance/importacoes");
  revalidatePath("/performance");
  return { vendasRemovidas };
}

/**
 * Zera TODAS as importações + vendas de uma unidade (uso pra reset completo).
 */
export async function zerarImportacoesUnidade(unidadeId: string): Promise<{ vendas: number; imports: number }> {
  const sb = await createClient();
  const { data: dv } = await sb
    .from("vendas")
    .delete()
    .eq("unidade_id", unidadeId)
    .select("id");
  const { data: di } = await sb
    .from("vendas_importacoes")
    .delete()
    .eq("unidade_id", unidadeId)
    .select("id");
  revalidatePath("/performance/importacoes");
  revalidatePath("/performance");
  return { vendas: dv?.length ?? 0, imports: di?.length ?? 0 };
}

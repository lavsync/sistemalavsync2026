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
  revalidatePath("/cadastros/importacoes");
  revalidatePath("/performance/importacoes");
  revalidatePath("/performance");
  return { vendas: dv?.length ?? 0, imports: di?.length ?? 0 };
}

// ─── CLIENTES ───────────────────────────────────────────────────────
/**
 * Exclui importação de clientes:
 * - apaga apenas clientes vinculados que NÃO têm compras (compras_total_qtd > 0 preserva)
 * - clientes preservados ficam com importacao_id = NULL
 * - apaga o log da importação
 */
export async function excluirImportacaoClientes(id: string): Promise<{
  clientesRemovidos: number;
  clientesPreservados: number;
}> {
  const sb = await createClient();
  // Apagar clientes sem compras
  const { data: removidos, error: e1 } = await sb
    .from("clientes")
    .delete()
    .eq("importacao_id", id)
    .eq("compras_total_qtd", 0)
    .select("id");
  if (e1) throw e1;
  // Desvincular os que ficaram (têm compras)
  const { data: preservados, error: e2 } = await sb
    .from("clientes")
    .update({ importacao_id: null })
    .eq("importacao_id", id)
    .select("id");
  if (e2) throw e2;
  // Apagar o log
  const { error: e3 } = await sb.from("clientes_importacoes").delete().eq("id", id);
  if (e3) throw e3;

  revalidatePath("/cadastros/importacoes");
  revalidatePath("/clientes");
  return {
    clientesRemovidos: removidos?.length ?? 0,
    clientesPreservados: preservados?.length ?? 0,
  };
}

/**
 * Zera todas as importações de clientes de uma unidade. Igual ao acima mas em batch.
 */
export async function zerarImportacoesClientesUnidade(unidadeId: string): Promise<{
  imports: number;
  clientesRemovidos: number;
  clientesPreservados: number;
}> {
  const sb = await createClient();
  // Lista de imports
  const { data: imps } = await sb
    .from("clientes_importacoes")
    .select("id")
    .eq("unidade_id", unidadeId);
  const ids = ((imps ?? []) as Array<{ id: string }>).map((x) => x.id);

  let removidos = 0;
  let preservados = 0;
  if (ids.length > 0) {
    // Apagar clientes sem compras vinculados a esses imports
    const { data: dr } = await sb
      .from("clientes")
      .delete()
      .in("importacao_id", ids)
      .eq("compras_total_qtd", 0)
      .select("id");
    removidos = dr?.length ?? 0;
    // Desvincular os que sobrevivem
    const { data: dp } = await sb
      .from("clientes")
      .update({ importacao_id: null })
      .in("importacao_id", ids)
      .select("id");
    preservados = dp?.length ?? 0;
  }
  // Apagar logs
  const { data: di } = await sb
    .from("clientes_importacoes")
    .delete()
    .eq("unidade_id", unidadeId)
    .select("id");
  const imports = di?.length ?? 0;

  revalidatePath("/cadastros/importacoes");
  revalidatePath("/clientes");
  return { imports, clientesRemovidos: removidos, clientesPreservados: preservados };
}

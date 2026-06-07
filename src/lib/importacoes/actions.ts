"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Apaga uma importação de vendas. FK ON DELETE CASCADE (migration 0011) apaga
 * todas as vendas com aquele importacao_id automaticamente no banco.
 */
export async function excluirImportacao(id: string): Promise<{ vendasRemovidas: number }> {
  const sb = await createClient();
  // Conta antes pra retornar (após o delete, o cascade já apagou)
  const { count } = await sb
    .from("vendas")
    .select("id", { count: "exact", head: true })
    .eq("importacao_id", id);
  const vendasRemovidas = count ?? 0;

  const { error } = await sb.from("vendas_importacoes").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/cadastros/importacoes");
  revalidatePath("/performance");
  revalidatePath("/");
  return { vendasRemovidas };
}

/**
 * Zera TODAS as importações + vendas de uma unidade.
 * 1. Apaga as importações (cascade apaga vendas com importacao_id)
 * 2. Apaga vendas "órfãs" (sem importacao_id) da unidade pra garantir limpeza total
 */
export async function zerarImportacoesUnidade(unidadeId: string): Promise<{ vendas: number; imports: number }> {
  const sb = await createClient();
  const { count: vendasCount } = await sb
    .from("vendas")
    .select("id", { count: "exact", head: true })
    .eq("unidade_id", unidadeId);
  const { data: di } = await sb
    .from("vendas_importacoes")
    .delete()
    .eq("unidade_id", unidadeId)
    .select("id");
  // Apagar vendas órfãs remanescentes (sem importacao_id) da mesma unidade
  await sb.from("vendas")
    .delete()
    .eq("unidade_id", unidadeId)
    .is("importacao_id", null);
  revalidatePath("/cadastros/importacoes");
  revalidatePath("/performance");
  revalidatePath("/");
  return { vendas: vendasCount ?? 0, imports: di?.length ?? 0 };
}

// ─── CLIENTES ───────────────────────────────────────────────────────
/**
 * Apaga uma importação de clientes. FK ON DELETE CASCADE (migration 0011) apaga
 * os clientes vinculados. Vendas que referenciavam esses clientes ficam com
 * cliente_id = NULL (FK vendas_cliente_id_fkey já tem ON DELETE SET NULL).
 */
export async function excluirImportacaoClientes(id: string): Promise<{
  clientesRemovidos: number;
}> {
  const sb = await createClient();
  const { count } = await sb
    .from("clientes")
    .select("id", { count: "exact", head: true })
    .eq("importacao_id", id);
  const clientesRemovidos = count ?? 0;

  const { error } = await sb.from("clientes_importacoes").delete().eq("id", id);
  if (error) throw error;

  revalidatePath("/cadastros/importacoes");
  revalidatePath("/clientes");
  revalidatePath("/");
  return { clientesRemovidos };
}

/**
 * Zera todas as importações de clientes de uma unidade.
 * 1. Apaga importações (cascade apaga clientes vinculados via importacao_id)
 * 2. Apaga clientes "órfãos" (sem importacao_id) da mesma unidade pra limpeza total
 */
export async function zerarImportacoesClientesUnidade(unidadeId: string): Promise<{
  imports: number;
  clientesRemovidos: number;
}> {
  const sb = await createClient();
  const { count: clientesAntes } = await sb
    .from("clientes")
    .select("id", { count: "exact", head: true })
    .eq("unidade_id", unidadeId);

  const { data: di } = await sb
    .from("clientes_importacoes")
    .delete()
    .eq("unidade_id", unidadeId)
    .select("id");
  // Apagar clientes órfãos remanescentes (sem importacao_id) da mesma unidade
  await sb.from("clientes")
    .delete()
    .eq("unidade_id", unidadeId)
    .is("importacao_id", null);

  revalidatePath("/cadastros/importacoes");
  revalidatePath("/clientes");
  revalidatePath("/");
  return { imports: di?.length ?? 0, clientesRemovidos: clientesAntes ?? 0 };
}

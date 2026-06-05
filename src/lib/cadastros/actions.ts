"use server";
// LavSync · Cadastros · Server actions (CRUD genérico por tabela)
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const TABELAS_PERMITIDAS = new Set([
  "categorias_financeiras",
  "fornecedores",
  "despesas",
  "servicos",
  "planos",
  "campanhas",
  "parceiros",
  "unidades",
]);

async function pegarTenantId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from("tenants").select("id").limit(1).maybeSingle();
  if (!data) throw new Error("Tenant não encontrado");
  return (data as { id: string }).id;
}

export async function criarCadastro(tabela: string, dados: Record<string, unknown>) {
  if (!TABELAS_PERMITIDAS.has(tabela)) throw new Error(`Tabela ${tabela} não permitida`);
  const supabase = await createClient();
  const tenant_id = await pegarTenantId();
  const payload = { ...dados, tenant_id };
  const { error } = await supabase.from(tabela).insert(payload);
  if (error) throw error;
  revalidatePath(`/cadastros/${tabela.replace("_", "-")}`);
  revalidatePath("/cadastros");
}

export async function atualizarCadastro(tabela: string, id: string, dados: Record<string, unknown>) {
  if (!TABELAS_PERMITIDAS.has(tabela)) throw new Error(`Tabela ${tabela} não permitida`);
  const supabase = await createClient();
  const { error } = await supabase.from(tabela).update(dados).eq("id", id);
  if (error) throw error;
  revalidatePath(`/cadastros/${tabela.replace("_", "-")}`);
}

export async function deletarCadastro(tabela: string, id: string) {
  if (!TABELAS_PERMITIDAS.has(tabela)) throw new Error(`Tabela ${tabela} não permitida`);
  const supabase = await createClient();
  const { error } = await supabase.from(tabela).delete().eq("id", id);
  if (error) throw error;
  revalidatePath(`/cadastros/${tabela.replace("_", "-")}`);
  revalidatePath("/cadastros");
}

export async function alternarAtivoCadastro(tabela: string, id: string, ativo: boolean) {
  if (!TABELAS_PERMITIDAS.has(tabela)) throw new Error(`Tabela ${tabela} não permitida`);
  const supabase = await createClient();
  // Algumas tabelas usam "ativa" em vez de "ativo"
  const campo = ["categorias_financeiras", "unidades"].includes(tabela) ? "ativa" : "ativo";
  const { error } = await supabase.from(tabela).update({ [campo]: ativo }).eq("id", id);
  if (error) throw error;
  revalidatePath(`/cadastros/${tabela.replace("_", "-")}`);
}

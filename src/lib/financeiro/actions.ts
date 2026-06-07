"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function pegarTenant() {
  const sb = await createClient();
  const { data } = await sb.from("tenants").select("id").limit(1).maybeSingle();
  return (data as { id: string } | null)?.id;
}

export async function atualizarConfigUnidade(unidadeId: string, patch: {
  responsavel_nome?: string | null;
  tipo_unidade?: string;
  mes_inauguracao?: number | null;
  ano_inauguracao?: number | null;
  potencial_faturamento?: number;
  aluguel_iptu?: number | null;
  meta_payback_meses?: number;
}) {
  const sb = await createClient();
  const tenant_id = await pegarTenant();
  const { error } = await sb
    .from("financeiro_unidades_config")
    .upsert({ unidade_id: unidadeId, tenant_id, ...patch }, { onConflict: "unidade_id" });
  if (error) throw error;
  revalidatePath("/financeiro");
}

export async function atualizarValorRealInvestimento(itemId: string, valor: number | null) {
  const sb = await createClient();
  const { error } = await sb
    .from("financeiro_investimento_itens")
    .update({ valor_real: valor })
    .eq("id", itemId);
  if (error) throw error;
  revalidatePath("/financeiro");
}

export async function criarCategoriaInvestimento(unidadeId: string, nome: string) {
  const sb = await createClient();
  const tenant_id = await pegarTenant();
  const { data: max } = await sb
    .from("financeiro_investimento_categorias")
    .select("ordem")
    .eq("unidade_id", unidadeId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordem = ((max as { ordem?: number } | null)?.ordem ?? 0) + 1;
  const { data, error } = await sb
    .from("financeiro_investimento_categorias")
    .insert({ unidade_id: unidadeId, tenant_id, nome: nome.trim(), ordem })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/financeiro");
  return (data as { id: string }).id;
}

export async function deletarCategoriaInvestimento(id: string) {
  const sb = await createClient();
  const { error } = await sb.from("financeiro_investimento_categorias").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/financeiro");
}

export async function criarItemInvestimento(categoriaId: string, unidadeId: string, dados: { descricao: string; valor_projetado: number }) {
  const sb = await createClient();
  const tenant_id = await pegarTenant();
  const { data: max } = await sb
    .from("financeiro_investimento_itens")
    .select("ordem")
    .eq("categoria_id", categoriaId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordem = ((max as { ordem?: number } | null)?.ordem ?? 0) + 1;
  const { error } = await sb.from("financeiro_investimento_itens").insert({
    categoria_id: categoriaId,
    unidade_id: unidadeId,
    tenant_id,
    descricao: dados.descricao.trim(),
    valor_projetado: dados.valor_projetado,
    ordem,
  });
  if (error) throw error;
  revalidatePath("/financeiro");
}

export async function deletarItemInvestimento(id: string) {
  const sb = await createClient();
  const { error } = await sb.from("financeiro_investimento_itens").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/financeiro");
}

export async function lancarFaturamentoMes(input: {
  unidade_id: string;
  mes_index: number;
  ano: number;
  mes: number;
  faturamento_real: number | null;
}) {
  const sb = await createClient();
  const tenant_id = await pegarTenant();
  const { error } = await sb.from("financeiro_lancamentos").upsert(
    {
      unidade_id: input.unidade_id,
      tenant_id,
      mes_index: input.mes_index,
      ano: input.ano,
      mes: input.mes,
      faturamento_real: input.faturamento_real,
    },
    { onConflict: "unidade_id,mes_index" },
  );
  if (error) throw error;
  revalidatePath("/financeiro");
}

export async function salvarCustoFixo(unidadeId: string, dados: {
  id?: string;
  descricao: string;
  valor_mensal: number;
  valor_inaugural?: number | null;
  meses_inaugural?: number | null;
  ativo?: boolean;
}) {
  const sb = await createClient();
  const tenant_id = await pegarTenant();
  if (dados.id) {
    const { error } = await sb.from("financeiro_custos_fixos").update(dados).eq("id", dados.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from("financeiro_custos_fixos").insert({ unidade_id: unidadeId, tenant_id, ...dados });
    if (error) throw error;
  }
  revalidatePath("/financeiro");
}

export async function deletarCustoFixo(id: string) {
  const sb = await createClient();
  const { error } = await sb.from("financeiro_custos_fixos").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/financeiro");
}

export async function salvarCustoVariavel(unidadeId: string, dados: {
  id?: string;
  descricao: string;
  tipo: string;
  percentual_faturamento?: number | null;
  valor_minimo?: number | null;
  a_partir_do_mes?: number | null;
  ativo?: boolean;
}) {
  const sb = await createClient();
  const tenant_id = await pegarTenant();
  if (dados.id) {
    const { error } = await sb.from("financeiro_custos_variaveis").update(dados).eq("id", dados.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from("financeiro_custos_variaveis").insert({ unidade_id: unidadeId, tenant_id, ...dados });
    if (error) throw error;
  }
  revalidatePath("/financeiro");
}

export async function deletarCustoVariavel(id: string) {
  const sb = await createClient();
  const { error } = await sb.from("financeiro_custos_variaveis").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/financeiro");
}

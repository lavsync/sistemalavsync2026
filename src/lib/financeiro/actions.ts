"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { paginarTodos } from "@/lib/supabase/pagination";
import { normDesc } from "./engine";

type SB = Awaited<ReturnType<typeof createClient>>;

/** Renomear um custo leva junto as despesas reais já lançadas com o nome antigo
 *  (o vínculo custo ↔ valor pago no DRE é pela descrição, acento/maiúscula-insensível). */
async function renomearDespesas(
  sb: SB,
  tabela: "financeiro_custos_fixos" | "financeiro_custos_variaveis",
  id: string,
  novaDescricao: string,
) {
  const { data, error } = await sb.from(tabela).select("descricao, unidade_id").eq("id", id).maybeSingle();
  if (error) throw error;
  const atual = data as { descricao: string; unidade_id: string } | null;
  if (!atual || !novaDescricao.trim() || atual.descricao === novaDescricao) return;
  const alvo = normDesc(atual.descricao);
  const rows = await paginarTodos<{ id: string; descricao: string }>((r) =>
    sb.from("despesas").select("id, descricao").eq("unidade_id", atual.unidade_id).order("id").range(r.from, r.to));
  const ids = rows.filter((d) => normDesc(d.descricao) === alvo).map((d) => d.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { error: e } = await sb.from("despesas").update({ descricao: novaDescricao })
      .in("id", ids.slice(i, i + 200)).eq("unidade_id", atual.unidade_id);
    if (e) throw new Error(`Falha ao renomear as despesas lançadas: ${e.message}`);
  }
}

/** Tenant da unidade (RLS garante o acesso) — antes era o 1º tenant visível,
 *  errado para quem enxerga mais de um. */
async function tenantDaUnidade(sb: SB, unidadeId: string): Promise<string> {
  const { data, error } = await sb.from("unidades").select("tenant_id").eq("id", unidadeId).maybeSingle();
  if (error) throw error;
  const t = (data as { tenant_id: string } | null)?.tenant_id;
  if (!t) throw new Error("Unidade não encontrada");
  return t;
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
  const tenant_id = await tenantDaUnidade(sb, unidadeId);
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
  const tenant_id = await tenantDaUnidade(sb, unidadeId);
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
  const tenant_id = await tenantDaUnidade(sb, unidadeId);
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
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const v = input.faturamento_real;
    if (v != null && (!Number.isFinite(v) || v < 0)) return { ok: false, erro: "Valor inválido" };
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return { ok: false, erro: "Sessão expirada. Entre novamente." };
    const tenant_id = await tenantDaUnidade(sb, input.unidade_id);
    const { error } = await sb.from("financeiro_lancamentos").upsert(
      {
        unidade_id: input.unidade_id,
        tenant_id,
        mes_index: input.mes_index,
        ano: input.ano,
        mes: input.mes,
        faturamento_real: v != null ? Math.round(v * 100) / 100 : null,
      },
      { onConflict: "unidade_id,mes_index" },
    );
    if (error) return { ok: false, erro: error.message };
    revalidatePath("/financeiro");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
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
  const tenant_id = await tenantDaUnidade(sb, unidadeId);
  if (dados.id) {
    await renomearDespesas(sb, "financeiro_custos_fixos", dados.id, dados.descricao);
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
  const tenant_id = await tenantDaUnidade(sb, unidadeId);
  if (dados.id) {
    await renomearDespesas(sb, "financeiro_custos_variaveis", dados.id, dados.descricao);
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

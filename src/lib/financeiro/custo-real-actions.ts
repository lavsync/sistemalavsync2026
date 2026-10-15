"use server";
// LavSync · Financeiro · Custo variável lançado em R$
// O operador informa só o valor pago no mês; o sistema calcula o % sobre o
// faturamento daquele mês, grava a despesa real (competência) e recalibra o %
// do custo = soma paga ÷ soma do faturamento dos meses lançados. O DRE do mês
// usa o valor pago; meses sem lançamento usam o % recalibrado.
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getFaturamentoPorMes } from "./queries";
import { nomeCategoriaFinanceira, normDesc } from "./engine";

export type LancarCustoRealInput = {
  unidade_id: string;
  ano: number;
  mes: number;
  valor: number;
  custo_id?: string;                       // custo existente
  novo?: { descricao: string; tipo: "variavel" | "csp" | "royalties" };
};

export type LancarCustoRealResult = {
  ok: true;
  custo_id: string;
  faturamento_mes: number;
  percentual_mes: number;
  percentual_recalibrado: number | null;
  meses_base: number;
} | { ok: false; erro: string };

async function contexto(unidadeId: string) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: unid } = await sb.from("unidades").select("id, tenant_id").eq("id", unidadeId).maybeSingle();
  if (!unid) throw new Error("Unidade não encontrada");
  return { sb, tenant_id: (unid as { tenant_id: string }).tenant_id };
}

async function idCategoria(sb: Awaited<ReturnType<typeof createClient>>, tenant_id: string, descricao: string) {
  const nome = nomeCategoriaFinanceira(descricao);
  const { data } = await sb.from("categorias_financeiras").select("id")
    .eq("tenant_id", tenant_id).eq("tipo", "despesa").eq("nome", nome).maybeSingle();
  if (data) return (data as { id: string }).id;
  const { data: nova } = await sb.from("categorias_financeiras")
    .insert({ tenant_id, nome, tipo: "despesa", cor: "#19C7CB" }).select("id").single();
  return (nova as { id: string } | null)?.id ?? null;
}

/** Recalcula o % do custo a partir de TODOS os meses com valor pago lançado. */
async function recalibrarPercentual(
  sb: Awaited<ReturnType<typeof createClient>>,
  unidadeId: string,
  custoId: string,
  descricao: string,
  fatPorMes: Map<string, number>,
): Promise<{ pct: number | null; meses: number }> {
  const { data } = await sb.from("despesas")
    .select("descricao, valor, vencimento, data_competencia")
    .eq("unidade_id", unidadeId)
    .neq("status", "cancelada")
    .ilike("descricao", descricao.replace(/[%_]/g, "\\$&"));
  const porMes = new Map<string, number>();
  for (const d of (data ?? []) as Array<{ descricao: string; valor: number | string; vencimento: string; data_competencia: string | null }>) {
    if (normDesc(d.descricao) !== normDesc(descricao)) continue;
    const k = (d.data_competencia ?? d.vencimento).slice(0, 7);
    porMes.set(k, (porMes.get(k) ?? 0) + (Number(d.valor) || 0));
  }
  let pago = 0, fat = 0, meses = 0;
  for (const [k, v] of porMes) {
    const f = fatPorMes.get(k);
    if (!f || f <= 0) continue;
    pago += v; fat += f; meses++;
  }
  if (meses === 0) return { pct: null, meses: 0 };
  const pct = Math.round((pago / fat) * 10000) / 100;   // numeric(5,2)
  await sb.from("financeiro_custos_variaveis").update({ percentual_faturamento: Math.min(pct, 999.99) }).eq("id", custoId);
  return { pct, meses };
}

export async function lancarCustoVariavelReal(input: LancarCustoRealInput): Promise<LancarCustoRealResult> {
  try {
    if (!(input.valor > 0)) return { ok: false, erro: "Informe um valor maior que zero." };
    const { sb, tenant_id } = await contexto(input.unidade_id);
    const chave = `${input.ano}-${String(input.mes).padStart(2, "0")}`;
    const fatPorMes = await getFaturamentoPorMes(input.unidade_id);
    const fatMes = fatPorMes.get(chave) ?? 0;
    if (fatMes <= 0) return { ok: false, erro: "Esse mês não tem faturamento real — importe as vendas ou lance o faturamento antes." };

    // Resolve o custo (existente ou novo)
    let custoId = input.custo_id;
    let descricao: string;
    if (custoId) {
      const { data } = await sb.from("financeiro_custos_variaveis").select("descricao, tipo").eq("id", custoId).maybeSingle();
      if (!data) return { ok: false, erro: "Custo não encontrado." };
      if ((data as { tipo: string }).tipo === "simples") return { ok: false, erro: "O Simples Nacional é calculado automaticamente." };
      descricao = (data as { descricao: string }).descricao;
    } else {
      descricao = (input.novo?.descricao ?? "").trim();
      if (!descricao) return { ok: false, erro: "Dê um nome ao custo." };
      const { data: ord } = await sb.from("financeiro_custos_variaveis").select("ordem")
        .eq("unidade_id", input.unidade_id).order("ordem", { ascending: false }).limit(1).maybeSingle();
      const { data: novo, error } = await sb.from("financeiro_custos_variaveis").insert({
        unidade_id: input.unidade_id, tenant_id, descricao,
        tipo: input.novo?.tipo ?? "variavel",
        percentual_faturamento: Math.round((input.valor / fatMes) * 10000) / 100,
        ativo: true,
        ordem: Number((ord as { ordem: number } | null)?.ordem ?? 0) + 1,
      }).select("id").single();
      if (error || !novo) return { ok: false, erro: error?.message ?? "Falha ao criar o custo." };
      custoId = (novo as { id: string }).id;
    }

    // Grava/atualiza a despesa real da competência (1 por custo/mês)
    const competencia = `${chave}-01`;
    const { data: existentes } = await sb.from("despesas").select("id, descricao")
      .eq("unidade_id", input.unidade_id).eq("data_competencia", competencia);
    const existente = ((existentes ?? []) as Array<{ id: string; descricao: string }>)
      .find((d) => normDesc(d.descricao) === normDesc(descricao));
    const payload = {
      tenant_id,
      unidade_id: input.unidade_id,
      categoria_id: await idCategoria(sb, tenant_id, descricao),
      descricao,
      valor: Math.round(input.valor * 100) / 100,
      vencimento: competencia,
      data_competencia: competencia,
      pago_em: competencia,
      periodicidade: "mensal" as const,
      status: "paga" as const,
      observacoes: "Custo variável lançado em R$ (Financeiro › Configurações)",
    };
    const { error: eDesp } = existente
      ? await sb.from("despesas").update(payload).eq("id", existente.id)
      : await sb.from("despesas").insert(payload);
    if (eDesp) return { ok: false, erro: eDesp.message };

    const { pct, meses } = await recalibrarPercentual(sb, input.unidade_id, custoId!, descricao, fatPorMes);
    revalidatePath("/financeiro");
    return {
      ok: true,
      custo_id: custoId!,
      faturamento_mes: fatMes,
      percentual_mes: Math.round((input.valor / fatMes) * 10000) / 100,
      percentual_recalibrado: pct,
      meses_base: meses,
    };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function removerCustoVariavelReal(unidadeId: string, despesaId: string, custoId: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const { sb } = await contexto(unidadeId);
    const { data: custo } = await sb.from("financeiro_custos_variaveis").select("descricao").eq("id", custoId).maybeSingle();
    const { error } = await sb.from("despesas").delete().eq("id", despesaId).eq("unidade_id", unidadeId);
    if (error) return { ok: false, erro: error.message };
    if (custo) {
      const fatPorMes = await getFaturamentoPorMes(unidadeId);
      await recalibrarPercentual(sb, unidadeId, custoId, (custo as { descricao: string }).descricao, fatPorMes);
    }
    revalidatePath("/financeiro");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

/** Depois de editar/excluir uma despesa no DRE Mensal: se a descrição é de um
 *  custo variável (não Simples), recalibra o % de referência dele. Silencioso. */
export async function recalibrarCustoVariavelPorDescricao(unidadeId: string, descricao: string): Promise<void> {
  try {
    const { sb } = await contexto(unidadeId);
    const { data } = await sb.from("financeiro_custos_variaveis").select("id, descricao, tipo").eq("unidade_id", unidadeId);
    const custo = ((data ?? []) as Array<{ id: string; descricao: string; tipo: string }>)
      .find((c) => c.tipo !== "simples" && normDesc(c.descricao) === normDesc(descricao));
    if (!custo) return;
    const fatPorMes = await getFaturamentoPorMes(unidadeId);
    await recalibrarPercentual(sb, unidadeId, custo.id, custo.descricao, fatPorMes);
  } catch (e) {
    console.error("[financeiro] recalibrar custo variável:", e instanceof Error ? e.message : e);
  }
}

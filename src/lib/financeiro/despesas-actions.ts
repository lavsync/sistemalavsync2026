"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type LancarDespesaItem = {
  descricao: string;
  valor: number;
  vencimento: string;          // YYYY-MM-DD
  categoria_nome?: string | null;
  pago: boolean;
};

/**
 * Lança várias despesas de uma vez (uso do dialog "Lançar despesas do mês").
 * Cria/reusa categorias por nome. Faz upsert por (unidade + descricao + vencimento)
 * pra permitir re-edição sem duplicar.
 */
export async function lancarDespesasLote(
  unidadeId: string,
  itens: LancarDespesaItem[],
): Promise<{ inseridas: number; atualizadas: number }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: unid } = await sb
    .from("unidades")
    .select("id, tenant_id")
    .eq("id", unidadeId)
    .maybeSingle();
  if (!unid) throw new Error("Unidade não encontrada");
  const tenant_id = (unid as { tenant_id: string }).tenant_id;

  // Resolver categoria_id por nome (cria se faltar)
  const nomesUsados = Array.from(new Set(itens.map((i) => i.categoria_nome).filter(Boolean) as string[]));
  const catCache = new Map<string, string>();
  if (nomesUsados.length > 0) {
    const { data: cats } = await sb
      .from("categorias_financeiras")
      .select("id, nome")
      .eq("tenant_id", tenant_id)
      .eq("tipo", "despesa")
      .in("nome", nomesUsados);
    for (const c of (cats ?? []) as Array<{ id: string; nome: string }>) {
      catCache.set(c.nome, c.id);
    }
    for (const nome of nomesUsados) {
      if (catCache.has(nome)) continue;
      const { data: novaCat } = await sb
        .from("categorias_financeiras")
        .insert({ tenant_id, nome, tipo: "despesa", cor: "#19C7CB" })
        .select("id")
        .single();
      if (novaCat) catCache.set(nome, (novaCat as { id: string }).id);
    }
  }

  // Para cada item: verifica se já existe por (unidade + descricao + vencimento) e atualiza,
  // senão insere.
  let inseridas = 0;
  let atualizadas = 0;
  for (const it of itens) {
    if (!it.descricao || !it.vencimento || !(it.valor > 0)) continue;
    const { data: existente } = await sb
      .from("despesas")
      .select("id")
      .eq("unidade_id", unidadeId)
      .eq("descricao", it.descricao)
      .eq("vencimento", it.vencimento)
      .maybeSingle();

    const payload = {
      tenant_id,
      unidade_id: unidadeId,
      categoria_id: it.categoria_nome ? catCache.get(it.categoria_nome) ?? null : null,
      descricao: it.descricao,
      valor: it.valor,
      vencimento: it.vencimento,
      pago_em: it.pago ? it.vencimento : null,
      data_competencia: it.vencimento,
      periodicidade: "mensal" as const,
      status: it.pago ? "paga" as const : "aberta" as const,
    };

    if (existente?.id) {
      await sb.from("despesas").update(payload).eq("id", existente.id);
      atualizadas++;
    } else {
      await sb.from("despesas").insert(payload);
      inseridas++;
    }
  }

  revalidatePath("/financeiro");
  revalidatePath("/cadastros/despesas");
  return { inseridas, atualizadas };
}

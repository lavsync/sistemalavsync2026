"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { inferirGenero } from "./inferir";

/**
 * Aplica inferência de gênero em todos os clientes com `genero` NULL.
 * Não sobrescreve quem já tem gênero definido (manual ou de planilha VM).
 *
 * @param somenteUnidade opcional — limita a 1 unidade
 * @returns total processados, atualizados, indeterminados
 */
export async function inferirGeneroBackfill(somenteUnidade?: string): Promise<{
  processados: number;
  atualizados: number;
  masculinos: number;
  femininos: number;
  indeterminados: number;
}> {
  const sb = await createClient();
  let q = sb.from("clientes")
    .select("id, nome")
    .is("genero", null)
    .limit(5000);
  if (somenteUnidade) q = q.eq("unidade_id", somenteUnidade);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as Array<{ id: string; nome: string }>;

  let masculinos = 0;
  let femininos = 0;
  let indeterminados = 0;

  for (const r of rows) {
    const g = inferirGenero(r.nome);
    if (g === "Masculino") masculinos++;
    else if (g === "Feminino") femininos++;
    else { indeterminados++; continue; }

    await sb.from("clientes").update({ genero: g }).eq("id", r.id);
  }

  revalidatePath("/clientes");
  revalidatePath("/");
  return {
    processados: rows.length,
    atualizados: masculinos + femininos,
    masculinos,
    femininos,
    indeterminados,
  };
}

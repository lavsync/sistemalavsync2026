"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { EngenhariaCustos } from "./margem-engine";

export async function salvarEngenhariaCustos(
  unidadeId: string,
  patch: Partial<EngenhariaCustos>,
) {
  const sb = await createClient();
  const { error } = await sb
    .from("financeiro_engenharia_custos")
    .update(patch)
    .eq("unidade_id", unidadeId);
  if (error) throw error;
  revalidatePath("/financeiro");
}

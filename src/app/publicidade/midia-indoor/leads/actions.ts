"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@mi/lib/supabase/server";
import { requireUser } from "@mi/lib/auth";

type LeadStatus = "novo" | "em_analise" | "aprovado" | "rejeitado";

export async function updateLeadStatusAction(id: string, status: LeadStatus) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("mi_partner_leads").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/publicidade/midia-indoor/leads");
}

export async function deleteLeadAction(id: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("mi_partner_leads").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/publicidade/midia-indoor/leads");
}

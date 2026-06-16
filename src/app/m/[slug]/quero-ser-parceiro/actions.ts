"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@mi/lib/supabase/admin";
import { partnerLeadSchema } from "@mi/schemas";

export type LeadState = { ok: true } | { ok: false; error: string } | undefined;

export async function submitPartnerLeadAction(
  _prev: LeadState,
  formData: FormData,
): Promise<LeadState> {
  const parsed = partnerLeadSchema.safeParse({
    unidade_id: String(formData.get("unidade_id") || ""),
    responsible_name: String(formData.get("responsible_name") || ""),
    business_name: String(formData.get("business_name") || ""),
    segment: (formData.get("segment") as string) || null,
    whatsapp: String(formData.get("whatsapp") || "").replace(/\D/g, ""),
    instagram: (formData.get("instagram") as string) || null,
    address: (formData.get("address") as string) || null,
    benefit_proposal: (formData.get("benefit_proposal") as string) || null,
    message: (formData.get("message") as string) || null,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("mi_partner_leads").insert(parsed.data);
  if (error) return { ok: false, error: error.message };

  const slug = formData.get("unit_slug") as string;
  if (slug) revalidatePath(`/m/${slug}/quero-ser-parceiro`);

  return { ok: true };
}

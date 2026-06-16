"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@mi/lib/supabase/server";
import { requirePartnerUser } from "@mi/lib/partner-auth";

export type ActionState = { ok: true } | { ok: false; error: string } | undefined;

export async function updatePartnerProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { partner } = await requirePartnerUser();
  if (!partner) return { ok: false, error: "Sem cadastro" };

  const patch = {
    name: String(formData.get("name") || partner.name),
    short_description: (formData.get("short_description") as string) || null,
    full_description: (formData.get("full_description") as string) || null,
    instagram: (formData.get("instagram") as string) || null,
    website: (formData.get("website") as string) || null,
    whatsapp_business: (formData.get("whatsapp_business") as string) || null,
    address: (formData.get("address") as string) || null,
    neighborhood: (formData.get("neighborhood") as string) || null,
    logo_url: (formData.get("logo_url") as string) || null,
    cover_url: (formData.get("cover_url") as string) || null,
  };

  const supabase = await createClient();
  const { error } = await supabase.from("mi_partners").update(patch).eq("id", partner.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/parceiro/perfil");
  revalidatePath("/parceiro/dashboard");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@mi/lib/supabase/admin";
import { clubMemberSchema } from "@mi/schemas";

export type ClubSignupState =
  | { ok: true; phone: string }
  | { ok: false; error: string }
  | undefined;

export async function signUpClubMemberAction(
  _prev: ClubSignupState,
  formData: FormData,
): Promise<ClubSignupState> {
  const parsed = clubMemberSchema.safeParse({
    unidade_id: String(formData.get("unidade_id") || ""),
    full_name: String(formData.get("full_name") || ""),
    phone: String(formData.get("phone") || "").replace(/\D/g, ""),
    email: (formData.get("email") as string) || null,
    birthdate: (formData.get("birthdate") as string) || null,
    neighborhood: (formData.get("neighborhood") as string) || null,
    accepted_terms: formData.get("accepted_terms") === "on",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  // Usa admin client para contornar RLS (cadastro público)
  const supabase = createAdminClient();

  const { error } = await supabase.from("mi_club_members").insert(parsed.data);

  if (error) {
    if (error.code === "23505") {
      return { ok: true, phone: parsed.data.phone };
    }
    return { ok: false, error: error.message };
  }

  const slug = formData.get("unit_slug") as string;
  if (slug) revalidatePath(`/m/${slug}/clube-de-beneficios`);

  return { ok: true, phone: parsed.data.phone };
}

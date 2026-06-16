"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@mi/lib/supabase/server";
import { partnerSchema } from "@mi/schemas";
import { requireUser } from "@mi/lib/auth";
import { slugify } from "@mi/lib/utils";

function formToInput(formData: FormData, unitFallback: string | null) {
  return {
    unidade_id: String(formData.get("unidade_id") || unitFallback || ""),
    category_id: String(formData.get("category_id") || ""),
    slug: slugify(String(formData.get("slug") || formData.get("name") || "")),
    name: String(formData.get("name") || ""),
    logo_url: (formData.get("logo_url") as string) || null,
    cover_url: (formData.get("cover_url") as string) || null,
    short_description: (formData.get("short_description") as string) || null,
    full_description: (formData.get("full_description") as string) || null,
    address: (formData.get("address") as string) || null,
    neighborhood: (formData.get("neighborhood") as string) || null,
    whatsapp: (formData.get("whatsapp") as string) || null,
    instagram: (formData.get("instagram") as string) || null,
    website: (formData.get("website") as string) || null,
    external_link: (formData.get("external_link") as string) || null,
    plan: (formData.get("plan") as "gratuito" | "destaque" | "premium") || "gratuito",
    status:
      (formData.get("status") as "pendente" | "ativo" | "pausado" | "removido") || "pendente",
  };
}

export type ActionState = { ok: true } | { ok: false; error: string } | undefined;

export async function createPartnerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { profile } = await requireUser();

  const parsed = partnerSchema.safeParse(formToInput(formData, profile.unidade_id));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  // Gestor só pode criar parceiros na sua unidade
  if (profile.role !== "master" && parsed.data.unidade_id !== profile.unidade_id) {
    return { ok: false, error: "Você só pode cadastrar parceiros na sua unidade" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("mi_partners").insert(parsed.data);

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe parceiro com esse slug nessa unidade" };
    return { ok: false, error: error.message };
  }

  revalidatePath("/publicidade/midia-indoor/parceiros");
  redirect("/publicidade/midia-indoor/parceiros");
}

export async function updatePartnerAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { profile } = await requireUser();
  const parsed = partnerSchema.safeParse(formToInput(formData, profile.unidade_id));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("mi_partners").update(parsed.data).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/publicidade/midia-indoor/parceiros");
  revalidatePath(`/publicidade/midia-indoor/parceiros/${id}`);
  return { ok: true };
}

export async function approvePartnerAction(id: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("mi_partners").update({ status: "ativo" }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/publicidade/midia-indoor/parceiros");
}

export async function togglePartnerStatusAction(id: string, currentStatus: string) {
  await requireUser();
  const next = currentStatus === "ativo" ? "pausado" : "ativo";
  const supabase = await createClient();
  const { error } = await supabase.from("mi_partners").update({ status: next }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/publicidade/midia-indoor/parceiros");
}

export async function deletePartnerAction(id: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("mi_partners").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/publicidade/midia-indoor/parceiros");
  redirect("/publicidade/midia-indoor/parceiros");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@mi/lib/supabase/server";
import { unitSchema } from "@mi/schemas";
import { requireRole } from "@mi/lib/auth";

function formToInput(formData: FormData) {
  return {
    slug: String(formData.get("slug") || ""),
    name: String(formData.get("name") || ""),
    address: (formData.get("address") as string) || null,
    neighborhood: (formData.get("neighborhood") as string) || null,
    city: (formData.get("city") as string) || null,
    state: (formData.get("state") as string) || null,
    phone: (formData.get("phone") as string) || null,
    whatsapp: (formData.get("whatsapp") as string) || null,
    instagram: (formData.get("instagram") as string) || null,
    opening_hours: (formData.get("opening_hours") as string) || null,
    is_active: formData.get("is_active") === "on" || formData.get("is_active") === "true",
  };
}

export type ActionState = { ok: true } | { ok: false; error: string } | undefined;

export async function createUnitAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["master"]);

  const parsed = unitSchema.safeParse(formToInput(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("mi_units").insert(parsed.data);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Já existe uma unidade com esse slug" };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/publicidade/midia-indoor/unidades");
  redirect("/publicidade/midia-indoor/unidades");
}

export async function updateUnitAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["master", "gestor"]);

  const parsed = unitSchema.safeParse(formToInput(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("mi_units").update(parsed.data).eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/publicidade/midia-indoor/unidades");
  revalidatePath(`/publicidade/midia-indoor/unidades/${id}`);
  return { ok: true };
}

export async function toggleUnitActiveAction(id: string, isActive: boolean) {
  await requireRole(["master"]);
  const supabase = await createClient();
  const { error } = await supabase.from("mi_units").update({ is_active: !isActive }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/publicidade/midia-indoor/unidades");
}

export async function regenerateUnitTokenAction(id: string) {
  await requireRole(["master"]);
  const supabase = await createClient();

  // Gera token novo via crypto.randomUUID + remove hífens (24 chars+)
  const newToken = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "").slice(0, 48);

  const { error } = await supabase.from("mi_units").update({ player_token: newToken }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/publicidade/midia-indoor/unidades");
  revalidatePath(`/publicidade/midia-indoor/unidades/${id}`);
  return newToken;
}

export async function deleteUnitAction(id: string) {
  await requireRole(["master"]);
  const supabase = await createClient();
  const { error } = await supabase.from("mi_units").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/publicidade/midia-indoor/unidades");
  redirect("/publicidade/midia-indoor/unidades");
}

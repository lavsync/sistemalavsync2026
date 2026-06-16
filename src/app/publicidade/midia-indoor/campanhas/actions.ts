"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@mi/lib/supabase/server";
import { campaignSchema } from "@mi/schemas";
import { requireUser } from "@mi/lib/auth";

function detectMediaType(url: string | null): "image" | "video" | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (/\.(mp4|webm|mov|m4v)(\?|$)/.test(lower)) return "video";
  return "image";
}

function formToInput(formData: FormData, unitFallback: string | null) {
  const startsAt = formData.get("starts_at") as string;
  const endsAt = formData.get("ends_at") as string;
  const mediaUrl = (formData.get("media_url") as string) || null;
  return {
    unidade_id: String(formData.get("unidade_id") || unitFallback || ""),
    partner_id: (formData.get("partner_id") as string) || null,
    offer_id: (formData.get("offer_id") as string) || null,
    template_id: String(formData.get("template_id") || ""),
    editor_template_id: (formData.get("editor_template_id") as string) || null,
    name: String(formData.get("name") || ""),
    type: String(formData.get("type") || "padrao"),
    priority:
      (formData.get("priority") as "normal" | "destaque" | "premium") || "normal",
    duration_seconds: Number(formData.get("duration_seconds") || 15),
    starts_at: startsAt ? new Date(startsAt).toISOString() : null,
    ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    status:
      (formData.get("status") as "rascunho" | "ativa" | "pausada" | "expirada") ||
      "rascunho",
    headline: (formData.get("headline") as string) || null,
    subheadline: (formData.get("subheadline") as string) || null,
    cta_label: (formData.get("cta_label") as string) || null,
    cta_url: (formData.get("cta_url") as string) || null,
    media_url: mediaUrl,
    media_type: detectMediaType(mediaUrl),
  };
}

export type ActionState = { ok: true } | { ok: false; error: string } | undefined;

export async function createCampaignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { profile } = await requireUser();
  const parsed = campaignSchema.safeParse(formToInput(formData, profile.unidade_id));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  if (profile.role !== "master" && parsed.data.unidade_id !== profile.unidade_id) {
    return { ok: false, error: "Só pode criar campanhas na sua unidade" };
  }

  // Limpar string vazia em partner_id / offer_id (UUIDs)
  const data = {
    ...parsed.data,
    partner_id: parsed.data.partner_id || null,
    offer_id: parsed.data.offer_id || null,
    editor_template_id: parsed.data.editor_template_id || null,
  };

  const supabase = await createClient();
  const { error } = await supabase.from("mi_campaigns").insert(data);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/publicidade/midia-indoor/campanhas");
  redirect("/publicidade/midia-indoor/campanhas");
}

export async function updateCampaignAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { profile } = await requireUser();
  const parsed = campaignSchema.safeParse(formToInput(formData, profile.unidade_id));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const data = {
    ...parsed.data,
    partner_id: parsed.data.partner_id || null,
    offer_id: parsed.data.offer_id || null,
    editor_template_id: parsed.data.editor_template_id || null,
  };

  const supabase = await createClient();
  const { error } = await supabase.from("mi_campaigns").update(data).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/publicidade/midia-indoor/campanhas");
  revalidatePath(`/publicidade/midia-indoor/campanhas/${id}`);
  return { ok: true };
}

export async function toggleCampaignStatusAction(id: string, current: string) {
  await requireUser();
  const next =
    current === "ativa" ? "pausada" : current === "pausada" || current === "rascunho" ? "ativa" : "ativa";
  const supabase = await createClient();
  const { error } = await supabase.from("mi_campaigns").update({ status: next }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/publicidade/midia-indoor/campanhas");
}

export async function deleteCampaignAction(id: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("mi_campaigns").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/publicidade/midia-indoor/campanhas");
  redirect("/publicidade/midia-indoor/campanhas");
}

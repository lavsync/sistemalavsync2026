"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@mi/lib/supabase/server";
import { createAdminClient } from "@mi/lib/supabase/admin";
import { offerSchema } from "@mi/schemas";
import { requireUser } from "@mi/lib/auth";
import { createQrCode } from "@mi/lib/qr-code";

function formToInput(formData: FormData) {
  const startsAt = formData.get("starts_at") as string;
  const expiresAt = formData.get("expires_at") as string;
  return {
    partner_id: String(formData.get("partner_id") || ""),
    title: String(formData.get("title") || ""),
    description: (formData.get("description") as string) || null,
    banner_url: (formData.get("banner_url") as string) || null,
    coupon: (formData.get("coupon") as string) || null,
    terms: (formData.get("terms") as string) || null,
    main_call: (formData.get("main_call") as string) || null,
    cta_label: (formData.get("cta_label") as string) || null,
    cta_url: (formData.get("cta_url") as string) || null,
    whatsapp_url: (formData.get("whatsapp_url") as string) || null,
    starts_at: startsAt ? new Date(startsAt).toISOString() : null,
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    is_featured: formData.get("is_featured") === "on" || formData.get("is_featured") === "true",
    status:
      (formData.get("status") as "ativa" | "inativa" | "expirada") || "ativa",
  };
}

export type ActionState = { ok: true } | { ok: false; error: string } | undefined;

export async function createOfferAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = offerSchema.safeParse(formToInput(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { data: offer, error } = await supabase
    .from("mi_offers")
    .insert(parsed.data)
    .select("id, partner_id")
    .single();

  if (error) return { ok: false, error: error.message };

  // Gera QR Code automaticamente
  try {
    const admin = createAdminClient();
    const { data: partner } = await admin
      .from("mi_partners")
      .select("unidade_id, slug, name, units:mi_units(slug)")
      .eq("id", offer.partner_id)
      .single<{ unidade_id: string; slug: string; name: string; units: { slug: string } | null }>();

    if (partner && partner.units) {
      await createQrCode({
        unitId: partner.unidade_id,
        unitSlug: partner.units.slug,
        purpose: "oferta",
        partnerId: offer.partner_id,
        offerId: offer.id,
        campaignName: parsed.data.title,
        targetPath: `/${partner.units.slug}/oferta/${offer.id}`,
      });
    }
  } catch (e) {
    console.error("Falha ao criar QR Code automático:", e);
  }

  revalidatePath("/publicidade/midia-indoor/ofertas");
  redirect("/publicidade/midia-indoor/ofertas");
}

export async function updateOfferAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireUser();
  const parsed = offerSchema.safeParse(formToInput(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("mi_offers").update(parsed.data).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/publicidade/midia-indoor/ofertas");
  revalidatePath(`/publicidade/midia-indoor/ofertas/${id}`);
  return { ok: true };
}

export async function toggleOfferFeaturedAction(id: string, currentFeatured: boolean) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("mi_offers")
    .update({ is_featured: !currentFeatured })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/publicidade/midia-indoor/ofertas");
}

export async function toggleOfferStatusAction(id: string, currentStatus: string) {
  await requireUser();
  const next = currentStatus === "ativa" ? "inativa" : "ativa";
  const supabase = await createClient();
  const { error } = await supabase.from("mi_offers").update({ status: next }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/publicidade/midia-indoor/ofertas");
}

export async function deleteOfferAction(id: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("mi_offers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/publicidade/midia-indoor/ofertas");
  redirect("/publicidade/midia-indoor/ofertas");
}

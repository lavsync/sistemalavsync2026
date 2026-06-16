import { createAdminClient } from "@mi/lib/supabase/admin";
import { APP_URL } from "@mi/lib/constants";

interface CreateQrCodeOptions {
  unitId: string;
  unitSlug: string;
  purpose: "oferta" | "parceiro" | "clube" | "whatsapp" | "quero-ser-parceiro" | "campanha";
  partnerId?: string | null;
  offerId?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  targetPath: string; // ex: "/buritis/oferta/abc-123"
}

/**
 * Cria um QR Code no banco com URL alvo já populada de UTMs.
 * Retorna o registro completo.
 */
export async function createQrCode(opts: CreateQrCodeOptions) {
  const supabase = createAdminClient();

  const utmCampaign = opts.campaignName ?? opts.purpose;
  const url = new URL(`${APP_URL}${opts.targetPath}`);
  url.searchParams.set("utm_source", "totem");
  url.searchParams.set("utm_medium", "tv");
  url.searchParams.set("utm_campaign", slugifyUtm(utmCampaign));
  if (opts.partnerId) url.searchParams.set("utm_content", `partner-${opts.partnerId.slice(0, 8)}`);

  const { data, error } = await supabase
    .from("mi_qr_codes")
    .insert({
      unidade_id: opts.unitId,
      target_url: url.toString(),
      purpose: opts.purpose,
      partner_id: opts.partnerId ?? null,
      offer_id: opts.offerId ?? null,
      campaign_id: opts.campaignId ?? null,
      utm_source: "totem",
      utm_medium: "tv",
      utm_campaign: slugifyUtm(utmCampaign),
      utm_content: opts.partnerId ? `partner-${opts.partnerId.slice(0, 8)}` : null,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Falha ao criar QR Code: ${error.message}`);
  return data;
}

export async function deleteQrCodesFor(filters: {
  partnerId?: string;
  offerId?: string;
  campaignId?: string;
}) {
  const supabase = createAdminClient();
  let q = supabase.from("mi_qr_codes").delete();
  if (filters.partnerId) q = q.eq("partner_id", filters.partnerId);
  if (filters.offerId) q = q.eq("offer_id", filters.offerId);
  if (filters.campaignId) q = q.eq("campaign_id", filters.campaignId);
  await q;
}

function slugifyUtm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 40);
}

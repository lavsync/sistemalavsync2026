"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@mi/lib/supabase/server";
import { createAdminClient } from "@mi/lib/supabase/admin";
import { requirePartnerUser } from "@mi/lib/partner-auth";
import { createQrCode } from "@mi/lib/qr-code";
import { APP_URL } from "@mi/lib/constants";
import type { QrCodeElement, TextElement, EditorElement, PriceElement } from "@mi/types/editor";

export type ActionState = { ok: true; id?: string } | { ok: false; error: string } | undefined;

const MAX_OFFERS_PER_PARTNER = 5;

interface CreateOfferInput {
  title: string;
  description: string | null;
  banner_url: string | null;
  coupon: string | null;
  main_call: string | null;
  cta_label: string | null;
  starts_at: string | null;
  expires_at: string | null;
  whatsapp_message: string | null;
  price_from: number | null;
  price_by: number | null;
  is_featured: boolean;
}

export async function createPartnerOfferAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { partner } = await requirePartnerUser();
  if (!partner) return { ok: false, error: "Complete seu cadastro antes de criar ofertas" };
  if (partner.status !== "ativo") {
    return { ok: false, error: "Seu cadastro ainda está em análise. Aguarde aprovação para criar ofertas." };
  }

  // Limite de 5 ofertas ativas
  const supabase = await createClient();
  const { count: existing } = await supabase
    .from("mi_offers")
    .select("*", { count: "exact", head: true })
    .eq("partner_id", partner.id)
    .in("status", ["ativa", "inativa"]);
  if ((existing ?? 0) >= MAX_OFFERS_PER_PARTNER) {
    return {
      ok: false,
      error: `Você atingiu o limite de ${MAX_OFFERS_PER_PARTNER} ofertas. Pause ou exclua uma antes de criar outra.`,
    };
  }

  const startsAt = formData.get("starts_at") as string;
  const expiresAt = formData.get("expires_at") as string;
  const priceFrom = formData.get("price_from") as string;
  const priceBy = formData.get("price_by") as string;
  const input: CreateOfferInput = {
    title: String(formData.get("title") ?? "").trim(),
    description: (formData.get("description") as string) || null,
    banner_url: (formData.get("banner_url") as string) || null,
    coupon: (formData.get("coupon") as string) || null,
    main_call: (formData.get("main_call") as string) || null,
    cta_label: (formData.get("cta_label") as string) || null,
    starts_at: startsAt ? new Date(startsAt).toISOString() : null,
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    whatsapp_message: (formData.get("whatsapp_message") as string) || null,
    price_from: priceFrom ? Number(priceFrom) : null,
    price_by: priceBy ? Number(priceBy) : null,
    is_featured: formData.get("is_featured") === "on",
  };

  if (input.title.length < 2) return { ok: false, error: "Título muito curto" };

  const admin = createAdminClient();

  // 1. Cria a oferta
  const whatsappUrl =
    partner.whatsapp || partner.whatsapp_business
      ? `https://wa.me/${(partner.whatsapp_business || partner.whatsapp)!.replace(/\D/g, "")}?text=${encodeURIComponent(
          input.whatsapp_message || `Olá, vi sua oferta "${input.title}" no Clube Xô Varal!`,
        )}`
      : null;

  const { data: offer, error: offerErr } = await admin
    .from("mi_offers")
    .insert({
      partner_id: partner.id,
      title: input.title,
      description: input.description,
      banner_url: input.banner_url,
      coupon: input.coupon,
      main_call: input.main_call,
      cta_label: input.cta_label,
      whatsapp_url: whatsappUrl,
      starts_at: input.starts_at,
      expires_at: input.expires_at,
      is_featured: input.is_featured,
      status: "ativa",
    })
    .select("id, partner_id")
    .single<{ id: string; partner_id: string }>();

  if (offerErr || !offer) return { ok: false, error: offerErr?.message ?? "Falha ao criar oferta" };

  // 2. Cria QR Code rastreável
  const unitSlug = await admin
    .from("mi_units")
    .select("slug")
    .eq("id", partner.unidade_id)
    .single<{ slug: string }>()
    .then((r) => r.data?.slug ?? "default");

  let qrShortUrl = `${APP_URL}/${unitSlug}/oferta/${offer.id}`;
  try {
    const qr = await createQrCode({
      unitId: partner.unidade_id,
      unitSlug,
      purpose: "oferta",
      partnerId: partner.id,
      offerId: offer.id,
      campaignName: input.title,
      targetPath: `/${unitSlug}/oferta/${offer.id}`,
    });
    qrShortUrl = `${APP_URL}/qr/${qr.short_code}`;
  } catch (e) {
    console.error("Falha ao criar QR Code:", e);
  }

  // 3. Cria banner editor_template publicado automaticamente
  try {
    await createBannerFromOffer({
      partner,
      offer: {
        id: offer.id,
        title: input.title,
        description: input.description,
        banner_url: input.banner_url,
        coupon: input.coupon,
        main_call: input.main_call,
        cta_label: input.cta_label,
        price_from: input.price_from,
        price_by: input.price_by,
      },
      qrShortUrl,
    });
  } catch (e) {
    console.error("Falha ao gerar banner automático:", e);
  }

  revalidatePath("/parceiro/dashboard");
  revalidatePath("/parceiro/ofertas");
  revalidatePath("/parceiro/banners");
  redirect("/parceiro/ofertas?created=1");
}

export async function togglePartnerOfferAction(offerId: string) {
  const { partner } = await requirePartnerUser();
  if (!partner) throw new Error("Sem cadastro");
  const supabase = await createClient();
  const { data: offer } = await supabase
    .from("mi_offers")
    .select("status, partner_id")
    .eq("id", offerId)
    .single<{ status: string; partner_id: string }>();
  if (!offer || offer.partner_id !== partner.id) throw new Error("Oferta não encontrada");

  const next = offer.status === "ativa" ? "inativa" : "ativa";
  const { error } = await supabase.from("mi_offers").update({ status: next }).eq("id", offerId);
  if (error) throw new Error(error.message);
  revalidatePath("/parceiro/ofertas");
}

export async function deletePartnerOfferAction(offerId: string) {
  const { partner } = await requirePartnerUser();
  if (!partner) throw new Error("Sem cadastro");
  const supabase = await createClient();
  const { data: offer } = await supabase
    .from("mi_offers")
    .select("partner_id")
    .eq("id", offerId)
    .single<{ partner_id: string }>();
  if (!offer || offer.partner_id !== partner.id) throw new Error("Oferta não encontrada");

  const { error } = await supabase.from("mi_offers").delete().eq("id", offerId);
  if (error) throw new Error(error.message);
  revalidatePath("/parceiro/ofertas");
  revalidatePath("/parceiro/banners");
}

// ─── Auto-banner ────────────────────────────────────────────────────────────

interface OfferForBanner {
  id: string;
  title: string;
  description: string | null;
  banner_url: string | null;
  coupon: string | null;
  main_call: string | null;
  cta_label: string | null;
  price_from: number | null;
  price_by: number | null;
}

async function createBannerFromOffer({
  partner,
  offer,
  qrShortUrl,
}: {
  partner: { id: string; unidade_id: string; name: string; logo_url: string | null };
  offer: OfferForBanner;
  qrShortUrl: string;
}) {
  const admin = createAdminClient();
  const newId = () => crypto.randomUUID();

  const elements: EditorElement[] = [];

  // Logo do parceiro (se houver) — canto superior esquerdo
  if (partner.logo_url) {
    elements.push({
      id: newId(),
      type: "logo",
      x: 100, y: 80, width: 180, height: 180,
      rotation: 0, opacity: 1, zIndex: 10,
      src: partner.logo_url,
      objectFit: "contain",
      motion: { preset: "fade-in", delay: 0, duration: 600 },
    });
  }

  // Título principal
  const headline: TextElement = {
    id: newId(),
    type: "heading",
    x: 100, y: partner.logo_url ? 320 : 180,
    width: 1100, height: 220,
    rotation: 0, opacity: 1, zIndex: 5,
    text: offer.title,
    fontFamily: "Arial Black",
    fontSize: 96,
    fontWeight: 900,
    color: "#ffffff",
    align: "left",
    lineHeight: 1.1,
    letterSpacing: -2,
    textShadow: "0 4px 20px rgba(0,0,0,0.3)",
    motion: { preset: "slide-up", delay: 200, duration: 700 },
  };
  elements.push(headline);

  // Chamada secundária
  if (offer.main_call) {
    elements.push({
      id: newId(),
      type: "subtitle",
      x: 100, y: (headline.y as number) + 240,
      width: 1100, height: 90,
      rotation: 0, opacity: 1, zIndex: 5,
      text: offer.main_call,
      fontFamily: "Inter",
      fontSize: 42,
      fontWeight: 500,
      color: "#ccfbf1",
      align: "left",
      lineHeight: 1.3,
      letterSpacing: 0,
      motion: { preset: "fade-in", delay: 500, duration: 600 },
    } as TextElement);
  }

  // Preço de/por (se preenchido)
  if (offer.price_from || offer.price_by) {
    const priceY = (headline.y as number) + (offer.main_call ? 360 : 280);
    elements.push({
      id: newId(),
      type: "price",
      x: 100, y: priceY,
      width: 900, height: 320,
      rotation: 0, opacity: 1, zIndex: 5,
      fromLabel: "De",
      fromValue: offer.price_from ?? 0,
      byLabel: "Por",
      byValue: offer.price_by ?? offer.price_from ?? 0,
      currency: "R$",
      fontFamily: "Arial Black",
      color: "#ffffff",
      highlightColor: "#facc15",
      size: 1.0,
      motion: { preset: "zoom-in", delay: 700, duration: 700 },
    } as PriceElement);
  }

  // Cupom (badge no canto)
  if (offer.coupon) {
    elements.push({
      id: newId(),
      type: "text",
      x: 100, y: 980,
      width: 700, height: 70,
      rotation: 0, opacity: 1, zIndex: 5,
      text: `🎫  Cupom: ${offer.coupon}`,
      fontFamily: "Arial Black",
      fontSize: 36,
      fontWeight: 900,
      color: "#0f1720",
      background: "#facc15",
      padding: 16,
      borderRadius: 12,
      align: "center",
      lineHeight: 1,
      letterSpacing: 1,
      motion: { preset: "fade-in", delay: 900, duration: 500 },
    } as TextElement);
  }

  // QR Code (direita)
  const qrEl: QrCodeElement = {
    id: newId(),
    type: "qrcode",
    x: 1380, y: 300,
    width: 440, height: 540,
    rotation: 0, opacity: 1, zIndex: 5,
    source: "custom",
    value: qrShortUrl,
    utmCampaign: `oferta-${offer.id.slice(0, 8)}`,
    fgColor: "#0f1720",
    bgColor: "#ffffff",
    level: "M",
    margin: 3,
    label: offer.cta_label || "Aponte a câmera",
    labelColor: "#0f1720",
    labelSize: 26,
    pulse: true,
    motion: { preset: "pulse", delay: 0, duration: 2000 },
  };
  elements.push(qrEl);

  await admin.from("mi_editor_templates").insert({
    name: `${partner.name} — ${offer.title}`,
    format: "horizontal",
    width: 1920,
    height: 1080,
    background: offer.banner_url
      ? { type: "image", value: offer.banner_url }
      : { type: "gradient", value: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)" },
    elements,
    duration_seconds: 15,
    is_published: true,
    category: "ofertas",
    unidade_id: partner.unidade_id,
    partner_id: partner.id,
    linked_offer_id: offer.id,
    motion: { enterDuration: 600, exitDuration: 400 },
  });
}

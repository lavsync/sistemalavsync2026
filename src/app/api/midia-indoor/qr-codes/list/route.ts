import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@mi/lib/supabase/server";
import { createAdminClient } from "@mi/lib/supabase/admin";
import { APP_URL } from "@mi/lib/constants";

export const dynamic = "force-dynamic";

interface QrItem {
  id: string;
  shortUrl: string;
  shortCode: string;
  purpose: string;
  label: string;
  detail: string;
  utmCampaign: string | null;
  createdAt: string;
}

/**
 * Lista QR codes acessíveis ao usuário logado (RLS já filtra por unidade_id via xv_can_manage_unit).
 * Retorna URL curta /qr/[code] que faz tracking + redirect.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const purpose = req.nextUrl.searchParams.get("purpose"); // filtro opcional
  const search = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

  const admin = createAdminClient();
  let query = admin
    .from("mi_qr_codes")
    .select(
      "id, short_code, purpose, utm_campaign, created_at, partners(name), offers(title), campaigns(name), units(name, slug)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (purpose) query = query.eq("purpose", purpose);

  const { data } = await query;

  type Row = {
    id: string;
    short_code: string;
    purpose: string;
    utm_campaign: string | null;
    created_at: string;
    partners: { name: string } | null;
    offers: { title: string } | null;
    campaigns: { name: string } | null;
    units: { name: string; slug: string } | null;
  };

  // Supabase pode retornar relação como array OU objeto — normaliza
  const first = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? v[0] ?? null : v ?? null;

  const items: QrItem[] = ((data ?? []) as unknown as Row[])
    .map((r) => {
      const offer = first(r.offers as unknown as { title: string } | { title: string }[] | null);
      const partner = first(r.partners as unknown as { name: string } | { name: string }[] | null);
      const campaign = first(r.campaigns as unknown as { name: string } | { name: string }[] | null);
      const unit = first(r.units as unknown as { name: string; slug: string } | { name: string; slug: string }[] | null);

      const label =
        offer?.title ??
        partner?.name ??
        campaign?.name ??
        labelForPurpose(r.purpose);
      const detail = [unit?.name, partner?.name && offer?.title ? partner.name : null]
        .filter(Boolean)
        .join(" · ");

      return {
        id: r.id,
        shortCode: r.short_code,
        shortUrl: `${APP_URL}/qr/${r.short_code}`,
        purpose: r.purpose,
        label,
        detail,
        utmCampaign: r.utm_campaign,
        createdAt: r.created_at,
      };
    })
    .filter((item) => !search || item.label.toLowerCase().includes(search) || item.purpose.toLowerCase().includes(search));

  return NextResponse.json({ items });
}

function labelForPurpose(p: string) {
  switch (p) {
    case "oferta": return "Oferta";
    case "parceiro": return "Parceiro";
    case "clube-beneficios": return "Clube de Benefícios";
    case "campanha": return "Campanha";
    case "whatsapp": return "WhatsApp";
    case "quero-ser-parceiro": return "Quero ser parceiro";
    default: return p;
  }
}

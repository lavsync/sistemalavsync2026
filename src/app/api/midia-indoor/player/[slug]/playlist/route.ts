import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@mi/lib/supabase/admin";
import { buildPlaylist, type CampaignForPlaylist } from "@mi/lib/playlist";
import { APP_URL } from "@mi/lib/constants";
import { rowToTemplate } from "@/app/publicidade/midia-indoor/templates/_components/row-to-template";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: RouteContext) {
  const { slug } = await ctx.params;
  const token = request.nextUrl.searchParams.get("token");

  const supabase = createAdminClient();

  const { data: unit } = await supabase
    .from("mi_units")
    .select("id, slug, name, player_token")
    .eq("slug", slug)
    .single<{ id: string; slug: string; name: string; player_token: string }>();

  if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  if (unit.player_token !== token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { data: campaigns } = await supabase
    .from("mi_campaigns")
    .select(
      `id, name, priority, duration_seconds, status, starts_at, ends_at,
       headline, subheadline, cta_label, cta_url, media_url, media_type,
       editor_template_id,
       templates(slug, name),
       partners(id, name, slug, logo_url),
       offers(id, title, coupon, banner_url),
       qr_codes!campaigns_qr_code_id_fkey(short_code, target_url)`,
    )
    .eq("unidade_id", unit.id)
    .eq("status", "ativa");

  const { data: clubQr } = await supabase
    .from("mi_qr_codes")
    .select("short_code")
    .eq("unidade_id", unit.id)
    .eq("purpose", "clube-beneficios")
    .limit(1)
    .single<{ short_code: string }>();

  const { data: editorTplRows } = await supabase
    .from("mi_editor_templates")
    .select("*")
    .eq("is_published", true)
    .or(`unidade_id.eq.${unit.id},unidade_id.is.null`);

  const editorTemplates = (editorTplRows ?? []).map((r) =>
    rowToTemplate(r as Record<string, unknown>),
  );

  const playlist = buildPlaylist({
    unitName: unit.name,
    unitSlug: unit.slug,
    unitWhatsapp: null,
    clubeUrl: `${APP_URL}/${unit.slug}/clube-de-beneficios`,
    clubeShortUrl: clubQr ? `${APP_URL}/qr/${clubQr.short_code}` : `${APP_URL}/${unit.slug}/clube-de-beneficios`,
    campaigns: (campaigns as unknown as CampaignForPlaylist[]) ?? [],
    editorTemplates,
  });

  return NextResponse.json({ playlist, fetchedAt: new Date().toISOString() });
}

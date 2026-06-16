import { notFound } from "next/navigation";
import { createAdminClient } from "@mi/lib/supabase/admin";
import { buildPlaylist, type CampaignForPlaylist } from "@mi/lib/playlist";
import { PlayerShell } from "./player-shell";
import { APP_URL } from "@mi/lib/constants";
import type { Tables } from "@mi/types/database";
import { rowToTemplate } from "@/app/publicidade/midia-indoor/templates/_components/row-to-template";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return {
    title: `Player TV — ${slug}`,
    robots: { index: false, follow: false },
  };
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string; preview?: string }>;
}) {
  const { slug } = await params;
  const { token, preview } = await searchParams;

  const supabase = createAdminClient();

  // Resolve unidade
  const { data: unit } = await supabase
    .from("mi_units")
    .select("*")
    .eq("slug", slug)
    .single<Tables<"units">>();

  if (!unit) notFound();

  // Validação de token (a menos que esteja em modo preview com auth admin)
  if (!preview && unit.player_token !== token) {
    return (
      <div className="grid h-screen w-screen place-items-center bg-black text-white">
        <div className="text-center">
          <p className="text-2xl font-bold">Token inválido</p>
          <p className="mt-2 text-sm text-white/60">
            Verifique a URL completa no painel admin → Unidades.
          </p>
        </div>
      </div>
    );
  }

  // Busca campanhas com tudo aninhado
  const { data: campaigns } = await supabase
    .from("mi_campaigns")
    .select(
      `*,
      templates(slug, name),
      partners(id, name, slug, logo_url),
      offers(id, title, coupon, banner_url),
      qr_codes!campaigns_qr_code_id_fkey(short_code, target_url)`,
    )
    .eq("unidade_id", unit.id)
    .eq("status", "ativa");

  // Busca editor templates publicados (multi-unidade: incluir templates sem unidade_id)
  const { data: editorTplRows } = await supabase
    .from("mi_editor_templates")
    .select("*")
    .eq("is_published", true)
    .or(`unidade_id.eq.${unit.id},unidade_id.is.null`);

  const editorTemplates = (editorTplRows ?? []).map((r) =>
    rowToTemplate(r as Record<string, unknown>),
  );

  // Settings
  const { data: settings } = await supabase
    .from("mi_settings")
    .select("key, value")
    .in("key", ["player_default_slide_ms", "player_club_frequency"]);

  const settingsMap = new Map<string, unknown>(
    (settings ?? []).map((s: { key: string; value: unknown }) => [s.key, s.value]),
  );
  const defaultSlideMs = Number(settingsMap.get("player_default_slide_ms") ?? 15000);
  const clubInterval = Number(settingsMap.get("player_club_frequency") ?? 5);

  // Resolve QR Code do clube (cria se não existir)
  let clubQrCode = await getOrCreateClubQrCode(unit.id, unit.slug);

  const playlist = buildPlaylist({
    unitName: unit.name,
    unitSlug: unit.slug,
    unitWhatsapp: unit.whatsapp,
    clubeUrl: `${APP_URL}/${unit.slug}/clube-de-beneficios`,
    clubeShortUrl: `${APP_URL}/qr/${clubQrCode.short_code}`,
    campaigns: (campaigns as unknown as CampaignForPlaylist[]) ?? [],
    editorTemplates,
    clubInterval,
    defaultSlideMs,
  });

  return (
    <PlayerShell
      unit={{
        id: unit.id,
        slug: unit.slug,
        name: unit.name,
        whatsapp: unit.whatsapp,
      }}
      initialPlaylist={playlist}
      defaultSlideMs={defaultSlideMs}
      previewMode={!!preview}
    />
  );
}

async function getOrCreateClubQrCode(unitId: string, unitSlug: string) {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("mi_qr_codes")
    .select("id, short_code, target_url")
    .eq("unidade_id", unitId)
    .eq("purpose", "clube-beneficios")
    .limit(1)
    .single<{ id: string; short_code: string; target_url: string }>();

  if (existing) return existing;

  const target = `${APP_URL}/${unitSlug}/clube-de-beneficios?utm_source=totem&utm_medium=tv&utm_campaign=conexao-local`;
  const { data: created } = await supabase
    .from("mi_qr_codes")
    .insert({
      unidade_id: unitId,
      target_url: target,
      purpose: "clube-beneficios",
      utm_source: "totem",
      utm_medium: "tv",
      utm_campaign: "conexao-local",
    })
    .select("id, short_code, target_url")
    .single<{ id: string; short_code: string; target_url: string }>();

  return created!;
}

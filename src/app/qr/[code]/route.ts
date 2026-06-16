import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@mi/lib/supabase/admin";
import { createHash } from "node:crypto";

interface RouteContext {
  params: Promise<{ code: string }>;
}

/**
 * Resolve um QR Code short_code e registra o clique antes de redirecionar.
 *   GET /qr/abc123 → 302 → target_url + UTMs
 */
export async function GET(request: NextRequest, ctx: RouteContext) {
  const { code } = await ctx.params;
  const supabase = createAdminClient();

  const { data: qr } = await supabase
    .from("mi_qr_codes")
    .select("id, unidade_id, target_url")
    .eq("short_code", code)
    .single<{ id: string; unidade_id: string; target_url: string }>();

  if (!qr) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  // Fire-and-forget tracking
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
  const ipHash = ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null;
  const userAgent = request.headers.get("user-agent");
  const referer = request.headers.get("referer");

  supabase
    .from("mi_qr_clicks")
    .insert({
      qr_code_id: qr.id,
      unidade_id: qr.unidade_id,
      user_agent: userAgent,
      referer,
      ip_hash: ipHash,
    })
    .then(() => null);

  return NextResponse.redirect(qr.target_url, 302);
}

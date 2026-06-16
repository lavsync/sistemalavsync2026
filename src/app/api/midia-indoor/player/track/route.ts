import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@mi/lib/supabase/admin";

interface TrackPayload {
  type: "heartbeat" | "impression";
  unitId: string;
  token: string;
  sessionId?: string;
  campaignId?: string;
}

export async function POST(request: NextRequest) {
  const body: TrackPayload = await request.json().catch(() => ({}));

  if (!body.unitId || !body.token) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Valida token
  const { data: unit } = await supabase
    .from("mi_units")
    .select("id, player_token")
    .eq("id", body.unitId)
    .single<{ id: string; player_token: string }>();

  if (!unit || unit.player_token !== body.token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  if (body.type === "heartbeat") {
    if (body.sessionId) {
      await supabase
        .from("mi_player_sessions")
        .update({ last_heartbeat: new Date().toISOString() })
        .eq("id", body.sessionId);
      return NextResponse.json({ ok: true });
    }

    // Cria nova sessão
    const { data } = await supabase
      .from("mi_player_sessions")
      .insert({
        unidade_id: body.unitId,
        user_agent: request.headers.get("user-agent"),
        ip: request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null,
      })
      .select("id")
      .single<{ id: string }>();

    return NextResponse.json({ ok: true, sessionId: data?.id });
  }

  if (body.type === "impression" && body.campaignId) {
    await supabase.from("mi_campaign_impressions").insert({
      campaign_id: body.campaignId,
      unidade_id: body.unitId,
      session_id: body.sessionId ?? null,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false });
}

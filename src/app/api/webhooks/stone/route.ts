// LavSync · Stone Open Banking · Endpoint de webhook
//
// Stone envia notificações em tempo real (Pix recebido, cartão recebido, etc).
// Headers obrigatórios:
//   x-stone-webhook-event-id   — identificador único do evento (idempotência)
//   x-stone-webhook-event-type — tipo do evento (pix.received, card_payment.received, etc)
// Body:
//   JWE (RSA-OAEP-256 + A256GCM) encriptado pra LavSync
//   Após decriptar, JWS (RS256) assinado pela Stone
//
// IMPORTANTE: Stone retenta até 50x ao longo do dia se não receber 2xx.
// Sempre retornar 200 mesmo em casos de evento desconhecido (registramos pra investigar).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Service role pra inserir em stone_webhook_events sem RLS bloquear
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(req: NextRequest) {
  const eventId = req.headers.get("x-stone-webhook-event-id");
  const eventType = req.headers.get("x-stone-webhook-event-type");
  const userAgent = req.headers.get("user-agent");
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (!eventId) {
    // Stone exige header. Sem ele, é payload inválido.
    return NextResponse.json({ error: "missing x-stone-webhook-event-id" }, { status: 400 });
  }

  const body = await req.text();

  // Coleta headers relevantes pra auditoria
  const headersMap: Record<string, string> = {};
  req.headers.forEach((v, k) => {
    if (k.startsWith("x-stone-") || k === "content-type" || k === "user-agent") {
      headersMap[k] = v;
    }
  });

  const sb = admin();

  // Idempotência: se já recebemos esse evento, retornamos 200 sem reprocessar.
  const { data: existente } = await sb
    .from("stone_webhook_events")
    .select("id, status")
    .eq("stone_event_id", eventId)
    .maybeSingle();

  if (existente) {
    return NextResponse.json({
      message: "evento já processado",
      event_id: eventId,
      status: (existente as { status: string }).status,
    }, { status: 200 });
  }

  // Tenta extrair unidade_id do payload (se decodificado vier com account_id)
  // Por enquanto: salva raw + marca como "recebido" pra processar depois (Sprint posterior).
  // Quando tivermos a chave pública Stone (JWKS), validamos JWS aqui.
  try {
    await sb.from("stone_webhook_events").insert({
      stone_event_id: eventId,
      event_type: eventType ?? "desconhecido",
      raw_body: body,
      decoded_payload: null,
      signature_validated: false,
      status: "recebido",
      http_headers: headersMap,
      ip_origem: forwardedFor?.split(",")[0]?.trim() ?? null,
    });

    // Resposta rápida — processamento pesado fica pro próximo job
    return NextResponse.json({
      message: "evento recebido",
      event_id: eventId,
      event_type: eventType,
    }, { status: 200 });
  } catch (e) {
    // Mesmo em erro, retornar 200 evita Stone retentar 50x. Mas log o erro.
    console.error("[stone-webhook] erro ao salvar evento:", e);
    void userAgent;
    return NextResponse.json({
      message: "evento recebido com falha de persistência",
      event_id: eventId,
      error: e instanceof Error ? e.message : "erro desconhecido",
    }, { status: 200 });
  }
}

// GET pra health check (Stone permite testar a URL)
export async function GET() {
  return NextResponse.json({
    service: "LavSync Stone Webhook",
    version: "1.0",
    status: "ok",
    endpoint: "POST com payload Stone Open Banking",
  });
}

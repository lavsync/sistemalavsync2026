// LavSync · CLOCK v2 · Token do reconhecimento de voz (Scribe realtime)
//
// POST → { token, expira_em } | 503 { fallback: "webspeech" }
// Gera um single-use token da ElevenLabs (POST /v1/single-use-token/realtime_scribe,
// válido por 15 min e consumido no uso) para o navegador abrir o WebSocket do
// Scribe sem ver a chave. A chave precisa do escopo speech_to_text; sem ela
// (ou com 401/403) o cliente cai no webkitSpeechRecognition.
import { NextResponse } from "next/server";
import { chaveStt, dentroDoLimite, exigirSessao } from "@/lib/clock-voz/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALIDADE_MS = 15 * 60 * 1000;
/** Um token por vez de escuta; 20 por minuto cobre reconexões. */
const MAX_POR_MINUTO = 20;

function semScribe(motivo: string) {
  return NextResponse.json({ fallback: "webspeech", motivo }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  const sessao = await exigirSessao();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao === "proibido") return NextResponse.json({ erro: "Seu perfil não tem acesso ao CLOCK." }, { status: 403 });
  if (!dentroDoLimite(`stt:${sessao.user.id}`, MAX_POR_MINUTO, 60_000)) {
    return NextResponse.json({ erro: "Muitos pedidos de escuta em pouco tempo." }, { status: 429 });
  }

  const apiKey = chaveStt();
  if (!apiKey) return semScribe("sem_chave");

  let r: Response;
  try {
    r = await fetch("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      cache: "no-store",
    });
  } catch {
    return semScribe("elevenlabs_inacessivel");
  }

  if (!r.ok) {
    // 401/403 = chave sem speech_to_text; qualquer outro também cai no fallback
    return semScribe(`elevenlabs_${r.status}`);
  }
  const j = (await r.json().catch(() => ({}))) as { token?: string };
  if (!j.token) return semScribe("resposta_sem_token");

  return NextResponse.json(
    { token: j.token, expira_em: new Date(Date.now() + VALIDADE_MS).toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

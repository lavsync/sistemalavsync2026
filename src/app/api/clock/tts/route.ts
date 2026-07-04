// LavSync · CLOCK AI · Voz premium (ElevenLabs)
//
// POST { texto } → áudio MP3. Voz brasileira jovem/animada via
// eleven_multilingual_v2. Sem ELEVENLABS_API_KEY → 404 e o cliente cai
// no fallback (SpeechSynthesis do navegador).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// Voz default (premade "Adam" — masculina, jovem; multilingual fala pt-BR
// natural). Troque pela sua voz favorita via env ELEVENLABS_VOICE_ID.
const VOICE_DEFAULT = "pNInz6obpgDQGcFmaJgB";

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: u } = await sb.auth.getUser();
  if (!u?.user) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ erro: "sem_chave" }, { status: 404 });

  const { texto } = (await req.json()) as { texto?: string };
  if (!texto?.trim()) return NextResponse.json({ erro: "texto vazio" }, { status: 400 });

  const voiceId = process.env.ELEVENLABS_VOICE_ID || VOICE_DEFAULT;
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: texto.slice(0, 2500), // economia: teto por fala
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.45,          // menos estável = mais expressivo/animado
          similarity_boost: 0.75,
          style: 0.35,
          use_speaker_boost: true,
        },
      }),
    },
  );
  if (!r.ok) {
    const detalhe = await r.text().catch(() => "");
    return NextResponse.json({ erro: `elevenlabs ${r.status}`, detalhe: detalhe.slice(0, 300) }, { status: 502 });
  }
  return new NextResponse(r.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}

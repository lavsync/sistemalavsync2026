// LavSync · CLOCK v2 · Voz do CLOCK (ElevenLabs, streaming)
//
// POST { texto, anterior?, voice_id? } → audio/mpeg em streaming.
// Uma frase por pedido: o cliente toca enquanto os bytes chegam e já pede a
// próxima. Endpoint /stream + eleven_flash_v2_5 (menor latência, pt), com
// previous_text para a prosódia emendar entre frases.
//
// O Flash v2.5 não normaliza números: normalizarParaFala() converte moeda,
// porcentagem, datas e horas para extenso antes do envio.
// Voz: env ELEVENLABS_VOICE_ID > clock_config > Matheus Santos. `voice_id` no
// corpo só é aceito para as candidatas (amostra na tela de vozes).
// Sem ELEVENLABS_API_KEY → 404 { erro: "sem_chave" }.
import { NextResponse } from "next/server";
import { dentroDoLimite, exigirSessao, resolverVoz } from "@/lib/clock-voz/servidor";
import { normalizarParaFala } from "@/lib/clock-voz/numeros";
import { vozEhCandidata } from "@/lib/clock-voz/vozes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODELO = "eleven_flash_v2_5";
const TETO_CARACTERES = 1000;       // uma frase; resposta longa vem fatiada
const TETO_ANTERIOR = 300;
/** Uma resposta longa tem ~10 frases; 60 por minuto cobre conversa contínua com folga. */
const MAX_POR_MINUTO = 60;

export async function POST(req: Request) {
  const sessao = await exigirSessao();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao === "proibido") return NextResponse.json({ erro: "Seu perfil não tem acesso ao CLOCK." }, { status: 403 });
  if (!dentroDoLimite(`tts:${sessao.user.id}`, MAX_POR_MINUTO, 60_000)) {
    return NextResponse.json({ erro: "Muitas falas em pouco tempo. Tenta de novo em instantes." }, { status: 429 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ erro: "sem_chave" }, { status: 404 });

  let corpo: { texto?: unknown; anterior?: unknown; voice_id?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }
  const bruto = typeof corpo.texto === "string" ? corpo.texto.trim() : "";
  if (!bruto) return NextResponse.json({ erro: "texto vazio" }, { status: 400 });

  const texto = normalizarParaFala(bruto).slice(0, TETO_CARACTERES);
  const anterior =
    typeof corpo.anterior === "string" && corpo.anterior.trim()
      ? normalizarParaFala(corpo.anterior.trim()).slice(-TETO_ANTERIOR)
      : undefined;

  let voiceId: string;
  if (typeof corpo.voice_id === "string" && corpo.voice_id) {
    if (!vozEhCandidata(corpo.voice_id)) return NextResponse.json({ erro: "voz não permitida" }, { status: 400 });
    voiceId = corpo.voice_id;
  } else {
    voiceId = (await resolverVoz(sessao.sb, sessao.tenantId)).voice_id;
  }

  let r: Response;
  try {
    r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_64`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({
          text: texto,
          model_id: MODELO,
          language_code: "pt",
          previous_text: anterior,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.15,
            use_speaker_boost: true,
          },
        }),
        // cliente abortou (barge-in) → corta a geração lá também
        signal: req.signal,
      },
    );
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return new NextResponse(null, { status: 499 });
    return NextResponse.json({ erro: "ElevenLabs inacessível" }, { status: 502 });
  }

  if (!r.ok || !r.body) {
    const detalhe = await r.text().catch(() => "");
    return NextResponse.json({ erro: `elevenlabs ${r.status}`, detalhe: detalhe.slice(0, 300) }, { status: 502 });
  }

  return new NextResponse(r.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "X-Clock-Voz": voiceId,
    },
  });
}

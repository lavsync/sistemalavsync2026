// LavSync · CLOCK v2 · Vozes do CLOCK
//
// GET  → { atual: voice_id, atual_nome, fonte, candidatas: [{ nome, voice_id, descricao }], pode_alterar }
//        (`atual` é a string do voice_id em uso, como no contrato)
// POST { voice_id } → salva em clock_config do tenant (só admin/master).
// A amostra não passa por aqui: o front chama /api/clock/tts com voice_id.
// Precedência da voz ativa: env ELEVENLABS_VOICE_ID > clock_config > padrão.
// Com a env definida, a escolha salva só vale depois que a env sair.
import { NextResponse } from "next/server";
import { exigirSessao, resolverVoz } from "@/lib/clock-voz/servidor";
import { VOZES_CANDIDATAS, vozEhCandidata } from "@/lib/clock-voz/vozes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMINS = new Set(["admin", "master"]);

export async function GET() {
  const sessao = await exigirSessao();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao === "proibido") return NextResponse.json({ erro: "Seu perfil não tem acesso ao CLOCK." }, { status: 403 });

  const voz = await resolverVoz(sessao.sb, sessao.tenantId);
  const nome = VOZES_CANDIDATAS.find((v) => v.voice_id === voz.voice_id)?.nome ?? null;
  return NextResponse.json(
    {
      atual: voz.voice_id,
      atual_nome: nome,
      fonte: voz.fonte,
      candidatas: VOZES_CANDIDATAS,
      pode_alterar: ADMINS.has(sessao.papel),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const sessao = await exigirSessao();
  if (!sessao) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (sessao === "proibido") return NextResponse.json({ erro: "Seu perfil não tem acesso ao CLOCK." }, { status: 403 });

  if (!ADMINS.has(sessao.papel)) {
    return NextResponse.json({ erro: "Só administradores escolhem a voz do CLOCK." }, { status: 403 });
  }
  const tenantId = sessao.tenantId;
  let corpo: { voice_id?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }
  const voiceId = typeof corpo.voice_id === "string" ? corpo.voice_id : "";
  if (!vozEhCandidata(voiceId)) return NextResponse.json({ erro: "Voz fora da lista de candidatas." }, { status: 400 });

  const { error } = await sessao.sb
    .from("clock_config")
    .upsert({ tenant_id: tenantId, voice_id: voiceId, atualizado_em: new Date().toISOString() }, { onConflict: "tenant_id" });
  if (error) return NextResponse.json({ erro: `Não consegui salvar a voz: ${error.message}` }, { status: 500 });

  const efetiva = await resolverVoz(sessao.sb, sessao.tenantId);
  return NextResponse.json({
    ok: true,
    voice_id: voiceId,
    // com ELEVENLABS_VOICE_ID definida, a env continua mandando
    em_uso: efetiva.voice_id,
    fonte: efetiva.fonte,
  });
}

// LavSync · CLOCK v2 · Novidades (briefing do dia + alertas não vistos)
//
// GET  → { briefing?, alertas[] } filtrados por permissão e unidades do usuário.
// POST → { ids: string[] } marca como vistos (o front chama depois de falar).
import { NextRequest, NextResponse } from "next/server";
import { criarCtx, podeUsarClock } from "@/lib/clock-ai/gateway";
import { lerNovidades, marcarVistos } from "@/lib/clock-ai/briefing/novidades";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await criarCtx();
  if (!ctx) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!podeUsarClock(ctx)) return NextResponse.json({ alertas: [], erro: "Seu perfil não tem acesso ao CLOCK." }, { status: 403 });
  try {
    return NextResponse.json(await lerNovidades(ctx));
  } catch (e) {
    console.error("[clock/novidades] GET", e);
    return NextResponse.json({ alertas: [], erro: "Não consegui ler as novidades agora." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await criarCtx();
  if (!ctx) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!podeUsarClock(ctx)) return NextResponse.json({ ok: false, erro: "Seu perfil não tem acesso ao CLOCK." }, { status: 403 });
  let ids: unknown;
  try {
    ids = ((await req.json()) as { ids?: unknown })?.ids;
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }
  if (!Array.isArray(ids)) return NextResponse.json({ erro: "ids deve ser uma lista" }, { status: 400 });
  try {
    const marcados = await marcarVistos(ctx, ids.filter((x): x is string => typeof x === "string"));
    return NextResponse.json({ ok: true, marcados });
  } catch (e) {
    console.error("[clock/novidades] POST", e);
    return NextResponse.json({ ok: false, erro: "Não consegui marcar como visto." }, { status: 500 });
  }
}

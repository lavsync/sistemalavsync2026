// LavSync · CLOCK v2 · Decisão humana sobre ação pendente
//
// O modelo só PROPÕE (executar_acao grava clock_acoes 'pendente'). Quem decide
// é a pessoa, pelo cartão Confirmar/Cancelar. Confirmar passa pelo gateway,
// que re-checa permissão, dono, prazo e status antes de executar. O resultado
// fica em clock_acoes e o chat o relata no próximo turno da sessão.
import { NextRequest, NextResponse } from "next/server";
import { criarCtx, executarAcaoPendente, cancelarAcaoPendente, podeUsarClock } from "@/lib/clock-ai/gateway";

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const ctx = await criarCtx();
  if (!ctx) return NextResponse.json({ ok: false, erro: "Não autenticado" }, { status: 401 });
  if (!podeUsarClock(ctx)) return NextResponse.json({ ok: false, erro: "Seu perfil não tem acesso ao CLOCK." }, { status: 403 });

  let body: { acao_id?: unknown; decisao?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, erro: "JSON inválido" }, { status: 400 });
  }
  const acaoId = typeof body.acao_id === "string" ? body.acao_id : "";
  const decisao = body.decisao;
  if (!UUID.test(acaoId) || (decisao !== "confirmar" && decisao !== "cancelar")) {
    return NextResponse.json({ ok: false, erro: "Informe acao_id e decisao (confirmar ou cancelar)." }, { status: 400 });
  }

  if (decisao === "cancelar") {
    // Pelo gateway: a auditoria só aceita escrita com service role após o gate.
    const r = await cancelarAcaoPendente(ctx, acaoId);
    if (!r.ok) return NextResponse.json(r, { status: 409 });
    return NextResponse.json({ ok: true, resultado: { status: "cancelada" } });
  }

  try {
    const r = await executarAcaoPendente(ctx, acaoId);
    return NextResponse.json(r, { status: r.ok ? 200 : 409 });
  } catch (e) {
    console.error("[clock/acao] executar", e);
    return NextResponse.json({ ok: false, erro: "A ação falhou ao executar." }, { status: 500 });
  }
}

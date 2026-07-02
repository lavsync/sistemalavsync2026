// LavSync · Cron DIÁRIO unificado (plano Hobby = máx 2 crons)
//
// Roda 15:00 UTC (12:00 BR — dentro da janela de disparo 9h-21h):
//   1. Fechamento mensal da fidelidade (só age no dia 1 ou em catch-up)
//   2. Cadência de relacionamento (pós-uso D-1, inatividade, sprint)
//   3. processarFila — envia o que foi enfileirado (WhatsApp Cloud API)
//   4. Outbox Castelo — rede de segurança (antes era cron próprio)
//
// GET manual com Bearer CRON_SECRET pra forçar execução sob demanda.
import { NextRequest, NextResponse } from "next/server";
import { fecharMesAnterior } from "@/lib/fidelidade/fechamento";
import { rodarCadenciaDiaria } from "@/lib/fidelidade/cadencia";
import { processarFila } from "@/lib/clock-relacionamento/fila";
import { processarOutboxCastelo } from "@/lib/castelo-webhook/processor";

export const runtime = "nodejs";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Cada etapa é best-effort: uma falha não derruba as demais.
  const resultado: Record<string, unknown> = {};

  try { resultado.fechamento = await fecharMesAnterior(); }
  catch (e) { resultado.fechamento = { erro: e instanceof Error ? e.message : String(e) }; }

  try { resultado.cadencia = await rodarCadenciaDiaria(); }
  catch (e) { resultado.cadencia = { erro: e instanceof Error ? e.message : String(e) }; }

  try { resultado.fila = await processarFila({ limite: 500 }); }
  catch (e) { resultado.fila = { erro: e instanceof Error ? e.message : String(e) }; }

  try { resultado.casteloOutbox = await processarOutboxCastelo(); }
  catch (e) { resultado.casteloOutbox = { erro: e instanceof Error ? e.message : String(e) }; }

  return NextResponse.json({ ok: true, executado_em: new Date().toISOString(), ...resultado });
}

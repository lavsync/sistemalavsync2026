// LavSync · Cron de retry da outbox de webhooks → Xô Varal Castelo
//
// O caminho feliz é o flush inline ao fim de cada importação de vendas.
// Este cron é a REDE DE SEGURANÇA: reprocessa eventos 'pending' cujo
// next_attempt_at já venceu (retries com backoff) caso o site estivesse fora
// do ar no momento do import. No plano Hobby a Vercel só roda 1x/dia.
//
// Também pode ser chamado manualmente (GET com Bearer CRON_SECRET) pra forçar
// um flush sob demanda.
import { NextRequest, NextResponse } from "next/server";
import { processarOutboxCastelo } from "@/lib/castelo-webhook/processor";

export const runtime = "nodejs";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const inicio = Date.now();
  const r = await processarOutboxCastelo({ limite: 500 });
  return NextResponse.json({
    ok: true,
    duracao_ms: Date.now() - inicio,
    ...r,
  });
}

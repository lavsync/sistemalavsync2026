// LavSync · Processador da outbox de webhooks → Xô Varal Castelo
//
// Lê castelo_webhook_outbox (status='pending', next_attempt_at vencido) e
// dispara POST pro site Castelo. Idempotente por event_id no lado deles —
// reenviar nunca duplica pontos.
//
// Política de retry (timeout/5xx): backoff 1min → 5min → 30min → 2h → 24h,
// depois marca 'failed' (morto). 400/401 = erro permanente, não reenvia.
//
// Spec: ~/Desktop/INTEGRACAO-LAVSYNC-WEBHOOK.md
import { createClient } from "@supabase/supabase-js";

const CASTELO_WEBHOOK_URL =
  process.env.CASTELO_WEBHOOK_URL ?? "https://castelo.xovaral.com/api/lavsync/webhook";
const SECRET = process.env.LAVSYNC_WEBHOOK_SECRET ?? "";
const TIMEOUT_MS = 10_000;

// Minutos de espera após cada falha transitória. 5 tentativas e desiste.
const BACKOFF_MIN = [1, 5, 30, 120, 1440]; // 1min, 5min, 30min, 2h, 24h

type OutboxRow = {
  id: string;
  event_id: string;
  cpf: string;
  cycles: number;
  points: number;
  amount_cents: number | null;
  occurred_at: string | null;
  attempts: number;
};

export type ProcessarOutboxResult = {
  considerados: number;
  enviados: number;
  reagendados: number;
  mortos: number;
  pulado?: string;
};

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/**
 * Processa eventos pendentes da outbox da Castelo.
 * Best-effort: nunca lança — devolve um resumo do que aconteceu.
 */
export async function processarOutboxCastelo(
  opts?: { limite?: number },
): Promise<ProcessarOutboxResult> {
  const res: ProcessarOutboxResult = { considerados: 0, enviados: 0, reagendados: 0, mortos: 0 };

  if (!SECRET) {
    // Sem secret configurado ainda — não envia nada (eventos ficam acumulando
    // como 'pending' e serão entregues quando LAVSYNC_WEBHOOK_SECRET existir).
    res.pulado = "LAVSYNC_WEBHOOK_SECRET ausente";
    return res;
  }

  const limite = opts?.limite ?? 100;
  const sb = admin();
  const agora = new Date().toISOString();

  const { data: rows, error } = await sb
    .from("castelo_webhook_outbox")
    .select("id, event_id, cpf, cycles, points, amount_cents, occurred_at, attempts")
    .eq("status", "pending")
    .lte("next_attempt_at", agora)
    .order("criado_em", { ascending: true })
    .limit(limite);

  if (error || !rows) {
    res.pulado = error?.message ?? "sem linhas";
    return res;
  }

  res.considerados = rows.length;

  for (const r of rows as OutboxRow[]) {
    const body = {
      event_id: r.event_id,
      type: "payment.confirmed",
      cpf: r.cpf,
      cycles: r.cycles,
      points: r.points,
      ...(r.amount_cents != null ? { amount_cents: r.amount_cents } : {}),
      ...(r.occurred_at ? { occurred_at: r.occurred_at } : {}),
    };

    let statusCode: number | null = null;
    let respText = "";
    let transitorio = false; // true => reagendar; false => sucesso ou permanente

    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const resp = await fetch(CASTELO_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SECRET}`,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      statusCode = resp.status;
      respText = (await resp.text()).slice(0, 2000);

      if (resp.ok) {
        // 200 applied | stored | duplicate → entregue
        await sb
          .from("castelo_webhook_outbox")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            attempts: r.attempts + 1,
            last_status_code: statusCode,
            last_error: null,
            response_body: respText,
            atualizado_em: new Date().toISOString(),
          })
          .eq("id", r.id);
        res.enviados += 1;
        continue;
      }

      // 400/401 = erro permanente (payload inválido ou secret errado): não reenviar
      if (resp.status === 400 || resp.status === 401) {
        transitorio = false;
      } else {
        transitorio = true; // 5xx e demais → retry
      }
    } catch (e) {
      // timeout / rede → transitório
      statusCode = null;
      respText = e instanceof Error ? e.message : String(e);
      transitorio = true;
    }

    const novasTentativas = r.attempts + 1;

    if (!transitorio) {
      // permanente: marca morto pra inspeção manual
      await sb
        .from("castelo_webhook_outbox")
        .update({
          status: "failed",
          attempts: novasTentativas,
          last_status_code: statusCode,
          last_error: respText,
          response_body: respText,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", r.id);
      res.mortos += 1;
      continue;
    }

    // transitório: reagenda com backoff, ou desiste após esgotar
    if (novasTentativas > BACKOFF_MIN.length) {
      await sb
        .from("castelo_webhook_outbox")
        .update({
          status: "failed",
          attempts: novasTentativas,
          last_status_code: statusCode,
          last_error: `esgotou retries: ${respText}`,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", r.id);
      res.mortos += 1;
    } else {
      const esperaMin = BACKOFF_MIN[novasTentativas - 1];
      const proxima = new Date(Date.now() + esperaMin * 60_000).toISOString();
      await sb
        .from("castelo_webhook_outbox")
        .update({
          attempts: novasTentativas,
          next_attempt_at: proxima,
          last_status_code: statusCode,
          last_error: respText,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", r.id);
      res.reagendados += 1;
    }
  }

  return res;
}

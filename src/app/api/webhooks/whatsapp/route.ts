// LavSync · CLOCK Relacionamento · Webhook do WhatsApp Cloud API
//
// GET  → handshake de verificação (Meta manda hub.challenge).
// POST → eventos: status de entrega (sent/delivered/read/failed) e mensagens
//        recebidas (inbound). Loga tudo em wa_eventos, atualiza msg_fila pelo
//        wamid e trata opt-out (SAIR/SAIRPROMO).
// O proxy já libera /api/webhooks do guard de auth.
// Doc: docs/CLOCK-RELACIONAMENTO.md §3, §10.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { interpretarPalavraOptOut } from "@/lib/clock-relacionamento/optout";

export const runtime = "nodejs";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// ── GET: verificação do webhook (Meta) ──────────────────────────────
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("hub.mode");
  const token = sp.get("hub.verify_token");
  const challenge = sp.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

// Mapa status Meta → status interno da fila
const STATUS_FILA: Record<string, string> = {
  sent: "enviado",
  delivered: "entregue",
  read: "lido",
  failed: "falhou",
};

// ── POST: eventos ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: true }); // ignora corpo inválido, sempre 200
  }

  const sb = admin();
  const eventos: Record<string, unknown>[] = [];

  try {
    const entries = (payload as { entry?: unknown[] })?.entry ?? [];
    for (const entry of entries as Array<{ changes?: unknown[] }>) {
      for (const change of (entry.changes ?? []) as Array<{ value?: Record<string, unknown> }>) {
        const value = change.value ?? {};
        const meta = value.metadata as { phone_number_id?: string } | undefined;
        const phoneNumberId = meta?.phone_number_id ?? null;

        // 1) Status de mensagens enviadas
        for (const st of (value.statuses ?? []) as Array<Record<string, unknown>>) {
          const wamid = st.id as string | undefined;
          const status = st.status as string | undefined;
          const errs = (st.errors ?? []) as Array<{ code?: number; title?: string; message?: string }>;
          const err = errs[0];
          eventos.push({
            tipo: "status", phone_number_id: phoneNumberId, wamid: wamid ?? null,
            status: status ?? null, recipient: (st.recipient_id as string) ?? null,
            erro_code: err?.code ?? null, erro_msg: err?.message ?? err?.title ?? null,
            raw: st,
          });
          // Atualiza a fila pelo wamid (se a mensagem saiu pela engine)
          if (wamid && status && STATUS_FILA[status]) {
            const upd: Record<string, unknown> = { status: STATUS_FILA[status] };
            if (status === "delivered") upd.entregue_em = new Date().toISOString();
            if (status === "failed") upd.erro = err?.message ?? err?.title ?? "falha de entrega";
            await sb.from("msg_fila").update(upd).eq("provider_message_id", wamid);
          }
        }

        // 2) Mensagens recebidas (inbound)
        for (const msg of (value.messages ?? []) as Array<Record<string, unknown>>) {
          const from = msg.from as string | undefined;
          const texto = ((msg.text as { body?: string } | undefined)?.body ?? "") as string;
          eventos.push({
            tipo: "inbound", phone_number_id: phoneNumberId, wamid: (msg.id as string) ?? null,
            from_number: from ?? null, texto, raw: msg,
          });
          // Opt-out por palavra-chave (SAIR/SAIRPROMO)
          const escopo = interpretarPalavraOptOut(texto);
          if (escopo && from) {
            await sb.from("msg_optout").insert({
              telefone: from, escopo, origem: escopo === "todas" ? "SAIR" : "SAIRPROMO", ativo: true,
              tenant_id: "00000000-0000-0000-0000-000000000001",
            });
          }
        }
      }
    }
    if (eventos.length > 0) await sb.from("wa_eventos").insert(eventos);
  } catch {
    // nunca propaga — Meta exige 200 ou fica retentando
  }
  return NextResponse.json({ ok: true });
}

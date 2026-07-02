"use server";
// LavSync · CLOCK Relacionamento · Onboarding WhatsApp (Embedded Signup)
//
// Fecha o Sprint 2: recebe o resultado do Embedded Signup (coexistência —
// o número segue no app WhatsApp Business do celular E ganha Cloud API),
// troca o code por token, registra o número na Cloud API e assina o
// webhook do WABA. Credenciais por unidade em wa_conexoes (0034).
// Doc: docs/CLOCK-RELACIONAMENTO.md §9.
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const GRAPH = "https://graph.facebook.com/v21.0";

type GraphErro = { error?: { message?: string; code?: number; error_subcode?: number } };

async function graphFetch(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: Record<string, unknown> & GraphErro }> {
  const r = await fetch(`${GRAPH}/${path}`, init);
  const body = (await r.json().catch(() => ({}))) as Record<string, unknown> & GraphErro;
  return { ok: r.ok, status: r.status, body };
}

/** app_id/app_secret: env primeiro, senão a 1ª conexão existente que tenha. */
async function credenciaisApp(): Promise<{ appId: string; appSecret: string } | null> {
  const envId = process.env.META_APP_ID;
  const envSecret = process.env.META_APP_SECRET;
  if (envId && envSecret) return { appId: envId, appSecret: envSecret };
  const sb = createAdminClient();
  const { data } = await sb
    .from("wa_conexoes")
    .select("app_id, app_secret")
    .not("app_id", "is", null)
    .not("app_secret", "is", null)
    .limit(1)
    .maybeSingle();
  const row = data as { app_id: string; app_secret: string } | null;
  return row ? { appId: row.app_id, appSecret: row.app_secret } : null;
}

async function logEvento(dados: {
  tipo: string; phone_number_id?: string | null; status?: string | null;
  erro_code?: number | null; erro_msg?: string | null; raw?: unknown;
}) {
  const sb = createAdminClient();
  const { data: tenant } = await sb.from("tenants").select("id").limit(1).maybeSingle();
  await sb.from("wa_eventos").insert({
    tenant_id: (tenant as { id: string } | null)?.id ?? null,
    tipo: dados.tipo,
    phone_number_id: dados.phone_number_id ?? null,
    status: dados.status ?? null,
    erro_code: dados.erro_code ?? null,
    erro_msg: dados.erro_msg ?? null,
    raw: dados.raw ?? null,
  });
}

export type OnboardingInput = {
  unidadeId: string;
  code: string;            // authResponse.code do FB.login
  wabaId: string;          // capturado no evento WA_EMBEDDED_SIGNUP
  phoneNumberId: string;   // idem
  pin: string;             // 6 dígitos — 2FA do registro Cloud API
};

export type OnboardingResultado = {
  ok: boolean;
  etapa: "token" | "registro" | "webhook" | "salvar" | "concluido";
  erro?: string;
};

/**
 * Conclui o Embedded Signup: code→token, register(pin), subscribed_apps,
 * upsert em wa_conexoes. Cada etapa loga em wa_eventos p/ auditoria.
 */
export async function concluirEmbeddedSignup(input: OnboardingInput): Promise<OnboardingResultado> {
  const creds = await credenciaisApp();
  if (!creds) return { ok: false, etapa: "token", erro: "META_APP_ID/META_APP_SECRET ausentes (env ou wa_conexoes)" };
  if (!/^\d{6}$/.test(input.pin)) return { ok: false, etapa: "registro", erro: "PIN deve ter 6 dígitos" };

  // 1) code → business token (Embedded Signup não usa redirect_uri)
  const tok = await graphFetch(
    `oauth/access_token?client_id=${creds.appId}&client_secret=${creds.appSecret}&code=${encodeURIComponent(input.code)}`,
  );
  const accessToken = tok.body?.access_token as string | undefined;
  if (!tok.ok || !accessToken) {
    const erro = tok.body?.error?.message ?? `HTTP ${tok.status}`;
    await logEvento({ tipo: "onboarding", phone_number_id: input.phoneNumberId, status: "falha_token", erro_msg: erro, raw: tok.body });
    return { ok: false, etapa: "token", erro };
  }

  // 2) registra o número na Cloud API (coexistência exige register + PIN)
  const reg = await graphFetch(`${input.phoneNumberId}/register`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", pin: input.pin }),
  });
  if (!reg.ok) {
    const erro = reg.body?.error?.message ?? `HTTP ${reg.status}`;
    await logEvento({ tipo: "onboarding", phone_number_id: input.phoneNumberId, status: "falha_registro", erro_code: reg.body?.error?.code ?? null, erro_msg: erro, raw: reg.body });
    return { ok: false, etapa: "registro", erro };
  }

  // 3) assina o app no WABA (webhooks de status/inbound)
  const sub = await graphFetch(`${input.wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!sub.ok) {
    // não-fatal: registro já feito; segue e reporta
    await logEvento({ tipo: "onboarding", phone_number_id: input.phoneNumberId, status: "falha_webhook", erro_msg: sub.body?.error?.message ?? `HTTP ${sub.status}`, raw: sub.body });
  }

  // 4) dados do número + upsert wa_conexoes
  const info = await graphFetch(`${input.phoneNumberId}?fields=display_phone_number,verified_name&access_token=${accessToken}`);
  const numero = String(info.body?.display_phone_number ?? "").replace(/\D/g, "") || null;
  const verifiedName = (info.body?.verified_name as string | undefined) ?? null;

  const sb = createAdminClient();
  const { data: tenant } = await sb.from("tenants").select("id").limit(1).maybeSingle();
  if (!tenant) return { ok: false, etapa: "salvar", erro: "Tenant não encontrado" };

  const { error } = await sb.from("wa_conexoes").upsert(
    {
      tenant_id: (tenant as { id: string }).id,
      unidade_id: input.unidadeId,
      provider: "meta_cloud",
      numero_comercial: numero,
      verified_name: verifiedName,
      waba_id: input.wabaId,
      phone_number_id: input.phoneNumberId,
      app_id: creds.appId,
      app_secret: creds.appSecret,
      access_token: accessToken,
      status: "conectado",
      ultimo_check_em: new Date().toISOString(),
      ultimo_erro: sub.ok ? null : "subscribed_apps falhou — reassinar webhook",
      ativo: true,
    },
    { onConflict: "tenant_id,unidade_id" },
  );
  if (error) return { ok: false, etapa: "salvar", erro: error.message };

  await logEvento({ tipo: "onboarding", phone_number_id: input.phoneNumberId, status: "concluido", raw: { waba_id: input.wabaId, numero } });
  revalidatePath("/integracoes/whatsapp");
  return { ok: true, etapa: "concluido" };
}

export type SaudeConexao = {
  ok: boolean;
  canSend?: string;                 // AVAILABLE | LIMITED | BLOCKED
  platformType?: string;            // CLOUD_API | ON_PREMISE | ...
  detalhes?: string[];
  erro?: string;
};

/** Checa health_status na Meta e atualiza status/ultimo_check_em da conexão. */
export async function checarSaudeConexao(unidadeId: string): Promise<SaudeConexao> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("wa_conexoes")
    .select("id, phone_number_id, access_token")
    .eq("unidade_id", unidadeId)
    .eq("ativo", true)
    .maybeSingle();
  const cx = data as { id: string; phone_number_id: string | null; access_token: string | null } | null;
  if (!cx?.phone_number_id || !cx.access_token) return { ok: false, erro: "Conexão sem credenciais" };

  const r = await graphFetch(
    `${cx.phone_number_id}?fields=health_status,platform_type&access_token=${cx.access_token}`,
  );
  if (!r.ok) {
    const erro = r.body?.error?.message ?? `HTTP ${r.status}`;
    await sb.from("wa_conexoes").update({
      status: "erro", ultimo_erro: erro, ultimo_check_em: new Date().toISOString(),
    }).eq("id", cx.id);
    return { ok: false, erro };
  }

  const health = r.body?.health_status as { can_send_message?: string; entities?: { entity_type: string; can_send_message: string; additional_info?: string[] }[] } | undefined;
  const canSend = health?.can_send_message ?? "UNKNOWN";
  const platformType = (r.body?.platform_type as string | undefined) ?? "UNKNOWN";
  const detalhes = (health?.entities ?? []).flatMap((e) =>
    (e.additional_info ?? []).map((m) => `${e.entity_type}: ${m}`),
  );

  const conectado = platformType === "CLOUD_API" && canSend !== "BLOCKED";
  await sb.from("wa_conexoes").update({
    status: conectado ? "conectado" : "erro",
    ultimo_erro: conectado ? null : `platform=${platformType} can_send=${canSend}`,
    ultimo_check_em: new Date().toISOString(),
  }).eq("id", cx.id);
  revalidatePath("/integracoes/whatsapp");
  return { ok: true, canSend, platformType, detalhes };
}

/** Envia mensagem de teste (texto livre) pela conexão da unidade. */
export async function enviarMensagemTeste(unidadeId: string, telefone: string, texto: string): Promise<{ ok: boolean; erro?: string; messageId?: string }> {
  const { getConexaoUnidade, enviarTexto } = await import("./meta-cloud");
  const conexao = await getConexaoUnidade(unidadeId);
  if (!conexao) return { ok: false, erro: "Unidade sem conexão ativa" };
  const r = await enviarTexto(conexao, telefone, texto);
  await logEvento({
    tipo: "teste_envio", phone_number_id: conexao.phone_number_id,
    status: r.ok ? "enviado" : "falha", erro_code: r.statusCode || null, erro_msg: r.erro ?? null,
  });
  return { ok: r.ok, erro: r.erro, messageId: r.messageId };
}

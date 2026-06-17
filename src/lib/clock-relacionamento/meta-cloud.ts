// LavSync · CLOCK Relacionamento · Adaptador Meta WhatsApp Cloud API
//
// Envio POR UNIDADE: cada unidade tem sua conexão (token, phone_number_id)
// em wa_conexoes. Este adaptador lê a conexão e fala com a Graph API.
// Doc: docs/CLOCK-RELACIONAMENTO.md §9.
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const GRAPH = "https://graph.facebook.com/v21.0";
const TIMEOUT_MS = 15_000;

export type Conexao = {
  id: string;
  unidade_id: string;
  numero_comercial: string | null;
  verified_name: string | null;
  waba_id: string | null;
  phone_number_id: string | null;
  access_token: string | null;
  verify_token: string | null;
  status: string;
};

/** Carrega a conexão WhatsApp de uma unidade (service_role; nunca no client). */
export async function getConexaoUnidade(unidadeId: string): Promise<Conexao | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("wa_conexoes")
    .select("id, unidade_id, numero_comercial, verified_name, waba_id, phone_number_id, access_token, verify_token, status")
    .eq("unidade_id", unidadeId)
    .eq("ativo", true)
    .maybeSingle();
  return (data as Conexao | null) ?? null;
}

/** Normaliza telefone BR para E.164 (só dígitos, com 55). */
export function normalizarE164(tel: string): string {
  let d = tel.replace(/\D/g, "");
  if (d.startsWith("55")) return d;
  if (d.length === 10 || d.length === 11) return "55" + d; // DDD + número
  return d;
}

export type EnvioResultado = {
  ok: boolean;
  messageId?: string;
  statusCode: number;
  erro?: string;
  permanente?: boolean; // 4xx = não reenviar
};

async function postMessages(conexao: Conexao, payload: Record<string, unknown>): Promise<EnvioResultado> {
  if (!conexao.phone_number_id || !conexao.access_token) {
    return { ok: false, statusCode: 0, erro: "conexão sem phone_number_id/token", permanente: true };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${GRAPH}/${conexao.phone_number_id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conexao.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
      signal: ctrl.signal,
    });
    const body = await r.json().catch(() => ({}));
    if (r.ok) {
      const id = body?.messages?.[0]?.id as string | undefined;
      return { ok: true, messageId: id, statusCode: r.status };
    }
    // 4xx = erro permanente (payload/template/janela); 5xx/429 = transitório
    const permanente = r.status >= 400 && r.status < 500 && r.status !== 429;
    return {
      ok: false,
      statusCode: r.status,
      erro: body?.error?.message ?? `HTTP ${r.status}`,
      permanente,
    };
  } catch (e) {
    return { ok: false, statusCode: 0, erro: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

/** Texto livre — só funciona dentro da janela de 24h (cliente falou primeiro). */
export async function enviarTexto(conexao: Conexao, para: string, texto: string): Promise<EnvioResultado> {
  return postMessages(conexao, {
    to: normalizarE164(para),
    type: "text",
    text: { preview_url: false, body: texto },
  });
}

/** Template aprovado — para mensagem iniciada pela empresa (campanha/transacional). */
export async function enviarTemplate(
  conexao: Conexao,
  para: string,
  nome: string,
  lang = "pt_BR",
  components?: unknown[],
): Promise<EnvioResultado> {
  return postMessages(conexao, {
    to: normalizarE164(para),
    type: "template",
    template: { name: nome, language: { code: lang }, ...(components ? { components } : {}) },
  });
}

/** Lê dados do número na Graph API (valida token + phone_number_id). */
export async function checarNumero(conexao: Conexao): Promise<{ ok: boolean; info?: unknown; erro?: string }> {
  if (!conexao.phone_number_id || !conexao.access_token) return { ok: false, erro: "sem credenciais" };
  try {
    const r = await fetch(
      `${GRAPH}/${conexao.phone_number_id}?fields=verified_name,display_phone_number,quality_rating,platform_type`,
      { headers: { Authorization: `Bearer ${conexao.access_token}` } },
    );
    const info = await r.json();
    return r.ok ? { ok: true, info } : { ok: false, erro: info?.error?.message };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

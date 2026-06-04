// LavSync · Server Actions de integrações
// - lê .env.local pra detectar quem está conectado
// - salva novas credenciais sem destruir o resto do arquivo
// - testa conexão real (ping) por provider
"use server";

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { PROVIDERS, getProvider, type ProviderId, type IntegrationProvider } from "@/lib/integrations-config";

const ENV_PATH = path.join(process.cwd(), ".env.local");
const IS_PROD = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

// ─── parsing/serialização do .env.local (preserva comentários/ordem) ────────
type EnvMap = Record<string, string>;

/**
 * Em dev: lê do .env.local (também serve pra preservar quando salvar).
 * Em prod (Vercel): lê de process.env diretamente — Vercel injeta os envs.
 */
async function readEnvFile(): Promise<{ raw: string; map: EnvMap }> {
  // process.env é sempre a fonte de verdade pro status (Next carrega .env.local em dev)
  const map: EnvMap = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string" && v.length > 0) map[k] = v;
  }
  let raw = "";
  if (!IS_PROD) {
    try {
      raw = await fs.readFile(ENV_PATH, "utf8");
    } catch {
      raw = "";
    }
  }
  return { raw, map };
}

function upsertEnvLines(raw: string, updates: EnvMap): string {
  const keys = new Set(Object.keys(updates));
  const lines = raw.split(/\r?\n/);
  const seen = new Set<string>();
  const out = lines.map((line) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return line;
    const eq = t.indexOf("=");
    if (eq <= 0) return line;
    const key = t.slice(0, eq).trim();
    if (keys.has(key)) {
      seen.add(key);
      return `${key}=${updates[key]}`;
    }
    return line;
  });
  // append novas chaves no final
  const missing = [...keys].filter((k) => !seen.has(k));
  if (missing.length) {
    if (out.length && out[out.length - 1].trim() !== "") out.push("");
    out.push("# ============ ADICIONADO PELO ASSISTENTE ============");
    for (const k of missing) out.push(`${k}=${updates[k]}`);
  }
  return out.join("\n");
}

// ─── status por provider ─────────────────────────────────────────────────────
export type FieldStatus = {
  envKey: string;
  label: string;
  secret: boolean;
  filled: boolean;
  preview: string | null; // valor mascarado (ou começo, se não-secret)
};

export type ProviderStatus = {
  id: ProviderId;
  state: "connected" | "partial" | "missing";
  filledCount: number;
  totalCount: number;
  fields: FieldStatus[];
};

function maskValue(value: string, secret: boolean): string {
  if (!value) return "";
  if (!secret) {
    if (value.length <= 32) return value;
    return value.slice(0, 28) + "…";
  }
  // secret
  const head = value.slice(0, 4);
  const tail = value.slice(-4);
  return `${head}••••${tail}`;
}

export async function getIntegrationStatus(): Promise<ProviderStatus[]> {
  const { map } = await readEnvFile();
  return PROVIDERS.map<ProviderStatus>((p) => {
    const fields: FieldStatus[] = p.fields.map((f) => {
      const v = map[f.envKey] ?? "";
      const filled = v.length > 0;
      return {
        envKey: f.envKey,
        label: f.label,
        secret: !!f.secret,
        filled,
        preview: filled ? maskValue(v, !!f.secret) : null,
      };
    });
    const filledCount = fields.filter((f) => f.filled).length;
    const totalCount = fields.length;
    const state: ProviderStatus["state"] =
      totalCount === 0 ? "missing" :
      filledCount === totalCount ? "connected" :
      filledCount > 0 ? "partial" : "missing";
    return { id: p.id, state, filledCount, totalCount, fields };
  });
}

// ─── salvar credenciais ──────────────────────────────────────────────────────
export type SaveCredentialsInput = {
  providerId: ProviderId;
  values: Record<string, string>;
};

export type SaveCredentialsResult =
  | { ok: true; updated: string[] }
  | { ok: false; error: string; vercelEnvUrl?: string };

export async function saveIntegrationCredentials(input: SaveCredentialsInput): Promise<SaveCredentialsResult> {
  const provider = getProvider(input.providerId);
  if (!provider) return { ok: false, error: "Provider não encontrado." };
  const allowed = new Set(provider.fields.map((f) => f.envKey));
  const updates: EnvMap = {};
  for (const [k, v] of Object.entries(input.values)) {
    if (!allowed.has(k)) continue;
    const trimmed = (v ?? "").trim();
    if (!trimmed) continue;
    updates[k] = trimmed;
  }
  if (!Object.keys(updates).length) return { ok: false, error: "Nada para salvar." };

  if (IS_PROD) {
    // No Vercel o filesystem é read-only — credencial precisa ir no painel.
    return {
      ok: false,
      error: "Em produção, adicione as variáveis direto no painel do Vercel (depois faça redeploy).",
      vercelEnvUrl: "https://vercel.com/dashboard/environment-variables",
    };
  }

  const { raw } = await readEnvFile();
  const next = upsertEnvLines(raw, updates);
  await fs.writeFile(ENV_PATH, next, "utf8");
  revalidatePath("/integracoes");
  return { ok: true, updated: Object.keys(updates) };
}

// ─── teste de conexão por provider ───────────────────────────────────────────
export type TestResult = { ok: boolean; message: string; details?: string };

async function pingSupabase(env: EnvMap): Promise<TestResult> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: false, message: "URL ou Anon Key ausente." };
  try {
    const r = await fetch(`${url}/rest/v1/?apikey=${key}`, { headers: { apikey: key } });
    if (r.ok || r.status === 200) return { ok: true, message: "PostgREST respondendo OK." };
    return { ok: false, message: `HTTP ${r.status}`, details: await r.text() };
  } catch (e) {
    return { ok: false, message: "Falha de rede.", details: String(e) };
  }
}

async function pingVercel(env: EnvMap): Promise<TestResult> {
  const token = env.VERCEL_TOKEN;
  if (!token) return { ok: false, message: "VERCEL_TOKEN ausente." };
  try {
    const r = await fetch("https://api.vercel.com/v2/user", { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return { ok: false, message: `HTTP ${r.status}`, details: await r.text() };
    const data = (await r.json()) as { user?: { username?: string; email?: string } };
    const u = data.user;
    return { ok: true, message: `Autenticado como ${u?.username ?? u?.email ?? "usuário"}.` };
  } catch (e) {
    return { ok: false, message: "Falha de rede.", details: String(e) };
  }
}

async function pingGithub(env: EnvMap): Promise<TestResult> {
  const token = env.GITHUB_TOKEN;
  if (!token) return { ok: false, message: "GITHUB_TOKEN ausente." };
  try {
    const r = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    if (!r.ok) return { ok: false, message: `HTTP ${r.status}`, details: await r.text() };
    const data = (await r.json()) as { login?: string };
    return { ok: true, message: `Autenticado como @${data.login}.` };
  } catch (e) {
    return { ok: false, message: "Falha de rede.", details: String(e) };
  }
}

async function pingZapi(env: EnvMap): Promise<TestResult> {
  const id = env.ZAPI_INSTANCE_ID;
  const tok = env.ZAPI_TOKEN;
  const ct = env.ZAPI_CLIENT_TOKEN;
  if (!id || !tok) return { ok: false, message: "Instance ID ou Token ausente." };
  try {
    const r = await fetch(`https://api.z-api.io/instances/${id}/token/${tok}/status`, {
      headers: ct ? { "Client-Token": ct } : undefined,
    });
    if (!r.ok) return { ok: false, message: `HTTP ${r.status}`, details: await r.text() };
    const data = (await r.json()) as { connected?: boolean; smartphoneConnected?: boolean };
    if (data.connected || data.smartphoneConnected) return { ok: true, message: "Instância conectada ao WhatsApp." };
    return { ok: false, message: "Instância criada, mas WhatsApp não pareado. Escaneie o QR no painel da Z-API." };
  } catch (e) {
    return { ok: false, message: "Falha de rede.", details: String(e) };
  }
}

async function pingTwilio(env: EnvMap): Promise<TestResult> {
  const sid = env.TWILIO_ACCOUNT_SID;
  const tok = env.TWILIO_AUTH_TOKEN;
  if (!sid || !tok) return { ok: false, message: "SID ou Auth Token ausente." };
  try {
    const auth = Buffer.from(`${sid}:${tok}`).toString("base64");
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!r.ok) return { ok: false, message: `HTTP ${r.status}`, details: await r.text() };
    const data = (await r.json()) as { friendly_name?: string; status?: string };
    return { ok: true, message: `Conta '${data.friendly_name}' (${data.status}).` };
  } catch (e) {
    return { ok: false, message: "Falha de rede.", details: String(e) };
  }
}

async function pingMetaWhatsApp(env: EnvMap): Promise<TestResult> {
  const id = env.META_WA_PHONE_ID;
  const tok = env.META_WA_TOKEN;
  if (!id || !tok) return { ok: false, message: "Phone ID ou Token ausente." };
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${id}?fields=display_phone_number,verified_name`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    if (!r.ok) return { ok: false, message: `HTTP ${r.status}`, details: await r.text() };
    const data = (await r.json()) as { display_phone_number?: string; verified_name?: string };
    return { ok: true, message: `${data.verified_name ?? "Conta"} · ${data.display_phone_number}` };
  } catch (e) {
    return { ok: false, message: "Falha de rede.", details: String(e) };
  }
}

async function pingGoogleCalendar(env: EnvMap): Promise<TestResult> {
  // só valida que client id parece um OAuth válido — sync real depende de OAuth flow do user
  const cid = env.GOOGLE_CLIENT_ID;
  const cs = env.GOOGLE_CLIENT_SECRET;
  if (!cid || !cs) return { ok: false, message: "Client ID/Secret ausente." };
  if (!cid.endsWith(".apps.googleusercontent.com")) {
    return { ok: false, message: "Client ID não tem o formato esperado (.apps.googleusercontent.com)." };
  }
  return { ok: true, message: "Credenciais OAuth registradas. Próximo passo: usuário autoriza acesso ao calendário." };
}

const TESTERS: Partial<Record<ProviderId, (env: EnvMap) => Promise<TestResult>>> = {
  supabase: pingSupabase,
  vercel: pingVercel,
  github: pingGithub,
  zapi: pingZapi,
  twilio: pingTwilio,
  meta_whatsapp: pingMetaWhatsApp,
  google_calendar: pingGoogleCalendar,
};

export async function testIntegration(providerId: ProviderId): Promise<TestResult> {
  const tester = TESTERS[providerId];
  if (!tester) return { ok: false, message: "Teste automático ainda não implementado para este provider." };
  const { map } = await readEnvFile();
  return tester(map);
}

// ─── helper agregado para o cliente ──────────────────────────────────────────
export async function getIntegrationsCatalog(): Promise<{
  providers: IntegrationProvider[];
  status: ProviderStatus[];
}> {
  const status = await getIntegrationStatus();
  return { providers: PROVIDERS, status };
}

// LavSync · Stone Open Banking · Autenticação
// Spec oficial: https://docs.openbank.stone.com.br/docs/guias/token-de-acesso/
//
// Fluxo OAuth2 client_credentials com client_assertion JWT (RS256).
// JWT obrigatoriamente assinado com chave RSA 4096.
// Validade máxima do JWT: 15 minutos.
// Validade do access_token retornado: 900s (15min).
import "server-only";
import { SignJWT, importPKCS8 } from "jose";
import { randomUUID } from "node:crypto";

// ─── Audiences oficiais (NÃO trocar) ──────────────────────────────
const AUDIENCE_PROD = "https://accounts.openbank.stone.com.br/auth/realms/stone_bank";
const AUDIENCE_SANDBOX = "https://sandbox-accounts.openbank.stone.com.br/auth/realms/stone_bank";

// ─── Token endpoints ─────────────────────────────────────────────
const TOKEN_URL_PROD = "https://accounts.openbank.stone.com.br/auth/realms/stone_bank/protocol/openid-connect/token";
const TOKEN_URL_SANDBOX = "https://sandbox-accounts.openbank.stone.com.br/auth/realms/stone_bank/protocol/openid-connect/token";

// ─── Constantes ──────────────────────────────────────────────────
export const USER_AGENT = "LavSync/1.0";

/** JWT validade — Stone exige no máximo 15 minutos. Usamos 13 pra margem. */
const JWT_VALIDADE_SEGUNDOS = 13 * 60;

export type StoneAmbiente = "production" | "sandbox";

export type StoneCredencial = {
  client_id: string;
  private_key_pem: string;
  ambiente: StoneAmbiente;
};

export type StoneTokenResposta = {
  access_token: string;
  expires_in: number;
  token_type: "Bearer";
  refresh_expires_in?: number;
  scope?: string;
};

/**
 * Gera o client_assertion JWT assinado com a chave privada RSA 4096.
 * Claims exigidas pela Stone:
 *   - alg=RS256, typ=JWT
 *   - iss = sub = clientId = client_id
 *   - aud = audience oficial Stone (NÃO mudar)
 *   - realm = "stone_bank"
 *   - exp = agora + máx 15min
 *   - nbf = agora (not before)
 *   - iat = agora
 *   - jti = UUID v4 único
 */
async function gerarClientAssertion(cred: StoneCredencial): Promise<string> {
  const audience = cred.ambiente === "sandbox" ? AUDIENCE_SANDBOX : AUDIENCE_PROD;
  const privateKey = await importPKCS8(cred.private_key_pem, "RS256");
  const agora = Math.floor(Date.now() / 1000);

  return await new SignJWT({
    realm: "stone_bank",
    clientId: cred.client_id,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(cred.client_id)              // iss
    .setSubject(cred.client_id)             // sub
    .setAudience(audience)                  // aud
    .setIssuedAt(agora)                     // iat
    .setNotBefore(agora)                    // nbf
    .setExpirationTime(agora + JWT_VALIDADE_SEGUNDOS)  // exp (≤15min)
    .setJti(randomUUID())                   // jti
    .sign(privateKey);
}

/**
 * Troca client_assertion JWT por access_token.
 * Stone retorna access_token com validade 900s (15min).
 */
export async function getAccessToken(cred: StoneCredencial): Promise<StoneTokenResposta> {
  const url = cred.ambiente === "sandbox" ? TOKEN_URL_SANDBOX : TOKEN_URL_PROD;
  const clientAssertion = await gerarClientAssertion(cred);

  const body = new URLSearchParams({
    client_id: cred.client_id,
    grant_type: "client_credentials",
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: clientAssertion,
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,             // obrigatório segundo doc Stone
    },
    body: body.toString(),
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Stone auth HTTP ${resp.status}: ${text.slice(0, 300)}`);
  }
  const json = JSON.parse(text) as StoneTokenResposta;
  if (!json.access_token) {
    throw new Error(`Stone retornou resposta sem access_token: ${text.slice(0, 300)}`);
  }
  return json;
}

/**
 * Valida formato da chave privada RSA antes de salvar.
 * Stone exige RSA 4096. Não validamos o tamanho da chave aqui (precisaria parsear ASN.1),
 * mas validamos o formato PKCS#8 PEM.
 */
export function validarPrivateKeyPem(pem: string): { ok: true } | { ok: false; motivo: string } {
  const trimmed = pem.trim();
  if (!trimmed.startsWith("-----BEGIN")) {
    return { ok: false, motivo: "Chave deve começar com -----BEGIN PRIVATE KEY----- ou -----BEGIN RSA PRIVATE KEY-----" };
  }
  if (!trimmed.includes("-----END")) {
    return { ok: false, motivo: "Chave deve terminar com -----END PRIVATE KEY-----" };
  }
  // Chave 4096 PKCS#8 PEM tem aproximadamente 3300 caracteres
  if (trimmed.length < 1000) {
    return { ok: false, motivo: "Chave parece curta demais. Stone exige RSA 4096 — a chave PEM completa deve ter >3000 caracteres." };
  }
  if (trimmed.length < 2400) {
    return { ok: false, motivo: "Chave parece ser RSA 2048. Stone EXIGE RSA 4096. Regenere com: openssl genrsa -out chave.pem 4096" };
  }
  return { ok: true };
}

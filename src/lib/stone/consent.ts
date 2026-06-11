// LavSync · Stone Open Banking · Fluxo de Consentimento
// Spec: https://docs.openbank.stone.com.br/docs/guias/consentimento/
//
// Cada unidade Xô Varal (PJ separada) precisa aprovar acesso da aplicação parceira LavSync.
// Fluxo:
//   1. LavSync gera JWT type=consent assinado com chave privada
//   2. Link conta.stone.com.br/consentimento?client_id=X&jwt=Y é exibido pro responsável
//   3. Responsável da unidade clica, faz login Stone, aprova
//   4. Stone redireciona pra redirect_uri (LavSync) com consent_result + session_metadata
//   5. Callback atualiza integracoes_stone.resource_id + consent_status='aprovado'
import "server-only";
import { SignJWT, importPKCS8 } from "jose";
import { randomUUID } from "node:crypto";

const CONSENT_AUDIENCE = "accounts-hubid@openbank.stone.com.br";
const CONSENT_URL = "https://conta.stone.com.br/consentimento";
// Sandbox tem URL própria — Stone informa na hora do cadastro
const CONSENT_URL_SANDBOX = "https://sandbox-conta.stone.com.br/consentimento";

/** JWT consentimento — máx 2 horas de validade. */
const JWT_CONSENT_VALIDADE_SEGUNDOS = 2 * 60 * 60;

export type GerarLinkConsentimentoInput = {
  client_id: string;
  private_key_pem: string;
  redirect_uri: string;
  session_metadata: string;        // dados pra correlacionar callback (sugestão: hash unidadeId+timestamp)
  ambiente: "production" | "sandbox";
};

export type LinkConsentimento = {
  url: string;
  jwt: string;
  session_metadata: string;
  expira_em: Date;
};

/**
 * Gera JWT específico de consentimento.
 * Claims exigidas:
 *   - type: "consent"
 *   - client_id: identificador da aplicação parceira
 *   - redirect_uri: URI pré-cadastrada na Stone
 *   - session_metadata: dados pra identificar o callback
 *   - exp: máximo 2h
 *   - aud: "accounts-hubid@openbank.stone.com.br"
 */
export async function gerarJwtConsentimento(input: GerarLinkConsentimentoInput): Promise<string> {
  const privateKey = await importPKCS8(input.private_key_pem, "RS256");
  const agora = Math.floor(Date.now() / 1000);
  return await new SignJWT({
    type: "consent",
    client_id: input.client_id,
    redirect_uri: input.redirect_uri,
    session_metadata: input.session_metadata,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setAudience(CONSENT_AUDIENCE)
    .setIssuedAt(agora)
    .setNotBefore(agora)
    .setExpirationTime(agora + JWT_CONSENT_VALIDADE_SEGUNDOS)
    .setJti(randomUUID())
    .sign(privateKey);
}

/** Gera o link completo de consentimento (URL + JWT em query string). */
export async function gerarLinkConsentimento(input: GerarLinkConsentimentoInput): Promise<LinkConsentimento> {
  const jwt = await gerarJwtConsentimento(input);
  const base = input.ambiente === "sandbox" ? CONSENT_URL_SANDBOX : CONSENT_URL;
  const url = `${base}?client_id=${encodeURIComponent(input.client_id)}&jwt=${encodeURIComponent(jwt)}`;
  const expiraEm = new Date(Date.now() + JWT_CONSENT_VALIDADE_SEGUNDOS * 1000);
  return { url, jwt, session_metadata: input.session_metadata, expira_em: expiraEm };
}

/** Gera session_metadata único e seguro (16 bytes hex). */
export function gerarSessionMetadata(): string {
  return randomUUID().replace(/-/g, "");
}

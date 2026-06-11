"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { gerarLinkConsentimento, gerarSessionMetadata } from "./consent";

const REDIRECT_URI_DEFAULT = "https://sistema.lavsync.com.br/integracoes/stone/callback";

/**
 * Gera novo link de consentimento pra unidade. Retorna URL pronta pra compartilhar.
 * Idempotente: se já há link pendente válido, retorna o mesmo.
 */
export async function solicitarConsentimentoStone(unidadeId: string): Promise<{ url: string; expira_em: string; session_metadata: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

  const { data: int } = await sb.from("integracoes_stone")
    .select("id, tenant_id, client_id, private_key_pem, ambiente, consent_status, consent_expira_em, consent_session_metadata, consent_redirect_uri")
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (!int) throw new Error("Integração Stone não cadastrada pra essa unidade.");
  type I = {
    id: string; tenant_id: string; client_id: string; private_key_pem: string;
    ambiente: "production" | "sandbox";
    consent_status: string; consent_expira_em: string | null;
    consent_session_metadata: string | null; consent_redirect_uri: string | null;
  };
  const cfg = int as I;

  // Reusa link pendente se ainda for válido (>5min)
  if (cfg.consent_status === "pendente"
      && cfg.consent_expira_em
      && new Date(cfg.consent_expira_em).getTime() > Date.now() + 5 * 60 * 1000
      && cfg.consent_session_metadata) {
    // Re-gera o link (sem alterar session_metadata pra manter idempotência)
    const link = await gerarLinkConsentimento({
      client_id: cfg.client_id,
      private_key_pem: cfg.private_key_pem,
      redirect_uri: cfg.consent_redirect_uri ?? REDIRECT_URI_DEFAULT,
      session_metadata: cfg.consent_session_metadata,
      ambiente: cfg.ambiente,
    });
    return {
      url: link.url,
      expira_em: cfg.consent_expira_em,
      session_metadata: cfg.consent_session_metadata,
    };
  }

  // Novo link
  const session = gerarSessionMetadata();
  const link = await gerarLinkConsentimento({
    client_id: cfg.client_id,
    private_key_pem: cfg.private_key_pem,
    redirect_uri: REDIRECT_URI_DEFAULT,
    session_metadata: session,
    ambiente: cfg.ambiente,
  });

  await sb.from("integracoes_stone").update({
    consent_status: "pendente",
    consent_solicitado_em: new Date().toISOString(),
    consent_expira_em: link.expira_em.toISOString(),
    consent_session_metadata: session,
    consent_redirect_uri: REDIRECT_URI_DEFAULT,
    consent_jwt: link.jwt,
    atualizado_em: new Date().toISOString(),
  }).eq("id", cfg.id);

  await sb.from("stone_consent_logs").insert({
    tenant_id: cfg.tenant_id,
    unidade_id: unidadeId,
    integracao_id: cfg.id,
    evento: "link_gerado",
    session_metadata: session,
    usuario_id: user?.id ?? null,
  });

  revalidatePath("/integracoes/stone");
  return {
    url: link.url,
    expira_em: link.expira_em.toISOString(),
    session_metadata: session,
  };
}

/** Marca consentimento como revogado (usuário pediu pra revogar). */
export async function revogarConsentimentoStone(unidadeId: string, motivo: string): Promise<void> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const { data: int } = await sb.from("integracoes_stone")
    .select("id, tenant_id").eq("unidade_id", unidadeId).maybeSingle();
  if (!int) throw new Error("Integração não encontrada");
  const cfg = int as { id: string; tenant_id: string };

  await sb.from("integracoes_stone").update({
    consent_status: "revogado",
    resource_id: null,
    atualizado_em: new Date().toISOString(),
  }).eq("id", cfg.id);

  await sb.from("stone_consent_logs").insert({
    tenant_id: cfg.tenant_id,
    unidade_id: unidadeId,
    integracao_id: cfg.id,
    evento: "revogado",
    raw_data: { motivo },
    usuario_id: user?.id ?? null,
  });

  revalidatePath("/integracoes/stone");
}

/** Marca consentimentos pendentes vencidos como expirados (chamado em cron ou na leitura). */
export async function expirarConsentimentosVencidos(): Promise<{ expirados: number }> {
  const sb = await createClient();
  const { data, error } = await sb.from("integracoes_stone")
    .update({ consent_status: "expirado", atualizado_em: new Date().toISOString() })
    .eq("consent_status", "pendente")
    .lt("consent_expira_em", new Date().toISOString())
    .select("id");
  if (error) throw error;
  return { expirados: (data ?? []).length };
}

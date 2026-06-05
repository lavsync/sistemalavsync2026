"use server";
// LavSync · Server actions LGPD (consentimento + direitos do titular)
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

type TipoConsentimento =
  | "cookies_essenciais" | "cookies_analytics" | "cookies_marketing"
  | "termos_uso" | "politica_privacidade" | "newsletter" | "whatsapp";

type TipoSolicitacao =
  | "acesso" | "correcao" | "anonimizacao" | "portabilidade"
  | "exclusao" | "revogacao" | "oposicao" | "informacao";

function admin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function pegarRequestInfo() {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null;
  const userAgent = h.get("user-agent") ?? null;
  return { ip, userAgent };
}

export async function registrarConsentimento(input: {
  tipo: TipoConsentimento;
  concedido: boolean;
  versaoDocumento: string;
  email?: string | null;
  origem?: "site" | "sistema" | "totem";
  metadata?: Record<string, unknown>;
}) {
  const sb = admin();
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { ip, userAgent } = await pegarRequestInfo();

  const { error } = await sb.from("consentimentos_lgpd").insert({
    usuario_id: user?.id ?? null,
    email: input.email ?? user?.email ?? null,
    tipo: input.tipo,
    concedido: input.concedido,
    versao_documento: input.versaoDocumento,
    ip_origem: ip,
    user_agent: userAgent,
    origem: input.origem ?? "sistema",
    metadata: input.metadata ?? null,
  });
  if (error) throw error;
}

export async function aceitarTermosELogin(input: {
  versaoTermos: string;
  versaoPolitica: string;
}) {
  const supabase = await createServerClient();
  const sb = admin();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const agora = new Date().toISOString();

  await sb.from("usuarios").update({
    termos_aceitos_em: agora,
    termos_versao: input.versaoTermos,
    politica_aceita_em: agora,
    politica_versao: input.versaoPolitica,
  }).eq("id", user.id);

  // Registra os 2 consentimentos
  const { ip, userAgent } = await pegarRequestInfo();
  await sb.from("consentimentos_lgpd").insert([
    {
      usuario_id: user.id, email: user.email,
      tipo: "termos_uso", concedido: true,
      versao_documento: input.versaoTermos,
      ip_origem: ip, user_agent: userAgent, origem: "sistema",
    },
    {
      usuario_id: user.id, email: user.email,
      tipo: "politica_privacidade", concedido: true,
      versao_documento: input.versaoPolitica,
      ip_origem: ip, user_agent: userAgent, origem: "sistema",
    },
  ]);
}

export type AbrirSolicitacaoInput = {
  tipo: TipoSolicitacao;
  nome: string;
  email: string;
  cpf?: string | null;
  telefone?: string | null;
  descricao: string;
};

export async function abrirSolicitacaoLgpd(input: AbrirSolicitacaoInput): Promise<{ ok: boolean; protocolo?: string; motivo?: string }> {
  if (!input.nome.trim() || !input.email.trim() || !input.descricao.trim()) {
    return { ok: false, motivo: "Preencha nome, e-mail e descrição." };
  }
  if (!/^[^@]+@[^@]+\.[^@]+$/.test(input.email)) {
    return { ok: false, motivo: "E-mail inválido." };
  }
  if (input.descricao.length < 20) {
    return { ok: false, motivo: "Descreva sua solicitação com mais detalhes (mínimo 20 caracteres)." };
  }

  const sb = admin();
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { ip, userAgent } = await pegarRequestInfo();

  const { data, error } = await sb.from("solicitacoes_lgpd").insert({
    tipo: input.tipo,
    titular_nome: input.nome.trim(),
    titular_email: input.email.trim().toLowerCase(),
    titular_cpf: input.cpf?.trim() || null,
    titular_telefone: input.telefone?.trim() || null,
    descricao: input.descricao.trim(),
    usuario_id: user?.id ?? null,
    ip_origem: ip,
    user_agent: userAgent,
  }).select("id").single();

  if (error) return { ok: false, motivo: error.message };
  return { ok: true, protocolo: (data as { id: string }).id };
}

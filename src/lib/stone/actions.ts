"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { validarPrivateKeyPem } from "./auth";
import { sincronizarStoneUnidade, testarConexaoStone } from "./sync";

export type IntegracaoStoneInput = {
  unidade_id: string;
  cnpj: string;
  razao_social?: string | null;
  account_id: string;
  client_id: string;
  private_key_pem: string;
  ambiente: "production" | "sandbox";
  ativo?: boolean;
  sync_automatico?: boolean;
  sync_intervalo_minutos?: number;
  observacoes?: string | null;
};

export async function salvarIntegracaoStone(id: string | null, input: IntegracaoStoneInput): Promise<{ id: string }> {
  const sb = await createClient();

  // Valida chave
  const valKey = validarPrivateKeyPem(input.private_key_pem);
  if (!valKey.ok) throw new Error("Chave privada inválida: " + valKey.motivo);

  if (id) {
    // Update — só atualiza private_key se foi alterada (não vazio)
    const updates: Record<string, unknown> = {
      cnpj: input.cnpj, razao_social: input.razao_social ?? null,
      account_id: input.account_id, client_id: input.client_id,
      ambiente: input.ambiente, ativo: input.ativo ?? true,
      sync_automatico: input.sync_automatico ?? false,
      sync_intervalo_minutos: input.sync_intervalo_minutos ?? 60,
      observacoes: input.observacoes ?? null,
      atualizado_em: new Date().toISOString(),
    };
    if (input.private_key_pem.trim()) updates.private_key_pem = input.private_key_pem;
    const { error } = await sb.from("integracoes_stone").update(updates).eq("id", id);
    if (error) throw error;
    revalidatePath("/integracoes/stone");
    return { id };
  }

  const { data: tenant } = await sb.from("tenants").select("id").limit(1).maybeSingle();
  if (!tenant) throw new Error("Tenant não encontrado");
  const { data, error } = await sb.from("integracoes_stone").insert({
    ...input,
    tenant_id: (tenant as { id: string }).id,
    ativo: input.ativo ?? true,
    sync_automatico: input.sync_automatico ?? false,
    sync_intervalo_minutos: input.sync_intervalo_minutos ?? 60,
  }).select("id").single();
  if (error) {
    if (error.message.includes("integracoes_stone_unidade_id_key")
        || error.message.includes("duplicate key")) {
      throw new Error("Já existe uma integração Stone configurada pra essa unidade.");
    }
    throw error;
  }
  revalidatePath("/integracoes/stone");
  return { id: (data as { id: string }).id };
}

export async function excluirIntegracaoStone(id: string): Promise<void> {
  const sb = await createClient();
  const { error } = await sb.from("integracoes_stone").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/integracoes/stone");
}

export async function testarConexao(unidadeId: string): Promise<{ ok: boolean; mensagem: string }> {
  const r = await testarConexaoStone(unidadeId);
  return { ok: r.ok, mensagem: r.mensagem };
}

export async function sincronizarAgora(unidadeId: string, fromIso?: string, toIso?: string) {
  const r = await sincronizarStoneUnidade({
    unidadeId,
    from: fromIso ? new Date(fromIso) : undefined,
    to: toIso ? new Date(toIso) : undefined,
    disparadoPor: "manual",
  });
  revalidatePath("/integracoes/stone");
  revalidatePath("/painel-ao-vivo");
  revalidatePath("/");
  return r;
}

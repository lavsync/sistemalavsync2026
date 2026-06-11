import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ConsentStatus = "sem_consentimento" | "pendente" | "aprovado" | "rejeitado" | "expirado" | "revogado";

export type IntegracaoStone = {
  id: string;
  unidade_id: string;
  unidade_nome: string;
  cnpj: string;
  razao_social: string | null;
  account_id: string;
  client_id: string;
  ambiente: "production" | "sandbox";
  ativo: boolean;
  ultimo_sync_em: string | null;
  ultimo_sync_ok: boolean | null;
  ultimo_sync_erro: string | null;
  sync_automatico: boolean;
  sync_intervalo_minutos: number;
  observacoes: string | null;
  criado_em: string;
  // Consentimento (Sprint 2)
  consent_status: ConsentStatus;
  consent_id: string | null;
  resource_id: string | null;
  consent_solicitado_em: string | null;
  consent_aprovado_em: string | null;
  consent_expira_em: string | null;
  consent_redirect_uri: string | null;
};

export async function listarIntegracoesStone(): Promise<IntegracaoStone[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("integracoes_stone")
    .select(`
      id, unidade_id, cnpj, razao_social, account_id, client_id, ambiente,
      ativo, ultimo_sync_em, ultimo_sync_ok, ultimo_sync_erro,
      sync_automatico, sync_intervalo_minutos, observacoes, criado_em,
      consent_status, consent_id, resource_id,
      consent_solicitado_em, consent_aprovado_em, consent_expira_em, consent_redirect_uri,
      unidade:unidades(nome)
    `)
    .order("criado_em", { ascending: false });
  type Raw = Omit<IntegracaoStone, "unidade_nome"> & {
    unidade: { nome: string } | Array<{ nome: string }> | null;
  };
  return ((data ?? []) as unknown as Raw[]).map((r) => {
    const u = Array.isArray(r.unidade) ? r.unidade[0] : r.unidade;
    return { ...r, unidade_nome: u?.nome ?? "—" };
  });
}

export type SyncLog = {
  id: string;
  unidade_id: string;
  unidade_nome: string;
  iniciado_em: string;
  concluido_em: string | null;
  status: "em_andamento" | "sucesso" | "erro" | "parcial";
  janela_from: string | null;
  janela_to: string | null;
  transacoes_recebidas: number;
  vendas_inseridas: number;
  vendas_duplicadas: number;
  erro: string | null;
  disparado_por: string | null;
};

export async function listarSyncLogs(opts?: { unidadeId?: string; limit?: number }): Promise<SyncLog[]> {
  const sb = await createClient();
  let q = sb.from("stone_sync_logs")
    .select(`
      id, unidade_id, iniciado_em, concluido_em, status,
      janela_from, janela_to, transacoes_recebidas, vendas_inseridas, vendas_duplicadas, erro, disparado_por,
      unidade:unidades(nome)
    `)
    .order("iniciado_em", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (opts?.unidadeId) q = q.eq("unidade_id", opts.unidadeId);
  const { data } = await q;
  type Raw = Omit<SyncLog, "unidade_nome"> & { unidade: { nome: string } | Array<{ nome: string }> | null };
  return ((data ?? []) as unknown as Raw[]).map((r) => {
    const u = Array.isArray(r.unidade) ? r.unidade[0] : r.unidade;
    return { ...r, unidade_nome: u?.nome ?? "—" };
  });
}

export type CronStatusEntry = {
  id: string;
  iniciado_em: string;
  concluido_em: string | null;
  unidades_processadas: number;
  unidades_com_sucesso: number;
  unidades_com_erro: number;
  vendas_inseridas_total: number;
  duracao_segundos: number | null;
  erro_global: string | null;
};

export async function listarCronStatus(limit = 20): Promise<CronStatusEntry[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("stone_cron_status")
    .select("id, iniciado_em, concluido_em, unidades_processadas, unidades_com_sucesso, unidades_com_erro, vendas_inseridas_total, duracao_segundos, erro_global")
    .order("iniciado_em", { ascending: false })
    .limit(limit);
  return (data ?? []) as CronStatusEntry[];
}

export type WebhookEventLog = {
  id: string;
  stone_event_id: string;
  event_type: string;
  status: string;
  vendas_geradas: number;
  signature_validated: boolean;
  erro: string | null;
  recebido_em: string;
  processado_em: string | null;
};

export async function listarWebhookEvents(limit = 30): Promise<WebhookEventLog[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("stone_webhook_events")
    .select("id, stone_event_id, event_type, status, vendas_geradas, signature_validated, erro, recebido_em, processado_em")
    .order("recebido_em", { ascending: false })
    .limit(limit);
  return (data ?? []) as WebhookEventLog[];
}

export type ConsentLog = {
  id: string;
  unidade_id: string;
  unidade_nome: string;
  evento: string;
  consent_result: string | null;
  resource_id: string | null;
  criado_em: string;
};

export async function listarConsentLogs(opts?: { unidadeId?: string; limit?: number }): Promise<ConsentLog[]> {
  const sb = await createClient();
  let q = sb.from("stone_consent_logs")
    .select(`
      id, unidade_id, evento, consent_result, resource_id, criado_em,
      unidade:unidades(nome)
    `)
    .order("criado_em", { ascending: false })
    .limit(opts?.limit ?? 30);
  if (opts?.unidadeId) q = q.eq("unidade_id", opts.unidadeId);
  const { data } = await q;
  type Raw = Omit<ConsentLog, "unidade_nome"> & { unidade: { nome: string } | Array<{ nome: string }> | null };
  return ((data ?? []) as unknown as Raw[]).map((r) => {
    const u = Array.isArray(r.unidade) ? r.unidade[0] : r.unidade;
    return { ...r, unidade_nome: u?.nome ?? "—" };
  });
}

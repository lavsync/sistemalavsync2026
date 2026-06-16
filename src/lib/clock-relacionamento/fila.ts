// LavSync · CLOCK Relacionamento · Fila unificada de mensagens
//
// Enfileiramento (com dedupe + opt-out) e processador. Herda o padrão da
// castelo_webhook_outbox (0030): seleciona pendentes vencidos, backoff de
// retry, best-effort. Sprint 1 = dry-run (sem provider). O Sprint 2 pluga
// o adaptador Meta Cloud API no ponto marcado.
// Doc: docs/CLOCK-RELACIONAMENTO.md §8.
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Backoff de retry para falha transitória (min). Mesma curva do Castelo.
export const BACKOFF_MIN = [1, 5, 30, 120, 1440];

export type TipoMsg = "transacional" | "campanha" | "automacao" | "inbound_resp";
export type EscopoMsg = "promo" | "operacional";
export type CanalMsg = "whatsapp" | "email" | "sms";

export type ItemFila = {
  tenant_id: string;
  unidade_id?: string | null;
  tipo: TipoMsg;
  prioridade?: number;            // 0=operacional ... 9=campanha. default por tipo.
  escopo: EscopoMsg;
  cliente_id?: string | null;
  campanha_id?: string | null;
  template_chave?: string | null;
  canal?: CanalMsg;
  destinatario_nome?: string | null;
  destinatario_telefone?: string | null;
  destinatario_cpf?: string | null;
  corpo_renderizado: string;
  agendado_para?: string | null;  // ISO; default now
  dedupe_key?: string | null;
};

function prioridadePadrao(tipo: TipoMsg): number {
  switch (tipo) {
    case "transacional": return 0;   // operacional tem prioridade máxima
    case "inbound_resp": return 1;
    case "automacao": return 4;
    case "campanha": return 9;
  }
}

/**
 * Enfileira mensagens em msg_fila. Dedupe por dedupe_key (ignora duplicados).
 * Retorna quantos foram efetivamente enfileirados.
 */
export async function enfileirar(itens: ItemFila[]): Promise<{ enfileirados: number }> {
  if (itens.length === 0) return { enfileirados: 0 };
  const sb = createAdminClient();
  const agora = new Date().toISOString();

  const rows = itens.map((it) => ({
    tenant_id: it.tenant_id,
    unidade_id: it.unidade_id ?? null,
    tipo: it.tipo,
    prioridade: it.prioridade ?? prioridadePadrao(it.tipo),
    escopo: it.escopo,
    cliente_id: it.cliente_id ?? null,
    campanha_id: it.campanha_id ?? null,
    template_chave: it.template_chave ?? null,
    canal: it.canal ?? "whatsapp",
    destinatario_nome: it.destinatario_nome ?? null,
    destinatario_telefone: it.destinatario_telefone ?? null,
    destinatario_cpf: it.destinatario_cpf ?? null,
    corpo_renderizado: it.corpo_renderizado,
    agendado_para: it.agendado_para ?? agora,
    proximo_retry_em: it.agendado_para ?? agora,
    status: "pendente",
  }));

  let enfileirados = 0;
  // insert em batches de 200, ignorando colisão de dedupe_key
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { data, error } = await sb
      .from("msg_fila")
      .upsert(batch, { onConflict: "tenant_id,dedupe_key", ignoreDuplicates: true })
      .select("id");
    if (!error && data) enfileirados += data.length;
  }
  return { enfileirados };
}

export type ResultadoProcessamento = {
  considerados: number;
  enviados: number;
  reagendados: number;
  mortos: number;
  suprimidos: number;
  dryRun: boolean;
  motivo?: string;
};

/**
 * Processa a fila respeitando prioridade (operacional antes de campanha).
 * Sprint 1: sem provider configurado → dry-run (não envia, deixa pendente).
 * Sprint 2: liga o envio real no ponto marcado [[ENVIO]].
 */
export async function processarFila(opts?: { limite?: number }): Promise<ResultadoProcessamento> {
  const res: ResultadoProcessamento = {
    considerados: 0, enviados: 0, reagendados: 0, mortos: 0, suprimidos: 0, dryRun: true,
  };
  const providerPronto = Boolean(process.env.WHATSAPP_CLOUD_TOKEN); // setado no Sprint 2
  res.dryRun = !providerPronto;

  const limite = opts?.limite ?? 100;
  const sb = createAdminClient();
  const agora = new Date().toISOString();

  const { data: rows, error } = await sb
    .from("msg_fila")
    .select("id, tipo, escopo, canal, destinatario_telefone, corpo_renderizado, tentativas")
    .eq("status", "pendente")
    .lte("proximo_retry_em", agora)
    .order("prioridade", { ascending: true })       // 0 (operacional) primeiro
    .order("proximo_retry_em", { ascending: true })
    .limit(limite);

  if (error || !rows) {
    res.motivo = error?.message ?? "sem linhas";
    return res;
  }
  res.considerados = rows.length;

  if (!providerPronto) {
    // Dry-run: fundação no ar, mas sem WhatsApp ligado. Não toca nas linhas —
    // ficam 'pendente' e serão enviadas quando WHATSAPP_CLOUD_TOKEN existir.
    res.motivo = "provider WhatsApp não configurado (dry-run)";
    return res;
  }

  // ─── Sprint 2: envio real ───────────────────────────────────────
  // for (const r of rows) {
  //   const r = await enviarWhatsApp(r.destinatario_telefone, r.corpo_renderizado);  // [[ENVIO]]
  //   ...marcar enviado / reagendar com BACKOFF_MIN / marcar morto...
  // }
  return res;
}

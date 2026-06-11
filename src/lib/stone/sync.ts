// LavSync · Stone Open Banking · Sincronização → vendas
import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  StoneClient, detectarMeioPagamento, ehReceitaVenda,
  type StoneStatementEntry,
} from "./client";
import type { StoneAmbiente } from "./auth";

export type SyncResultado = {
  syncLogId: string;
  status: "sucesso" | "erro" | "parcial";
  transacoes_recebidas: number;
  vendas_inseridas: number;
  vendas_duplicadas: number;
  erro: string | null;
};

export type SyncOpts = {
  unidadeId: string;
  from?: Date;
  to?: Date;
  disparadoPor?: "manual" | "cron" | "api";
};

/** Sincroniza Stone → LavSync. Pega extrato, salva brutas, gera vendas. */
export async function sincronizarStoneUnidade(opts: SyncOpts): Promise<SyncResultado> {
  const sb = await createClient();

  // 1. Carrega credenciais
  const { data: int } = await sb.from("integracoes_stone")
    .select("*").eq("unidade_id", opts.unidadeId).eq("ativo", true).maybeSingle();
  if (!int) throw new Error("Integração Stone não configurada ou inativa pra essa unidade.");
  type Int = {
    id: string; tenant_id: string; unidade_id: string;
    account_id: string; client_id: string; private_key_pem: string;
    ambiente: StoneAmbiente;
  };
  const cfg = int as unknown as Int;

  const janelaTo = opts.to ?? new Date();
  const janelaFrom = opts.from ?? new Date(janelaTo.getTime() - 24 * 3600 * 1000);

  // 2. Cria log de sincronização
  const { data: { user } } = await sb.auth.getUser();
  const { data: log } = await sb.from("stone_sync_logs").insert({
    tenant_id: cfg.tenant_id,
    unidade_id: cfg.unidade_id,
    integracao_id: cfg.id,
    status: "em_andamento",
    janela_from: janelaFrom.toISOString(),
    janela_to: janelaTo.toISOString(),
    disparado_por: opts.disparadoPor ?? "manual",
    usuario_id: user?.id ?? null,
  }).select("id").single();
  const syncLogId = (log as { id: string }).id;

  let recebidas = 0, inseridas = 0, duplicadas = 0;
  let erroFinal: string | null = null;

  try {
    // 3. Autentica + busca extrato
    const client = new StoneClient({
      client_id: cfg.client_id,
      private_key_pem: cfg.private_key_pem,
      ambiente: cfg.ambiente,
    });

    const entries = await client.listarExtratoTodos({
      account_id: cfg.account_id,
      start_datetime: janelaFrom,
      end_datetime: janelaTo,
      // só pegamos tipos de receita; reduz payload
      type: ["instant_payment", "card_payment", "external", "internal"],
    });
    recebidas = entries.length;

    // 4. Processa cada entrada
    for (const e of entries) {
      // Apenas receitas (créditos finalizados)
      if (!ehReceitaVenda(e)) continue;

      // Dedupe: já temos essa transação?
      const { data: existente } = await sb.from("stone_transacoes_brutas")
        .select("id, venda_id")
        .eq("unidade_id", cfg.unidade_id)
        .eq("stone_id", e.id)
        .maybeSingle();
      if (existente) { duplicadas += 1; continue; }

      const tipoPag = detectarMeioPagamento(e);
      const valorBRL = e.amount / 100;                  // amount já é líquido em centavos
      const valorBrutoBRL = e.operation_amount / 100;
      const taxaBRL = e.fee_amount / 100;

      // Insere transação bruta (audit trail)
      const { data: brt, error: errBrt } = await sb.from("stone_transacoes_brutas").insert({
        tenant_id: cfg.tenant_id,
        unidade_id: cfg.unidade_id,
        stone_id: e.id,
        tipo: tipoPag === "credit_card" ? "credit_card"
            : tipoPag === "debit_card" ? "debit_card"
            : tipoPag === "pix" ? "pix"
            : tipoPag === "boleto" ? "boleto"
            : tipoPag === "transfer" ? "transfer" : "other",
        valor: valorBrutoBRL,
        taxa: taxaBRL,
        liquido: valorBRL,
        bandeira: null,                                // Stone não envia bandeira no statement padrão
        parcelas: null,
        cpf_cliente: e.counter_party?.entity?.document_type === "cpf"
          ? e.counter_party?.entity?.document ?? null : null,
        nome_cliente: e.counter_party?.entity?.name ?? null,
        data_evento: e.created_at,
        data_liquidacao: e.created_at,
        descricao: e.description ?? null,
        raw_payload: e as unknown as Record<string, unknown>,
        sync_log_id: syncLogId,
      }).select("id").single();
      if (errBrt) { erroFinal = errBrt.message; continue; }

      // Cria registro de venda
      const tipoPagamentoVenda = tipoPag === "pix" ? "qrcode"
        : tipoPag === "credit_card" || tipoPag === "debit_card" ? "tef"
        : "outro";
      const tipoCartao = tipoPag === "credit_card" ? "credito"
        : tipoPag === "debit_card" ? "debito"
        : "nao_se_aplica";

      const { data: venda, error: errVenda } = await sb.from("vendas").insert({
        tenant_id: cfg.tenant_id,
        unidade_id: cfg.unidade_id,
        requisicao: `STONE-${e.id}`,                    // dedupe natural
        data_venda: e.created_at,
        situacao: "sucesso",
        tipo_pagamento: tipoPagamentoVenda,
        tipo_cartao: tipoCartao,
        valor: valorBrutoBRL,                          // bruto (cliente pagou)
        valor_sem_desconto: valorBrutoBRL,
        cpf: e.counter_party?.entity?.document_type === "cpf"
          ? e.counter_party?.entity?.document ?? null : null,
        nome_cliente: e.counter_party?.entity?.name ?? null,
        origem_sistema: "stone",
        tipo_servico: "indefinido",                    // será inferido por valor (R$17/R$16,99)
        quantidade_ciclos: 1,
        stone_transacao_id: (brt as { id: string }).id,
      }).select("id").single();

      if (!errVenda) {
        inseridas += 1;
        await sb.from("stone_transacoes_brutas")
          .update({ conciliado: true, venda_id: (venda as { id: string }).id })
          .eq("id", (brt as { id: string }).id);
      }
    }

    // 5. Conclui log
    await sb.from("stone_sync_logs").update({
      concluido_em: new Date().toISOString(),
      status: erroFinal ? "parcial" : "sucesso",
      transacoes_recebidas: recebidas,
      vendas_inseridas: inseridas,
      vendas_duplicadas: duplicadas,
      erro: erroFinal,
    }).eq("id", syncLogId);

    await sb.from("integracoes_stone").update({
      ultimo_sync_em: new Date().toISOString(),
      ultimo_sync_ok: !erroFinal,
      ultimo_sync_erro: erroFinal,
    }).eq("id", cfg.id);

  } catch (e) {
    erroFinal = e instanceof Error ? e.message : String(e);
    await sb.from("stone_sync_logs").update({
      concluido_em: new Date().toISOString(),
      status: "erro",
      transacoes_recebidas: recebidas,
      vendas_inseridas: inseridas,
      vendas_duplicadas: duplicadas,
      erro: erroFinal,
    }).eq("id", syncLogId);

    await sb.from("integracoes_stone").update({
      ultimo_sync_em: new Date().toISOString(),
      ultimo_sync_ok: false,
      ultimo_sync_erro: erroFinal,
    }).eq("id", cfg.id);
  }

  return {
    syncLogId,
    status: erroFinal ? "erro" : "sucesso",
    transacoes_recebidas: recebidas,
    vendas_inseridas: inseridas,
    vendas_duplicadas: duplicadas,
    erro: erroFinal,
  };
}

/** Testa credenciais sem efetuar sync. */
export async function testarConexaoStone(unidadeId: string): Promise<{ ok: boolean; mensagem: string; accountInfo?: unknown }> {
  const sb = await createClient();
  const { data: int } = await sb.from("integracoes_stone")
    .select("*").eq("unidade_id", unidadeId).maybeSingle();
  if (!int) return { ok: false, mensagem: "Integração não configurada" };
  type Int = { account_id: string; client_id: string; private_key_pem: string; ambiente: StoneAmbiente };
  const cfg = int as unknown as Int;
  try {
    const client = new StoneClient(cfg);
    const acc = await client.getAccount(cfg.account_id);
    return { ok: true, mensagem: "Conexão OK · Conta encontrada", accountInfo: acc };
  } catch (e) {
    return { ok: false, mensagem: e instanceof Error ? e.message : String(e) };
  }
}

void (null as unknown as StoneStatementEntry);

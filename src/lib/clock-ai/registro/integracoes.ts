// LavSync · CLOCK v2 · Registro · Integrações (Stone, WhatsApp, importações)
//
// Saúde do que alimenta os números: último sync Stone por unidade e status
// do cron, conexões WhatsApp e fila de mensagens, última importação e a
// última venda registrada por unidade (frescor da base). Credenciais e
// consentimento bancário NUNCA passam pelo CLOCK — só navegação.
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { listarIntegracoesStone, listarSyncLogs, listarCronStatus } from "@/lib/stone/queries";
import { sincronizarAgora, testarConexao } from "@/lib/stone/actions";
import type { DefAcao, DefConsulta } from "./tipos";
import { resolverUnidades, resolverUnidadeUnica, nomeUnidade, ErroClock } from "./comum";

const saudeIntegracoes: DefConsulta = {
  id: "saude_integracoes",
  modulo: "integracoes",
  descricao:
    "Saúde das integrações e frescor da base: Stone (ativo, último sync e erro por unidade, últimas execuções do cron), WhatsApp (conexões e fila de mensagens), " +
    "última importação de planilha e última venda registrada por unidade.",
  permissao: "integracoes.view",
  params: { type: "object", properties: { unidade: { type: "string", description: "Nome/id ou vazio para todas" } } },
  async executar(ctx, p) {
    const us = resolverUnidades(ctx, p.unidade);
    const ids = new Set(us.map((u) => u.id));
    const stone = (await listarIntegracoesStone()).filter((s) => ids.has(s.unidade_id));
    const logs = (await listarSyncLogs({ limit: 20 })).filter((l) => ids.has(l.unidade_id));
    const cron = await listarCronStatus(3);

    // Service role só depois do gate (wa_conexoes/msg_fila têm RLS de master)
    const admin = createAdminClient();
    const { data: conexoes } = await admin.from("wa_conexoes")
      .select("unidade_id, verified_name, status, ativo").in("unidade_id", [...ids]);
    const fila: Record<string, number> = {};
    for (const st of ["pendente", "falhou", "morto"]) {
      const { count } = await admin.from("msg_fila").select("id", { count: "exact", head: true }).in("unidade_id", [...ids]).eq("status", st);
      if (count) fila[st] = count;
    }

    const frescor = [];
    for (const u of us) {
      const { data: v } = await ctx.sb.from("vendas").select("data_venda").eq("unidade_id", u.id).eq("situacao", "sucesso")
        .order("data_venda", { ascending: false }).limit(1).maybeSingle();
      const { data: imp } = await ctx.sb.from("vendas_importacoes").select("criado_em, arquivo_nome, status").eq("unidade_id", u.id)
        .order("criado_em", { ascending: false }).limit(1).maybeSingle();
      frescor.push({
        unidade: u.nome,
        ultima_venda_em: (v as { data_venda?: string } | null)?.data_venda ?? null,
        ultima_importacao: imp ? { em: (imp as { criado_em: string }).criado_em, arquivo: (imp as { arquivo_nome: string }).arquivo_nome, status: (imp as { status: string }).status } : null,
      });
    }

    return {
      stone: stone.map((s) => ({
        unidade: s.unidade_nome, ativo: s.ativo, consentimento: s.consent_status, sync_automatico: s.sync_automatico,
        ultimo_sync_em: s.ultimo_sync_em, ultimo_sync_ok: s.ultimo_sync_ok, erro: s.ultimo_sync_erro,
      })),
      stone_ultimos_syncs: logs.slice(0, 5).map((l) => ({ unidade: l.unidade_nome, em: l.iniciado_em, status: l.status, vendas_inseridas: l.vendas_inseridas, erro: l.erro })),
      stone_cron: cron.map((c) => ({ em: c.iniciado_em, unidades_ok: c.unidades_com_sucesso, unidades_erro: c.unidades_com_erro, vendas_inseridas: c.vendas_inseridas_total, erro: c.erro_global })),
      whatsapp: ((conexoes ?? []) as Array<{ unidade_id: string; verified_name: string | null; status: string; ativo: boolean }>).map((c) => ({
        unidade: nomeUnidade(ctx, c.unidade_id), nome: c.verified_name, status: c.status, ativo: c.ativo,
      })),
      fila_mensagens: fila,
      frescor_da_base: frescor,
    };
  },
};

async function exigirStone(unidadeId: string) {
  const s = (await listarIntegracoesStone()).find((x) => x.unidade_id === unidadeId);
  if (!s) throw new ErroClock("Essa unidade não tem integração Stone cadastrada.");
  if (!s.ativo) throw new ErroClock("A integração Stone dessa unidade está desativada.");
  return s;
}

const sincronizarStone: DefAcao = {
  id: "sincronizar_stone",
  modulo: "integracoes",
  descricao: "Força agora a sincronização do extrato Stone da unidade (insere as vendas novas; duplicadas são ignoradas).",
  permissao: "integracoes.update",
  risco: "medio",
  params: { type: "object", properties: { unidade: { type: "string" } }, required: ["unidade"] },
  async resumir(ctx, p) {
    const u = resolverUnidadeUnica(ctx, p.unidade);
    const s = await exigirStone(u.id);
    return `Vou sincronizar agora o extrato Stone da unidade ${u.nome}${s.ultimo_sync_em ? `; o último sync foi em ${new Date(s.ultimo_sync_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}. Vendas novas entram na base. Confirma?`;
  },
  async executar(ctx, p) {
    const u = resolverUnidadeUnica(ctx, p.unidade);
    await exigirStone(u.id);
    return sincronizarAgora(u.id);
  },
};

const testarStone: DefAcao = {
  id: "testar_conexao_stone",
  modulo: "integracoes",
  descricao: "Testa a conexão com a Stone da unidade (não altera dados).",
  permissao: "integracoes.view",
  risco: "baixo",
  params: { type: "object", properties: { unidade: { type: "string" } }, required: ["unidade"] },
  async resumir(ctx, p) {
    const u = resolverUnidadeUnica(ctx, p.unidade);
    await exigirStone(u.id);
    return `Vou testar a conexão Stone da unidade ${u.nome}. Confirma?`;
  },
  async executar(ctx, p) {
    const u = resolverUnidadeUnica(ctx, p.unidade);
    return testarConexao(u.id);
  },
};

export const CONSULTAS_INTEGRACOES: DefConsulta[] = [saudeIntegracoes];
export const ACOES_INTEGRACOES: DefAcao[] = [sincronizarStone, testarStone];

// LavSync · CLOCK v2 · Registro · Clube de Vantagens, XÔ Club (LavCoin) e Fidelidade
//
// Dois programas distintos — nunca misturar na fala:
//   · Clube de Vantagens: nível por ciclos do mês de referência (Bronze 8+,
//     Prata 12+, Ouro 20+, Diamante 30+), desconto no mês seguinte. Ciclos
//     somam TODAS as unidades; motor único em src/lib/clube/engine.ts.
//   · XÔ Club / LavCoin: só SALDO (1 LC por R$1 gasto), sem nível. LavCoin
//     é passivo: vale xoclub_config.valor_lavcoin_brl no resgate.
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resumoClube, getAbaixoBronze, listarTemplates } from "@/lib/clube/queries";
import { listarEnviosManuais, marcarEnvioManual, type TipoEnvioManual } from "@/lib/clube/envios-manuais";
import { classificarMes, gerarDisparosClube } from "@/lib/clube/actions";
import { labelDoNivel, type NivelClube } from "@/lib/clube/niveis";
import { getResumoXoClub, getResgates, getProdutos } from "@/lib/xoclub/queries";
import { relatorioFidelidade } from "@/lib/fidelidade/relatorio";
import type { DefAcao, DefConsulta } from "./tipos";
import {
  resolverUnidades, temAcessoTotal, textoObrig, umDe, mesRef, mesBR, somarMeses, nomeMesRef,
  mascararTelefone, nomeUnidade, r2, ErroClock, dentroDaJanelaDeDisparo,
} from "./comum";

const P_UNIDADE = { type: "string", description: "Nome ou id da unidade. Vazio = todas as liberadas." };
const NIVEIS: NivelClube[] = ["bronze", "prata", "ouro", "diamante"];

/** Contagem de status da fila de WhatsApp das unidades (service role só depois do gate de permissão). */
async function statusFila(unidadeIds: string[]): Promise<Record<string, number>> {
  const admin = createAdminClient();
  const cont: Record<string, number> = {};
  for (const st of ["pendente", "enviando", "enviado", "falhou", "morto", "suprimido"]) {
    const { count } = await admin.from("msg_fila").select("id", { count: "exact", head: true })
      .in("unidade_id", unidadeIds).eq("status", st);
    if (count) cont[st] = count;
  }
  return cont;
}

const situacaoClube: DefConsulta = {
  id: "situacao_clube",
  modulo: "clube",
  descricao:
    "Clube de Vantagens no mês vigente: classificados por nível e desconto projetado; quem ficou abaixo do Bronze no mês de referência e quantos " +
    "ficaram a até 3 ciclos; mensagens manuais do mês já enviadas por tipo; fila de WhatsApp e conexões ativas.",
  permissao: "marketing.clube.view",
  params: { type: "object", properties: { mes: { type: "string", description: "Mês de APLICAÇÃO AAAA-MM (padrão: mês atual)" }, unidade: P_UNIDADE } },
  async executar(ctx, p) {
    const us = resolverUnidades(ctx, p.unidade);
    const ids = us.map((u) => u.id);
    const aplicacao = mesRef(p, "mes") ?? mesBR(0);
    const referencia = somarMeses(aplicacao, -1);
    const resumo = await resumoClube(ids, aplicacao);
    const abaixo = await getAbaixoBronze(ids, referencia);
    const enviados: Record<string, number> = {};
    for (const tipo of ["qualificacao", "xoclub", "xoclub_saldo"] as TipoEnvioManual[]) {
      enviados[tipo] = (await listarEnviosManuais(referencia, tipo)).length;
    }
    const fila = await statusFila(ids);
    const { data: conexoes } = await createAdminClient().from("wa_conexoes")
      .select("unidade_id, verified_name, status").in("unidade_id", ids).eq("ativo", true);
    return {
      mes_aplicacao: nomeMesRef(aplicacao),
      mes_referencia: nomeMesRef(referencia),
      regra: "níveis pelos ciclos do mês de referência somando todas as unidades; desconto vale no mês de aplicação",
      classificados: resumo.total,
      por_nivel: Object.fromEntries(NIVEIS.map((n) => [labelDoNivel(n), resumo.porNivel[n] ?? 0])),
      desconto_projetado_reais: r2(resumo.fatProjetadoDesconto),
      top_membros: resumo.topMembros.slice(0, 5).map((m) => ({ nome: m.cliente_nome, nivel: labelDoNivel(m.nivel), ciclos: m.ciclos_mes })),
      abaixo_do_bronze: abaixo.length,
      quase_bronze_ate_3_ciclos: abaixo.filter((c) => c.faltaram <= 3).length,
      mensagens_manuais_enviadas: enviados,
      fila_whatsapp: fila,
      conexoes_whatsapp: ((conexoes ?? []) as Array<{ unidade_id: string; verified_name: string | null; status: string }>).map((c) => ({
        unidade: nomeUnidade(ctx, c.unidade_id), nome: c.verified_name, status: c.status,
      })),
    };
  },
};

const xoclubResumo: DefConsulta = {
  id: "xoclub_resumo",
  modulo: "xoclub",
  descricao:
    "XÔ Club (LavCoin, só saldo, sem nível): clientes no programa, LavCoins emitidos, resgatados e em circulação, passivo em reais (circulação × valor do LavCoin), " +
    "maiores saldos, resgates aguardando aprovação e produtos ativos na store.",
  permissao: "marketing.clube.view",
  params: { type: "object", properties: { unidade: P_UNIDADE } },
  async executar(ctx, p) {
    const us = resolverUnidades(ctx, p.unidade);
    const ids = new Set(us.map((u) => u.id));
    const r = await getResumoXoClub([...ids]);
    const { data: cfg } = await ctx.sb.from("xoclub_config").select("valor_lavcoin_brl").limit(1).maybeSingle();
    const valorLc = Number((cfg as { valor_lavcoin_brl?: number } | null)?.valor_lavcoin_brl) || null;
    const resgates = (await getResgates({ status: "solicitado", limit: 100 })).filter((x) => !x.unidade_id || ids.has(x.unidade_id));
    const produtos = await getProdutos(true);
    return {
      clientes_no_programa: r.total_clientes,
      clientes_ativos: r.clientes_ativos,
      clientes_inativos: r.clientes_inativos,
      lavcoins_emitidos: r.total_xc_emitidos,
      lavcoins_resgatados: r.total_xc_resgatados,
      lavcoins_em_circulacao: r.total_xc_em_circulacao,
      valor_lavcoin_reais: valorLc,
      passivo_reais: valorLc != null ? r2(r.total_xc_em_circulacao * valorLc) : null,
      maiores_saldos: r.saldo_top10.slice(0, 5).map((s) => ({ cliente_id: s.cliente_id, nome: s.cliente_nome, saldo: s.saldo_atual, unidade: s.unidade_nome })),
      resgates_aguardando: resgates.length,
      resgates: resgates.slice(0, 10).map((x) => ({ id: x.id, cliente: x.cliente_nome, produto: x.produto_nome, custo_lavcoins: x.custo_xc, unidade: x.unidade_nome, solicitado_em: x.solicitado_em })),
      produtos_ativos_na_store: produtos.length,
    };
  },
};

const fidelidadeRelatorio: DefConsulta = {
  id: "fidelidade_relatorio",
  modulo: "fidelidade",
  descricao:
    "Relatório mensal de fidelidade (mês de aplicação, padrão: atual): classificados por nível e unidade, ciclos e faturamento dos membros, " +
    "saldo de LavCoins somado e os principais membros.",
  permissao: "marketing.clube.view",
  params: { type: "object", properties: { mes: { type: "string", description: "Mês de aplicação AAAA-MM" }, unidade: P_UNIDADE } },
  async executar(ctx, p) {
    const ids = new Set(resolverUnidades(ctx, p.unidade).map((u) => u.id));
    const aplicacao = mesRef(p, "mes") ?? mesBR(0);
    const linhas = (await relatorioFidelidade(aplicacao)).filter((l) => ids.has(l.unidade_id));
    const porNivel: Record<string, number> = {};
    const porUnidade: Record<string, number> = {};
    for (const l of linhas) {
      porNivel[l.nivel] = (porNivel[l.nivel] ?? 0) + 1;
      porUnidade[l.unidade_nome] = (porUnidade[l.unidade_nome] ?? 0) + 1;
    }
    return {
      mes_aplicacao: nomeMesRef(aplicacao),
      membros: linhas.length,
      por_nivel: porNivel,
      por_unidade: porUnidade,
      ciclos_total: linhas.reduce((s, l) => s + l.ciclos_mes, 0),
      faturamento_membros: r2(linhas.reduce((s, l) => s + l.faturamento_mes, 0)),
      lavcoins_saldo_total: linhas.reduce((s, l) => s + (l.lavcoins_saldo || 0), 0),
      principais: [...linhas].sort((a, b) => b.ciclos_mes - a.ciclos_mes).slice(0, 10).map((l) => ({
        cliente_id: l.cliente_id, nome: l.nome, telefone: mascararTelefone(l.telefone), unidade: l.unidade_nome,
        nivel: l.nivel, ciclos: l.ciclos_mes, lavcoins: l.lavcoins_saldo,
      })),
    };
  },
};

const templatesClube: DefConsulta = {
  id: "templates_clube",
  modulo: "clube",
  descricao: "Templates de mensagem do Clube (id, tipo, nível alvo, título, ativo) — use o id em gerar_disparos_clube.",
  permissao: "marketing.clube.view",
  params: { type: "object", properties: {} },
  async executar() {
    const t = await listarTemplates();
    return { templates: t.map((x) => ({ id: x.id, tipo: x.tipo, nivel_alvo: x.nivel_alvo, titulo: x.titulo, ativo: x.ativo })) };
  },
};

// ─── Ações ──────────────────────────────────────────────────────────────────

const acaoClassificarMes: DefAcao = {
  id: "classificar_mes",
  modulo: "clube",
  descricao: "Reclassifica TODOS os clientes no Clube para um mês de referência (recalcula níveis e pontos; o desconto vale no mês seguinte). Idempotente.",
  permissao: "marketing.clube.classificar",
  risco: "medio",
  params: { type: "object", properties: { mes_ref: { type: "string", description: "Mês de REFERÊNCIA AAAA-MM (padrão: mês anterior)" } } },
  async resumir(ctx, p) {
    // O motor (engine.ts:agregarCompetencia) agrega com service role sem
    // recorte de tenant: só o master da plataforma pode disparar pelo CLOCK.
    if (ctx.papel !== "master") throw new ErroClock("Reclassificar o Clube recalcula a rede inteira; só o master pode pedir isso pelo CLOCK. Use a tela do Clube.");
    const ref = mesRef(p, "mes_ref") ?? mesBR(-1);
    if (ref >= mesBR(0)) throw new ErroClock("Só dá para classificar um mês já encerrado.");
    return `Vou reclassificar o Clube com os ciclos de ${nomeMesRef(ref)}. Isso recalcula o nível e os pontos de todos os clientes, com desconto valendo em ${nomeMesRef(somarMeses(ref, 1))}. Confirma?`;
  },
  async executar(ctx, p) {
    if (ctx.papel !== "master") throw new ErroClock("Só o master pode reclassificar o Clube pelo CLOCK.");
    const ref = mesRef(p, "mes_ref") ?? mesBR(-1);
    if (ref >= mesBR(0)) throw new ErroClock("Só dá para classificar um mês já encerrado.");
    const r = await classificarMes(ref);
    return { mes_ref: ref, classificados: r.classificados, por_nivel: r.porNivel };
  },
};

const acaoMarcarEnvioManual: DefAcao = {
  id: "marcar_envio_manual",
  modulo: "clube",
  descricao: "Registra que a equipe já mandou a mensagem do mês ao cliente (qualificação do Clube, portal XÔ Club ou saldo do dia). Não envia nada.",
  permissao: "marketing.clube.disparar",
  risco: "baixo",
  params: {
    type: "object",
    properties: {
      cliente_id: { type: "string", description: "id do cliente (de buscar_cliente)" },
      tipo: { type: "string", enum: ["qualificacao", "xoclub", "xoclub_saldo"] },
      mes_ref: { type: "string", description: "Mês de referência AAAA-MM (padrão: mês anterior)" },
      enviado: { type: "boolean", description: "false desmarca (padrão: true)" },
    },
    required: ["cliente_id", "tipo"],
  },
  async resumir(ctx, p) {
    const c = await clienteDoEscopo(ctx, textoObrig(p, "cliente_id"));
    const tipo = umDe(p, "tipo", ["qualificacao", "xoclub", "xoclub_saldo"] as const, "qualificacao");
    const ref = mesRef(p, "mes_ref") ?? mesBR(-1);
    const desmarcar = p.enviado === false;
    return `Vou ${desmarcar ? "desmarcar" : "marcar"} como enviada a mensagem de ${tipo === "qualificacao" ? "qualificação do Clube" : tipo === "xoclub" ? "portal do XÔ Club" : "saldo do dia"} de ${c.nome}, referente a ${nomeMesRef(ref)}. Confirma?`;
  },
  async executar(ctx, p) {
    const c = await clienteDoEscopo(ctx, textoObrig(p, "cliente_id"));
    const tipo = umDe(p, "tipo", ["qualificacao", "xoclub", "xoclub_saldo"] as const, "qualificacao");
    const ref = mesRef(p, "mes_ref") ?? mesBR(-1);
    const r = await marcarEnvioManual({ clienteId: c.id, unidadeId: c.unidade_id, mesRef: ref, tipo, enviado: p.enviado !== false });
    if (!r.ok) throw new ErroClock(r.erro ?? "Falha ao registrar.");
    return { ok: true, cliente: c.nome, tipo, mes_ref: ref };
  },
};

const acaoGerarDisparosClube: DefAcao = {
  id: "gerar_disparos_clube",
  modulo: "clube",
  descricao:
    "Gera a campanha do Clube com um template para todos os classificados do mês de aplicação (cria a campanha e uma mensagem pendente de envio para cada cliente). " +
    "Use templates_clube para o template_id.",
  permissao: "marketing.clube.disparar",
  risco: "alto",
  params: {
    type: "object",
    properties: {
      template_id: { type: "string" },
      mes: { type: "string", description: "Mês de aplicação AAAA-MM (padrão: atual)" },
      unidade: P_UNIDADE,
    },
    required: ["template_id"],
  },
  async resumir(ctx, p) {
    const us = resolverUnidades(ctx, p.unidade);
    const aplicacao = mesRef(p, "mes") ?? mesBR(0);
    const tplId = textoObrig(p, "template_id");
    const tpl = (await listarTemplates()).find((t) => t.id === tplId);
    if (!tpl) throw new ErroClock("Template não encontrado.");
    const r = await resumoClube(us.map((u) => u.id), aplicacao);
    if (r.total === 0) throw new ErroClock(`Não há classificados em ${nomeMesRef(aplicacao)}.`);
    return `Vou gerar mensagens do Clube com o template "${tpl.titulo}" para ${r.total} clientes classificados em ${nomeMesRef(aplicacao)} (${us.map((u) => u.nome).join(", ")}). Isso cria mensagens a clientes. Confirma?`;
  },
  async executar(ctx, p) {
    const us = resolverUnidades(ctx, p.unidade);
    const aplicacao = mesRef(p, "mes") ?? mesBR(0);
    const todas = us.length === ctx.unidades.length && (await temAcessoTotal(ctx));
    const r = await gerarDisparosClube(aplicacao, textoObrig(p, "template_id"), todas ? null : us.map((u) => u.id));
    return { campanha_id: r.campanhaId, envios: r.envios, janela_de_disparo_aberta: dentroDaJanelaDeDisparo() };
  },
};

/** Cliente pelo id, só se pertencer às unidades liberadas ao usuário. */
async function clienteDoEscopo(ctx: Parameters<DefAcao["executar"]>[0], id: string): Promise<{ id: string; nome: string; unidade_id: string | null }> {
  const { data } = await ctx.sb.from("clientes").select("id, nome, unidade_id").eq("id", id).maybeSingle();
  const c = data as { id: string; nome: string; unidade_id: string | null } | null;
  if (!c || (c.unidade_id && !ctx.unidades.some((u) => u.id === c.unidade_id))) throw new ErroClock("Cliente não encontrado nas suas unidades.");
  return c;
}

export const CONSULTAS_CLUBE: DefConsulta[] = [situacaoClube, xoclubResumo, fidelidadeRelatorio, templatesClube];
export const ACOES_CLUBE: DefAcao[] = [acaoClassificarMes, acaoMarcarEnvioManual, acaoGerarDisparosClube];

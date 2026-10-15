// LavSync · CLOCK v2 · Registro · Marketing (campanhas, cupons e fila de mensagens)
//
// Toda mensagem a cliente é risco ALTO: confirmação com o número de
// destinatários, permissão marketing.disparar, janela das 9h às 21h
// (Brasília) e opt-out aplicado pelo motor (dispararCampanha/processarFila).
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { listarCampanhas, contarAlvosSegmento, type SegmentoRFM } from "@/lib/marketing/queries";
import { relatorioCupons } from "@/lib/marketing/cupons";
import { salvarCampanha, dispararCampanha, deletarCampanha } from "@/lib/marketing/actions";
import { processarFila } from "@/lib/clock-relacionamento/fila";
import type { CtxClock, DefAcao, DefConsulta } from "./tipos";
import {
  resolverUnidades, resolverUnidadeUnica, temAcessoTotal, texto, textoObrig, inteiro, umDe, mesRef, mesBR, nomeMesRef,
  r2, ErroClock, dentroDaJanelaDeDisparo,
} from "./comum";

const SEGMENTOS = ["campeoes", "fieis", "em_risco", "dormentes", "novos", "todos"] as const;
const P_UNIDADE = { type: "string", description: "Nome ou id da unidade. Vazio = todas as liberadas." };

const campanhasECupons: DefConsulta = {
  id: "campanhas_e_cupons",
  modulo: "marketing",
  descricao:
    "Campanhas de marketing (status, segmento, destinatários, enviados, entregues, erros) e o relatório de cupons/vouchers do mês " +
    "(usos, valor, desconto, códigos compartilhados por mais de um CPF).",
  permissao: "marketing.view",
  params: { type: "object", properties: { unidade: P_UNIDADE, mes: { type: "string", description: "Mês dos cupons AAAA-MM (padrão: atual)" }, limite: { type: "integer" } } },
  async executar(ctx, p) {
    const ids = resolverUnidades(ctx, p.unidade).map((u) => u.id);
    const lim = inteiro(p, "limite", 10, 1, 50);
    const camps = await listarCampanhas(ids);
    const ref = mesRef(p, "mes") ?? mesBR(0);
    const cup = await relatorioCupons(ref);
    // O relatório é da rede; usuário restrito vê só códigos usados nas suas unidades
    const nomes = new Set(ctx.unidades.map((u) => u.nome));
    const codigos = (await temAcessoTotal(ctx)) ? cup.codigos : cup.codigos.filter((c) => c.unidades.some((n) => nomes.has(n)));
    const parcial = codigos !== cup.codigos;
    return {
      campanhas_total: camps.length,
      campanhas: camps.slice(0, lim).map((c) => ({
        id: c.id, nome: c.nome, unidade: c.unidade_nome, status: c.status, segmento: c.segmento, canal: c.canal,
        destinatarios: c.total_destinatarios, enviados: c.total_enviados, entregues: c.total_entregues, erros: c.total_erros, criada_em: c.criado_em,
      })),
      cupons: {
        mes: nomeMesRef(ref),
        usos: parcial ? codigos.reduce((s, c) => s + c.usos, 0) : cup.total_usos,
        codigos: parcial ? codigos.length : cup.total_codigos,
        compartilhados: parcial ? codigos.filter((c) => c.compartilhado).length : cup.codigos_compartilhados,
        valor_total: r2(parcial ? codigos.reduce((s, c) => s + c.valor_total, 0) : cup.valor_total),
        desconto_total: r2(parcial ? codigos.reduce((s, c) => s + c.desconto_total, 0) : cup.desconto_total),
        top: codigos.slice(0, 8).map((c) => ({ codigo: c.codigo, origem: c.origem, usos: c.usos, clientes: c.cpfs_distintos, compartilhado: c.compartilhado, desconto: r2(c.desconto_total) })),
      },
    };
  },
};

const alvosSegmento: DefConsulta = {
  id: "alvos_segmento",
  modulo: "marketing",
  descricao: "Quantos clientes com telefone caem num segmento (campeoes, fieis, em_risco, dormentes, novos, todos), opcionalmente com dias sem compra. Prévia de campanha.",
  permissao: "marketing.view",
  params: {
    type: "object",
    properties: { segmento: { type: "string", enum: [...SEGMENTOS] }, unidade: P_UNIDADE, dias_sem_compra: { type: "integer" } },
    required: ["segmento"],
  },
  async executar(ctx, p) {
    const us = resolverUnidades(ctx, p.unidade);
    const seg = umDe(p, "segmento", SEGMENTOS, "todos") as SegmentoRFM;
    const dias = p.dias_sem_compra == null ? null : inteiro(p, "dias_sem_compra", 30, 1, 3650);
    const porUnidade = [];
    for (const u of us) porUnidade.push({ unidade: u.nome, clientes: await contarAlvosSegmento([u.id], seg, dias) });
    return { segmento: seg, dias_sem_compra: dias, total: porUnidade.reduce((s, x) => s + x.clientes, 0), por_unidade: porUnidade };
  },
};

// ─── Ações ──────────────────────────────────────────────────────────────────

/** Texto da mensagem para o cartão de confirmação: o humano aprova vendo o conteúdo que vai ao cliente. */
function textoDaMensagem(t: string | null | undefined): string {
  const limpo = (t ?? "").replace(/\s+/g, " ").trim();
  if (!limpo) return "(mensagem vazia)";
  return limpo.length > 300 ? `${limpo.slice(0, 300)}...` : limpo;
}

async function campanhaDoEscopo(ctx: CtxClock, id: string) {
  const c = (await listarCampanhas(ctx.unidades.map((u) => u.id))).find((x) => x.id === id);
  if (!c) throw new ErroClock("Campanha não encontrada nas suas unidades.");
  return c;
}

const prepararCampanha: DefAcao = {
  id: "preparar_campanha",
  modulo: "marketing",
  descricao: "Cria uma campanha em RASCUNHO (segmento, canal, mensagem) para uma unidade e informa quantos destinatários ela teria. NÃO envia nada.",
  permissao: "marketing.campanhas.create",
  risco: "medio",
  params: {
    type: "object",
    properties: {
      nome: { type: "string" },
      unidade: { type: "string" },
      segmento: { type: "string", enum: [...SEGMENTOS] },
      canal: { type: "string", enum: ["whatsapp", "email", "sms"], description: "Padrão: whatsapp" },
      mensagem: { type: "string", description: "Texto da mensagem; aceita {primeiro_nome}, {nome}" },
      dias_sem_compra: { type: "integer" },
      descricao: { type: "string" },
    },
    required: ["nome", "unidade", "segmento", "mensagem"],
  },
  async resumir(ctx, p) {
    const u = resolverUnidadeUnica(ctx, p.unidade);
    const seg = umDe(p, "segmento", SEGMENTOS, "todos") as SegmentoRFM;
    const dias = p.dias_sem_compra == null ? null : inteiro(p, "dias_sem_compra", 30, 1, 3650);
    const n = await contarAlvosSegmento([u.id], seg, dias);
    return `Vou criar a campanha "${textoObrig(p, "nome")}" em rascunho na unidade ${u.nome}, segmento ${seg}, com ${n} destinatários hoje. Nada é enviado agora. Mensagem: "${textoDaMensagem(textoObrig(p, "mensagem"))}". Confirma?`;
  },
  async executar(ctx, p) {
    const u = resolverUnidadeUnica(ctx, p.unidade);
    await salvarCampanha({
      unidade_id: u.id,
      nome: textoObrig(p, "nome"),
      descricao: texto(p, "descricao") ?? null,
      canal: umDe(p, "canal", ["whatsapp", "email", "sms"] as const, "whatsapp"),
      template_mensagem: textoObrig(p, "mensagem"),
      segmento: umDe(p, "segmento", SEGMENTOS, "todos"),
      filtro_dias_sem_compra: p.dias_sem_compra == null ? null : inteiro(p, "dias_sem_compra", 30, 1, 3650),
      status: "rascunho",
    });
    return { criada: true, status: "rascunho", href: "/publicidade?aba=campanhas" };
  },
};

const dispararCampanhaAcao: DefAcao = {
  id: "disparar_campanha",
  modulo: "marketing",
  descricao:
    "Dispara uma campanha existente: resolve os destinatários, aplica opt-out e ENFILEIRA as mensagens a clientes. Só entre 9h e 21h. Use campanhas_e_cupons para o id.",
  permissao: "marketing.disparar",
  risco: "alto",
  params: { type: "object", properties: { campanha_id: { type: "string" } }, required: ["campanha_id"] },
  async resumir(ctx, p) {
    const c = await campanhaDoEscopo(ctx, textoObrig(p, "campanha_id"));
    if (!c.unidade_id) throw new ErroClock("Campanha sem unidade definida.");
    if (c.status === "concluida" || c.status === "enviando") throw new ErroClock(`A campanha já está ${c.status}.`);
    if (!dentroDaJanelaDeDisparo()) throw new ErroClock("Fora da janela de disparo (9h às 21h).");
    const n = await contarAlvosSegmento([c.unidade_id], c.segmento, c.filtro_dias_sem_compra, c.filtro_ltv_minimo);
    return `Vou disparar a campanha "${c.nome}" para cerca de ${n} clientes da unidade ${c.unidade_nome ?? ""}, pelo ${c.canal}. Quem pediu para sair não recebe. As mensagens vão para a fila de envio. Mensagem: "${textoDaMensagem(c.template_mensagem)}". Confirma?`;
  },
  async executar(ctx, p) {
    const c = await campanhaDoEscopo(ctx, textoObrig(p, "campanha_id"));
    // Repete as checagens do resumo: o estado pode ter mudado até a confirmação.
    if (!c.unidade_id) throw new ErroClock("Campanha sem unidade definida.");
    if (c.status === "concluida" || c.status === "enviando") throw new ErroClock(`A campanha já está ${c.status}.`);
    if (!dentroDaJanelaDeDisparo()) throw new ErroClock("Fora da janela de disparo (9h às 21h).");
    const r = await dispararCampanha(c.id);
    return { campanha: c.nome, ...r };
  },
};

const excluirCampanha: DefAcao = {
  id: "excluir_campanha",
  modulo: "marketing",
  descricao: "Exclui uma campanha de marketing. Irreversível.",
  permissao: "marketing.campanhas.delete",
  risco: "alto",
  params: { type: "object", properties: { campanha_id: { type: "string" } }, required: ["campanha_id"] },
  async resumir(ctx, p) {
    const c = await campanhaDoEscopo(ctx, textoObrig(p, "campanha_id"));
    return `Vou excluir a campanha "${c.nome}" (${c.status}, ${c.total_enviados} enviados). Não dá para desfazer. Confirma?`;
  },
  async executar(ctx, p) {
    const c = await campanhaDoEscopo(ctx, textoObrig(p, "campanha_id"));
    await deletarCampanha(c.id);
    return { excluida: true, campanha: c.nome };
  },
};

const processarFilaMensagens: DefAcao = {
  id: "processar_fila_mensagens",
  modulo: "marketing",
  descricao: "Envia AGORA as mensagens pendentes da fila de WhatsApp pelas conexões ativas (até 200). Só entre 9h e 21h; respeita opt-out.",
  permissao: "marketing.disparar",
  risco: "alto",
  params: { type: "object", properties: {} },
  async resumir(ctx) {
    if (!(await temAcessoTotal(ctx))) throw new ErroClock("Processar a fila afeta todas as unidades; peça a um administrador.");
    if (!dentroDaJanelaDeDisparo()) throw new ErroClock("Fora da janela de disparo (9h às 21h).");
    const { count } = await createAdminClient().from("msg_fila").select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId).eq("status", "pendente").lte("agendado_para", new Date().toISOString());
    if (!count) throw new ErroClock("Não há mensagens pendentes prontas para envio.");
    return `Vou enviar agora até ${Math.min(200, count)} das ${count} mensagens pendentes da fila de WhatsApp. Isso manda mensagem real para clientes. Confirma?`;
  },
  async executar(ctx) {
    if (!(await temAcessoTotal(ctx))) throw new ErroClock("Sem acesso a todas as unidades.");
    if (!dentroDaJanelaDeDisparo()) throw new ErroClock("Fora da janela de disparo (9h às 21h).");
    // Só a fila do tenant do usuário (o motor sem tenantId é o do cron, global).
    return processarFila({ limite: 200, tenantId: ctx.tenantId });
  },
};

export const CONSULTAS_MARKETING: DefConsulta[] = [campanhasECupons, alvosSegmento];
export const ACOES_MARKETING: DefAcao[] = [prepararCampanha, dispararCampanhaAcao, excluirCampanha, processarFilaMensagens];

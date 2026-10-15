// LavSync · CLOCK v2 · Registro · Tarefas, Agenda e Rotinas Corporativas
//
// Atenção a nomes repetidos: criarTarefa existe em tarefas/actions.ts
// (tabela tarefas) e em agenda-actions.ts (checklist de evento). Aqui só a
// de TAREFAS é exposta; a agenda cria evento com alerta.
import "server-only";
import { listarTarefas, getResumoTarefas, type Tarefa } from "@/lib/tarefas/queries";
import { listarColunasKanban } from "@/lib/tarefas/kanban-queries";
import {
  criarTarefa as criarTarefaAcao, atualizarTarefa, adicionarComentario, excluirTarefa,
} from "@/lib/tarefas/actions";
import { moverTarefaKanban } from "@/lib/tarefas/kanban-actions";
import { getEventosNoIntervalo, getFeriadosNoIntervalo } from "@/lib/agenda-queries";
import { criarEvento } from "@/lib/agenda-actions";
import { getMinhasRotinasHoje } from "@/lib/corp/minhas-rotinas";
import { concluirRotinaDireto } from "@/lib/corp/execucoes-actions";
import { norm } from "@/lib/utils";
import { addDaysBR, startOfDayBR, endOfDayBR, isoDayBR, todayBRiso } from "@/lib/timezone-br";
import type { CtxClock, DefAcao, DefConsulta, Params } from "./tipos";
import {
  resolverUnidadeUnica, temAcessoTotal, texto, textoObrig, inteiro, umDe, dia, booleano, nomeUnidade, ErroClock,
} from "./comum";

const STATUS = ["pendente", "em_andamento", "concluida", "cancelada", "bloqueada"] as const;
const PRIORIDADES = ["baixa", "media", "alta", "critica"] as const;

/** Tarefas visíveis ao usuário: todas (acesso total) ou das unidades liberadas + atribuídas a ele. */
async function tarefasVisiveis(ctx: CtxClock, status: Tarefa["status"] | "todos", limite: number): Promise<Tarefa[]> {
  if (await temAcessoTotal(ctx)) return listarTarefas({ status, limit: limite });
  const [daUnidade, minhas] = await Promise.all([
    listarTarefas({ unidadeIds: ctx.unidades.map((u) => u.id), status, limit: limite }),
    listarTarefas({ atribuidaPara: ctx.userId, status, limit: limite }),
  ]);
  const vistos = new Set<string>();
  return [...daUnidade, ...minhas].filter((t) => (vistos.has(t.id) ? false : (vistos.add(t.id), true)));
}

async function tarefaDoEscopo(ctx: CtxClock, id: string): Promise<Tarefa> {
  const t = (await tarefasVisiveis(ctx, "todos", 1000)).find((x) => x.id === id);
  if (!t) throw new ErroClock("Tarefa não encontrada entre as suas.");
  return t;
}

const linhaTarefa = (t: Tarefa) => ({
  id: t.id, titulo: t.titulo, status: t.status, prioridade: t.prioridade, prazo: t.prazo,
  unidade: t.unidade_nome, responsavel: t.atribuida_para_nome,
});

function atrasada(t: Tarefa): boolean {
  return !!t.prazo && (t.status === "pendente" || t.status === "em_andamento") && t.prazo.slice(0, 10) < todayBRiso();
}

// ─── Consultas ──────────────────────────────────────────────────────────────

const minhasPendencias: DefConsulta = {
  id: "minhas_pendencias",
  modulo: "tarefas",
  descricao:
    "Pendências do usuário para o briefing: rotinas de hoje (feitas e por fazer), tarefas atrasadas e abertas atribuídas a ele, " +
    "compromissos de hoje e amanhã e feriados dos próximos 15 dias. Cada bloco só aparece se o perfil tiver acesso.",
  permissao: null,
  params: { type: "object", properties: {} },
  async executar(ctx) {
    const out: Record<string, unknown> = {};
    if (ctx.permissoes.has("rotinas.view")) {
      const rotinas = await getMinhasRotinasHoje();
      out.rotinas_hoje = {
        total: rotinas.length,
        concluidas: rotinas.filter((r) => r.ja_concluida_hoje).length,
        pendentes: rotinas.filter((r) => !r.ja_concluida_hoje).map((r) => ({ id: r.id, titulo: r.titulo, horario_alvo: r.horario_alvo, criticidade: r.criticidade })),
      };
    }
    if (ctx.permissoes.has("tarefas.view")) {
      const minhas = await listarTarefas({ atribuidaPara: ctx.userId, status: "todos", limit: 500 });
      const abertas = minhas.filter((t) => t.status === "pendente" || t.status === "em_andamento" || t.status === "bloqueada");
      out.tarefas = {
        abertas: abertas.length,
        atrasadas: abertas.filter(atrasada).map(linhaTarefa),
        vencem_hoje: abertas.filter((t) => t.prazo?.slice(0, 10) === todayBRiso()).map(linhaTarefa),
      };
    }
    if (ctx.permissoes.has("agenda.view")) {
      const hoje = startOfDayBR();
      const eventos = await getEventosNoIntervalo(hoje.toISOString(), endOfDayBR(addDaysBR(hoje, 1)).toISOString());
      const feriados = await getFeriadosNoIntervalo(todayBRiso(), isoDayBR(addDaysBR(hoje, 15)));
      out.agenda = {
        compromissos: eventos.filter((e) => e.status !== "cancelado").map((e) => ({ titulo: e.titulo, inicio: e.inicio_em, fim: e.fim_em, local: e.local, dia_inteiro: e.dia_inteiro })),
        feriados_proximos: feriados.map((f) => ({ data: f.data, nome: f.nome })),
      };
    }
    if (Object.keys(out).length === 0) throw new ErroClock("Seu perfil não tem acesso a rotinas, tarefas nem agenda.");
    return out;
  },
};

const tarefasLista: DefConsulta = {
  id: "tarefas_lista",
  modulo: "tarefas",
  descricao: "Tarefas com resumo por status e prioridade, atrasadas e que vencem hoje; filtro por status e 'só minhas'. Devolve ids para ações.",
  permissao: "tarefas.view",
  params: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["todos", ...STATUS] },
      so_minhas: { type: "boolean", description: "Só as atribuídas ao usuário (padrão: false)" },
      limite: { type: "integer" },
    },
  },
  async executar(ctx, p) {
    const status = umDe(p, "status", ["todos", ...STATUS] as const, "todos");
    const lim = inteiro(p, "limite", 20, 1, 100);
    const lista = booleano(p, "so_minhas", false)
      ? await listarTarefas({ atribuidaPara: ctx.userId, status, limit: 500 })
      : await tarefasVisiveis(ctx, status, 500);
    const resumo = booleano(p, "so_minhas", false) || !(await temAcessoTotal(ctx))
      ? null
      : await getResumoTarefas();
    return {
      resumo: resumo ?? {
        total: lista.length,
        atrasadas: lista.filter(atrasada).length,
      },
      atrasadas: lista.filter(atrasada).slice(0, lim).map(linhaTarefa),
      tarefas: lista.slice(0, lim).map(linhaTarefa),
    };
  },
};

const agendaPeriodo: DefConsulta = {
  id: "agenda_periodo",
  modulo: "agenda",
  descricao: "Compromissos da agenda e feriados num intervalo (padrão: hoje e os próximos 7 dias).",
  permissao: "agenda.view",
  params: { type: "object", properties: { de: { type: "string", description: "AAAA-MM-DD" }, ate: { type: "string", description: "AAAA-MM-DD" } } },
  async executar(_ctx, p) {
    const de = dia(p, "de") ?? todayBRiso();
    const ate = dia(p, "ate") ?? isoDayBR(addDaysBR(new Date(), 7));
    if (ate < de) throw new ErroClock("A data final é anterior à inicial.");
    const ini = new Date(`${de}T00:00:00-03:00`).toISOString();
    const fim = new Date(`${ate}T23:59:59.999-03:00`).toISOString();
    const eventos = await getEventosNoIntervalo(ini, fim);
    const feriados = await getFeriadosNoIntervalo(de, ate);
    return {
      intervalo: `${de} a ${ate}`,
      eventos: eventos.map((e) => ({ id: e.id, titulo: e.titulo, inicio: e.inicio_em, fim: e.fim_em, local: e.local, status: e.status, tipo: e.tipo, prioridade: e.prioridade })),
      feriados: feriados.map((f) => ({ data: f.data, nome: f.nome })),
    };
  },
};

const rotinasHoje: DefConsulta = {
  id: "rotinas_hoje",
  modulo: "rotinas",
  descricao: "Rotinas corporativas que o usuário deve executar hoje, com passos, horário alvo e se já foram concluídas. Devolve ids para concluir_rotina.",
  permissao: "rotinas.view",
  params: { type: "object", properties: {} },
  async executar() {
    const rotinas = await getMinhasRotinasHoje();
    return {
      total: rotinas.length,
      rotinas: rotinas.map((r) => ({
        id: r.id, titulo: r.titulo, frequencia: r.frequencia, criticidade: r.criticidade, horario_alvo: r.horario_alvo,
        unidade: r.unidade_nome, concluida_hoje: r.ja_concluida_hoje, passos: r.steps.map((s) => s.titulo),
      })),
    };
  },
};

// ─── Ações ──────────────────────────────────────────────────────────────────

const acaoCriarTarefa: DefAcao = {
  id: "criar_tarefa",
  modulo: "tarefas",
  descricao: "Cria uma tarefa (título, prioridade, prazo, unidade opcional; atribuída ao próprio usuário por padrão).",
  permissao: "tarefas.create",
  risco: "baixo",
  params: {
    type: "object",
    properties: {
      titulo: { type: "string" },
      descricao: { type: "string" },
      prioridade: { type: "string", enum: [...PRIORIDADES] },
      prazo: { type: "string", description: "AAAA-MM-DD" },
      unidade: { type: "string", description: "Nome/id da unidade (opcional)" },
    },
    required: ["titulo"],
  },
  async resumir(ctx, p) {
    const u = texto(p, "unidade") ? resolverUnidadeUnica(ctx, p.unidade) : null;
    const prazo = dia(p, "prazo");
    return `Vou criar a tarefa "${textoObrig(p, "titulo")}", prioridade ${umDe(p, "prioridade", PRIORIDADES, "media")}${prazo ? `, prazo ${prazo.split("-").reverse().join("/")}` : ""}${u ? `, unidade ${u.nome}` : ""}, atribuída a você. Confirma?`;
  },
  async executar(ctx, p) {
    const u = texto(p, "unidade") ? resolverUnidadeUnica(ctx, p.unidade) : null;
    const prazo = dia(p, "prazo");
    const r = await criarTarefaAcao({
      titulo: textoObrig(p, "titulo"),
      descricao: texto(p, "descricao") ?? null,
      prioridade: umDe(p, "prioridade", PRIORIDADES, "media"),
      prazo: prazo ?? null,
      unidade_id: u?.id ?? null,
      atribuida_para: ctx.userId,
    });
    return { criada: true, id: r.id, href: "/tarefas" };
  },
};

const acaoComentarTarefa: DefAcao = {
  id: "comentar_tarefa",
  modulo: "tarefas",
  descricao: "Adiciona um comentário a uma tarefa existente.",
  permissao: "tarefas.create",
  risco: "baixo",
  params: { type: "object", properties: { tarefa_id: { type: "string" }, comentario: { type: "string" } }, required: ["tarefa_id", "comentario"] },
  async resumir(ctx, p) {
    const t = await tarefaDoEscopo(ctx, textoObrig(p, "tarefa_id"));
    return `Vou comentar na tarefa "${t.titulo}": ${textoObrig(p, "comentario")}. Confirma?`;
  },
  async executar(ctx, p) {
    const t = await tarefaDoEscopo(ctx, textoObrig(p, "tarefa_id"));
    await adicionarComentario(t.id, textoObrig(p, "comentario"));
    return { comentado: true };
  },
};

const acaoStatusTarefa: DefAcao = {
  id: "atualizar_status_tarefa",
  modulo: "tarefas",
  descricao: "Muda o status de uma tarefa (pendente, em_andamento, concluida, cancelada, bloqueada) ou move para uma coluna do kanban pelo nome.",
  permissao: "tarefas.update",
  risco: "baixo",
  params: {
    type: "object",
    properties: {
      tarefa_id: { type: "string" },
      status: { type: "string", enum: [...STATUS] },
      coluna_kanban: { type: "string", description: "Nome da coluna do kanban (alternativa ao status)" },
    },
    required: ["tarefa_id"],
  },
  async resumir(ctx, p) {
    const t = await tarefaDoEscopo(ctx, textoObrig(p, "tarefa_id"));
    const col = await colunaPedida(p);
    const alvo = col ? `para a coluna ${col.label}` : `para ${umDe(p, "status", STATUS, "concluida")}`;
    return `Vou mover a tarefa "${t.titulo}" ${alvo}. Confirma?`;
  },
  async executar(ctx, p) {
    const t = await tarefaDoEscopo(ctx, textoObrig(p, "tarefa_id"));
    const col = await colunaPedida(p);
    if (col) await moverTarefaKanban(t.id, col.id);
    else await atualizarTarefa(t.id, { status: umDe(p, "status", STATUS, "concluida") });
    return { atualizada: true };
  },
};

async function colunaPedida(p: Params) {
  const nome = texto(p, "coluna_kanban");
  if (!nome) {
    if (!texto(p, "status")) throw new ErroClock("Informe o status ou a coluna do kanban.");
    return null;
  }
  const cols = await listarColunasKanban();
  const n = norm(nome);
  const c = cols.find((x) => norm(x.label) === n) ?? cols.find((x) => norm(x.label).includes(n) || norm(x.codigo) === n);
  if (!c) throw new ErroClock(`Coluna "${nome}" não existe. Colunas: ${cols.map((x) => x.label).join(", ")}.`);
  return c;
}

const acaoExcluirTarefa: DefAcao = {
  id: "excluir_tarefa",
  modulo: "tarefas",
  descricao: "Exclui uma tarefa e seus comentários. Irreversível.",
  permissao: "tarefas.delete",
  risco: "alto",
  params: { type: "object", properties: { tarefa_id: { type: "string" } }, required: ["tarefa_id"] },
  async resumir(ctx, p) {
    const t = await tarefaDoEscopo(ctx, textoObrig(p, "tarefa_id"));
    return `Vou excluir a tarefa "${t.titulo}" (${t.status}). Não dá para desfazer. Confirma?`;
  },
  async executar(ctx, p) {
    const t = await tarefaDoEscopo(ctx, textoObrig(p, "tarefa_id"));
    await excluirTarefa(t.id);
    return { excluida: true };
  },
};

const acaoAgendar: DefAcao = {
  id: "agendar_compromisso",
  modulo: "agenda",
  descricao: "Cria um compromisso na agenda (negócio ou particular) com início, duração e, opcionalmente, um alerta por WhatsApp no telefone do usuário N minutos antes.",
  permissao: "agenda.create",
  risco: "baixo",
  params: {
    type: "object",
    properties: {
      titulo: { type: "string" },
      inicio: { type: "string", description: "Data e hora em Brasília: AAAA-MM-DDTHH:MM" },
      duracao_min: { type: "integer", description: "Padrão 60" },
      tipo: { type: "string", enum: ["negocio", "particular"] },
      local: { type: "string" },
      descricao: { type: "string" },
      unidade: { type: "string" },
      alerta_min_antes: { type: "integer", description: "Alerta por WhatsApp N minutos antes (opcional; usa o telefone do perfil)" },
    },
    required: ["titulo", "inicio"],
  },
  async resumir(ctx, p) {
    const { ini, fim } = horario(p);
    if (p.alerta_min_antes != null) await telefoneDoUsuario(ctx);
    const u = texto(p, "unidade") ? resolverUnidadeUnica(ctx, p.unidade) : null;
    const quando = ini.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    const dur = Math.round((fim.getTime() - ini.getTime()) / 60000);
    return `Vou agendar "${textoObrig(p, "titulo")}" para ${quando}, ${dur} minutos${u ? `, unidade ${u.nome}` : ""}${p.alerta_min_antes != null ? `, com alerta ${inteiro(p, "alerta_min_antes", 30, 0, 10080)} minutos antes` : ""}. Confirma?`;
  },
  async executar(ctx, p) {
    const { ini, fim } = horario(p);
    const u = texto(p, "unidade") ? resolverUnidadeUnica(ctx, p.unidade) : null;
    const telefone = p.alerta_min_antes != null ? await telefoneDoUsuario(ctx) : null;
    const r = await criarEvento({
      titulo: textoObrig(p, "titulo"),
      descricao: texto(p, "descricao") ?? null,
      local: texto(p, "local") ?? null,
      tipo: umDe(p, "tipo", ["negocio", "particular"] as const, "negocio"),
      inicio_em: ini.toISOString(),
      fim_em: fim.toISOString(),
      unidade_id: u?.id ?? null,
      responsavel_id: ctx.userId,
      alertas: telefone
        ? [{ canal: "whatsapp", destino: telefone, minutos_antes: inteiro(p, "alerta_min_antes", 30, 0, 10080) }]
        : undefined,
    });
    return { agendado: true, id: r.id, href: "/agenda" };
  },
};

async function telefoneDoUsuario(ctx: CtxClock): Promise<string> {
  const { data } = await ctx.sb.from("usuarios").select("telefone").eq("id", ctx.userId).maybeSingle();
  const tel = (data as { telefone?: string | null } | null)?.telefone?.replace(/\D/g, "");
  if (!tel) throw new ErroClock("Seu perfil não tem telefone cadastrado para o alerta. Cadastre em Configurações ou agende sem alerta.");
  return tel;
}

function horario(p: Params): { ini: Date; fim: Date } {
  const s = textoObrig(p, "inicio");
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/.exec(s);
  if (!m) throw new ErroClock("inicio deve ser AAAA-MM-DDTHH:MM (horário de Brasília).");
  const ini = new Date(`${m[1]}T${m[2]}:${m[3]}:00-03:00`);
  if (isNaN(ini.getTime())) throw new ErroClock("Data/hora inválida.");
  const dur = inteiro(p, "duracao_min", 60, 5, 24 * 60);
  return { ini, fim: new Date(ini.getTime() + dur * 60000) };
}

const acaoConcluirRotina: DefAcao = {
  id: "concluir_rotina",
  modulo: "rotinas",
  descricao: "Marca uma rotina de hoje como concluída (id de rotinas_hoje).",
  permissao: "rotinas.execute",
  risco: "baixo",
  params: { type: "object", properties: { rotina_id: { type: "string" }, observacoes: { type: "string" } }, required: ["rotina_id"] },
  async resumir(_ctx, p) {
    const r = (await getMinhasRotinasHoje()).find((x) => x.id === textoObrig(p, "rotina_id"));
    if (!r) throw new ErroClock("Essa rotina não está na sua lista de hoje.");
    if (r.ja_concluida_hoje) throw new ErroClock("Essa rotina já foi concluída hoje.");
    return `Vou marcar a rotina "${r.titulo}" como concluída hoje. Confirma?`;
  },
  async executar(ctx, p) {
    const r = (await getMinhasRotinasHoje()).find((x) => x.id === textoObrig(p, "rotina_id"));
    if (!r) throw new ErroClock("Essa rotina não está na sua lista de hoje.");
    if (r.ja_concluida_hoje) throw new ErroClock("Essa rotina já foi concluída hoje.");
    await concluirRotinaDireto(r.id, texto(p, "observacoes"));
    return { concluida: true, rotina: r.titulo, unidade: nomeUnidade(ctx, r.unidade_id) };
  },
};

export const CONSULTAS_TAREFAS: DefConsulta[] = [minhasPendencias, tarefasLista, agendaPeriodo, rotinasHoje];
export const ACOES_TAREFAS: DefAcao[] = [acaoCriarTarefa, acaoComentarTarefa, acaoStatusTarefa, acaoExcluirTarefa, acaoAgendar, acaoConcluirRotina];

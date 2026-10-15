// LavSync · CLOCK v2 · Registro · Suporte (chamados internos)
import "server-only";
import { listarTickets } from "@/lib/suporte/queries";
import { salvarTicket } from "@/lib/suporte/actions";
import type { DefAcao, DefConsulta } from "./tipos";
import { resolverUnidadeUnica, texto, textoObrig, umDe, inteiro } from "./comum";

const CATEGORIAS = ["bug", "sugestao", "maquina", "atendimento", "duvida", "outro"] as const;
const PRIORIDADES = ["baixa", "media", "alta", "critica"] as const;

const ticketsSuporte: DefConsulta = {
  id: "tickets_suporte",
  modulo: "suporte",
  descricao: "Chamados de suporte das unidades liberadas: abertos e em andamento por prioridade, e os mais recentes.",
  permissao: "suporte.view",
  params: { type: "object", properties: { status: { type: "string", enum: ["abertos", "todos"] }, limite: { type: "integer" } } },
  async executar(ctx, p) {
    const ids = new Set(ctx.unidades.map((u) => u.id));
    const todos = (await listarTickets()).filter((t) => !t.unidade_id || ids.has(t.unidade_id));
    const abertos = todos.filter((t) => t.status === "aberto" || t.status === "em_andamento");
    const lista = umDe(p, "status", ["abertos", "todos"] as const, "abertos") === "abertos" ? abertos : todos;
    const porPrioridade: Record<string, number> = {};
    for (const t of abertos) porPrioridade[t.prioridade] = (porPrioridade[t.prioridade] ?? 0) + 1;
    return {
      abertos: abertos.length,
      abertos_por_prioridade: porPrioridade,
      tickets: lista.slice(0, inteiro(p, "limite", 10, 1, 50)).map((t) => ({
        numero: t.numero, titulo: t.titulo, categoria: t.categoria, prioridade: t.prioridade, status: t.status,
        unidade: t.unidade_nome, criado_em: t.criado_em,
      })),
    };
  },
};

const abrirTicket: DefAcao = {
  id: "abrir_ticket_suporte",
  modulo: "suporte",
  descricao: "Abre um chamado de suporte interno (bug, sugestão, máquina, atendimento, dúvida) para uma unidade.",
  permissao: "suporte.create",
  risco: "baixo",
  params: {
    type: "object",
    properties: {
      titulo: { type: "string" },
      descricao: { type: "string" },
      categoria: { type: "string", enum: [...CATEGORIAS] },
      prioridade: { type: "string", enum: [...PRIORIDADES] },
      unidade: { type: "string" },
    },
    required: ["titulo", "descricao"],
  },
  async resumir(ctx, p) {
    const u = texto(p, "unidade") ? resolverUnidadeUnica(ctx, p.unidade) : null;
    return `Vou abrir um chamado ${umDe(p, "categoria", CATEGORIAS, "outro")} de prioridade ${umDe(p, "prioridade", PRIORIDADES, "media")}: "${textoObrig(p, "titulo")}"${u ? `, unidade ${u.nome}` : ""}. Confirma?`;
  },
  async executar(ctx, p) {
    const u = texto(p, "unidade") ? resolverUnidadeUnica(ctx, p.unidade) : null;
    await salvarTicket({
      unidade_id: u?.id ?? null,
      titulo: textoObrig(p, "titulo"),
      descricao: textoObrig(p, "descricao"),
      categoria: umDe(p, "categoria", CATEGORIAS, "outro"),
      prioridade: umDe(p, "prioridade", PRIORIDADES, "media"),
      status: "aberto",
    });
    return { aberto: true, href: "/suporte" };
  },
};

export const CONSULTAS_SUPORTE: DefConsulta[] = [ticketsSuporte];
export const ACOES_SUPORTE: DefAcao[] = [abrirTicket];

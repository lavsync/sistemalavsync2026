// LavSync · CLOCK v2 · Registro · Máquinas e Manutenção
import "server-only";
import { listarMaquinas, detectarEquipamentosNaoCadastrados, listarOrdensServico } from "@/lib/manutencao/queries";
import { salvarOrdemServico, autoCadastrarMaquina } from "@/lib/manutencao/actions";
import { norm } from "@/lib/utils";
import type { DefAcao, DefConsulta, Params } from "./tipos";
import { resolverUnidades, resolverUnidadeUnica, texto, textoObrig, umDe, r2, ErroClock } from "./comum";

const P_UNIDADE = { type: "string", description: "Nome ou id da unidade. Vazio = todas as liberadas." };

const maquinasStatus: DefConsulta = {
  id: "maquinas_status",
  modulo: "manutencao",
  descricao:
    "Máquinas por unidade com uso nos últimos 30 dias (vendas, faturamento, dias sem uso), máquinas paradas ou em manutenção, " +
    "equipamentos que aparecem nas vendas mas não estão cadastrados e ordens de serviço abertas.",
  permissao: "manutencao.view",
  params: { type: "object", properties: { unidade: P_UNIDADE } },
  async executar(ctx, p) {
    const ids = resolverUnidades(ctx, p.unidade).map((u) => u.id);
    const maquinas = await listarMaquinas(ids);
    const naoCad = await detectarEquipamentosNaoCadastrados(ids);
    const os = await listarOrdensServico(ids, 50);
    const abertas = os.filter((o) => o.status === "aberta" || o.status === "em_andamento");
    return {
      total_maquinas: maquinas.length,
      paradas_ou_em_manutencao: maquinas.filter((m) => m.status !== "ativa").map((m) => ({ codigo: m.codigo, unidade: m.unidade_nome, status: m.status })),
      sem_uso_ha_3_dias_ou_mais: maquinas.filter((m) => m.status === "ativa" && (m.dias_sem_uso ?? 0) >= 3)
        .map((m) => ({ codigo: m.codigo, unidade: m.unidade_nome, dias_sem_uso: m.dias_sem_uso })),
      uso_30d: maquinas.map((m) => ({
        maquina_id: m.id, codigo: m.codigo, tipo: m.tipo, unidade: m.unidade_nome, status: m.status,
        vendas: m.vendas_30d, faturamento: r2(m.faturamento_30d), dias_sem_uso: m.dias_sem_uso,
      })).sort((a, b) => b.vendas - a.vendas),
      equipamentos_nao_cadastrados: naoCad.map((e) => ({ equipamento: e.equipamento, vendas_30d: e.vendas, ultima: e.ultima })),
      os_abertas: abertas.map((o) => ({
        id: o.id, titulo: o.titulo, maquina: o.maquina_codigo, tipo: o.tipo, prioridade: o.prioridade, status: o.status, aberta_em: o.aberta_em,
      })),
    };
  },
};

/** Máquina por id ou código (sem acento/maiúscula) dentro da unidade. */
async function acharMaquina(unidadeId: string, termo: string | undefined): Promise<{ id: string; codigo: string } | null> {
  if (!termo) return null;
  const ms = await listarMaquinas([unidadeId]);
  const t = norm(termo);
  const m = ms.find((x) => x.id === termo) ?? ms.find((x) => norm(x.codigo) === t) ?? ms.find((x) => norm(x.codigo).includes(t));
  if (!m) throw new ErroClock(`Máquina "${termo}" não encontrada na unidade.`);
  return { id: m.id, codigo: m.codigo };
}

const TIPOS_OS = ["corretiva", "preventiva", "revisao"] as const;
const PRIORIDADES = ["baixa", "media", "alta", "critica"] as const;

function dadosOS(p: Params) {
  return {
    tipo: umDe(p, "tipo", TIPOS_OS, "corretiva"),
    prioridade: umDe(p, "prioridade", PRIORIDADES, "media"),
    titulo: textoObrig(p, "titulo"),
    descricao: texto(p, "descricao") ?? null,
  };
}

const abrirOs: DefAcao = {
  id: "abrir_os_manutencao",
  modulo: "manutencao",
  descricao: "Abre uma ordem de serviço (corretiva, preventiva ou revisão) para uma máquina da unidade.",
  permissao: "manutencao.os.crud",
  risco: "medio",
  params: {
    type: "object",
    properties: {
      unidade: { type: "string" },
      maquina: { type: "string", description: "Código ou id da máquina (opcional)" },
      titulo: { type: "string" },
      descricao: { type: "string" },
      tipo: { type: "string", enum: [...TIPOS_OS] },
      prioridade: { type: "string", enum: [...PRIORIDADES] },
    },
    required: ["unidade", "titulo"],
  },
  async resumir(ctx, p) {
    const u = resolverUnidadeUnica(ctx, p.unidade);
    const m = await acharMaquina(u.id, texto(p, "maquina"));
    const d = dadosOS(p);
    return `Vou abrir uma OS ${d.tipo} de prioridade ${d.prioridade}: "${d.titulo}"${m ? ` na máquina ${m.codigo}` : ""}, unidade ${u.nome}. Confirma?`;
  },
  async executar(ctx, p) {
    const u = resolverUnidadeUnica(ctx, p.unidade);
    const m = await acharMaquina(u.id, texto(p, "maquina"));
    await salvarOrdemServico({ unidade_id: u.id, maquina_id: m?.id ?? null, status: "aberta", ...dadosOS(p) });
    return { aberta: true, href: "/manutencao?aba=ordens" };
  },
};

const cadastrarMaquinaDetectada: DefAcao = {
  id: "cadastrar_maquina_detectada",
  modulo: "manutencao",
  descricao: "Cadastra um equipamento que aparece nas vendas mas não está cadastrado (nome exato de maquinas_status.equipamentos_nao_cadastrados).",
  permissao: "manutencao.maquinas.crud",
  risco: "baixo",
  params: { type: "object", properties: { unidade: { type: "string" }, equipamento: { type: "string" } }, required: ["unidade", "equipamento"] },
  async resumir(ctx, p) {
    const u = resolverUnidadeUnica(ctx, p.unidade);
    const eq = textoObrig(p, "equipamento");
    const lista = await detectarEquipamentosNaoCadastrados([u.id]);
    if (!lista.some((e) => e.equipamento === eq)) throw new ErroClock("Esse equipamento não está na lista de não cadastrados da unidade.");
    return `Vou cadastrar a máquina ${eq} na unidade ${u.nome}, como ativa. Confirma?`;
  },
  async executar(ctx, p) {
    const u = resolverUnidadeUnica(ctx, p.unidade);
    await autoCadastrarMaquina(u.id, textoObrig(p, "equipamento"));
    return { cadastrada: true };
  },
};

export const CONSULTAS_MANUTENCAO: DefConsulta[] = [maquinasStatus];
export const ACOES_MANUTENCAO: DefAcao[] = [abrirOs, cadastrarMaquinaDetectada];

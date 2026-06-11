import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Tarefa = {
  id: string;
  unidade_id: string | null;
  unidade_nome: string | null;
  criada_por: string | null;
  criada_por_nome: string | null;
  atribuida_para: string | null;
  atribuida_para_nome: string | null;
  routine_id: string | null;
  routine_titulo: string | null;
  kanban_coluna_id: string | null;
  titulo: string;
  descricao: string | null;
  prioridade: "baixa" | "media" | "alta" | "critica";
  status: "pendente" | "em_andamento" | "concluida" | "cancelada" | "bloqueada";
  prazo: string | null;
  iniciada_em: string | null;
  concluida_em: string | null;
  tempo_estimado_minutes: number | null;
  tempo_real_minutes: number | null;
  tags: string[];
  criado_em: string;
  atualizado_em?: string;
};

export type TarefaResumo = {
  total: number;
  por_status: Record<Tarefa["status"], number>;
  por_prioridade: Record<Tarefa["prioridade"], number>;
  atrasadas: number;
  vencem_hoje: number;
};

export async function listarTarefas(opts?: {
  unidadeIds?: string[];
  atribuidaPara?: string;
  status?: Tarefa["status"] | "todos";
  prioridade?: Tarefa["prioridade"] | "todas";
  limit?: number;
}): Promise<Tarefa[]> {
  const sb = await createClient();
  let q = sb
    .from("tarefas")
    .select(`
      id, unidade_id, criada_por, atribuida_para, routine_id, kanban_coluna_id, titulo, descricao,
      prioridade, status, prazo, iniciada_em, concluida_em,
      tempo_estimado_minutes, tempo_real_minutes, tags, criado_em, atualizado_em,
      unidade:unidades(nome),
      criador:usuarios!tarefas_criada_por_fkey(nome),
      atribuido:usuarios!tarefas_atribuida_para_fkey(nome),
      routine:corp_routines(titulo)
    `)
    .order("criado_em", { ascending: false })
    .limit(opts?.limit ?? 200);
  if (opts?.unidadeIds && opts.unidadeIds.length > 0) q = q.in("unidade_id", opts.unidadeIds);
  if (opts?.atribuidaPara) q = q.eq("atribuida_para", opts.atribuidaPara);
  if (opts?.status && opts.status !== "todos") q = q.eq("status", opts.status);
  if (opts?.prioridade && opts.prioridade !== "todas") q = q.eq("prioridade", opts.prioridade);
  const { data } = await q;
  type Raw = {
    id: string; unidade_id: string | null; criada_por: string | null; atribuida_para: string | null;
    routine_id: string | null; kanban_coluna_id: string | null; titulo: string; descricao: string | null;
    prioridade: Tarefa["prioridade"]; status: Tarefa["status"];
    prazo: string | null; iniciada_em: string | null; concluida_em: string | null;
    tempo_estimado_minutes: number | null; tempo_real_minutes: number | null;
    tags: string[] | null; criado_em: string; atualizado_em: string;
    unidade: { nome: string } | Array<{ nome: string }> | null;
    criador: { nome: string } | Array<{ nome: string }> | null;
    atribuido: { nome: string } | Array<{ nome: string }> | null;
    routine: { titulo: string } | Array<{ titulo: string }> | null;
  };
  return ((data ?? []) as unknown as Raw[]).map((r) => {
    const und = Array.isArray(r.unidade) ? r.unidade[0] : r.unidade;
    const cri = Array.isArray(r.criador) ? r.criador[0] : r.criador;
    const atb = Array.isArray(r.atribuido) ? r.atribuido[0] : r.atribuido;
    const rou = Array.isArray(r.routine) ? r.routine[0] : r.routine;
    return {
      ...r,
      tags: r.tags ?? [],
      unidade_nome: und?.nome ?? null,
      criada_por_nome: cri?.nome ?? null,
      atribuida_para_nome: atb?.nome ?? null,
      routine_titulo: rou?.titulo ?? null,
    };
  });
}

export async function getResumoTarefas(opts?: { unidadeIds?: string[]; atribuidaPara?: string }): Promise<TarefaResumo> {
  const tarefas = await listarTarefas({ ...opts, status: "todos", limit: 1000 });
  const porStatus: Record<Tarefa["status"], number> = {
    pendente: 0, em_andamento: 0, concluida: 0, cancelada: 0, bloqueada: 0,
  };
  const porPri: Record<Tarefa["prioridade"], number> = { baixa: 0, media: 0, alta: 0, critica: 0 };
  let atrasadas = 0, vencemHoje = 0;
  const hojeIso = new Date().toISOString().slice(0, 10);
  for (const t of tarefas) {
    porStatus[t.status] = (porStatus[t.status] ?? 0) + 1;
    porPri[t.prioridade] = (porPri[t.prioridade] ?? 0) + 1;
    if (t.prazo && (t.status === "pendente" || t.status === "em_andamento")) {
      const prazoData = t.prazo.slice(0, 10);
      if (prazoData < hojeIso) atrasadas += 1;
      else if (prazoData === hojeIso) vencemHoje += 1;
    }
  }
  return {
    total: tarefas.length,
    por_status: porStatus,
    por_prioridade: porPri,
    atrasadas,
    vencem_hoje: vencemHoje,
  };
}

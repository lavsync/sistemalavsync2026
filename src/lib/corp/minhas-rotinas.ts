import "server-only";
import { createClient } from "@/lib/supabase/server";
import { paginarTodos } from "@/lib/supabase/pagination";
import type { Frequencia, Criticidade, Routine } from "./queries";

export type RotinaHoje = Routine & {
  steps: Array<{ id: string; ordem: number; titulo: string; descricao: string | null; obrigatorio: boolean }>;
  execucao_aberta_id: string | null;
  ja_concluida_hoje: boolean;
};

/** Retorna as rotinas que precisam ser executadas HOJE pelo usuário logado.
 *  Lógica de "hoje":
 *   - frequência diaria + dias_semana incluí hoje (ou null = todos) → aparece
 *   - frequência semanal + dias_semana inclui hoje → aparece
 *   - frequência continua → aparece sempre
 *   - frequência mensal: dia 1 ou se nunca executada no mês → aparece
 *   - frequência contingencia: só se ativada via tarefa (não aparece automatic)
 *  Pra cada uma, verifica se já tem execução concluída hoje. */
export async function getMinhasRotinasHoje(): Promise<RotinaHoje[]> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

  const hoje = new Date();
  const diaSemana = hoje.getDay(); // 0=domingo
  const inicioHoje = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0)).toISOString();
  const fimHoje = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59)).toISOString();

  // 1. Busca rotinas ativas
  type R = {
    id: string; codigo: string | null; titulo: string; descricao: string | null;
    frequencia: Frequencia; criticidade: Criticidade; impacto_financeiro: "nenhum" | "baixo" | "medio" | "alto" | "critico";
    operational_weight: number;
    estimated_minutes: number | null; sla_ideal_minutes: number | null; sla_max_minutes: number | null;
    horario_alvo: string | null; dias_semana: number[] | null;
    unidade_id: string | null; org_unit_id: string | null; category_id: string | null;
    responsavel_id: string | null; kpis: string[] | null; ativo: boolean;
    criado_em: string; ultima_execucao_em: string | null;
    cat: { nome: string; color: string | null } | Array<{ nome: string; color: string | null }> | null;
    org: { nome: string } | Array<{ nome: string }> | null;
    unidade: { nome: string } | Array<{ nome: string }> | null;
    resp: { nome: string } | Array<{ nome: string }> | null;
  };
  const rotinas = await paginarTodos<R>((r) =>
    sb.from("corp_routines")
      .select(`
        id, codigo, titulo, descricao, frequencia, criticidade, impacto_financeiro,
        operational_weight, estimated_minutes, sla_ideal_minutes, sla_max_minutes,
        horario_alvo, dias_semana, unidade_id, org_unit_id, category_id,
        responsavel_id, kpis, ativo, criado_em, ultima_execucao_em,
        cat:corp_categories(nome, color),
        org:corp_org_units(nome),
        unidade:unidades(nome),
        resp:usuarios!corp_routines_responsavel_id_fkey(nome)
      `)
      .eq("ativo", true)
      .range(r.from, r.to),
  );

  // Filtra "do dia"
  const doDia = rotinas.filter((r) => {
    if (r.frequencia === "continua" || r.frequencia === "diaria") {
      if (!r.dias_semana || r.dias_semana.length === 0) return true;
      return r.dias_semana.includes(diaSemana);
    }
    if (r.frequencia === "semanal" || r.frequencia === "quinzenal") {
      if (!r.dias_semana || r.dias_semana.length === 0) return false;
      return r.dias_semana.includes(diaSemana);
    }
    if (r.frequencia === "mensal") {
      const isPrimeiroDiaMes = hoje.getDate() === 1;
      const ultExec = r.ultima_execucao_em ? new Date(r.ultima_execucao_em) : null;
      const naoExecutadoNoMes = !ultExec
        || ultExec.getMonth() !== hoje.getMonth()
        || ultExec.getFullYear() !== hoje.getFullYear();
      return isPrimeiroDiaMes || naoExecutadoNoMes;
    }
    return false;
  });

  if (doDia.length === 0) return [];

  // 2. Busca steps por routine
  const ids = doDia.map((r) => r.id);
  type S = { id: string; routine_id: string; ordem: number; titulo: string; descricao: string | null; obrigatorio: boolean };
  const { data: stepsData } = await sb.from("corp_routine_steps")
    .select("*").in("routine_id", ids).order("ordem");
  const stepsMap = new Map<string, S[]>();
  for (const s of (stepsData ?? []) as S[]) {
    if (!stepsMap.has(s.routine_id)) stepsMap.set(s.routine_id, []);
    stepsMap.get(s.routine_id)!.push(s);
  }

  // 3. Busca execuções de hoje
  const { data: execs } = await sb.from("corp_executions")
    .select("id, routine_id, status, completed_at, executor_id")
    .in("routine_id", ids)
    .gte("data_alvo", new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString().slice(0, 10))
    .lte("data_alvo", new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString().slice(0, 10));
  type E = { id: string; routine_id: string; status: string; completed_at: string | null; executor_id: string | null };
  const execMap = new Map<string, E[]>();
  for (const e of (execs ?? []) as E[]) {
    if (!execMap.has(e.routine_id)) execMap.set(e.routine_id, []);
    execMap.get(e.routine_id)!.push(e);
  }

  // 4. Monta resultado, prioriza pelas do usuário logado
  const result: RotinaHoje[] = doDia.map((r) => {
    const cat = Array.isArray(r.cat) ? r.cat[0] : r.cat;
    const org = Array.isArray(r.org) ? r.org[0] : r.org;
    const und = Array.isArray(r.unidade) ? r.unidade[0] : r.unidade;
    const resp = Array.isArray(r.resp) ? r.resp[0] : r.resp;
    const execs = execMap.get(r.id) ?? [];
    const aberta = execs.find((e) => e.status === "em_andamento");
    const concluida = execs.some((e) => e.status === "concluida");
    return {
      id: r.id,
      codigo: r.codigo,
      titulo: r.titulo,
      descricao: r.descricao,
      unidade_id: r.unidade_id,
      unidade_nome: und?.nome ?? null,
      org_unit_id: r.org_unit_id,
      org_unit_nome: org?.nome ?? null,
      category_id: r.category_id,
      category_nome: cat?.nome ?? null,
      category_color: cat?.color ?? null,
      frequencia: r.frequencia,
      criticidade: r.criticidade,
      impacto_financeiro: r.impacto_financeiro,
      operational_weight: r.operational_weight,
      estimated_minutes: r.estimated_minutes,
      sla_ideal_minutes: r.sla_ideal_minutes,
      sla_max_minutes: r.sla_max_minutes,
      horario_alvo: r.horario_alvo,
      dias_semana: r.dias_semana,
      responsavel_id: r.responsavel_id,
      responsavel_nome: resp?.nome ?? null,
      kpis: r.kpis ?? [],
      ativo: r.ativo,
      criado_em: r.criado_em,
      steps: stepsMap.get(r.id) ?? [],
      execucao_aberta_id: aberta?.id ?? null,
      ja_concluida_hoje: concluida,
    };
  });

  // Ordena: minhas primeiro, depois por horário/criticidade
  return result.sort((a, b) => {
    const minhaA = a.responsavel_id === user?.id ? 0 : 1;
    const minhaB = b.responsavel_id === user?.id ? 0 : 1;
    if (minhaA !== minhaB) return minhaA - minhaB;
    if (a.ja_concluida_hoje !== b.ja_concluida_hoje) return a.ja_concluida_hoje ? 1 : -1;
    if (a.horario_alvo && b.horario_alvo) return a.horario_alvo.localeCompare(b.horario_alvo);
    if (a.horario_alvo) return -1;
    if (b.horario_alvo) return 1;
    return 0;
  });
}

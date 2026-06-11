"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/** Inicia execução de uma rotina pelo usuário logado. */
export async function iniciarExecucao(routineId: string): Promise<{ executionId: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: rot } = await sb.from("corp_routines")
    .select("tenant_id, unidade_id").eq("id", routineId).maybeSingle();
  if (!rot) throw new Error("Rotina não encontrada");
  const r = rot as { tenant_id: string; unidade_id: string | null };

  const { data: exec, error } = await sb.from("corp_executions").insert({
    tenant_id: r.tenant_id,
    routine_id: routineId,
    unidade_id: r.unidade_id,
    executor_id: user.id,
    status: "em_andamento",
    started_at: new Date().toISOString(),
  }).select("id").single();
  if (error) throw error;

  // Pré-cria execution_steps a partir dos steps da rotina
  const { data: steps } = await sb.from("corp_routine_steps")
    .select("id, ordem, titulo").eq("routine_id", routineId).order("ordem");
  type S = { id: string; ordem: number; titulo: string };
  const stepsList = (steps ?? []) as S[];
  if (stepsList.length > 0) {
    const execStepsRows = stepsList.map((s) => ({
      execution_id: (exec as { id: string }).id,
      step_id: s.id,
      ordem: s.ordem,
      titulo: s.titulo,
      done: false,
    }));
    await sb.from("corp_execution_steps").insert(execStepsRows);
  }

  revalidatePath("/rotinas-corporativas");
  return { executionId: (exec as { id: string }).id };
}

/** Marca step de uma execução como done. */
export async function marcarStep(executionStepId: string, done: boolean, observacoes?: string) {
  const sb = await createClient();
  const { error } = await sb.from("corp_execution_steps").update({
    done, done_at: done ? new Date().toISOString() : null, observacoes,
  }).eq("id", executionStepId);
  if (error) throw error;
  revalidatePath("/rotinas-corporativas");
}

/** Conclui a execução. */
export async function concluirExecucao(execucaoId: string, observacoes?: string) {
  const sb = await createClient();
  const { data: exec } = await sb.from("corp_executions")
    .select("started_at").eq("id", execucaoId).maybeSingle();
  const startedAt = (exec as { started_at: string | null } | null)?.started_at;
  const totalSec = startedAt
    ? Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)
    : null;

  const { error } = await sb.from("corp_executions").update({
    status: "concluida",
    completed_at: new Date().toISOString(),
    total_seconds: totalSec,
    observacoes,
  }).eq("id", execucaoId);
  if (error) throw error;
  revalidatePath("/rotinas-corporativas");
  revalidatePath("/tarefas");
}

/** Conclui rotina diretamente (atalho — sem checklist detalhado). */
export async function concluirRotinaDireto(routineId: string, observacoes?: string) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: rot } = await sb.from("corp_routines")
    .select("tenant_id, unidade_id").eq("id", routineId).maybeSingle();
  if (!rot) throw new Error("Rotina não encontrada");
  const r = rot as { tenant_id: string; unidade_id: string | null };
  const agora = new Date().toISOString();

  const { error } = await sb.from("corp_executions").insert({
    tenant_id: r.tenant_id,
    routine_id: routineId,
    unidade_id: r.unidade_id,
    executor_id: user.id,
    status: "concluida",
    started_at: agora,
    completed_at: agora,
    total_seconds: 0,
    observacoes,
  });
  if (error) throw error;
  revalidatePath("/rotinas-corporativas");
}

/** Cancela uma execução em andamento. */
export async function cancelarExecucao(execucaoId: string, motivo: string) {
  const sb = await createClient();
  const { error } = await sb.from("corp_executions").update({
    status: "cancelada",
    completed_at: new Date().toISOString(),
    observacoes: motivo,
  }).eq("id", execucaoId);
  if (error) throw error;
  revalidatePath("/rotinas-corporativas");
}

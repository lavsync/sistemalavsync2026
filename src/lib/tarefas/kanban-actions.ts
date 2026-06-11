"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/** Move tarefa pra nova coluna. Atualiza tarefa.kanban_coluna_id + status alvo. */
export async function moverTarefaKanban(tarefaId: string, novaColunaId: string) {
  const sb = await createClient();
  const { data: col } = await sb
    .from("tarefas_kanban_colunas")
    .select("status_alvo, is_final")
    .eq("id", novaColunaId)
    .maybeSingle();
  const c = col as { status_alvo: string; is_final: boolean } | null;
  if (!c) throw new Error("Coluna não encontrada");

  const patch: Record<string, unknown> = {
    kanban_coluna_id: novaColunaId,
    status: c.status_alvo,
    atualizado_em: new Date().toISOString(),
  };
  if (c.is_final) patch.concluida_em = new Date().toISOString();
  else patch.concluida_em = null;

  const { error } = await sb.from("tarefas").update(patch).eq("id", tarefaId);
  if (error) throw error;
  revalidatePath("/tarefas");
}

export type ColunaInput = {
  codigo: string;
  label: string;
  color: string;
  ordem: number;
  status_alvo: "pendente" | "em_andamento" | "concluida" | "cancelada" | "bloqueada";
  is_final?: boolean;
  is_inicial?: boolean;
};

export async function salvarColuna(id: string | null, input: ColunaInput) {
  const sb = await createClient();
  if (id) {
    const { error } = await sb.from("tarefas_kanban_colunas").update(input).eq("id", id);
    if (error) throw error;
  } else {
    const { data: tenant } = await sb.from("tenants").select("id").limit(1).maybeSingle();
    if (!tenant) throw new Error("tenant não encontrado");
    const { error } = await sb.from("tarefas_kanban_colunas").insert({
      ...input,
      tenant_id: (tenant as { id: string }).id,
    });
    if (error) throw error;
  }
  revalidatePath("/tarefas");
}

export async function excluirColuna(id: string) {
  const sb = await createClient();
  const { error } = await sb.from("tarefas_kanban_colunas").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/tarefas");
}

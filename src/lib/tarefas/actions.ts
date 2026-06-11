"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type TarefaInput = {
  titulo: string;
  descricao?: string | null;
  unidade_id?: string | null;
  atribuida_para?: string | null;
  routine_id?: string | null;
  prioridade: "baixa" | "media" | "alta" | "critica";
  status?: "pendente" | "em_andamento" | "concluida" | "cancelada" | "bloqueada";
  prazo?: string | null;
  tempo_estimado_minutes?: number | null;
  tags?: string[];
};

export async function criarTarefa(input: TarefaInput): Promise<{ id: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: tenant } = await sb.from("tenants").select("id").limit(1).maybeSingle();
  if (!tenant) throw new Error("Tenant não encontrado");
  const { data, error } = await sb.from("tarefas").insert({
    ...input,
    tenant_id: (tenant as { id: string }).id,
    criada_por: user.id,
    tags: input.tags ?? [],
  }).select("id").single();
  if (error) throw error;
  revalidatePath("/tarefas");
  return { id: (data as { id: string }).id };
}

export async function atualizarTarefa(id: string, patch: Partial<TarefaInput>): Promise<void> {
  const sb = await createClient();
  const updates: Record<string, unknown> = { ...patch, atualizado_em: new Date().toISOString() };
  if (patch.status === "em_andamento") {
    const { data: t } = await sb.from("tarefas").select("iniciada_em").eq("id", id).maybeSingle();
    if (!(t as { iniciada_em: string | null } | null)?.iniciada_em) {
      updates.iniciada_em = new Date().toISOString();
    }
  }
  if (patch.status === "concluida") {
    updates.concluida_em = new Date().toISOString();
  }
  const { error } = await sb.from("tarefas").update(updates).eq("id", id);
  if (error) throw error;
  revalidatePath("/tarefas");
}

export async function excluirTarefa(id: string): Promise<void> {
  const sb = await createClient();
  const { error } = await sb.from("tarefas").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/tarefas");
}

export async function adicionarComentario(tarefaId: string, comentario: string): Promise<void> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { error } = await sb.from("tarefas_comentarios").insert({
    tarefa_id: tarefaId,
    autor_id: user.id,
    comentario,
  });
  if (error) throw error;
  revalidatePath("/tarefas");
}

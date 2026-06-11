import "server-only";
import { createClient } from "@/lib/supabase/server";

export type KanbanColuna = {
  id: string;
  codigo: string;
  label: string;
  color: string;
  ordem: number;
  status_alvo: "pendente" | "em_andamento" | "concluida" | "cancelada" | "bloqueada";
  is_final: boolean;
  is_inicial: boolean;
  ativo: boolean;
};

export async function listarColunasKanban(): Promise<KanbanColuna[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("tarefas_kanban_colunas")
    .select("*")
    .eq("ativo", true)
    .order("ordem");
  return (data ?? []) as KanbanColuna[];
}

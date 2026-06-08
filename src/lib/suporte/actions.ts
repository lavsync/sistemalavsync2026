"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function pegarTenant() {
  const sb = await createClient();
  const { data } = await sb.from("tenants").select("id").limit(1).maybeSingle();
  return (data as { id: string } | null)?.id;
}

export type TicketInput = {
  id?: string;
  unidade_id: string | null;
  titulo: string;
  descricao: string;
  categoria: "bug" | "sugestao" | "maquina" | "atendimento" | "duvida" | "outro";
  prioridade: "baixa" | "media" | "alta" | "critica";
  status?: "aberto" | "em_andamento" | "resolvido" | "fechado";
  resposta?: string | null;
};

export async function salvarTicket(input: TicketInput) {
  const sb = await createClient();
  const tenant_id = await pegarTenant();
  const payload: Record<string, unknown> = { ...input };
  if (input.status === "resolvido" || input.status === "fechado") {
    payload.resolvido_em = new Date().toISOString();
  }
  if (input.id) {
    const { error } = await sb.from("tickets_suporte").update(payload).eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await sb.from("tickets_suporte").insert({ ...payload, tenant_id });
    if (error) throw error;
  }
  revalidatePath("/suporte");
}

export async function deletarTicket(id: string) {
  const sb = await createClient();
  const { error } = await sb.from("tickets_suporte").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/suporte");
}

// LavSync · Suporte / Chamados
import "server-only";
import { createClient } from "@/lib/supabase/server";

export type TicketCategoria = "bug" | "sugestao" | "maquina" | "atendimento" | "duvida" | "outro";
export type TicketPrioridade = "baixa" | "media" | "alta" | "critica";
export type TicketStatus = "aberto" | "em_andamento" | "resolvido" | "fechado";

export type Ticket = {
  id: string;
  numero: number;
  unidade_id: string | null;
  unidade_nome: string | null;
  titulo: string;
  descricao: string;
  categoria: TicketCategoria;
  prioridade: TicketPrioridade;
  status: TicketStatus;
  resposta: string | null;
  resolvido_em: string | null;
  criado_em: string;
};

export async function listarTickets(): Promise<Ticket[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("tickets_suporte")
    .select("*, unidade:unidades(nome)")
    .order("criado_em", { ascending: false });
  if (error) throw error;
  type Raw = Omit<Ticket, "unidade_nome"> & { unidade: { nome: string } | Array<{ nome: string }> | null };
  return ((data ?? []) as Raw[]).map((r) => {
    const un = Array.isArray(r.unidade) ? r.unidade[0]?.nome : r.unidade?.nome;
    return { ...r, unidade_nome: un ?? null };
  });
}

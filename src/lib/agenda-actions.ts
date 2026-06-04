"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  EventoTipo,
  EventoStatus,
  EventoPrioridade,
  TarefaStatus,
} from "@/lib/agenda-queries";

// ─── Tipos de input ─────────────────────────────────────────────────────────
export type CriarEventoInput = {
  titulo: string;
  descricao?: string | null;
  local?: string | null;
  tipo: EventoTipo;
  prioridade?: EventoPrioridade;
  cor?: string | null;
  inicio_em: string;        // ISO
  fim_em: string;           // ISO
  dia_inteiro?: boolean;
  unidade_id?: string | null;
  responsavel_id?: string | null;
  tags?: string[];
  // alertas iniciais (opcional)
  alertas?: { canal: "whatsapp" | "email" | "push"; destino: string; minutos_antes: number }[];
  // tarefas iniciais (opcional)
  tarefas?: { titulo: string; descricao?: string | null; prazo_em?: string | null }[];
};

export type AtualizarEventoInput = Partial<CriarEventoInput> & {
  id: string;
  status?: EventoStatus;
};

// Helper: pega tenant_id do usuário logado (RLS depende disso, mas insert
// precisa do valor explícito porque não temos default).
async function getCurrentTenantId(): Promise<string> {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Não autenticado");
  const { data, error } = await supabase
    .from("usuarios")
    .select("tenant_id")
    .eq("id", u.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data?.tenant_id) throw new Error("Usuário sem tenant");
  return data.tenant_id as string;
}

// ─── CREATE ─────────────────────────────────────────────────────────────────
export async function criarEvento(input: CriarEventoInput): Promise<{ id: string }> {
  const supabase = await createClient();
  const tenant_id = await getCurrentTenantId();

  const { data: ev, error } = await supabase
    .from("eventos")
    .insert({
      tenant_id,
      titulo: input.titulo,
      descricao: input.descricao ?? null,
      local: input.local ?? null,
      tipo: input.tipo,
      prioridade: input.prioridade ?? "normal",
      cor: input.cor ?? null,
      inicio_em: input.inicio_em,
      fim_em: input.fim_em,
      dia_inteiro: input.dia_inteiro ?? false,
      unidade_id: input.unidade_id ?? null,
      responsavel_id: input.responsavel_id ?? null,
      tags: input.tags ?? [],
    })
    .select("id")
    .single();
  if (error) throw error;
  const eventoId = ev.id as string;

  if (input.tarefas?.length) {
    const tarefasRows = input.tarefas.map((t, i) => ({
      evento_id: eventoId,
      tenant_id,
      titulo: t.titulo,
      descricao: t.descricao ?? null,
      prazo_em: t.prazo_em ?? null,
      ordem: i,
    }));
    const { error: et } = await supabase.from("eventos_tarefas").insert(tarefasRows);
    if (et) throw et;
  }
  if (input.alertas?.length) {
    const alertasRows = input.alertas.map((a) => ({
      evento_id: eventoId,
      tenant_id,
      canal: a.canal,
      destino: a.destino,
      minutos_antes: a.minutos_antes,
      // disparar_em é setado pelo trigger
      disparar_em: input.inicio_em,
    }));
    const { error: ea } = await supabase.from("eventos_alertas").insert(alertasRows);
    if (ea) throw ea;
  }
  revalidatePath("/agenda");
  return { id: eventoId };
}

// ─── UPDATE ─────────────────────────────────────────────────────────────────
export async function atualizarEvento(input: AtualizarEventoInput): Promise<void> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  for (const k of [
    "titulo", "descricao", "local", "tipo", "status", "prioridade", "cor",
    "inicio_em", "fim_em", "dia_inteiro", "unidade_id", "responsavel_id", "tags",
  ] as const) {
    const v = input[k];
    if (v !== undefined) patch[k] = v;
  }
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from("eventos").update(patch).eq("id", input.id);
  if (error) throw error;
  revalidatePath("/agenda");
}

// ─── DELETE ─────────────────────────────────────────────────────────────────
export async function excluirEvento(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("eventos").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/agenda");
}

// ─── TAREFAS ────────────────────────────────────────────────────────────────
export async function criarTarefa(
  evento_id: string,
  titulo: string,
  prazo_em?: string | null,
): Promise<{ id: string }> {
  const supabase = await createClient();
  const tenant_id = await getCurrentTenantId();
  const { data, error } = await supabase
    .from("eventos_tarefas")
    .insert({ evento_id, tenant_id, titulo, prazo_em: prazo_em ?? null, ordem: 9999 })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/agenda");
  return { id: data.id as string };
}

export async function atualizarStatusTarefa(
  id: string,
  status: TarefaStatus,
): Promise<void> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "concluida") patch.concluida_em = new Date().toISOString();
  else patch.concluida_em = null;
  const { error } = await supabase.from("eventos_tarefas").update(patch).eq("id", id);
  if (error) throw error;
  revalidatePath("/agenda");
}

export async function excluirTarefa(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("eventos_tarefas").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/agenda");
}

// ─── ALERTAS ────────────────────────────────────────────────────────────────
export async function adicionarAlerta(
  evento_id: string,
  canal: "whatsapp" | "email" | "push",
  destino: string,
  minutos_antes: number,
): Promise<{ id: string }> {
  const supabase = await createClient();
  const tenant_id = await getCurrentTenantId();
  // pega inicio_em pra calcular disparar_em (trigger também faz, mas precisamos passar algo non-null)
  const { data: ev } = await supabase
    .from("eventos")
    .select("inicio_em")
    .eq("id", evento_id)
    .maybeSingle();
  const baseIso = (ev?.inicio_em as string | undefined) ?? new Date().toISOString();
  const { data, error } = await supabase
    .from("eventos_alertas")
    .insert({
      evento_id,
      tenant_id,
      canal,
      destino,
      minutos_antes,
      disparar_em: baseIso,
    })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/agenda");
  return { id: data.id as string };
}

export async function excluirAlerta(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("eventos_alertas").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/agenda");
}

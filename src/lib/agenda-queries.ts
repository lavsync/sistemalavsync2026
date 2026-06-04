// LavSync · Agenda · Server-side queries (Supabase + RLS por tenant)
import "server-only";
import { createClient } from "@/lib/supabase/server";

export type EventoTipo = "particular" | "negocio";
export type EventoStatus = "agendado" | "em_andamento" | "concluido" | "cancelado";
export type EventoPrioridade = "baixa" | "normal" | "alta" | "critica";
export type TarefaStatus = "pendente" | "em_andamento" | "concluida" | "bloqueada";

export type EventoTarefa = {
  id: string;
  evento_id: string;
  titulo: string;
  descricao: string | null;
  status: TarefaStatus;
  ordem: number;
  prazo_em: string | null;
  concluida_em: string | null;
};

export type EventoAlerta = {
  id: string;
  canal: "whatsapp" | "email" | "push" | "in_app";
  destino: string;
  minutos_antes: number;
  status: "pendente" | "enviado" | "falhou" | "cancelado";
};

export type Evento = {
  id: string;
  titulo: string;
  descricao: string | null;
  local: string | null;
  tipo: EventoTipo;
  status: EventoStatus;
  prioridade: EventoPrioridade;
  cor: string | null;
  tags: string[];
  inicio_em: string;
  fim_em: string;
  dia_inteiro: boolean;
  unidade_id: string | null;
  responsavel_id: string | null;
  google_event_id: string | null;
  origem: "lavsync" | "google";
};

export type EventoComDetalhes = Evento & {
  tarefas: EventoTarefa[];
  alertas: EventoAlerta[];
};

export type Feriado = {
  id: string;
  data: string;       // YYYY-MM-DD
  nome: string;
  tipo: string;
  uf: string | null;
};

// Helper: trata "tabela não encontrada" como vazio (migration ainda não aplicada).
function isMissingTable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return e.code === "PGRST205" || (e.message?.includes("Could not find the table") ?? false);
}

// ─── Listagem por intervalo (mês/semana/dia) ────────────────────────────────
export async function getEventosNoIntervalo(
  inicioIso: string,
  fimIso: string,
): Promise<Evento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("eventos")
    .select(
      "id, titulo, descricao, local, tipo, status, prioridade, cor, tags, inicio_em, fim_em, dia_inteiro, unidade_id, responsavel_id, google_event_id, origem",
    )
    .gte("inicio_em", inicioIso)
    .lt("inicio_em", fimIso)
    .order("inicio_em", { ascending: true });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as Evento[];
}

export async function getEventoComDetalhes(
  id: string,
): Promise<EventoComDetalhes | null> {
  const supabase = await createClient();
  const { data: ev, error: e1 } = await supabase
    .from("eventos")
    .select(
      "id, titulo, descricao, local, tipo, status, prioridade, cor, tags, inicio_em, fim_em, dia_inteiro, unidade_id, responsavel_id, google_event_id, origem",
    )
    .eq("id", id)
    .maybeSingle();
  if (e1) {
    if (isMissingTable(e1)) return null;
    throw e1;
  }
  if (!ev) return null;

  const [tarefas, alertas] = await Promise.all([
    supabase
      .from("eventos_tarefas")
      .select("id, evento_id, titulo, descricao, status, ordem, prazo_em, concluida_em")
      .eq("evento_id", id)
      .order("ordem", { ascending: true }),
    supabase
      .from("eventos_alertas")
      .select("id, canal, destino, minutos_antes, status")
      .eq("evento_id", id)
      .order("minutos_antes", { ascending: false }),
  ]);
  if (tarefas.error) throw tarefas.error;
  if (alertas.error) throw alertas.error;

  return {
    ...(ev as Evento),
    tarefas: (tarefas.data ?? []) as EventoTarefa[],
    alertas: (alertas.data ?? []) as EventoAlerta[],
  };
}

// ─── Feriados no intervalo ──────────────────────────────────────────────────
export async function getFeriadosNoIntervalo(
  inicioYmd: string,
  fimYmd: string,
  uf?: string,
): Promise<Feriado[]> {
  const supabase = await createClient();
  let q = supabase
    .from("feriados_br")
    .select("id, data, nome, tipo, uf")
    .gte("data", inicioYmd)
    .lte("data", fimYmd)
    .order("data", { ascending: true });
  if (uf) q = q.or(`uf.is.null,uf.eq.${uf}`);
  const { data, error } = await q;
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as Feriado[];
}

// ─── Resumo do mês (contagens por status para o header) ─────────────────────
export type AgendaResumo = {
  total: number;
  agendados: number;
  emAndamento: number;
  concluidos: number;
  cancelados: number;
  proximoEvento: { titulo: string; inicio_em: string } | null;
};

export async function getAgendaResumo(
  inicioIso: string,
  fimIso: string,
): Promise<AgendaResumo> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("eventos")
    .select("status, titulo, inicio_em")
    .gte("inicio_em", inicioIso)
    .lt("inicio_em", fimIso)
    .order("inicio_em", { ascending: true });
  if (error) {
    if (isMissingTable(error)) {
      return { total: 0, agendados: 0, emAndamento: 0, concluidos: 0, cancelados: 0, proximoEvento: null };
    }
    throw error;
  }
  const rows = (data ?? []) as { status: EventoStatus; titulo: string; inicio_em: string }[];

  const now = Date.now();
  let agendados = 0, emAndamento = 0, concluidos = 0, cancelados = 0;
  let proximoEvento: AgendaResumo["proximoEvento"] = null;

  for (const r of rows) {
    if (r.status === "agendado") agendados++;
    else if (r.status === "em_andamento") emAndamento++;
    else if (r.status === "concluido") concluidos++;
    else if (r.status === "cancelado") cancelados++;
    if (!proximoEvento && new Date(r.inicio_em).getTime() >= now && r.status !== "cancelado") {
      proximoEvento = { titulo: r.titulo, inicio_em: r.inicio_em };
    }
  }
  return { total: rows.length, agendados, emAndamento, concluidos, cancelados, proximoEvento };
}

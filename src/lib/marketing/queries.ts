// LavSync · Marketing · Queries
import "server-only";
import { createClient } from "@/lib/supabase/server";

export type SegmentoRFM = "campeoes" | "fieis" | "em_risco" | "dormentes" | "novos" | "todos";
export type CanalMarketing = "whatsapp" | "email" | "sms";
export type StatusCampanha = "rascunho" | "agendada" | "enviando" | "concluida" | "cancelada";

export type Campanha = {
  id: string;
  unidade_id: string | null;
  unidade_nome: string | null;
  nome: string;
  descricao: string | null;
  canal: CanalMarketing;
  template_mensagem: string;
  segmento: SegmentoRFM;
  filtro_dias_sem_compra: number | null;
  filtro_ltv_minimo: number | null;
  status: StatusCampanha;
  agendada_para: string | null;
  total_destinatarios: number;
  total_enviados: number;
  total_entregues: number;
  total_erros: number;
  criado_em: string;
  concluida_em: string | null;
};

export type ClienteAlvo = {
  id: string;
  nome: string;
  telefone: string | null;
  cpf: string;
  compras_total_qtd: number;
  compras_total_valor: number;
  ultima_compra_em: string | null;
  dias_sem_compra: number | null;
};

export async function listarCampanhas(unidadeId?: string): Promise<Campanha[]> {
  const sb = await createClient();
  let q = sb.from("marketing_campanhas")
    .select("*, unidade:unidades(nome)")
    .order("criado_em", { ascending: false });
  if (unidadeId) q = q.eq("unidade_id", unidadeId);
  const { data, error } = await q;
  if (error) throw error;
  type Raw = Omit<Campanha, "unidade_nome"> & { unidade: { nome: string } | Array<{ nome: string }> | null };
  return ((data ?? []) as Raw[]).map((r) => {
    const un = Array.isArray(r.unidade) ? r.unidade[0]?.nome : r.unidade?.nome;
    return { ...r, unidade_nome: un ?? null };
  });
}

/** Conta clientes que se encaixam no segmento (preview da campanha) */
export async function contarAlvosSegmento(
  unidadeId: string,
  segmento: SegmentoRFM,
  diasSemCompra?: number | null,
  ltvMinimo?: number | null,
): Promise<number> {
  const sb = await createClient();
  let q = sb.from("clientes")
    .select("id", { count: "exact", head: true })
    .eq("unidade_id", unidadeId)
    .not("telefone", "is", null);

  // Aplicar segmento RFM (heurísticas simples baseadas em compras_total_qtd e ultima_compra_em)
  const hoje = new Date();
  if (segmento === "campeoes") {
    q = q.gte("compras_total_qtd", 5);
  } else if (segmento === "fieis") {
    q = q.gte("compras_total_qtd", 3).lt("compras_total_qtd", 5);
  } else if (segmento === "novos") {
    q = q.eq("compras_total_qtd", 1);
  } else if (segmento === "dormentes") {
    const data60d = new Date(hoje.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
    q = q.lt("ultima_compra_em", data60d);
  } else if (segmento === "em_risco") {
    const data30d = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const data60d = new Date(hoje.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
    q = q.lt("ultima_compra_em", data30d).gte("ultima_compra_em", data60d);
  }

  if (diasSemCompra != null) {
    const dataLim = new Date(hoje.getTime() - diasSemCompra * 24 * 60 * 60 * 1000).toISOString();
    q = q.lt("ultima_compra_em", dataLim);
  }
  if (ltvMinimo != null && ltvMinimo > 0) {
    q = q.gte("compras_total_valor", ltvMinimo);
  }

  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

/** Resolve a lista de destinatários da campanha (executado na hora de disparar) */
export async function resolverAlvosCampanha(c: Campanha): Promise<ClienteAlvo[]> {
  const sb = await createClient();
  if (!c.unidade_id) return [];
  const hoje = new Date();
  let q = sb.from("clientes")
    .select("id, nome, telefone, cpf, compras_total_qtd, compras_total_valor, ultima_compra_em")
    .eq("unidade_id", c.unidade_id)
    .not("telefone", "is", null);

  if (c.segmento === "campeoes") q = q.gte("compras_total_qtd", 5);
  else if (c.segmento === "fieis") q = q.gte("compras_total_qtd", 3).lt("compras_total_qtd", 5);
  else if (c.segmento === "novos") q = q.eq("compras_total_qtd", 1);
  else if (c.segmento === "dormentes") {
    const data60d = new Date(hoje.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
    q = q.lt("ultima_compra_em", data60d);
  } else if (c.segmento === "em_risco") {
    const data30d = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const data60d = new Date(hoje.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
    q = q.lt("ultima_compra_em", data30d).gte("ultima_compra_em", data60d);
  }
  if (c.filtro_dias_sem_compra != null) {
    const lim = new Date(hoje.getTime() - c.filtro_dias_sem_compra * 24 * 60 * 60 * 1000).toISOString();
    q = q.lt("ultima_compra_em", lim);
  }
  if (c.filtro_ltv_minimo != null && c.filtro_ltv_minimo > 0) {
    q = q.gte("compras_total_valor", c.filtro_ltv_minimo);
  }

  const { data } = await q.limit(5000);
  type Raw = {
    id: string; nome: string; telefone: string | null; cpf: string;
    compras_total_qtd: number; compras_total_valor: number | string;
    ultima_compra_em: string | null;
  };
  return ((data ?? []) as Raw[]).map((c) => {
    const dias = c.ultima_compra_em
      ? Math.floor((hoje.getTime() - new Date(c.ultima_compra_em).getTime()) / (24 * 60 * 60 * 1000))
      : null;
    return {
      id: c.id, nome: c.nome, telefone: c.telefone, cpf: c.cpf,
      compras_total_qtd: c.compras_total_qtd,
      compras_total_valor: Number(c.compras_total_valor),
      ultima_compra_em: c.ultima_compra_em,
      dias_sem_compra: dias,
    };
  });
}

export type Envio = {
  id: string;
  campanha_id: string;
  destinatario_nome: string | null;
  destinatario_telefone: string | null;
  mensagem_renderizada: string;
  status: "pendente" | "enviado" | "entregue" | "lido" | "falhou";
  erro: string | null;
  criado_em: string;
  enviado_em: string | null;
};

export async function listarEnvios(campanhaId: string, limite = 200): Promise<Envio[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("marketing_envios")
    .select("id, campanha_id, destinatario_nome, destinatario_telefone, mensagem_renderizada, status, erro, criado_em, enviado_em")
    .eq("campanha_id", campanhaId)
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []) as Envio[];
}

"use server";
// LavSync · Financeiro · Despesas reais do DRE Mensal
// Lançamento em lote (diálogo "Lançar despesas"), edição/exclusão de uma
// despesa já lançada e marcação de pago/aberto. Toda action devolve
// { ok, erro } e nunca lança erro para o cliente.
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { nomeCategoriaFinanceira, normDesc } from "./engine";
import { todayBRiso } from "@/lib/timezone-br";
import { recalibrarCustoVariavelPorDescricao } from "./custo-real-actions";

type SB = Awaited<ReturnType<typeof createClient>>;
type Res<T = object> = ({ ok: true } & T) | { ok: false; erro: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const COMPETENCIA = /^\d{4}-\d{2}$/;

export type LancarDespesaItem = {
  /** Despesa já gravada — atualiza em vez de procurar/inserir. */
  despesa_id?: string | null;
  descricao: string;
  valor: number;
  vencimento: string;          // YYYY-MM-DD
  categoria_nome?: string | null;
  pago: boolean;
  pago_em?: string | null;     // YYYY-MM-DD
};

export type LancarDespesasResultado = Res<{
  inseridas: number;
  atualizadas: number;
  falhas: Array<{ indice: number; erro: string }>;
  /** índice do item → id da despesa gravada (evita duplicar numa nova tentativa) */
  ids: Record<number, string>;
}>;

// TODO(rbac): checar financeiro.despesas.lancar quando houver helper de permissão nas actions.
async function contexto(unidadeId: string): Promise<{ sb: SB; tenant_id: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Sessão expirada. Entre novamente.");
  const { data: unid } = await sb.from("unidades").select("id, tenant_id").eq("id", unidadeId).maybeSingle();
  if (!unid) throw new Error("Unidade não encontrada");
  return { sb, tenant_id: (unid as { tenant_id: string }).tenant_id };
}

/** Resolve categoria por nome (acento/maiúscula-insensível); cria se faltar. */
function resolvedorCategoria(sb: SB, tenant_id: string) {
  let cache: Map<string, string> | null = null;
  async function carregar() {
    if (cache) return cache;
    const { data, error } = await sb.from("categorias_financeiras").select("id, nome")
      .eq("tenant_id", tenant_id).in("tipo", ["despesa", "ambos"]);
    if (error) throw new Error(error.message);
    cache = new Map();
    for (const c of (data ?? []) as Array<{ id: string; nome: string }>) {
      const k = normDesc(c.nome);
      if (!cache.has(k)) cache.set(k, c.id);
    }
    return cache;
  }
  return async (nome: string | null | undefined, descricao: string): Promise<string> => {
    const final = (nome ?? "").trim() || nomeCategoriaFinanceira(descricao);
    const mapa = await carregar();
    const hit = mapa.get(normDesc(final));
    if (hit) return hit;
    const { data, error } = await sb.from("categorias_financeiras")
      .insert({ tenant_id, nome: final, tipo: "despesa", cor: "#19C7CB" })
      .select("id").single();
    if (error || !data) throw new Error(error?.message ?? "Falha ao criar a categoria");
    const id = (data as { id: string }).id;
    mapa.set(normDesc(final), id);
    return id;
  };
}

function competenciaRange(chave: string): [string, string] {
  const [a, m] = chave.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return [`${a}-${mm}-01`, `${a}-${mm}-${String(ultimo).padStart(2, "0")}`];
}

function revalidar() {
  revalidatePath("/financeiro");
  revalidatePath("/cadastros/despesas");
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Lança várias despesas da competência de uma vez (diálogo "Lançar despesas").
 * Sem despesa_id, casa com a existente do mês pela descrição normalizada —
 * inclusive a do dia 01 gravada por "Lançar custo variável pelo valor pago".
 */
export async function lancarDespesasLote(
  unidadeId: string,
  competencia: string,
  itens: LancarDespesaItem[],
): Promise<LancarDespesasResultado> {
  try {
    if (!COMPETENCIA.test(competencia)) return { ok: false, erro: "Competência inválida" };
    const { sb, tenant_id } = await contexto(unidadeId);
    const categoria = resolvedorCategoria(sb, tenant_id);
    const [ini, fim] = competenciaRange(competencia);
    const hoje = todayBRiso();

    // Despesas do mês (competência; sem competência, pelo vencimento)
    type Exist = { id: string; descricao: string; status: string; pago_em: string | null; data_competencia: string | null; vencimento: string };
    const { data: doMes, error: eMes } = await sb.from("despesas")
      .select("id, descricao, status, pago_em, data_competencia, vencimento")
      .eq("unidade_id", unidadeId)
      .neq("status", "cancelada")
      .or(`and(data_competencia.gte.${ini},data_competencia.lte.${fim}),and(data_competencia.is.null,vencimento.gte.${ini},vencimento.lte.${fim})`);
    if (eMes) return { ok: false, erro: eMes.message };
    const existentes = (doMes ?? []) as Exist[];
    const porId = new Map(existentes.map((d) => [d.id, d]));

    let inseridas = 0, atualizadas = 0;
    const falhas: Array<{ indice: number; erro: string }> = [];
    const ids: Record<number, string> = {};

    for (let i = 0; i < itens.length; i++) {
      const it = itens[i];
      try {
        const descricao = (it.descricao ?? "").trim();
        if (!descricao) { falhas.push({ indice: i, erro: "Informe a descrição" }); continue; }
        if (!(it.valor > 0) || !Number.isFinite(it.valor)) { falhas.push({ indice: i, erro: "Valor deve ser maior que zero" }); continue; }
        if (!ISO.test(it.vencimento)) { falhas.push({ indice: i, erro: "Vencimento inválido" }); continue; }

        let alvo: Exist | null = null;
        if (it.despesa_id) {
          alvo = porId.get(it.despesa_id) ?? null;
        } else {
          const n = normDesc(descricao);
          const iguais = existentes.filter((d) => normDesc(d.descricao) === n);
          if (iguais.length > 1) { falhas.push({ indice: i, erro: "Duplicada: ajuste na lista Despesas lançadas" }); continue; }
          alvo = iguais[0] ?? null;
        }

        const pago_em = it.pago
          ? (it.pago_em && ISO.test(it.pago_em) ? it.pago_em : (alvo?.status === "paga" && alvo.pago_em) || hoje)
          : null;
        const payload = {
          tenant_id,
          unidade_id: unidadeId,
          categoria_id: await categoria(it.categoria_nome, descricao),
          descricao,
          valor: Math.round(it.valor * 100) / 100,
          vencimento: it.vencimento,
          data_competencia: ini,
          pago_em,
          periodicidade: "mensal" as const,
          status: it.pago ? ("paga" as const) : ("aberta" as const),
        };

        if (it.despesa_id || alvo) {
          const id = it.despesa_id ?? alvo!.id;
          const { data, error } = await sb.from("despesas").update(payload)
            .eq("id", id).eq("unidade_id", unidadeId).select("id");
          if (error) { falhas.push({ indice: i, erro: error.message }); continue; }
          if (!data || data.length === 0) { falhas.push({ indice: i, erro: "Despesa não encontrada ou sem permissão" }); continue; }
          ids[i] = id;
          atualizadas++;
        } else {
          const { data, error } = await sb.from("despesas").insert(payload).select("id").single();
          if (error || !data) { falhas.push({ indice: i, erro: error?.message ?? "Falha ao inserir" }); continue; }
          const id = (data as { id: string }).id;
          ids[i] = id;
          // Um segundo item com a mesma descrição no lote casa com esta
          existentes.push({ id, descricao, status: payload.status, pago_em, data_competencia: ini, vencimento: it.vencimento });
          porId.set(id, existentes[existentes.length - 1]);
          inseridas++;
        }
      } catch (e) {
        falhas.push({ indice: i, erro: msg(e) });
      }
    }

    revalidar();
    return { ok: true, inseridas, atualizadas, falhas, ids };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

export type AtualizarDespesaPatch = {
  descricao?: string;
  valor?: number;
  categoria_nome?: string | null;
  vencimento?: string;
  pago?: boolean;
  pago_em?: string | null;
};

/** Edita uma despesa lançada (linha da seção "Despesas lançadas no mês"). */
export async function atualizarDespesa(unidadeId: string, id: string, patch: AtualizarDespesaPatch): Promise<Res> {
  try {
    const upd: Record<string, unknown> = {};
    if (patch.descricao !== undefined) {
      const d = patch.descricao.trim();
      if (!d) return { ok: false, erro: "Informe a descrição" };
      upd.descricao = d;
    }
    if (patch.valor !== undefined) {
      if (!(patch.valor > 0) || !Number.isFinite(patch.valor)) return { ok: false, erro: "Valor deve ser maior que zero" };
      upd.valor = Math.round(patch.valor * 100) / 100;
    }
    if (patch.vencimento !== undefined) {
      if (!ISO.test(patch.vencimento)) return { ok: false, erro: "Vencimento inválido" };
      upd.vencimento = patch.vencimento;
    }
    if (patch.pago !== undefined) {
      upd.status = patch.pago ? "paga" : "aberta";
      upd.pago_em = patch.pago ? (patch.pago_em && ISO.test(patch.pago_em) ? patch.pago_em : todayBRiso()) : null;
    }

    const { sb, tenant_id } = await contexto(unidadeId);
    const { data: atual } = await sb.from("despesas").select("descricao").eq("id", id).eq("unidade_id", unidadeId).maybeSingle();
    if (!atual) return { ok: false, erro: "Despesa não encontrada ou sem permissão" };
    const descricaoAntiga = (atual as { descricao: string }).descricao;

    if (patch.categoria_nome !== undefined) {
      upd.categoria_id = await resolvedorCategoria(sb, tenant_id)(patch.categoria_nome, (upd.descricao as string) ?? descricaoAntiga);
    }
    if (Object.keys(upd).length === 0) return { ok: true };
    upd.atualizado_em = new Date().toISOString();

    const { data, error } = await sb.from("despesas").update(upd)
      .eq("id", id).eq("unidade_id", unidadeId).select("id");
    if (error) return { ok: false, erro: error.message };
    if (!data || data.length === 0) return { ok: false, erro: "Despesa não encontrada ou sem permissão" };

    // Valor ou descrição de custo variável mudou → o % de referência se reajusta
    if (upd.valor !== undefined || upd.descricao !== undefined) {
      await recalibrarCustoVariavelPorDescricao(unidadeId, descricaoAntiga);
      if (upd.descricao !== undefined && upd.descricao !== descricaoAntiga) {
        await recalibrarCustoVariavelPorDescricao(unidadeId, upd.descricao as string);
      }
    }
    revalidar();
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

/** Exclui uma despesa lançada. */
export async function excluirDespesa(unidadeId: string, id: string): Promise<Res> {
  try {
    const { sb } = await contexto(unidadeId);
    const { data, error } = await sb.from("despesas").delete()
      .eq("id", id).eq("unidade_id", unidadeId).select("id, descricao");
    if (error) return { ok: false, erro: error.message };
    if (!data || data.length === 0) return { ok: false, erro: "Despesa não encontrada ou sem permissão" };
    await recalibrarCustoVariavelPorDescricao(unidadeId, (data[0] as { descricao: string }).descricao);
    revalidar();
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

/** Marca várias despesas como pagas (hoje, fuso SP) ou em aberto. */
export async function marcarDespesasPagas(unidadeId: string, ids: string[], pago: boolean): Promise<Res<{ atualizadas: number }>> {
  try {
    if (ids.length === 0) return { ok: true, atualizadas: 0 };
    const { sb } = await contexto(unidadeId);
    const { data, error } = await sb.from("despesas")
      .update({ status: pago ? "paga" : "aberta", pago_em: pago ? todayBRiso() : null, atualizado_em: new Date().toISOString() })
      .in("id", ids).eq("unidade_id", unidadeId).select("id");
    if (error) return { ok: false, erro: error.message };
    revalidar();
    return { ok: true, atualizadas: data?.length ?? 0 };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

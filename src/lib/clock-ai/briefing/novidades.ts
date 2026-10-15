// LavSync · CLOCK v2 · Novidades do usuário (briefing + alertas não vistos)
//
// Lê clock_insights com a SESSÃO do usuário (RLS de tenant) e aplica por cima
// as duas travas que a RLS não cobre: permissão do insight e unidade. Insight
// de rede (unidade_id null) só aparece para quem enxerga TODAS as unidades —
// assim o operador do Castelo nunca ouve o faturamento do Buritis.
//
// Usado por GET/POST /api/clock/novidades e pela ferramenta briefing() do chat.
import "server-only";
import type { CtxClock } from "@/lib/clock-ai/registro/tipos";

export type Severidade = "info" | "warn" | "danger";

export type NovidadeBriefing = { id: string; titulo: string; texto_fala: string; criado_em: string };
export type NovidadeAlerta = { id: string; titulo: string; texto_fala: string; severidade: Severidade; href?: string };
export type Novidades = { briefing?: NovidadeBriefing; alertas: NovidadeAlerta[] };

type InsightRow = {
  id: string;
  unidade_id: string | null;
  tipo: "briefing" | "alerta";
  titulo: string;
  texto_fala: string;
  severidade: string | null;
  permissao: string | null;
  href: string | null;
  ref_data: string | null;
  criado_em: string;
};

/** Janela de validade das novidades: briefing de ontem ainda vale hoje cedo. */
const DIAS_VALIDADE = 3;
const MAX_ALERTAS = 10;
const PESO_SEVERIDADE: Record<Severidade, number> = { danger: 3, warn: 2, info: 1 };

export function ehAdmin(ctx: CtxClock): boolean {
  return ctx.papel === "master" || ctx.papel === "admin";
}

export function temPermissao(ctx: CtxClock, permissao: string | null | undefined): boolean {
  if (!permissao) return true;
  return ehAdmin(ctx) || ctx.permissoes.has(permissao);
}

/** true quando ctx.unidades cobre todas as unidades ativas do tenant. */
export async function usuarioVeTodasUnidades(ctx: CtxClock): Promise<boolean> {
  const { data, error } = await ctx.sb.from("unidades").select("id").eq("tenant_id", ctx.tenantId).eq("ativo", true);
  if (error) return ehAdmin(ctx);
  const todas = ((data ?? []) as Array<{ id: string }>).map((u) => u.id);
  const minhas = new Set(ctx.unidades.map((u) => u.id));
  return todas.length > 0 && todas.every((id) => minhas.has(id));
}

function normalizarSeveridade(s: string | null): Severidade {
  return s === "danger" || s === "warn" ? s : "info";
}

export async function lerNovidades(ctx: CtxClock): Promise<Novidades> {
  const desde = new Date(Date.now() - DIAS_VALIDADE * 86_400_000).toISOString();
  const [{ data: rows, error }, { data: vistos }, veTodas] = await Promise.all([
    ctx.sb
      .from("clock_insights")
      .select("id, unidade_id, tipo, titulo, texto_fala, severidade, permissao, href, ref_data, criado_em")
      .eq("tenant_id", ctx.tenantId) // master enxerga todos os tenants pela RLS
      .gte("criado_em", desde)
      .order("criado_em", { ascending: false })
      .limit(200),
    ctx.sb
      .from("clock_insights_vistos")
      .select("insight_id")
      .eq("usuario_id", ctx.userId)
      .gte("visto_em", desde),
    usuarioVeTodasUnidades(ctx),
  ]);
  if (error) throw new Error(error.message);

  const jaVistos = new Set(((vistos ?? []) as Array<{ insight_id: string }>).map((v) => v.insight_id));
  const minhasUnidades = new Map(ctx.unidades.map((u, i) => [u.id, i]));

  const visiveis = ((rows ?? []) as InsightRow[]).filter((r) => {
    if (jaVistos.has(r.id)) return false;
    if (!temPermissao(ctx, r.permissao)) return false;
    if (r.unidade_id === null) return veTodas;
    return minhasUnidades.has(r.unidade_id);
  });

  // Briefing: o mais recente do escopo do usuário. Quem vê tudo ouve o da rede;
  // quem vê parte ouve o da sua primeira unidade com briefing.
  const briefings = visiveis.filter((r) => r.tipo === "briefing");
  const escolhido = veTodas
    ? briefings.find((r) => r.unidade_id === null) ?? briefings[0]
    : [...briefings].sort((a, b) => {
        const porData = (b.ref_data ?? "").localeCompare(a.ref_data ?? "");
        if (porData !== 0) return porData;
        return (minhasUnidades.get(a.unidade_id ?? "") ?? 99) - (minhasUnidades.get(b.unidade_id ?? "") ?? 99);
      })[0];

  const alertas = visiveis
    .filter((r) => r.tipo === "alerta")
    .map((r) => ({ r, sev: normalizarSeveridade(r.severidade) }))
    .sort((a, b) => PESO_SEVERIDADE[b.sev] - PESO_SEVERIDADE[a.sev] || b.r.criado_em.localeCompare(a.r.criado_em))
    .slice(0, MAX_ALERTAS)
    .map(({ r, sev }) => {
      const a: NovidadeAlerta = { id: r.id, titulo: r.titulo, texto_fala: r.texto_fala, severidade: sev };
      if (r.href) a.href = r.href;
      return a;
    });

  return {
    ...(escolhido
      ? { briefing: { id: escolhido.id, titulo: escolhido.titulo, texto_fala: escolhido.texto_fala, criado_em: escolhido.criado_em } }
      : {}),
    alertas,
  };
}

/**
 * Marca insights como vistos pelo usuário. Só grava ids que existem para o
 * tenant dele (o select passa pela RLS antes do upsert).
 */
export async function marcarVistos(ctx: CtxClock, ids: string[]): Promise<number> {
  const unicos = [...new Set(ids.filter((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)))].slice(0, 100);
  if (unicos.length === 0) return 0;
  const { data: existentes, error } = await ctx.sb.from("clock_insights").select("id").eq("tenant_id", ctx.tenantId).in("id", unicos);
  if (error) throw new Error(error.message);
  const validos = ((existentes ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (validos.length === 0) return 0;
  const agora = new Date().toISOString();
  const { error: e2 } = await ctx.sb
    .from("clock_insights_vistos")
    .upsert(
      validos.map((insight_id) => ({ insight_id, usuario_id: ctx.userId, visto_em: agora })),
      { onConflict: "insight_id,usuario_id", ignoreDuplicates: true },
    );
  if (e2) throw new Error(e2.message);
  return validos.length;
}

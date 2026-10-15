// LavSync · CLOCK v2 · Gateway de dados e ações
//
// Única porta entre o modelo e o LavSync:
//   · criarCtx: sessão do usuário (RLS), papel, permissões efetivas (RBAC
//     0017 + overrides; master/admin passam em tudo) e SÓ as unidades
//     liberadas a ele (usuarios.unidades_permitidas, mesma regra de
//     unidade-ativa.ts:listarUnidades).
//   · rodarConsulta: checa permissão e params, executa a leitura e devolve
//     JSON compacto para o tool_result. Nunca lança.
//   · proporAcao: o modelo só PROPÕE. Grava em clock_acoes como 'pendente'
//     com a frase de impacto; quem confirma é o humano (cartão ou voz).
//   · executarAcaoPendente: re-checa dono, status, validade (10 min) e
//     permissão; "reivindica" a linha (pendente → executada) antes de
//     executar para nunca rodar duas vezes; grava resultado ou erro.
// Service role só dentro do motor que exige (clube/fila/storage) e na
// gravação de clock_acoes (a trilha de auditoria não aceita escrita do
// usuário pelo PostgREST), sempre depois deste gate e com tenant e dono
// filtrados explicitamente.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listarCatalogoPermissoes, listarPermissoesEfetivas } from "@/lib/permissoes/queries";
import { REGISTRO_CONSULTAS, REGISTRO_ACOES, ROTAS as REGISTRO_ROTAS } from "./registro";
import { ErroClock } from "./registro/comum";
import type { CtxClock, DefConsulta, DefAcao, DefRota, JSONSchema, Params, Risco } from "./registro/tipos";

export type { CtxClock, DefConsulta, DefAcao, DefRota, JSONSchema, Params, Risco } from "./registro/tipos";
export { ErroClock } from "./registro/comum";

export const CONSULTAS: DefConsulta[] = REGISTRO_CONSULTAS;
export const ACOES: DefAcao[] = REGISTRO_ACOES;
export const ROTAS: DefRota[] = REGISTRO_ROTAS;

/** Validade de uma ação pendente (confirmação por cartão ou voz). */
export const VALIDADE_ACAO_MS = 10 * 60_000;
/** Teto do tool_result de uma consulta (caracteres). */
export const LIMITE_RESULTADO = 6_000;

const PAPEIS_TOTAIS = new Set(["master", "admin"]);

// ─── Contexto ───────────────────────────────────────────────────────────────

export async function criarCtx(): Promise<CtxClock | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: row } = await sb
    .from("usuarios")
    .select("nome, papel, tenant_id, ativo, unidades_permitidas")
    .eq("id", user.id)
    .maybeSingle();
  const u = row as { nome: string | null; papel: string | null; tenant_id: string | null; ativo: boolean | null; unidades_permitidas: string[] | null } | null;
  if (!u || !u.tenant_id || !u.papel || u.ativo === false) return null;

  // Unidades: master/admin veem todas; demais respeitam unidades_permitidas
  // (NULL ou vazio = todas), igual a unidade-ativa.ts:listarUnidades.
  const { data: unds } = await sb.from("unidades").select("id, nome").order("nome");
  let unidades = ((unds ?? []) as Array<{ id: string; nome: string }>).map((x) => ({ id: x.id, nome: x.nome }));
  if (!PAPEIS_TOTAIS.has(u.papel) && u.unidades_permitidas && u.unidades_permitidas.length > 0) {
    const permitidas = new Set(u.unidades_permitidas);
    unidades = unidades.filter((x) => permitidas.has(x.id));
  }

  let permissoes: Set<string>;
  if (PAPEIS_TOTAIS.has(u.papel)) {
    // Master/admin passam: catálogo inteiro + qualquer chave usada pelo registro
    let catalogo: string[] = [];
    try {
      catalogo = (await listarCatalogoPermissoes()).map((c) => c.chave);
    } catch {
      catalogo = [];
    }
    permissoes = new Set([...catalogo, ...chavesDoRegistro()]);
  } else {
    permissoes = await listarPermissoesEfetivas(user.id);
  }

  return {
    sb,
    userId: user.id,
    nome: u.nome ?? user.email ?? "usuário",
    papel: u.papel,
    permissoes,
    unidades,
    tenantId: u.tenant_id,
  };
}

function chavesDoRegistro(): string[] {
  const s = new Set<string>();
  for (const c of CONSULTAS) if (c.permissao) s.add(c.permissao);
  for (const a of ACOES) s.add(a.permissao);
  for (const r of ROTAS) if (r.permissao) s.add(r.permissao);
  return [...s];
}

export function temPermissao(ctx: CtxClock, permissao: string | null | undefined): boolean {
  return !permissao || ctx.permissoes.has(permissao);
}

/** Chave que libera o CLOCK (chat, ações, novidades e voz). Master/admin passam. */
export const PERMISSAO_CLOCK = "clock.usar";

export function podeUsarClock(ctx: CtxClock): boolean {
  return PAPEIS_TOTAIS.has(ctx.papel) || ctx.permissoes.has(PERMISSAO_CLOCK);
}

// ─── Serialização compacta ──────────────────────────────────────────────────

function arredondar(_k: string, v: unknown): unknown {
  if (typeof v === "number" && Number.isFinite(v) && !Number.isInteger(v)) return Math.round(v * 100) / 100;
  if (v instanceof Map) return Object.fromEntries(v);
  if (v instanceof Set) return [...v];
  if (v === undefined) return undefined;
  return v;
}

function cortarListas(v: unknown, max: number, cortes: { n: number }): unknown {
  if (Array.isArray(v)) {
    const base = v.slice(0, max).map((x) => cortarListas(x, max, cortes));
    if (v.length > max) {
      cortes.n++;
      base.push(`… mais ${v.length - max} itens`);
    }
    return base;
  }
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = cortarListas(x, max, cortes);
    return out;
  }
  return v;
}

/** JSON compacto dentro do limite. Listas longas são cortadas com aviso; em último caso, texto truncado. */
export function compactar(valor: unknown, limite = LIMITE_RESULTADO): string {
  const base = JSON.parse(JSON.stringify(valor ?? null, arredondar) ?? "null") as unknown;
  let s = JSON.stringify(base);
  if (s.length <= limite) return s;
  for (const max of [40, 20, 10, 5, 3]) {
    const cortes = { n: 0 };
    const c = cortarListas(base, max, cortes);
    const envelope = c && typeof c === "object" && !Array.isArray(c)
      ? { ...(c as Record<string, unknown>), aviso_truncado: `Listas cortadas em ${max} itens para caber. Peça um filtro mais específico se precisar do resto.` }
      : { dados: c, aviso_truncado: `Listas cortadas em ${max} itens para caber.` };
    s = JSON.stringify(envelope);
    if (s.length <= limite) return s;
  }
  return JSON.stringify({
    aviso_truncado: "Resultado grande demais; mostrando só o começo. Refine a consulta (unidade, período).",
    parcial: s.slice(0, Math.max(0, limite - 200)),
  });
}

function faltando(schema: JSONSchema, params: Params): string[] {
  return (schema.required ?? []).filter((k) => params[k] == null || params[k] === "");
}

function mensagemDe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// ─── Consultas ──────────────────────────────────────────────────────────────

export async function rodarConsulta(ctx: CtxClock, id: string, params: unknown): Promise<string> {
  try {
    const def = CONSULTAS.find((c) => c.id === id);
    if (!def) return JSON.stringify({ erro: "consulta_desconhecida", disponiveis: CONSULTAS.map((c) => c.id) });
    if (!temPermissao(ctx, def.permissao)) {
      return JSON.stringify({ erro: "sem_permissao", permissao: def.permissao, mensagem: `Seu perfil não tem acesso a ${def.modulo}.` });
    }
    const p = (params && typeof params === "object" && !Array.isArray(params) ? params : {}) as Params;
    const falta = faltando(def.params, p);
    if (falta.length) return JSON.stringify({ erro: "params_invalidos", faltando: falta, esperado: def.params.properties });
    const r = await def.executar(ctx, p);
    return compactar(r);
  } catch (e) {
    if (e instanceof ErroClock) return JSON.stringify({ erro: e.message });
    console.error(`[clock/gateway] consulta ${id}`, e);
    return JSON.stringify({ erro: "falha_na_consulta", detalhe: mensagemDe(e).slice(0, 300) });
  }
}

// ─── Ações ──────────────────────────────────────────────────────────────────
//
// clock_acoes só é LIDA com a sessão do usuário. Toda escrita usa service
// role (a RLS não deixa o usuário inserir nem alterar a auditoria) e filtra
// sempre por tenant_id + usuario_id do ctx.

function auditoria() {
  return createAdminClient().from("clock_acoes");
}

export function defAcao(id: string): DefAcao | undefined {
  return ACOES.find((a) => a.id === id);
}

export async function proporAcao(
  ctx: CtxClock,
  sessaoId: string | null,
  id: string,
  params: unknown,
): Promise<{ acao_id: string; resumo: string; risco: Risco } | { erro: string }> {
  try {
    const def = defAcao(id);
    if (!def) return { erro: `Ação desconhecida: ${id}.` };
    if (!temPermissao(ctx, def.permissao)) return { erro: `Sem permissão (${def.permissao}) para essa ação.` };
    const p = (params && typeof params === "object" && !Array.isArray(params) ? params : {}) as Params;
    const falta = faltando(def.params, p);
    if (falta.length) return { erro: `Faltam parâmetros: ${falta.join(", ")}.` };

    const resumo = (await def.resumir(ctx, p)).trim();
    const { data, error } = await auditoria()
      .insert({
        tenant_id: ctx.tenantId,
        sessao_id: sessaoId,
        usuario_id: ctx.userId,
        acao: def.id,
        params: JSON.parse(JSON.stringify(p)),
        resumo,
        risco: def.risco,
        permissao: def.permissao,
        status: "pendente",
      })
      .select("id")
      .single();
    if (error || !data) return { erro: `Não consegui registrar a ação: ${error?.message ?? "sem retorno"}.` };
    return { acao_id: (data as { id: string }).id, resumo, risco: def.risco };
  } catch (e) {
    if (!(e instanceof ErroClock)) console.error(`[clock/gateway] propor ${id}`, e);
    return { erro: mensagemDe(e) };
  }
}

type AcaoRow = { id: string; acao: string; params: Params | null; status: string; criado_em: string; permissao: string };

async function encerrar(ctx: CtxClock, acaoId: string, de: "pendente" | "executada", status: "expirada" | "erro" | "cancelada", resultado: unknown) {
  // decidido_em só nasce na primeira decisão (a guarda da 0051 trava depois)
  await auditoria()
    .update({
      status,
      resultado: resultado == null ? null : JSON.parse(compactar(resultado, 4_000)),
      ...(de === "pendente" ? { decidido_em: new Date().toISOString() } : {}),
    })
    .eq("id", acaoId).eq("tenant_id", ctx.tenantId).eq("usuario_id", ctx.userId).eq("status", de);
}

/**
 * Executa uma ação pendente do próprio usuário. `viaVoz` vem da confirmação
 * falada: o risco decisivo é o do REGISTRO (nunca a coluna gravada), e risco
 * alto só se confirma no cartão.
 */
export async function executarAcaoPendente(
  ctx: CtxClock,
  acaoId: string,
  opts?: { viaVoz?: boolean },
): Promise<{ ok: boolean; resultado?: unknown; erro?: string }> {
  const { data, error } = await ctx.sb
    .from("clock_acoes")
    .select("id, acao, params, status, criado_em, permissao")
    .eq("id", acaoId)
    .eq("tenant_id", ctx.tenantId)
    .eq("usuario_id", ctx.userId)
    .maybeSingle();
  if (error) return { ok: false, erro: "Não consegui ler a ação." };
  const row = data as AcaoRow | null;
  if (!row) return { ok: false, erro: "Ação não encontrada." };
  if (row.status !== "pendente") return { ok: false, erro: `Essa ação já está ${row.status}.` };

  if (Date.now() - new Date(row.criado_em).getTime() > VALIDADE_ACAO_MS) {
    await encerrar(ctx, row.id, "pendente", "expirada", { motivo: "passou de 10 minutos sem confirmação" });
    return { ok: false, erro: "A ação expirou (mais de 10 minutos). Peça de novo." };
  }

  const def = defAcao(row.acao);
  if (!def) {
    await encerrar(ctx, row.id, "pendente", "erro", { erro: "ação não existe mais no registro" });
    return { ok: false, erro: "Essa ação não está mais disponível." };
  }
  if (opts?.viaVoz && def.risco === "alto") {
    return { ok: false, erro: "Ação de risco alto só pode ser confirmada no cartão." };
  }
  // Re-checa a permissão gravada E a atual do registro (podem ter mudado)
  if (!temPermissao(ctx, row.permissao) || !temPermissao(ctx, def.permissao)) {
    await encerrar(ctx, row.id, "pendente", "erro", { erro: "sem_permissao", permissao: def.permissao });
    return { ok: false, erro: `Seu perfil não tem mais a permissão ${def.permissao}.` };
  }

  // Reivindica: só um request passa daqui (UPDATE ... WHERE status='pendente')
  const { data: claim, error: eClaim } = await auditoria()
    .update({ status: "executada", decidido_em: new Date().toISOString() })
    .eq("id", row.id).eq("tenant_id", ctx.tenantId).eq("usuario_id", ctx.userId).eq("status", "pendente")
    .select("id");
  if (eClaim) return { ok: false, erro: "Não consegui registrar a decisão." };
  if (!claim || claim.length === 0) return { ok: false, erro: "Essa ação já foi decidida." };

  try {
    const resultado = await def.executar(ctx, row.params ?? {});
    const gravado = JSON.parse(compactar(resultado ?? { ok: true }, 4_000)) as unknown;
    await auditoria().update({ resultado: gravado })
      .eq("id", row.id).eq("tenant_id", ctx.tenantId).eq("usuario_id", ctx.userId).eq("status", "executada").is("resultado", null);
    return { ok: true, resultado: gravado };
  } catch (e) {
    const msg = mensagemDe(e);
    if (!(e instanceof ErroClock)) console.error(`[clock/gateway] executar ${row.acao}`, e);
    await encerrar(ctx, row.id, "executada", "erro", { erro: msg.slice(0, 500) });
    return { ok: false, erro: msg };
  }
}

/** Cancela uma ação pendente do próprio usuário. */
export async function cancelarAcaoPendente(ctx: CtxClock, acaoId: string): Promise<{ ok: boolean; erro?: string }> {
  const { data, error } = await auditoria()
    .update({ status: "cancelada", decidido_em: new Date().toISOString() })
    .eq("id", acaoId).eq("tenant_id", ctx.tenantId).eq("usuario_id", ctx.userId).eq("status", "pendente")
    .select("id");
  if (error) return { ok: false, erro: "Não consegui cancelar a ação." };
  if (!data || data.length === 0) return { ok: false, erro: "Essa ação não está mais pendente." };
  return { ok: true };
}

/**
 * Expira as pendentes da sessão (o usuário seguiu a conversa sem decidir).
 * Uma pendente viva por vários turnos deixaria um "sim" dito a OUTRA pergunta
 * executar a ação antiga. `manter` preserva ids que ainda valem (ex.: risco
 * alto, que só o cartão confirma). Devolve os ids expirados.
 */
export async function expirarPendentes(
  ctx: CtxClock,
  sessaoId: string,
  motivo: string,
  manter: string[] = [],
): Promise<string[]> {
  let q = auditoria()
    .update({ status: "expirada", resultado: { motivo }, decidido_em: new Date().toISOString() })
    .eq("sessao_id", sessaoId).eq("tenant_id", ctx.tenantId).eq("usuario_id", ctx.userId).eq("status", "pendente");
  if (manter.length > 0) q = q.not("id", "in", `(${manter.join(",")})`);
  const { data, error } = await q.select("id");
  if (error) {
    console.error("[clock/gateway] expirar pendentes", error.message);
    return [];
  }
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}

// LavSync · CLOCK v2 · Sessão de conversa no servidor (append-only)
//
// O front manda só { sessao_id, texto }; o histórico mora em
// clock_sessoes/clock_mensagens. Regra do modelo (thinking preservado):
// o histórico NUNCA é editado nem fatiado — só se ANEXA, com seq crescente.
// Sessão longa demais vira sessão nova (decisão de quem chama).
// O content é gravado como TEXTO com o JSON serializado (coluna text na
// 0051): jsonb reordenaria as chaves e o replay deixaria de ser byte-idêntico
// ao que o modelo produziu (quebra o cache e o thinking preservado).
import "server-only";
import type { CtxClock } from "./registro/tipos";

export type PapelMensagem = "user" | "assistant";
export type MensagemClock = { role: PapelMensagem; content: unknown };
export type SessaoClock = { id: string; titulo: string | null; criada_em: string; atualizada_em: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sessão existente do próprio usuário, ou null. */
export async function carregarSessao(ctx: CtxClock, sessaoId: string): Promise<SessaoClock | null> {
  if (!UUID.test(sessaoId)) return null;
  const { data } = await ctx.sb
    .from("clock_sessoes")
    .select("id, titulo, criada_em, atualizada_em")
    .eq("id", sessaoId)
    .eq("usuario_id", ctx.userId)
    .maybeSingle();
  return (data as SessaoClock | null) ?? null;
}

/** Cria uma sessão nova para o usuário. */
export async function criarSessao(ctx: CtxClock, titulo?: string | null): Promise<SessaoClock | null> {
  const { data, error } = await ctx.sb
    .from("clock_sessoes")
    .insert({ tenant_id: ctx.tenantId, usuario_id: ctx.userId, titulo: titulo?.slice(0, 120) ?? null })
    .select("id, titulo, criada_em, atualizada_em")
    .single();
  if (error) {
    console.error("[clock/sessao] criar", error.message);
    return null;
  }
  return data as SessaoClock;
}

/** Retoma a sessão pedida (se for do usuário) ou abre uma nova. */
export async function abrirSessao(ctx: CtxClock, sessaoId?: string | null): Promise<SessaoClock | null> {
  if (sessaoId) {
    const s = await carregarSessao(ctx, sessaoId);
    if (s) return s;
  }
  return criarSessao(ctx);
}

/** Histórico completo da sessão, na ordem, pronto para `messages` (blocos Anthropic). */
export async function carregarMensagens(ctx: CtxClock, sessaoId: string): Promise<MensagemClock[]> {
  const s = await carregarSessao(ctx, sessaoId);
  if (!s) return [];
  const out: MensagemClock[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await ctx.sb
      .from("clock_mensagens")
      .select("seq, role, content")
      .eq("sessao_id", sessaoId)
      .order("seq", { ascending: true })
      .range(de, de + 999);
    if (error) throw new Error(`clock_mensagens: ${error.message}`);
    const rows = (data ?? []) as Array<{ seq: number; role: PapelMensagem; content: string }>;
    out.push(...rows.map((r) => ({ role: r.role, content: JSON.parse(r.content) as unknown })));
    if (rows.length < 1000) break;
  }
  return out;
}

async function ultimoSeq(ctx: CtxClock, sessaoId: string): Promise<number> {
  const { data } = await ctx.sb
    .from("clock_mensagens")
    .select("seq")
    .eq("sessao_id", sessaoId)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { seq: number } | null)?.seq ?? 0;
}

/** Serializa o content: string vira [{type:'text'}]; blocos passam como estão, na ordem de chaves original. */
function serializarContent(c: unknown): string {
  if (typeof c === "string") return JSON.stringify([{ type: "text", text: c }]);
  return JSON.stringify(c ?? []);
}

/** Título curto a partir da primeira fala do usuário. */
function tituloDe(msgs: MensagemClock[]): string | null {
  const m = msgs.find((x) => x.role === "user");
  if (!m) return null;
  const blocos = Array.isArray(m.content) ? (m.content as Array<{ type?: string; text?: string }>) : [{ type: "text", text: String(m.content) }];
  const t = blocos.find((b) => b.type === "text" && b.text && !b.text.trimStart().startsWith("<"))?.text?.trim();
  if (!t) return null;
  return t.length > 80 ? `${t.slice(0, 77)}...` : t;
}

/**
 * Anexa mensagens no fim da sessão (seq = último + 1, + 2, ...). Append-only:
 * nunca altera o que já existe. Em corrida de seq (dois turnos ao mesmo
 * tempo), relê o último seq e tenta de novo.
 */
export async function anexarMensagens(ctx: CtxClock, sessaoId: string, msgs: MensagemClock[]): Promise<void> {
  if (msgs.length === 0) return;
  const sessao = await carregarSessao(ctx, sessaoId);
  if (!sessao) throw new Error("Sessão não encontrada para este usuário.");

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const base = await ultimoSeq(ctx, sessaoId);
    const linhas = msgs.map((m, i) => ({
      sessao_id: sessaoId,
      seq: base + i + 1,
      role: m.role,
      content: serializarContent(m.content),
    }));
    const { error } = await ctx.sb.from("clock_mensagens").insert(linhas);
    if (!error) {
      if (!sessao.titulo && base === 0) {
        const titulo = tituloDe(msgs);
        if (titulo) await ctx.sb.from("clock_sessoes").update({ titulo }).eq("id", sessaoId);
      }
      return;
    }
    // 23505 = unique(sessao_id, seq): outro turno anexou antes — tenta de novo
    if ((error as { code?: string }).code !== "23505") throw new Error(`clock_mensagens: ${error.message}`);
  }
  throw new Error("clock_mensagens: conflito de sequência persistente.");
}

/** Sessões recentes do usuário (lista lateral). */
export async function listarSessoes(ctx: CtxClock, limite = 20): Promise<SessaoClock[]> {
  const { data } = await ctx.sb
    .from("clock_sessoes")
    .select("id, titulo, criada_em, atualizada_em")
    .eq("usuario_id", ctx.userId)
    .order("atualizada_em", { ascending: false })
    .limit(Math.min(100, Math.max(1, limite)));
  return (data ?? []) as SessaoClock[];
}

// LavSync · CLOCK v2 · Utilitários comuns do registro
//
// Leitura de parâmetros vindos do modelo, escopo de unidade (só as
// permitidas ao usuário), janelas de período no fuso de Brasília com a
// BASE de comparação explícita, e máscaras LGPD (CPF nunca sai; telefone
// sai mascarado).
import "server-only";
import { norm } from "@/lib/utils";
import { startOfDayBR, endOfDayBR, addDaysBR, startOfMonthBR, startOfYearBR, nowBR, isoDayBR } from "@/lib/timezone-br";
import type { CtxClock, Params } from "./tipos";

/** Erro "de negócio": a mensagem vai para o modelo explicar ao usuário. */
export class ErroClock extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroClock";
  }
}

// ─── Parâmetros ─────────────────────────────────────────────────────────────

export function texto(p: Params, k: string): string | undefined {
  const v = p[k];
  if (v == null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

export function textoObrig(p: Params, k: string): string {
  const s = texto(p, k);
  if (!s) throw new ErroClock(`Parâmetro obrigatório ausente: ${k}.`);
  return s;
}

export function inteiro(p: Params, k: string, padrao: number, min: number, max: number): number {
  const v = p[k];
  const n = typeof v === "number" ? v : v == null || v === "" ? NaN : Number(v);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function booleano(p: Params, k: string, padrao: boolean): boolean {
  const v = p[k];
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return padrao;
}

export function umDe<T extends string>(p: Params, k: string, opcoes: readonly T[], padrao: T): T {
  const v = texto(p, k);
  return v && (opcoes as readonly string[]).includes(v) ? (v as T) : padrao;
}

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
const RE_MES = /^\d{4}-\d{2}$/;

export function dia(p: Params, k: string): string | undefined {
  const v = texto(p, k);
  if (!v) return undefined;
  if (!RE_DIA.test(v)) throw new ErroClock(`${k} deve estar no formato AAAA-MM-DD.`);
  return v;
}

/** Aceita "AAAA-MM" ou "AAAA-MM-DD" e devolve o 1º dia "AAAA-MM-01". */
export function mesRef(p: Params, k: string): string | undefined {
  const v = texto(p, k);
  if (!v) return undefined;
  if (RE_MES.test(v)) return `${v}-01`;
  if (RE_DIA.test(v)) return `${v.slice(0, 7)}-01`;
  throw new ErroClock(`${k} deve estar no formato AAAA-MM.`);
}

// ─── Números e datas ────────────────────────────────────────────────────────

export const r2 = (n: number) => Math.round(n * 100) / 100;

/** Variação % (1 casa) ou null quando a base é zero. */
export function variacaoPct(atual: number, base: number): number | null {
  if (!base) return null;
  return Math.round(((atual - base) / Math.abs(base)) * 1000) / 10;
}

/** "AAAA-MM-01" do mês corrente em Brasília (deslocado em n meses). */
export function mesBR(deslocamento = 0): string {
  const { ano, mes } = nowBR();
  const d = new Date(Date.UTC(ano, mes - 1 + deslocamento, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Soma n meses a um "AAAA-MM-01". */
export function somarMeses(ref: string, n: number): string {
  const [a, m] = ref.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Desloca um instante em n meses mantendo o "relógio" de Brasília (dia limitado ao fim do mês). */
export function deslocarMesesBR(d: Date, n: number): Date {
  const OFF = 3 * 3600_000;
  const br = new Date(d.getTime() - OFF);
  const ano = br.getUTCFullYear(), mes = br.getUTCMonth() + n;
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const diaMes = Math.min(br.getUTCDate(), ultimo);
  const alvo = Date.UTC(ano, mes, diaMes, br.getUTCHours(), br.getUTCMinutes(), br.getUTCSeconds(), br.getUTCMilliseconds());
  return new Date(alvo + OFF);
}

// ─── Períodos com base de comparação ────────────────────────────────────────

export const PERIODOS = ["hoje", "ontem", "7d", "30d", "mes", "mes_anterior", "90d", "ano", "ano_anterior", "custom"] as const;
export type PeriodoClock = (typeof PERIODOS)[number];

export type JanelaClock = { from: Date; to: Date; rotulo: string };
export type JanelaComBase = { atual: JanelaClock; base: JanelaClock | null; base_descricao: string | null };

const fmtDia = (d: Date) => isoDayBR(d).split("-").reverse().join("/");
const rotuloJanela = (from: Date, to: Date) => {
  const a = fmtDia(from), b = fmtDia(to);
  return a === b ? a : `${a} a ${b}`;
};

/**
 * Resolve o período pedido e a BASE de comparação justa:
 *   hoje → mesmo dia da semana passada até o mesmo horário
 *   ontem → mesmo dia da semana anterior
 *   mes (até agora) → mesmo intervalo do mês anterior
 *   ano (até agora) → mesmo intervalo do ano anterior
 *   mes_anterior / ano_anterior → o mês / ano imediatamente antes dele
 *   7d, 30d, 90d, custom → os N dias imediatamente anteriores
 */
export function resolverPeriodo(p: Params, chave = "periodo", chaveDe = "de", chaveAte = "ate"): JanelaComBase {
  const de = dia(p, chaveDe), ate = dia(p, chaveAte);
  const periodo: PeriodoClock = de || ate ? "custom" : umDe(p, chave, PERIODOS, "hoje");
  const agora = new Date();

  const mk = (from: Date, to: Date, rotulo?: string): JanelaClock => ({ from, to, rotulo: rotulo ?? rotuloJanela(from, to) });

  if (periodo === "hoje") {
    const from = startOfDayBR();
    const decorrido = agora.getTime() - from.getTime();
    const bFrom = addDaysBR(from, -7);
    return {
      atual: mk(from, agora, "hoje até agora"),
      base: mk(bFrom, new Date(bFrom.getTime() + decorrido)),
      base_descricao: "mesmo dia da semana passada até o mesmo horário",
    };
  }
  if (periodo === "ontem") {
    const from = addDaysBR(agora, -1);
    const bFrom = addDaysBR(agora, -8);
    return { atual: mk(from, endOfDayBR(from), "ontem"), base: mk(bFrom, endOfDayBR(bFrom)), base_descricao: "mesmo dia da semana anterior" };
  }
  if (periodo === "mes") {
    const from = startOfMonthBR();
    return {
      atual: mk(from, agora, "mês atual até agora"),
      base: mk(deslocarMesesBR(from, -1), deslocarMesesBR(agora, -1)),
      base_descricao: "mesmo intervalo do mês anterior",
    };
  }
  if (periodo === "mes_anterior") {
    const from = deslocarMesesBR(startOfMonthBR(), -1);
    const to = new Date(startOfMonthBR().getTime() - 1);
    const bFrom = deslocarMesesBR(from, -1);
    return { atual: mk(from, to, "mês anterior"), base: mk(bFrom, new Date(from.getTime() - 1)), base_descricao: "o mês imediatamente anterior a ele" };
  }
  if (periodo === "ano") {
    const from = startOfYearBR();
    return {
      atual: mk(from, agora, "ano atual até agora"),
      base: mk(deslocarMesesBR(from, -12), deslocarMesesBR(agora, -12)),
      base_descricao: "mesmo intervalo do ano anterior",
    };
  }
  if (periodo === "ano_anterior") {
    const from = deslocarMesesBR(startOfYearBR(), -12);
    const to = new Date(startOfYearBR().getTime() - 1);
    const bFrom = deslocarMesesBR(from, -12);
    return { atual: mk(from, to, "ano anterior"), base: mk(bFrom, new Date(from.getTime() - 1)), base_descricao: "o ano imediatamente anterior a ele" };
  }

  let from: Date, to: Date;
  if (periodo === "custom") {
    from = de ? startOfDayBR(new Date(`${de}T12:00:00-03:00`)) : addDaysBR(agora, -29);
    to = ate ? endOfDayBR(new Date(`${ate}T12:00:00-03:00`)) : endOfDayBR();
    if (to < from) throw new ErroClock("A data final é anterior à inicial.");
  } else {
    const n = periodo === "7d" ? 7 : periodo === "30d" ? 30 : 90;
    from = addDaysBR(agora, -(n - 1));
    to = agora;
  }
  const dias = Math.max(1, Math.round((startOfDayBR(to).getTime() - from.getTime()) / 86_400_000) + 1);
  if (dias > 400) throw new ErroClock("Período máximo de 400 dias por consulta.");
  const bTo = new Date(from.getTime() - 1);
  const bFrom = addDaysBR(from, -dias);
  return { atual: mk(from, to), base: mk(bFrom, bTo), base_descricao: `os ${dias} dias imediatamente anteriores` };
}

// ─── Unidades (escopo do usuário) ───────────────────────────────────────────

/**
 * Resolve o filtro de unidade vindo do modelo (id, nome parcial sem acento,
 * lista, ou "todas"/vazio) contra as unidades PERMITIDAS ao usuário.
 * Nunca devolve unidade fora do escopo.
 */
export function resolverUnidades(ctx: CtxClock, filtro: unknown): Array<{ id: string; nome: string }> {
  if (ctx.unidades.length === 0) throw new ErroClock("Seu usuário não tem unidades liberadas.");
  const lista = Array.isArray(filtro) ? filtro : filtro == null || filtro === "" ? [] : String(filtro).split(",");
  const termos = lista.map((x) => String(x).trim()).filter(Boolean);
  if (termos.length === 0 || termos.some((t) => ["todas", "todos", "rede", "consolidado"].includes(norm(t)))) {
    return ctx.unidades;
  }
  const out: Array<{ id: string; nome: string }> = [];
  for (const t of termos) {
    const tn = norm(t);
    const u = ctx.unidades.find((x) => x.id === t)
      ?? ctx.unidades.find((x) => norm(x.nome) === tn)
      ?? ctx.unidades.find((x) => norm(x.nome).includes(tn));
    if (!u) {
      const nomes = ctx.unidades.map((x) => x.nome).join(", ");
      throw new ErroClock(`Unidade "${t}" não encontrada entre as liberadas para você (${nomes}).`);
    }
    if (!out.some((x) => x.id === u.id)) out.push(u);
  }
  return out;
}

/** Exatamente uma unidade (ações e leituras por unidade). Sem filtro e com 1 unidade liberada, usa ela. */
export function resolverUnidadeUnica(ctx: CtxClock, filtro: unknown): { id: string; nome: string } {
  const us = resolverUnidades(ctx, filtro);
  if (us.length === 1) return us[0];
  throw new ErroClock(`Informe uma unidade: ${ctx.unidades.map((u) => u.nome).join(", ")}.`);
}

/** O usuário enxerga TODAS as unidades do tenant? (necessário para escopo consolidado/rede). */
export async function temAcessoTotal(ctx: CtxClock): Promise<boolean> {
  if (ctx.papel === "master" || ctx.papel === "admin") return true;
  const { data } = await ctx.sb.from("unidades").select("id");
  const todas = ((data ?? []) as Array<{ id: string }>).map((u) => u.id);
  const minhas = new Set(ctx.unidades.map((u) => u.id));
  return todas.every((id) => minhas.has(id));
}

export function nomeUnidade(ctx: CtxClock, id: string | null | undefined): string {
  if (!id) return "sem unidade";
  return ctx.unidades.find((u) => u.id === id)?.nome ?? "outra unidade";
}

// ─── LGPD ───────────────────────────────────────────────────────────────────

/** "31973603600" → "(31) 9****-3600". CPF nunca é devolvido ao modelo. */
export function mascararTelefone(t: string | null | undefined): string | null {
  if (!t) return null;
  const d = t.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length < 8) return "****";
  const ddd = d.length >= 10 ? `(${d.slice(0, 2)}) ` : "";
  return `${ddd}${d.length >= 10 ? d[2] : d[0]}****-${d.slice(-4)}`;
}

/** Janela do 1º ao último dia (Brasília) de um "AAAA-MM-01", em ISO. */
export function janelaMes(ref: string): { ini: string; fim: string } {
  const [a, m] = ref.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { ini: `${ref.slice(0, 7)}-01T00:00:00-03:00`, fim: `${ref.slice(0, 7)}-${String(ultimo).padStart(2, "0")}T23:59:59.999-03:00` };
}

/** Nome do mês por extenso para a fala ("setembro de 2026"). */
export function nomeMesRef(ref: string): string {
  const NOMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const [a, m] = ref.split("-").map(Number);
  return `${NOMES[m - 1]} de ${a}`;
}

/** Janela de disparo de mensagens a clientes (9h às 21h, Brasília). */
export function dentroDaJanelaDeDisparo(): boolean {
  const { hora } = nowBR();
  return hora >= 9 && hora < 21;
}

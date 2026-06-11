/**
 * Helpers de timezone Brasil (America/Sao_Paulo, -03:00 sem horário de verão desde 2019).
 *
 * Por que existe: Vercel e Supabase rodam em UTC. `new Date()` no servidor é UTC.
 * Se chamarmos `setHours(0,0,0,0)`, obtemos meia-noite UTC — NÃO meia-noite Brasília.
 * Exemplo: às 23h do 10/06 Brasília (02h do 11/06 UTC), `new Date().setHours(0)` retorna
 * "11/06 00:00 UTC" = "10/06 21:00 Brasília" — janela errada.
 *
 * Estes helpers sempre interpretam "hoje" como o dia corrente em Brasília
 * e retornam timestamps UTC corretos pra filtrar no banco.
 */

/** Offset fixo Brasília em horas (sem DST desde 2019). */
const BR_OFFSET_HOURS = -3;
const BR_OFFSET_MS = BR_OFFSET_HOURS * 60 * 60 * 1000;

/** Componentes da data atual no fuso Brasília. */
export function nowBR(): { ano: number; mes: number; dia: number; hora: number; minuto: number; segundo: number } {
  // Date.now() é UTC. Somar offset BR (negativo) e ler getUTC* dá horário Brasília.
  const d = new Date(Date.now() + BR_OFFSET_MS);
  return {
    ano: d.getUTCFullYear(),
    mes: d.getUTCMonth() + 1,
    dia: d.getUTCDate(),
    hora: d.getUTCHours(),
    minuto: d.getUTCMinutes(),
    segundo: d.getUTCSeconds(),
  };
}

/** Retorna a data atual no fuso Brasília como string YYYY-MM-DD. */
export function todayBRiso(): string {
  const { ano, mes, dia } = nowBR();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Início do dia (00:00) Brasília convertido pra Date UTC.
 * Ex: 10/06 00:00 BR = 10/06 03:00 UTC
 *
 * @param baseDate opcional — qual dia tomar como referência (default = hoje BR).
 *                Quando passa um Date, considera o dia BR DAQUELE momento.
 */
export function startOfDayBR(baseDate?: Date): Date {
  const ms = baseDate ? baseDate.getTime() : Date.now();
  const brTime = new Date(ms + BR_OFFSET_MS);
  // Pega ano/mês/dia em Brasília
  const ano = brTime.getUTCFullYear();
  const mes = brTime.getUTCMonth();
  const dia = brTime.getUTCDate();
  // Construir UTC = (00:00 BR) = (00 - (-3)) UTC = 03:00 UTC
  return new Date(Date.UTC(ano, mes, dia, -BR_OFFSET_HOURS, 0, 0, 0));
}

/** Fim do dia (23:59:59.999) Brasília convertido pra Date UTC. */
export function endOfDayBR(baseDate?: Date): Date {
  const start = startOfDayBR(baseDate);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/** Adiciona dias mantendo timezone BR. Retorna início do dia resultante. */
export function addDaysBR(baseDate: Date, days: number): Date {
  const start = startOfDayBR(baseDate);
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Início do mês (dia 1, 00:00) Brasília como UTC. */
export function startOfMonthBR(baseDate?: Date): Date {
  const ms = baseDate ? baseDate.getTime() : Date.now();
  const brTime = new Date(ms + BR_OFFSET_MS);
  const ano = brTime.getUTCFullYear();
  const mes = brTime.getUTCMonth();
  return new Date(Date.UTC(ano, mes, 1, -BR_OFFSET_HOURS, 0, 0, 0));
}

/** Início do ano (1º jan 00:00) Brasília como UTC. */
export function startOfYearBR(baseDate?: Date): Date {
  const ms = baseDate ? baseDate.getTime() : Date.now();
  const brTime = new Date(ms + BR_OFFSET_MS);
  const ano = brTime.getUTCFullYear();
  return new Date(Date.UTC(ano, 0, 1, -BR_OFFSET_HOURS, 0, 0, 0));
}

/** Converte Date UTC em string YYYY-MM-DD do dia BR correspondente. */
export function isoDayBR(date: Date): string {
  const br = new Date(date.getTime() + BR_OFFSET_MS);
  return `${br.getUTCFullYear()}-${String(br.getUTCMonth() + 1).padStart(2, "0")}-${String(br.getUTCDate()).padStart(2, "0")}`;
}

/** Converte string YYYY-MM-DD (interpretada como dia BR) em Date UTC do início do dia. */
export function parseDayBR(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, -BR_OFFSET_HOURS, 0, 0, 0));
}

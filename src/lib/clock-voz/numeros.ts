// LavSync · CLOCK v2 · Voz — números, moeda, porcentagem e datas por extenso
//
// Cinto de segurança antes do TTS: o eleven_flash_v2_5 NÃO normaliza números
// por padrão ("R$ 12.300" pode sair lido errado). A persona já manda o modelo
// falar por extenso; isto garante o resultado mesmo quando ele escapa.
//
// Módulo PURO (sem DOM, sem rede) — roda no servidor (/api/clock/tts) e é
// testável isoladamente. Convenções pt-BR: ponto separa milhar, vírgula separa
// decimal.

export type Genero = "m" | "f";

const UNIDADES_M = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const UNIDADES_F = ["zero", "uma", "duas", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZENOVE = ["dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS_M = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
const CENTENAS_F = ["", "cento", "duzentas", "trezentas", "quatrocentas", "quinhentas", "seiscentas", "setecentas", "oitocentas", "novecentas"];

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const ORDINAIS = ["", "primeiro", "segundo", "terceiro", "quarto", "quinto", "sexto", "sétimo", "oitavo", "nono", "décimo"];
const ORDINAIS_F = ["", "primeira", "segunda", "terceira", "quarta", "quinta", "sexta", "sétima", "oitava", "nona", "décima"];

/** 0..999 por extenso. */
function ate999(n: number, genero: Genero): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c > 0) partes.push((genero === "f" ? CENTENAS_F : CENTENAS_M)[c]);
  if (resto > 0) {
    if (resto < 10) partes.push((genero === "f" ? UNIDADES_F : UNIDADES_M)[resto]);
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u === 0 ? DEZENAS[d] : `${DEZENAS[d]} e ${(genero === "f" ? UNIDADES_F : UNIDADES_M)[u]}`);
    }
  }
  return partes.join(" e ");
}

const ESCALAS: Array<{ sing: string; plur: string }> = [
  { sing: "", plur: "" },
  { sing: "mil", plur: "mil" },
  { sing: "um milhão", plur: "milhões" },
  { sing: "um bilhão", plur: "bilhões" },
  { sing: "um trilhão", plur: "trilhões" },
];

/**
 * Inteiro não negativo por extenso (até trilhões).
 * Ex.: 12300 → "doze mil e trezentos"; 1234 → "mil duzentos e trinta e quatro".
 */
export function inteiroPorExtenso(valor: number, genero: Genero = "m"): string {
  if (!Number.isFinite(valor)) return String(valor);
  const n = Math.floor(Math.abs(valor));
  const sinal = valor < 0 && n > 0 ? "menos " : "";
  if (n === 0) return "zero";
  if (n >= 1e15) return sinal + String(n).split("").map((d) => UNIDADES_M[Number(d)]).join(" ");

  // grupos de 3 dígitos, do menos para o mais significativo
  const grupos: number[] = [];
  let r = n;
  while (r > 0) { grupos.push(r % 1000); r = Math.floor(r / 1000); }

  const pedacos: Array<{ texto: string; valor: number }> = [];
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i];
    if (g === 0) continue;
    // milhar e acima: o gênero do grupo é masculino ("duzentos mil"), exceto
    // quando o próprio número é feminino e o grupo é o de milhar
    // ("duzentas mil pessoas").
    const generoGrupo: Genero = i === 0 || i === 1 ? genero : "m";
    let texto: string;
    if (i === 0) texto = ate999(g, generoGrupo);
    else if (i === 1) texto = g === 1 ? "mil" : `${ate999(g, generoGrupo)} mil`;
    else texto = g === 1 ? ESCALAS[i].sing : `${ate999(g, "m")} ${ESCALAS[i].plur}`;
    pedacos.push({ texto, valor: g });
  }

  // "e" antes do último grupo quando ele é < 100 ou centena redonda
  let saida = "";
  pedacos.forEach((p, idx) => {
    if (idx === 0) { saida = p.texto; return; }
    const ultimo = idx === pedacos.length - 1;
    const usaE = ultimo && (p.valor < 100 || p.valor % 100 === 0);
    saida += (usaE ? " e " : " ") + p.texto;
  });
  return sinal + saida;
}

/** true quando o número termina em milhão/bilhão/trilhão redondo ("um milhão DE reais"). */
function exigeDe(n: number): boolean {
  return n >= 1_000_000 && n % 1_000_000 === 0;
}

/** Parte decimal lida dígito a dígito quando tem zero à esquerda ("0,05" → "zero cinco"). */
function decimalPorExtenso(digitos: string): string {
  const semZerosFinais = digitos.replace(/0+$/, "");
  if (!semZerosFinais) return "";
  const zerosEsq = semZerosFinais.match(/^0+/)?.[0].length ?? 0;
  const resto = semZerosFinais.slice(zerosEsq);
  const zeros = Array(zerosEsq).fill("zero").join(" ");
  if (resto.length > 3) return [zeros, ...resto.split("").map((d) => UNIDADES_M[Number(d)])].filter(Boolean).join(" ");
  return [zeros, inteiroPorExtenso(Number(resto))].filter(Boolean).join(" ");
}

/** "12.300,5" | "12300" | "12,5" → número JS. Retorna null se não for número pt-BR válido. */
export function lerNumeroBr(bruto: string): number | null {
  const s = bruto.trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^\d+(,\d+)?$/.test(s)) {
    return Number(s.replace(/\./g, "").replace(",", "."));
  }
  return null;
}

/** Número pt-BR (com vírgula decimal) por extenso: "12,5" → "doze vírgula cinco". */
export function numeroPorExtenso(bruto: string, genero: Genero = "m"): string {
  const s = bruto.trim();
  const [intParte, decParte] = s.replace(/\./g, "").split(",");
  const inteiro = inteiroPorExtenso(Number(intParte), genero);
  if (!decParte) return inteiro;
  const dec = decimalPorExtenso(decParte);
  return dec ? `${inteiro} vírgula ${dec}` : inteiro;
}

/** "R$ 12.300,50" → "doze mil e trezentos reais e cinquenta centavos". */
export function moedaPorExtenso(bruto: string): string {
  const s = bruto.replace(/\s+/g, "").replace(/^R\$/i, "");
  const negativo = s.startsWith("-") || s.startsWith("−");
  const limpo = s.replace(/^[-−]/, "");
  const [intStr, decStr = ""] = limpo.replace(/\./g, "").split(",");
  const reais = Number(intStr || "0");
  const centavos = decStr ? Math.round(Number(`0.${decStr}`) * 100) : 0;
  const partes: string[] = [];
  if (reais > 0) {
    const extenso = inteiroPorExtenso(reais);
    const unidade = reais === 1 ? "real" : "reais";
    partes.push(`${extenso}${exigeDe(reais) ? " de" : ""} ${unidade}`);
  }
  if (centavos > 0) partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  if (partes.length === 0) partes.push("zero real");
  return (negativo ? "menos " : "") + partes.join(" e ");
}

/** Data por extenso: (14, 10, 2026) → "catorze de outubro de dois mil e vinte e seis". */
export function dataPorExtenso(dia: number, mes: number, ano?: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = dia === 1 ? "primeiro" : inteiroPorExtenso(dia);
  const base = `${d} de ${MESES[mes - 1]}`;
  if (ano === undefined) return base;
  return `${base} de ${inteiroPorExtenso(ano)}`;
}

/** Hora por extenso: (14, 30) → "catorze e trinta"; (1, 0) → "uma hora". */
export function horaPorExtenso(h: number, m: number): string | null {
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  const horas = inteiroPorExtenso(h, "f");
  if (m === 0) return `${horas} ${h === 1 ? "hora" : "horas"}`;
  return `${horas} e ${inteiroPorExtenso(m)}`;
}

function anoCompleto(a: string): number {
  const n = Number(a);
  return a.length === 2 ? 2000 + n : n;
}

// Palavras femininas que costumam vir logo depois de um número nas respostas
// do CLOCK ("duas unidades", "duzentas lavagens").
const FEMININAS = /^(unidades?|lavagens?|secagens?|vendas?|m[áa]quinas?|horas?|semanas?|pessoas?|clientes?\s+novas?|transa[çc][õo]es?|tarefas?|rotinas?|lojas?|ordens?|vezes|lavadoras?|secadoras?|cestas?)\b/i;

/**
 * Normaliza um texto para fala em pt-BR: moeda, porcentagem, pontos
 * percentuais, datas, horas, ordinais, números com milhar/decimal e sequências
 * longas de dígitos (lidas dígito a dígito).
 */
export function normalizarParaFala(texto: string): string {
  let t = texto;

  // Moeda: R$ 12.300,50 | R$12300 | -R$ 50 | R$ -50
  t = t.replace(/([-−]\s?)?R\$\s?([-−]?\s?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|[-−]?\s?\d+(?:,\d{1,2})?)/g, (_m, menos: string | undefined, valor: string) => {
    const v = valor.replace(/\s/g, "");
    return moedaPorExtenso((menos ? "-" : "") + v);
  });

  // Pontos percentuais: 3 p.p. | 3,5 pp
  t = t.replace(/([+\-−]?)(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s?p\.?\s?p\.?(?=\s|$|[,;:!?)])/gi, (_m, s: string, n: string) => {
    const sinal = s === "+" ? "mais " : s ? "menos " : "";
    const extenso = numeroPorExtenso(n);
    const unidade = n === "1" ? "ponto percentual" : "pontos percentuais";
    return `${sinal}${extenso} ${unidade}`;
  });

  // Porcentagem: 12,5% | +8% | -3%
  t = t.replace(/(^|[\s(])([+\-−]?)(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s?%/g, (_m, pre: string, s: string, n: string) => {
    const sinal = s === "+" ? "mais " : s ? "menos " : "";
    return `${pre}${sinal}${numeroPorExtenso(n)} por cento`;
  });

  // Data ISO: 2026-10-14
  t = t.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m, a: string, me: string, d: string) =>
    dataPorExtenso(Number(d), Number(me), Number(a)) ?? m);

  // Data dd/mm/aaaa | dd/mm/aa
  t = t.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})\b/g, (m, d: string, me: string, a: string) =>
    dataPorExtenso(Number(d), Number(me), anoCompleto(a)) ?? m);
  // Data dd/mm (mês com 2 dígitos, para não confundir com fração "1/2")
  t = t.replace(/\b(\d{1,2})\/(\d{2})\b/g, (m, d: string, me: string) =>
    dataPorExtenso(Number(d), Number(me)) ?? m);

  // Hora: 14h30 | 14h | 14:30
  t = t.replace(/\b(\d{1,2})(?:h(\d{2})?|:(\d{2}))(?![\d:])\b/g, (m, h: string, m1?: string, m2?: string) =>
    horaPorExtenso(Number(h), Number(m1 ?? m2 ?? "0")) ?? m);

  // Ordinais 1º..10º / 1ª..10ª
  t = t.replace(/\b(\d{1,2})\s?([ºª°])/g, (m, n: string, sufixo: string) => {
    const i = Number(n);
    if (i < 1 || i > 10) return m;
    return sufixo === "ª" ? ORDINAIS_F[i] : ORDINAIS[i];
  });
  t = t.replace(/\bn[º°]\s?/gi, "número ");

  // Sequências longas de dígitos sem separador (telefone, código): dígito a dígito
  t = t.replace(/\b\d{8,}\b/g, (m) => m.split("").map((d) => UNIDADES_M[Number(d)]).join(" "));

  // Sinal na frente de número solto: "+12" → "mais doze"; " -3" → "menos três"
  t = t.replace(/(^|[\s(])([+\-−])(?=\d)/g, (_m, pre: string, s: string) => `${pre}${s === "+" ? "mais" : "menos"} `);

  // Números restantes: 12.300 | 12,5 | 42 — com gênero pela palavra seguinte
  t = t.replace(/\b(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)\b/g, (m: string, n: string, offset: number, todo: string) => {
    const seguinte = todo.slice(offset + m.length).trimStart();
    const genero: Genero = FEMININAS.test(seguinte) ? "f" : "m";
    return numeroPorExtenso(n, genero);
  });

  // Símbolos que o TTS lê mal
  t = t.replace(/\s&\s/g, " e ").replace(/\s\/\s/g, " ou ").replace(/\s{2,}/g, " ");
  return t.trim();
}

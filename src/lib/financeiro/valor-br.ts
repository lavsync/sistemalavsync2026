// LavSync · Financeiro · Valores em reais digitados pelo operador
// Módulo puro (cliente e servidor). Aceita "1.234,56", "1234,56", "1234.56"
// e "42.000" (ponto seguido de exatamente 3 dígitos, sem vírgula = milhar).

/** Converte o texto digitado em número com 2 casas. Vazio, inválido ou negativo → null. */
export function parseValorBR(s: string): number | null {
  const t = (s ?? "").replace(/\s|R\$/g, "").trim();
  if (!t) return null;
  let norm: string;
  if (t.includes(",")) {
    norm = t.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    norm = t.replace(/\./g, "");
  } else {
    norm = t;
  }
  if (!/^-?\d*(\.\d+)?$/.test(norm) || norm === "" || norm === "-") return null;
  const n = Number(norm);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

/** Formata para preencher input: 1234.56 → "1.234,56" (sem "R$"). */
export function formatValorBR(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

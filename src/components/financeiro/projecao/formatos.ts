// LavSync · Projetado × Real — formatos e rótulos compartilhados da tela
//
// Formatação pt-BR (moeda, percentual, mês), leitura de número digitado no
// padrão brasileiro ("1.234,56", "65%") e rótulos das chaves canônicas das
// linhas da projeção (alinhadas ao nosso DRE). Sem dependência de servidor:
// usado só pelos componentes de src/components/financeiro/projecao.
import { infoChave, type GrupoProjecao, type LinhaProjecao } from "@/lib/financeiro/projecao/tipos";

export const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const MESES_LONGOS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const TOTAL_MESES = 60;

export function fmtBRL(n: number, casas = 0): string {
  return n.toLocaleString("pt-BR", {
    style: "currency", currency: "BRL",
    minimumFractionDigits: casas, maximumFractionDigits: casas,
  });
}

/** R$ compacto para eixos e células estreitas: R$ 42,0 mil · R$ 1,2 mi. */
export function fmtBRLCompacto(n: number): string {
  const a = Math.abs(n);
  const s = n < 0 ? "−" : "";
  if (a >= 1_000_000) return `${s}R$ ${(a / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (a >= 1_000) return `${s}R$ ${(a / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${s}R$ ${a.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

/** Número para célula de grade: inteiro sem casas, fracionado com 2. */
export function fmtNumero(n: number): string {
  const inteiro = Math.abs(n - Math.round(n)) < 0.005;
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: inteiro ? 0 : 2,
    maximumFractionDigits: inteiro ? 0 : 2,
  });
}

/** Fração (0,05) → "5%" · "5,5%". */
export function fmtPct(frac: number, casas = 1): string {
  return `${(frac * 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas })}%`;
}

/** Diferença em pontos percentuais entre duas frações. */
export function fmtPP(fracA: number, fracB: number): string {
  const d = (fracA - fracB) * 100;
  const s = d > 0 ? "+" : d < 0 ? "−" : "";
  return `${s}${Math.abs(d).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`;
}

/**
 * Lê um número digitado no padrão pt-BR. Aceita "1.234,56", "1234,56",
 * "1234.56", "R$ 1.000", "-300", "65%". Devolve null se não houver número.
 */
export function parseNumeroBR(texto: string): number | null {
  let t = texto.trim().replace(/R\$\s?/i, "").replace(/%/g, "").replace(/\s/g, "").replace("−", "-");
  if (!t) return null;
  const temVirgula = t.includes(",");
  const pontos = (t.match(/\./g) ?? []).length;
  if (temVirgula) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (pontos > 1 || /\.\d{3}$/.test(t)) {
    // "1.234" ou "1.234.567" = separador de milhar
    t = t.replace(/\./g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Rótulo "ago/25" do mês i (0-based) contado a partir do mês 1 da projeção. */
export function rotuloMesCalendario(mes1Ano: number, mes1Mes: number, i: number): string {
  const total = (mes1Mes - 1) + i;
  const ano = mes1Ano + Math.floor(total / 12);
  const mes = total % 12;
  return `${MESES_CURTOS[mes]}/${String(ano).slice(-2)}`;
}

/** "2025-08" → "ago/25". */
export function rotuloChaveMes(chave: string): string {
  const [a, m] = chave.split("-").map(Number);
  if (!a || !m) return chave;
  return `${MESES_CURTOS[m - 1]}/${String(a).slice(-2)}`;
}

export const ROTULO_GRUPO: Record<GrupoProjecao, string> = {
  receita: "Receita",
  deducao: "Deduções",
  csp: "Custo do serviço prestado",
  franchising: "Franchising",
  pessoal: "Pessoal",
  terceiros: "Serviços de terceiros",
  marketing: "Marketing",
  gerais: "Despesas gerais",
  resultado: "Resultado",
  indicador: "Indicadores",
};

export const ORDEM_GRUPO: GrupoProjecao[] = [
  "receita", "deducao", "csp", "franchising", "pessoal", "terceiros",
  "marketing", "gerais", "resultado", "indicador",
];

/** Rótulo de uma chave canônica; `outros:<slug>` vira texto legível. */
export function rotuloChave(chave: string): string {
  const info = infoChave(chave);
  if (info) return info.descricao;
  const slug = chave.startsWith("outros:") ? chave.slice(7) : chave;
  const t = slug.replace(/[_-]+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : chave;
}

/** Linhas cujo valor é fração (exibir e digitar em %). */
export function linhaEhPercentual(l: Pick<LinhaProjecao, "chave" | "grupo">): boolean {
  return l.grupo === "indicador" && (l.chave === "percentual_potencial" || l.chave.includes("pct") || l.chave.includes("percent"));
}

/** Quantos meses têm algum valor diferente de zero em alguma linha. */
export function mesesPreenchidos(linhas: LinhaProjecao[]): number {
  let ultimo = 0;
  for (const l of linhas) {
    for (let i = l.valores.length - 1; i >= 0; i--) {
      if (l.valores[i]) { ultimo = Math.max(ultimo, i + 1); break; }
    }
  }
  return ultimo;
}

/** Posição canônica da chave (linhas `outros:*` e desconhecidas vão ao fim). */
export function ordemChave(chave: string): number {
  return infoChave(chave)?.ordem ?? Number.MAX_SAFE_INTEGER;
}

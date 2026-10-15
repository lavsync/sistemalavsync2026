// LavSync · Financeiro · Projetado da franqueadora — recálculo pelas premissas
//
// Reproduz as fórmulas da planilha de viabilidade da franqueadora (aba
// "Viabilidade"): faturamento = potencial × rampa; CSP, energia, água e taxa
// de cartão em % do faturamento; royalties = % do faturamento, com mínimo
// (max(%, mínimo)) só a partir do mês configurado; fundo de propaganda fixo;
// publicidade inaugural nos primeiros meses; Simples pelo método da
// franqueadora (RBT12 = faturamento do mês × 12) OU pela regra legal
// (12 meses anteriores — rbt12Legal do motor). Puro: cliente e servidor.

import { calcularSimplesMensal, rbt12Legal } from "../engine";
import {
  GRUPOS_CUSTO, N_MESES, infoChave, type ChaveCanonica, type LinhaProjecao, type PremissasProjecao,
} from "./tipos";

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Simples mês a mês de uma série de faturamento, pelo método escolhido. */
export function simplesPorMetodo(faturamento: number[], metodo: "franqueadora" | "legal"): number[] {
  return faturamento.map((fat, i) => {
    const rbt12 = metodo === "franqueadora" ? fat * 12 : rbt12Legal(faturamento.slice(0, i), fat);
    return calcularSimplesMensal(fat, rbt12);
  });
}

/** Resultado de cada mês = faturamento − soma das linhas dos grupos de custo. */
export function resultadoDasLinhas(linhas: LinhaProjecao[]): number[] {
  const fat = linhas.find((l) => l.chave === "faturamento")?.valores ?? [];
  const custos = linhas.filter((l) => GRUPOS_CUSTO.includes(l.grupo));
  return Array.from({ length: N_MESES }, (_, i) =>
    (fat[i] ?? 0) - custos.reduce((s, l) => s + (l.valores[i] ?? 0), 0));
}

/** Fluxo de caixa acumulado (sem o investimento, como a linha da planilha). */
export function acumular(v: number[]): number[] {
  let s = 0;
  return v.map((x) => (s += x));
}

/**
 * Recalcula as 60 colunas a partir das premissas.
 * `extras`: linhas que não saem das premissas (outras_despesas, outros:*) —
 * entram como estão e também descontam do resultado.
 */
export function recalcularPelasPremissas(p: PremissasProjecao, extras: LinhaProjecao[] = []): LinhaProjecao[] {
  const rampa = Array.from({ length: N_MESES }, (_, i) => {
    const x = Number(p.rampa?.[i] ?? p.rampa?.[p.rampa.length - 1] ?? 1);
    return Number.isFinite(x) ? Math.max(0, x) : 0;
  });
  const pct = (v: number) => (Number(v) || 0) / 100;
  const fat = rampa.map((x) => r2(p.potencial_faturamento * x));
  const simples = simplesPorMetodo(fat, p.metodo_simples).map(r2);
  const porMes = (f: (fat: number, mes: number) => number) => fat.map((v, i) => r2(f(v, i + 1)));

  const valores: Partial<Record<ChaveCanonica, number[]>> = {
    percentual_potencial: rampa,
    faturamento: fat,
    simples,
    csp: porMes((f) => f * pct(p.csp_pct)),
    royalties: porMes((f, m) => {
      const v = f * pct(p.royalties_pct);
      return p.royalties_minimo > 0 && m >= (p.royalties_minimo_a_partir_mes || 1) ? Math.max(v, p.royalties_minimo) : v;
    }),
    fundo_propaganda: porMes(() => p.fundo_propaganda_fixo),
    pessoal: porMes(() => p.pessoal),
    aluguel: porMes(() => p.aluguel),
    energia: porMes((f) => f * pct(p.energia_pct)),
    agua: porMes((f) => f * pct(p.agua_pct)),
    telefone: porMes(() => p.telefone),
    contador: porMes(() => p.contador),
    software: porMes(() => p.software),
    seguro: porMes(() => p.seguro),
    taxa_cartao: porMes((f) => f * pct(p.taxa_cartao_pct)),
    servicos_bancarios: porMes(() => p.servicos_bancarios),
    marketing_local: porMes((_, m) =>
      p.publicidade_inaugural_meses > 0 && m <= p.publicidade_inaugural_meses ? p.publicidade_inaugural : p.publicidade_local),
    materiais: porMes(() => p.materiais),
  };

  const linhas: LinhaProjecao[] = [];
  for (const [chave, v] of Object.entries(valores) as Array<[ChaveCanonica, number[]]>) {
    const info = infoChave(chave)!;
    linhas.push({ chave, descricao: info.descricao, grupo: info.grupo, ordem: info.ordem, valores: v });
  }
  const chavesProprias = new Set(linhas.map((l) => l.chave));
  for (const e of extras) {
    if (chavesProprias.has(e.chave) || e.chave === "resultado" || e.chave === "fluxo_acumulado") continue;
    linhas.push({ ...e, valores: [...e.valores] });
  }

  const resultado = resultadoDasLinhas(linhas).map(r2);
  const infoRes = infoChave("resultado")!;
  const infoFluxo = infoChave("fluxo_acumulado")!;
  linhas.push({ chave: "resultado", descricao: infoRes.descricao, grupo: infoRes.grupo, ordem: infoRes.ordem, valores: resultado });
  linhas.push({ chave: "fluxo_acumulado", descricao: infoFluxo.descricao, grupo: infoFluxo.grupo, ordem: infoFluxo.ordem, valores: acumular(resultado).map(r2) });
  return linhas.sort((a, b) => a.ordem - b.ordem);
}

// LavSync · Financeiro · Projetado da franqueadora — validação automática
//
// Confere a coerência do que foi lido (ou digitado): resultado ≈ faturamento
// − deduções e custos (tolerância R$ 1), fluxo acumulado, investimento que
// soma (itens → categorias → total), rampa coerente e faturamento ≈
// potencial × rampa. Cada divergência vira um aviso legível no rascunho.
// Puro: cliente e servidor.

import { N_MESES, type InvestimentoProjecao, type LinhaProjecao, type PremissasProjecao } from "./tipos";
import { acumular, resultadoDasLinhas } from "./calculo";

const TOL = 1;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const listaMeses = (ms: number[]) => (ms.length > 6 ? `${ms.slice(0, 6).join(", ")} e mais ${ms.length - 6}` : ms.join(", "));

export function validarLinhas(linhas: LinhaProjecao[]): string[] {
  const avisos: string[] = [];
  const get = (k: string) => linhas.find((l) => l.chave === k);
  const fat = get("faturamento");
  const res = get("resultado");
  if (!fat) avisos.push("Linha de faturamento não encontrada: a comparação com o real fica sem base.");
  if (!res) avisos.push("Linha de resultado não encontrada: o resultado foi recalculado pelas linhas de custo.");

  for (const l of linhas) {
    if (l.valores.length !== N_MESES) avisos.push(`"${l.descricao}" tem ${l.valores.length} meses (esperado ${N_MESES}).`);
  }

  if (fat && res) {
    const calc = resultadoDasLinhas(linhas);
    const div = calc.map((v, i) => ({ i, d: res.valores[i] - v })).filter((x) => Math.abs(x.d) > TOL);
    if (div.length > 0) {
      const p = div[0];
      avisos.push(`Resultado não fecha com faturamento − custos em ${div.length} ${div.length === 1 ? "mês" : "meses"} `
        + `(meses ${listaMeses(div.map((x) => x.i + 1))}). No mês ${p.i + 1}: diferença de ${brl(p.d)} — confira se falta alguma linha de custo.`);
    }
  }

  const fluxo = get("fluxo_acumulado");
  if (res && fluxo) {
    const acc = acumular(res.valores);
    const i = acc.findIndex((v, k) => Math.abs(v - fluxo.valores[k]) > TOL);
    if (i >= 0) avisos.push(`Fluxo de caixa acumulado não bate com a soma dos resultados a partir do mês ${i + 1}.`);
  }

  const rampa = get("percentual_potencial");
  if (rampa) {
    const fora = rampa.valores.map((v, i) => ({ v, i })).filter((x) => x.v < 0 || x.v > 1.5);
    if (fora.length) avisos.push(`Rampa (% do potencial) fora da faixa 0 a 150% nos meses ${listaMeses(fora.map((x) => x.i + 1))}.`);
    for (let i = 1; i < rampa.valores.length; i++) {
      const salto = rampa.valores[i] - rampa.valores[i - 1];
      if (salto > 0.2) avisos.push(`Rampa salta ${Math.round(salto * 100)} pontos do mês ${i} para o mês ${i + 1} `
        + `(${Math.round(rampa.valores[i - 1] * 100)}% → ${Math.round(rampa.valores[i] * 100)}% do potencial).`);
    }
  }
  return avisos;
}

export function validarPremissas(p: PremissasProjecao | null, linhas: LinhaProjecao[]): string[] {
  if (!p) return ["Premissas não identificadas: o recálculo pelas premissas fica indisponível até preenchê-las."];
  const avisos: string[] = [];
  if (!(p.potencial_faturamento > 0)) avisos.push("Potencial de faturamento ausente ou zero.");
  if (p.rampa.length !== N_MESES) avisos.push(`Rampa com ${p.rampa.length} meses (esperado ${N_MESES}).`);
  const fat = linhas.find((l) => l.chave === "faturamento");
  if (fat && p.potencial_faturamento > 0 && p.rampa.length === N_MESES) {
    const div = fat.valores.map((v, i) => ({ i, d: v - p.potencial_faturamento * p.rampa[i] })).filter((x) => Math.abs(x.d) > TOL);
    if (div.length) avisos.push(`Faturamento ≠ potencial × rampa em ${div.length} ${div.length === 1 ? "mês" : "meses"} (meses ${listaMeses(div.map((x) => x.i + 1))}).`);
  }
  for (const [k, v] of Object.entries({ csp_pct: p.csp_pct, royalties_pct: p.royalties_pct, energia_pct: p.energia_pct, agua_pct: p.agua_pct, taxa_cartao_pct: p.taxa_cartao_pct })) {
    if (v < 0 || v > 60) avisos.push(`Premissa ${k} = ${v}% parece fora da escala (esperado em pontos percentuais, ex.: 5 = 5%).`);
  }
  return avisos;
}

export function validarInvestimento(inv: InvestimentoProjecao | null): string[] {
  if (!inv) return ["Investimento inicial não identificado: o payback fica sem base até preenchê-lo."];
  const avisos: string[] = [];
  const somaCat = inv.categorias.reduce((s, c) => s + c.valor, 0);
  if (inv.categorias.length && Math.abs(somaCat - inv.total) > TOL) {
    avisos.push(`Categorias do investimento somam ${brl(somaCat)}, mas o total informado é ${brl(inv.total)}.`);
  }
  for (const c of inv.categorias) {
    if (!c.itens.length) continue;
    const somaItens = c.itens.reduce((s, it) => s + it.total, 0);
    if (Math.abs(somaItens - c.valor) > TOL) avisos.push(`Itens de "${c.nome}" somam ${brl(somaItens)} contra ${brl(c.valor)} da categoria.`);
    for (const it of c.itens) {
      if (it.unitario > 0 && it.quantidade > 0 && Math.abs(it.unitario * it.quantidade - it.total) > TOL) {
        avisos.push(`Item "${it.descricao}" (${c.nome}): ${it.quantidade} × ${brl(it.unitario)} ≠ ${brl(it.total)}.`);
      }
    }
  }
  return avisos;
}

/** Todas as validações juntas (ordem: linhas, premissas, investimento). */
export function validarProjecao(p: { linhas: LinhaProjecao[]; premissas: PremissasProjecao | null; investimento: InvestimentoProjecao | null }): string[] {
  return [...validarLinhas(p.linhas), ...validarPremissas(p.premissas, p.linhas), ...validarInvestimento(p.investimento)];
}

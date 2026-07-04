// LavSync · XÔ Club · Valor monetário do LavCoin (client-safe, puro)
//
// Regra oficial: 1 LavCoin = R$ 0,05 (logo R$1 de produto = 20 LavCoins).
// Emissão: 1 LavCoin por R$1 gasto → reserva = 5% do faturamento
// (provisionada como custo variável no DRE do Financeiro, mig 0048).

export const VALOR_LAVCOIN_BRL = 0.05;

export function lavcoinsParaReais(coins: number): number {
  return Math.round(coins * VALOR_LAVCOIN_BRL * 100) / 100;
}

export function reaisParaLavcoins(valorBrl: number): number {
  return Math.round(valorBrl / VALOR_LAVCOIN_BRL);
}

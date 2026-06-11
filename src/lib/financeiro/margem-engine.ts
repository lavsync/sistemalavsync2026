// LavSync · Engenharia de custos · Cálculo puro de margem de contribuição
//
// Tudo aqui é função pura — recebe parâmetros, devolve resultado.
// Custo por ciclo de lavagem = sabão + amaciante + energia + água (rateada)
// Custo por ciclo de secagem = energia
// Overhead elétrico = equipamentos sempre ligados × horas × dias × tarifa

export type EngenhariaCustos = {
  preco_galao_sabao_litros: number;
  preco_galao_sabao_valor: number;
  ml_sabao_por_ciclo: number;
  preco_galao_amaciante_litros: number;
  preco_galao_amaciante_valor: number;
  ml_amaciante_por_ciclo: number;
  tarifa_kwh: number;
  kwh_por_ciclo_lavagem: number;
  kwh_por_ciclo_secagem: number;
  conta_agua_mensal: number;
  ar_condicionado_btus: number;
  ar_condicionado_kwh_hora: number;
  lampadas_qtd: number;
  lampada_kwh_hora: number;
  cameras_qtd: number;
  camera_kwh_hora: number;
  tv_kwh_hora: number;
  totem_kwh_hora: number;
  internet_kwh_hora: number;
  horas_operacao_dia: number;
  dias_operacao_mes: number;
  preco_lavagem: number;
  preco_secagem: number;
};

export type ComponenteCusto = {
  rotulo: string;
  valor: number;        // R$ por ciclo
  cor: string;          // var(--token)
};

export type CustoCiclo = {
  total: number;
  componentes: ComponenteCusto[];
};

export type MargemUnidade = {
  // por ciclo
  custoLavagem: CustoCiclo;
  custoSecagem: CustoCiclo;
  margemUnitariaLavagem: number;
  margemUnitariaSecagem: number;
  margemPercLavagem: number;
  margemPercSecagem: number;
  // do mês
  ciclosLavagemMes: number;
  ciclosSecagemMes: number;
  faturamentoLavagemMes: number;
  faturamentoSecagemMes: number;
  custoTotalInsumosMes: number;
  margemContribuicaoMes: number;
  margemContribuicaoPctMes: number;
  // overhead elétrico (informativo — entra em custos fixos)
  overheadKwhDia: number;
  overheadKwhMes: number;
  overheadCustoMes: number;
  overheadDetalhe: ComponenteCusto[];
};

/** Custo de sabão por ciclo (R$).
 *  Ex: 40ml dum galão de 20L a R$ 887,29 → 40/20000 × 887,29 = R$ 1,7746 */
function custoInsumoPorCiclo(mlPorCiclo: number, litrosGalao: number, valorGalao: number): number {
  const mlGalao = litrosGalao * 1000;
  if (mlGalao <= 0) return 0;
  return (mlPorCiclo / mlGalao) * valorGalao;
}

/** Custo da água rateado por ciclo de lavagem. Se 0 ciclos no mês → 0. */
function custoAguaPorCiclo(contaMensal: number, ciclosLavagemMes: number): number {
  if (ciclosLavagemMes <= 0) return 0;
  return contaMensal / ciclosLavagemMes;
}

export function calcularCustoLavagem(
  c: EngenhariaCustos,
  ciclosLavagemMes: number,
): CustoCiclo {
  const sabao = custoInsumoPorCiclo(
    c.ml_sabao_por_ciclo, c.preco_galao_sabao_litros, c.preco_galao_sabao_valor,
  );
  const amaciante = custoInsumoPorCiclo(
    c.ml_amaciante_por_ciclo, c.preco_galao_amaciante_litros, c.preco_galao_amaciante_valor,
  );
  const energia = c.kwh_por_ciclo_lavagem * c.tarifa_kwh;
  const agua = custoAguaPorCiclo(c.conta_agua_mensal, ciclosLavagemMes);

  const total = sabao + amaciante + energia + agua;
  return {
    total,
    componentes: [
      { rotulo: "Sabão Omo",     valor: sabao,     cor: "var(--brand-cyan)" },
      { rotulo: "Amaciante",     valor: amaciante, cor: "var(--brand-purple)" },
      { rotulo: "Energia",       valor: energia,   cor: "var(--warning)" },
      { rotulo: "Água",          valor: agua,      cor: "var(--brand-blue)" },
    ],
  };
}

export function calcularCustoSecagem(c: EngenhariaCustos): CustoCiclo {
  const energia = c.kwh_por_ciclo_secagem * c.tarifa_kwh;
  return {
    total: energia,
    componentes: [
      { rotulo: "Energia", valor: energia, cor: "var(--warning)" },
    ],
  };
}

/** Overhead elétrico mensal — equipamentos sempre ligados durante horário de operação. */
export function calcularOverheadEletrico(c: EngenhariaCustos): {
  kwhDia: number;
  kwhMes: number;
  custoMes: number;
  detalhe: ComponenteCusto[];
} {
  const horas = Math.max(0, c.horas_operacao_dia);
  const dias = Math.max(0, c.dias_operacao_mes);

  const itens: Array<{ rotulo: string; kwhHora: number; cor: string }> = [
    { rotulo: "Ar-condicionado", kwhHora: c.ar_condicionado_kwh_hora,                          cor: "var(--brand-cyan)" },
    { rotulo: "Lâmpadas",        kwhHora: c.lampada_kwh_hora * c.lampadas_qtd,                  cor: "var(--warning)" },
    { rotulo: "Câmeras",         kwhHora: c.camera_kwh_hora * c.cameras_qtd,                    cor: "var(--brand-purple)" },
    { rotulo: "TV",              kwhHora: c.tv_kwh_hora,                                        cor: "var(--brand-blue)" },
    { rotulo: "Totem",           kwhHora: c.totem_kwh_hora,                                     cor: "var(--success)" },
    { rotulo: "Internet/telefonia", kwhHora: c.internet_kwh_hora,                               cor: "var(--brand-violet)" },
  ];

  const kwhHora = itens.reduce((s, it) => s + it.kwhHora, 0);
  const kwhDia = kwhHora * horas;
  const kwhMes = kwhDia * dias;
  const custoMes = kwhMes * c.tarifa_kwh;

  const detalhe: ComponenteCusto[] = itens.map((it) => ({
    rotulo: it.rotulo,
    valor: it.kwhHora * horas * dias * c.tarifa_kwh,
    cor: it.cor,
  }));

  return { kwhDia, kwhMes, custoMes, detalhe };
}

/** Cálculo completo da margem de contribuição da unidade num dado mês. */
export function calcularMargemContribuicao(
  c: EngenhariaCustos,
  ciclosLavagemMes: number,
  ciclosSecagemMes: number,
  faturamentoLavagemMes?: number,
  faturamentoSecagemMes?: number,
): MargemUnidade {
  // Se não passou faturamento real, calcula com base nos preços padrão
  const fatLav = faturamentoLavagemMes ?? (ciclosLavagemMes * c.preco_lavagem);
  const fatSec = faturamentoSecagemMes ?? (ciclosSecagemMes * c.preco_secagem);

  const custoLav = calcularCustoLavagem(c, ciclosLavagemMes);
  const custoSec = calcularCustoSecagem(c);
  const overhead = calcularOverheadEletrico(c);

  const margemUnitLav = c.preco_lavagem - custoLav.total;
  const margemUnitSec = c.preco_secagem - custoSec.total;
  const margemPercLav = c.preco_lavagem > 0 ? (margemUnitLav / c.preco_lavagem) * 100 : 0;
  const margemPercSec = c.preco_secagem > 0 ? (margemUnitSec / c.preco_secagem) * 100 : 0;

  const custoTotalInsumosMes = custoLav.total * ciclosLavagemMes + custoSec.total * ciclosSecagemMes;
  const margemTotalMes = (fatLav + fatSec) - custoTotalInsumosMes;
  const margemPctMes = (fatLav + fatSec) > 0 ? (margemTotalMes / (fatLav + fatSec)) * 100 : 0;

  return {
    custoLavagem: custoLav,
    custoSecagem: custoSec,
    margemUnitariaLavagem: margemUnitLav,
    margemUnitariaSecagem: margemUnitSec,
    margemPercLavagem: margemPercLav,
    margemPercSecagem: margemPercSec,
    ciclosLavagemMes,
    ciclosSecagemMes,
    faturamentoLavagemMes: fatLav,
    faturamentoSecagemMes: fatSec,
    custoTotalInsumosMes,
    margemContribuicaoMes: margemTotalMes,
    margemContribuicaoPctMes: margemPctMes,
    overheadKwhDia: overhead.kwhDia,
    overheadKwhMes: overhead.kwhMes,
    overheadCustoMes: overhead.custoMes,
    overheadDetalhe: overhead.detalhe,
  };
}

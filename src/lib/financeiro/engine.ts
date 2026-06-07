// LavSync · Financeiro · Engine de cálculos
// Simples Nacional Anexo III progressivo + DRE completo + Payback + Projeção 60m

export type CustoFixo = {
  id: string;
  descricao: string;
  valor_mensal: number;
  valor_inaugural: number | null;
  meses_inaugural: number | null;
  ativo: boolean;
};

export type CustoVariavel = {
  id: string;
  descricao: string;
  tipo: "simples" | "csp" | "royalties" | "variavel";
  percentual_faturamento: number | null;
  valor_minimo: number | null;
  a_partir_do_mes: number | null;
  ativo: boolean;
};

// ─── Simples Nacional · Anexo III ──────────────────────────────────────
// Faixas (RBT12 anualizada):
//  até 180k         → 6,00%
//  180k → 360k      → 11,20% (PD 9.360)
//  360k → 720k      → 13,50% (PD 17.640)
//  720k → 1.800k    → 16,00% (PD 35.640)
//  1.800k → 3.600k  → 21,00% (PD 125.640)
//  3.600k → 4.800k  → 33,00% (PD 648.000)
//
// Alíquota efetiva = (RBT12 × alíquota nominal − PD) / RBT12
// Sobre faturamento mensal: imposto = faturamento_mes × alíquota efetiva

const FAIXAS_SIMPLES_III = [
  { ate: 180_000,  aliquota: 0.06,  pd: 0 },
  { ate: 360_000,  aliquota: 0.112, pd: 9_360 },
  { ate: 720_000,  aliquota: 0.135, pd: 17_640 },
  { ate: 1_800_000, aliquota: 0.16, pd: 35_640 },
  { ate: 3_600_000, aliquota: 0.21, pd: 125_640 },
  { ate: 4_800_000, aliquota: 0.33, pd: 648_000 },
] as const;

/** RBT12 = soma dos faturamentos dos últimos 12 meses. Pra mês 1 use o próprio. */
export function aliquotaSimplesEfetiva(rbt12: number): number {
  if (rbt12 <= 0) return FAIXAS_SIMPLES_III[0].aliquota;
  for (const f of FAIXAS_SIMPLES_III) {
    if (rbt12 <= f.ate) {
      const efetiva = (rbt12 * f.aliquota - f.pd) / rbt12;
      return Math.max(0, efetiva);
    }
  }
  const last = FAIXAS_SIMPLES_III[FAIXAS_SIMPLES_III.length - 1];
  return Math.max(0, (rbt12 * last.aliquota - last.pd) / rbt12);
}

export function calcularSimplesMensal(faturamentoMes: number, rbt12: number): number {
  if (faturamentoMes <= 0) return 0;
  return faturamentoMes * aliquotaSimplesEfetiva(rbt12);
}

// ─── DRE Mensal ────────────────────────────────────────────────────────
export type DRELinha = {
  descricao: string;
  valor: number;
  destaque?: "receita" | "deducao" | "subtotal" | "total" | "indicador";
};

export type DREResultado = {
  faturamento_bruto: number;
  simples_nacional: number;
  receita_liquida: number;
  custo_servico_total: number;
  resultado_bruto: number;
  royalties: number;
  custos_fixos_total: number;
  custos_variaveis_total: number;
  despesas_total: number;
  resultado_liquido: number;
  margem_operacional: number;       // % sobre faturamento
  roi_sobre_investimento: number;   // % sobre investimento
  detalhe_fixos: Array<{ descricao: string; valor: number }>;
  detalhe_variaveis: Array<{ descricao: string; valor: number }>;
  detalhe_csp: Array<{ descricao: string; valor: number }>;
};

export type CalcDREInput = {
  faturamento: number;
  rbt12?: number;                   // se não informado, usa faturamento×12 (mês 1)
  mes_index: number;                // 1..60
  custos_fixos: CustoFixo[];
  custos_variaveis: CustoVariavel[];
  investimento_total: number;
};

export function calcularDRE(input: CalcDREInput): DREResultado {
  const fat = Math.max(0, input.faturamento || 0);
  const rbt12 = input.rbt12 ?? fat * 12;

  // ─── CSP (custo do serviço) ───
  const detalhe_csp: Array<{ descricao: string; valor: number }> = [];
  let custo_servico_total = 0;
  for (const cv of input.custos_variaveis) {
    if (!cv.ativo) continue;
    if (cv.tipo !== "csp") continue;
    const v = fat * ((cv.percentual_faturamento ?? 0) / 100);
    custo_servico_total += v;
    detalhe_csp.push({ descricao: cv.descricao, valor: v });
  }

  // ─── Royalties (% mínimo a partir do mês X) ───
  let royalties = 0;
  for (const cv of input.custos_variaveis) {
    if (!cv.ativo) continue;
    if (cv.tipo !== "royalties") continue;
    if (cv.a_partir_do_mes && input.mes_index < cv.a_partir_do_mes) continue;
    const pct = fat * ((cv.percentual_faturamento ?? 0) / 100);
    const min = cv.valor_minimo ?? 0;
    royalties += Math.max(pct, min);
  }

  // ─── Custos fixos ───
  const detalhe_fixos: Array<{ descricao: string; valor: number }> = [];
  let custos_fixos_total = 0;
  for (const cf of input.custos_fixos) {
    if (!cf.ativo) continue;
    const usaInaugural =
      cf.valor_inaugural != null && cf.meses_inaugural != null &&
      input.mes_index <= cf.meses_inaugural;
    const v = usaInaugural ? cf.valor_inaugural! : cf.valor_mensal;
    custos_fixos_total += v;
    detalhe_fixos.push({ descricao: cf.descricao, valor: v });
  }

  // ─── Custos variáveis (excluindo simples/csp/royalties) ───
  const detalhe_variaveis: Array<{ descricao: string; valor: number }> = [];
  let custos_variaveis_total = 0;
  for (const cv of input.custos_variaveis) {
    if (!cv.ativo) continue;
    if (cv.tipo !== "variavel") continue;
    const v = fat * ((cv.percentual_faturamento ?? 0) / 100);
    custos_variaveis_total += v;
    detalhe_variaveis.push({ descricao: cv.descricao, valor: v });
  }

  // ─── Simples Nacional ───
  const simples_nacional = calcularSimplesMensal(fat, rbt12);

  const receita_liquida = fat - simples_nacional;
  const resultado_bruto = receita_liquida - custo_servico_total;
  const despesas_total = royalties + custos_fixos_total + custos_variaveis_total;
  const resultado_liquido = resultado_bruto - despesas_total;
  const margem_operacional = fat > 0 ? (resultado_liquido / fat) * 100 : 0;
  const roi_sobre_investimento = input.investimento_total > 0
    ? (resultado_liquido / input.investimento_total) * 100
    : 0;

  return {
    faturamento_bruto: fat,
    simples_nacional,
    receita_liquida,
    custo_servico_total,
    resultado_bruto,
    royalties,
    custos_fixos_total,
    custos_variaveis_total,
    despesas_total,
    resultado_liquido,
    margem_operacional,
    roi_sobre_investimento,
    detalhe_fixos,
    detalhe_variaveis,
    detalhe_csp,
  };
}

// ─── Projeção 60 meses ──────────────────────────────────────────────────
export type ProjecaoMes = {
  mes_index: number;
  ano: number;
  mes: number;
  rotulo: string;                  // "Jun/26"
  faturamento_projetado: number;
  faturamento_real: number | null;
  pct_da_meta: number | null;
  resultado_projetado: number;
  resultado_real: number | null;
  fluxo_acumulado: number;         // acumulado real (ou projetado se sem real) menos investimento
  status: "pendente" | "lancado" | "acima" | "abaixo" | "futuro";
};

const MES_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export type ProjecaoInput = {
  mes_inicio: number;              // 1..12
  ano_inicio: number;
  potencial_faturamento: number;
  custos_fixos: CustoFixo[];
  custos_variaveis: CustoVariavel[];
  investimento_total: number;
  lancamentos: Map<number, number>;  // mes_index → faturamento_real
};

// Curva de ramp-up típica: cresce até atingir potencial no mês ~18
function fatorRamp(mes: number): number {
  if (mes >= 18) return 1.0;
  // Crescimento progressivo: mês 1 = 10%, mês 18 = 100%
  return 0.10 + (mes - 1) * (0.90 / 17);
}

export function projetar60Meses(input: ProjecaoInput): ProjecaoMes[] {
  const out: ProjecaoMes[] = [];
  let acumulado = -input.investimento_total;
  const hoje = new Date();
  const fatHistorico: number[] = [];

  for (let i = 1; i <= 60; i++) {
    const d = new Date(input.ano_inicio, input.mes_inicio - 1 + (i - 1), 1);
    const mes = d.getMonth() + 1;
    const ano = d.getFullYear();
    const fatProj = input.potencial_faturamento * fatorRamp(i);
    const fatReal = input.lancamentos.get(i) ?? null;
    const fatUsado = fatReal ?? fatProj;
    fatHistorico.push(fatUsado);

    const rbt12 = fatHistorico.slice(-12).reduce((s, v) => s + v, 0);

    const dre = calcularDRE({
      faturamento: fatUsado,
      rbt12,
      mes_index: i,
      custos_fixos: input.custos_fixos,
      custos_variaveis: input.custos_variaveis,
      investimento_total: input.investimento_total,
    });

    const dreProj = calcularDRE({
      faturamento: fatProj,
      rbt12,
      mes_index: i,
      custos_fixos: input.custos_fixos,
      custos_variaveis: input.custos_variaveis,
      investimento_total: input.investimento_total,
    });

    acumulado += dre.resultado_liquido;
    const pctMeta = fatReal != null && fatProj > 0 ? (fatReal / fatProj) * 100 : null;

    let status: ProjecaoMes["status"] = "pendente";
    if (fatReal == null) {
      const future = d > hoje;
      status = future ? "futuro" : "pendente";
    } else if (pctMeta != null && pctMeta >= 100) status = "acima";
    else status = "abaixo";

    out.push({
      mes_index: i, ano, mes,
      rotulo: `${MES_ABBR[mes - 1]}/${String(ano).slice(2)}`,
      faturamento_projetado: Math.round(fatProj * 100) / 100,
      faturamento_real: fatReal,
      pct_da_meta: pctMeta,
      resultado_projetado: Math.round(dreProj.resultado_liquido * 100) / 100,
      resultado_real: fatReal != null ? Math.round(dre.resultado_liquido * 100) / 100 : null,
      fluxo_acumulado: Math.round(acumulado * 100) / 100,
      status,
    });
  }
  return out;
}

// ─── Payback ───────────────────────────────────────────────────────────
export type Payback = {
  investimento: number;
  lucro_acumulado: number;          // resultado_liquido somado (apenas reais)
  falta_recuperar: number;
  pct_recuperado: number;
  mes_payback_projetado: number | null;  // a partir da projeção
};

export function calcularPayback(projecao: ProjecaoMes[], investimento: number): Payback {
  const lucroAcum = projecao
    .filter((p) => p.faturamento_real != null)
    .reduce((s, p) => s + (p.resultado_real ?? 0), 0);
  const faltaRec = Math.max(0, investimento - lucroAcum);
  const pct = investimento > 0 ? (lucroAcum / investimento) * 100 : 0;

  // Mês projetado em que o fluxo acumulado vira positivo
  const payMes = projecao.find((p) => p.fluxo_acumulado >= 0)?.mes_index ?? null;
  return {
    investimento,
    lucro_acumulado: Math.round(lucroAcum * 100) / 100,
    falta_recuperar: Math.round(faltaRec * 100) / 100,
    pct_recuperado: Math.round(pct * 10) / 10,
    mes_payback_projetado: payMes,
  };
}

// ─── Break-even ────────────────────────────────────────────────────────
/** Faturamento mínimo no mês pra resultado_liquido = 0 (aproximação iterativa). */
export function calcularBreakEven(input: {
  custos_fixos: CustoFixo[];
  custos_variaveis: CustoVariavel[];
  mes_index: number;
  rbt12: number;
  investimento_total: number;
}): number {
  // Busca binária entre 0 e 100.000
  let lo = 0, hi = 100_000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const dre = calcularDRE({
      faturamento: mid,
      rbt12: input.rbt12,
      mes_index: input.mes_index,
      custos_fixos: input.custos_fixos,
      custos_variaveis: input.custos_variaveis,
      investimento_total: input.investimento_total,
    });
    if (dre.resultado_liquido < 0) lo = mid; else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 100) / 100;
}

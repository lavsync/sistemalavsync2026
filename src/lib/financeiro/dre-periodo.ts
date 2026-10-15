// LavSync · Financeiro · DRE por período (mensal, trimestral, semestral, anual)
//
// Fonte única do DRE fechado de um período: reaproveita a projeção (mesma base
// do Simples e dos valores pagos do Painel/DRE Mensal) e soma mês a mês.
// Puro (sem server-only) — usado pela tela, pelo PDF e pelo CLOCK.

import {
  calcularDRE, projetar60Meses, mapearDespesasReais,
  type CustoFixo, type CustoVariavel, type DREResultado,
} from "./engine";

export type TipoPeriodo = "mensal" | "trimestral" | "semestral" | "anual";

export type Periodo = { tipo: TipoPeriodo; ano: number; numero: number }; // numero: mês 1-12 · tri 1-4 · sem 1-2 · anual 1

export type DespesaPaga = { descricao: string; categoria_nome: string; valor: number };

/** Tudo o que o DRE de uma unidade precisa (carregado no servidor). */
export type DadosDREUnidade = {
  unidade_id: string;
  unidade_nome: string;
  mes_inauguracao: number | null;
  ano_inauguracao: number | null;
  potencial_faturamento: number;
  custos_fixos: CustoFixo[];
  custos_variaveis: CustoVariavel[];
  /** "AAAA-MM" → faturamento real (vendas no fuso BR; senão lançamento manual) */
  faturamento_por_mes: Record<string, number>;
  /** "AAAA-MM" → despesas pagas na competência */
  despesas_por_mes: Record<string, DespesaPaga[]>;
  investimento_total: number;
};

export type LinhaDRE = {
  chave: string;
  descricao: string;
  grupo: "receita" | "deducao" | "csp" | "royalties" | "fixo" | "variavel" | "subtotal" | "resultado";
  valores: number[];          // 1 por coluna (mês ou trimestre)
  total: number;
  /** "real" = pago em todos os meses · "parcial" = parte paga, parte estimada · "estimado" = % de referência */
  origem?: "real" | "parcial" | "estimado";
  destaque?: boolean;
};

export type DREPeriodoResultado = {
  periodo: Periodo;
  titulo: string;               // "3º trimestre de 2026"
  intervalo: string;            // "jul a set/2026"
  unidades: string[];
  colunas: string[];            // rótulos das colunas (meses ou trimestres)
  meses: string[];              // "AAAA-MM" do período
  meses_com_dados: string[];
  meses_sem_dados: string[];
  linhas: LinhaDRE[];
  totais: {
    faturamento: number;
    simples: number;
    receita_liquida: number;
    csp: number;
    resultado_bruto: number;
    royalties: number;
    fixos: number;
    variaveis: number;
    despesas: number;
    resultado: number;
    margem: number;             // % s/ faturamento
    roi: number;                // % s/ investimento
    ciclos_ref?: number;
  };
  serie: Array<{ rotulo: string; faturamento: number; resultado: number }>;   // mês a mês
};

const MESES_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_NOME = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const k = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}`;

export function mesesDoPeriodo(p: Periodo): string[] {
  const span = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 }[p.tipo];
  const ini = p.tipo === "mensal" ? p.numero : p.tipo === "anual" ? 1 : (p.numero - 1) * span + 1;
  return Array.from({ length: span }, (_, i) => k(p.ano, ini + i));
}

export function periodoAnterior(p: Periodo): Periodo {
  const max = { mensal: 12, trimestral: 4, semestral: 2, anual: 1 }[p.tipo];
  if (p.tipo === "anual") return { ...p, ano: p.ano - 1 };
  return p.numero > 1 ? { ...p, numero: p.numero - 1 } : { ...p, ano: p.ano - 1, numero: max };
}

export function tituloPeriodo(p: Periodo): { titulo: string; intervalo: string } {
  const ms = mesesDoPeriodo(p);
  const [, mi] = ms[0].split("-").map(Number);
  const [, mf] = ms[ms.length - 1].split("-").map(Number);
  const intervalo = ms.length === 1 ? `${MESES_ABBR[mi - 1]}/${p.ano}` : `${MESES_ABBR[mi - 1]} a ${MESES_ABBR[mf - 1]}/${p.ano}`;
  const titulo =
    p.tipo === "mensal" ? `${MESES_NOME[p.numero - 1][0].toUpperCase()}${MESES_NOME[p.numero - 1].slice(1)} de ${p.ano}` :
    p.tipo === "trimestral" ? `${p.numero}º trimestre de ${p.ano}` :
    p.tipo === "semestral" ? `${p.numero}º semestre de ${p.ano}` : `Ano de ${p.ano}`;
  return { titulo, intervalo };
}

/** Período "fechado" mais recente do tipo pedido (o corrente ainda está em aberto). */
export function ultimoPeriodoFechado(tipo: TipoPeriodo, hoje: { ano: number; mes: number }): Periodo {
  const atual: Periodo =
    tipo === "mensal" ? { tipo, ano: hoje.ano, numero: hoje.mes } :
    tipo === "trimestral" ? { tipo, ano: hoje.ano, numero: Math.ceil(hoje.mes / 3) } :
    tipo === "semestral" ? { tipo, ano: hoje.ano, numero: hoje.mes <= 6 ? 1 : 2 } :
    { tipo, ano: hoje.ano, numero: 1 };
  return periodoAnterior(atual);
}

type DREMes = { dre: DREResultado; reais: Set<string> } | null;

/** DRE de cada mês "AAAA-MM" de uma unidade — null quando não há faturamento real no mês. */
function dresMensais(d: DadosDREUnidade, meses: string[]): Map<string, DREMes> {
  const out = new Map<string, DREMes>();
  if (!d.ano_inauguracao || !d.mes_inauguracao) {
    for (const m of meses) out.set(m, null);
    return out;
  }
  const custos = [
    ...d.custos_fixos.map((c) => ({ descricao: c.descricao, ativo: c.ativo, tipo: "fixo" })),
    ...d.custos_variaveis.map((c) => ({ descricao: c.descricao, ativo: c.ativo, tipo: c.tipo })),
  ];
  const overridesPorMes = new Map<string, Map<string, number>>();
  for (const [chave, itens] of Object.entries(d.despesas_por_mes)) {
    overridesPorMes.set(chave, mapearDespesasReais(custos, itens.map((x) => ({ descricao: x.descricao, categoria: x.categoria_nome, valor: x.valor }))));
  }
  const lancamentos = new Map<number, number>();
  for (const [chave, fat] of Object.entries(d.faturamento_por_mes)) {
    const [a, m] = chave.split("-").map(Number);
    const idx = (a - d.ano_inauguracao) * 12 + (m - d.mes_inauguracao) + 1;
    if (idx >= 1 && idx <= 60) lancamentos.set(idx, fat);
  }
  const projecao = projetar60Meses({
    mes_inicio: d.mes_inauguracao, ano_inicio: d.ano_inauguracao,
    potencial_faturamento: d.potencial_faturamento,
    custos_fixos: d.custos_fixos, custos_variaveis: d.custos_variaveis,
    investimento_total: d.investimento_total, lancamentos, overridesPorMes,
  });
  for (const chave of meses) {
    const [a, m] = chave.split("-").map(Number);
    const idx = (a - d.ano_inauguracao) * 12 + (m - d.mes_inauguracao) + 1;
    const p = projecao[idx - 1];
    if (!p || p.faturamento_real == null) { out.set(chave, null); continue; }
    const overrides = overridesPorMes.get(chave);
    const dre = calcularDRE({
      faturamento: p.faturamento_real, rbt12: p.rbt12, mes_index: idx,
      custos_fixos: d.custos_fixos, custos_variaveis: d.custos_variaveis,
      investimento_total: d.investimento_total, despesas_reais_overrides: overrides,
    });
    out.set(chave, { dre, reais: new Set(overrides?.keys() ?? []) });
  }
  return out;
}

/** DRE do período para 1 unidade ou consolidado (várias unidades somadas). */
export function calcularDREPeriodo(unidades: DadosDREUnidade[], periodo: Periodo): DREPeriodoResultado {
  const meses = mesesDoPeriodo(periodo);
  const porUnidade = unidades.map((u) => dresMensais(u, meses));

  // Soma das unidades por mês
  type Acc = { fat: number; simples: number; rl: number; csp: number; rb: number; roy: number; fix: number; vari: number; desp: number; res: number;
    csp_l: Map<string, number>; fix_l: Map<string, number>; var_l: Map<string, number>; real: Set<string>; est: Set<string>; tem: boolean };
  const nova = (): Acc => ({ fat: 0, simples: 0, rl: 0, csp: 0, rb: 0, roy: 0, fix: 0, vari: 0, desp: 0, res: 0,
    csp_l: new Map(), fix_l: new Map(), var_l: new Map(), real: new Set(), est: new Set(), tem: false });
  const porMes = new Map<string, Acc>(meses.map((m) => [m, nova()]));

  for (const mapa of porUnidade) {
    for (const m of meses) {
      const x = mapa.get(m);
      if (!x) continue;
      const a = porMes.get(m)!;
      const { dre, reais } = x;
      a.tem = true;
      a.fat += dre.faturamento_bruto; a.simples += dre.simples_nacional; a.rl += dre.receita_liquida;
      a.csp += dre.custo_servico_total; a.rb += dre.resultado_bruto; a.roy += dre.royalties;
      a.fix += dre.custos_fixos_total; a.vari += dre.custos_variaveis_total; a.desp += dre.despesas_total; a.res += dre.resultado_liquido;
      const add = (mp: Map<string, number>, linhas: DREResultado["detalhe_csp"]) => {
        for (const l of linhas) {
          mp.set(l.descricao, (mp.get(l.descricao) ?? 0) + l.valor);
          (reais.has(l.descricao) ? a.real : a.est).add(l.descricao);
        }
      };
      add(a.csp_l, dre.detalhe_csp); add(a.fix_l, dre.detalhe_fixos); add(a.var_l, dre.detalhe_variaveis);
    }
  }

  // Colunas: meses (até 6) ou trimestres (anual)
  const agruparTri = meses.length > 6;
  const colunas = agruparTri
    ? [1, 2, 3, 4].map((t) => `${t}º tri`)
    : meses.map((m) => { const [a, mm] = m.split("-").map(Number); return `${MESES_ABBR[mm - 1]}/${String(a).slice(2)}`; });
  const colDoMes = (i: number) => (agruparTri ? Math.floor(i / 3) : i);
  const nCols = colunas.length;

  const serieCol = (f: (a: Acc) => number) => {
    const v = new Array(nCols).fill(0);
    meses.forEach((m, i) => { v[colDoMes(i)] += f(porMes.get(m)!); });
    return v;
  };
  const soma = (v: number[]) => v.reduce((s, x) => s + x, 0);

  const linhas: LinhaDRE[] = [];
  const push = (chave: string, descricao: string, grupo: LinhaDRE["grupo"], valores: number[], extra?: Partial<LinhaDRE>) =>
    linhas.push({ chave, descricao, grupo, valores, total: soma(valores), ...extra });

  push("fat", "Faturamento bruto", "receita", serieCol((a) => a.fat), { destaque: true });
  push("simples", "(−) Simples Nacional", "deducao", serieCol((a) => -a.simples));
  push("rl", "(=) Receita líquida", "subtotal", serieCol((a) => a.rl), { destaque: true });

  const detalhe = (grupo: "csp" | "fixo" | "variavel", get: (a: Acc) => Map<string, number>) => {
    const nomes = new Set<string>();
    for (const a of porMes.values()) for (const n of get(a).keys()) nomes.add(n);
    for (const n of nomes) {
      const valores = serieCol((a) => -(get(a).get(n) ?? 0));
      let real = false, est = false;
      for (const a of porMes.values()) { if (a.real.has(n)) real = true; if (a.est.has(n)) est = true; }
      push(`${grupo}:${n}`, n, grupo, valores, { origem: real && est ? "parcial" : real ? "real" : "estimado" });
    }
  };
  detalhe("csp", (a) => a.csp_l);
  push("rb", "(=) Resultado bruto", "subtotal", serieCol((a) => a.rb), { destaque: true });
  push("roy", "(−) Royalties", "royalties", serieCol((a) => -a.roy));
  detalhe("fixo", (a) => a.fix_l);
  detalhe("variavel", (a) => a.var_l);
  push("desp", "(−) Total de despesas operacionais", "subtotal", serieCol((a) => -a.desp));
  push("res", "(=) Resultado líquido", "resultado", serieCol((a) => a.res), { destaque: true });

  const t = (f: (a: Acc) => number) => meses.reduce((s, m) => s + f(porMes.get(m)!), 0);
  const fat = t((a) => a.fat), res = t((a) => a.res);
  const inv = unidades.reduce((s, u) => s + u.investimento_total, 0);
  const { titulo, intervalo } = tituloPeriodo(periodo);

  return {
    periodo, titulo, intervalo,
    unidades: unidades.map((u) => u.unidade_nome),
    colunas, meses,
    meses_com_dados: meses.filter((m) => porMes.get(m)!.tem),
    meses_sem_dados: meses.filter((m) => !porMes.get(m)!.tem),
    linhas,
    totais: {
      faturamento: fat, simples: t((a) => a.simples), receita_liquida: t((a) => a.rl),
      csp: t((a) => a.csp), resultado_bruto: t((a) => a.rb), royalties: t((a) => a.roy),
      fixos: t((a) => a.fix), variaveis: t((a) => a.vari), despesas: t((a) => a.desp),
      resultado: res,
      margem: fat > 0 ? (res / fat) * 100 : 0,
      roi: inv > 0 ? (res / inv) * 100 : 0,
    },
    serie: meses.map((m) => {
      const a = porMes.get(m)!; const [an, mm] = m.split("-").map(Number);
      return { rotulo: `${MESES_ABBR[mm - 1]}/${String(an).slice(2)}`, faturamento: a.fat, resultado: a.res };
    }),
  };
}

/** Faturamento e resultado mês a mês numa janela qualquer (tendência no PDF/CLOCK). */
export function serieMensal(unidades: DadosDREUnidade[], meses: string[]): Array<{ mes: string; rotulo: string; faturamento: number; resultado: number; tem: boolean }> {
  const mapas = unidades.map((u) => dresMensais(u, meses));
  return meses.map((m) => {
    let fat = 0, res = 0, tem = false;
    for (const mp of mapas) { const x = mp.get(m); if (x) { tem = true; fat += x.dre.faturamento_bruto; res += x.dre.resultado_liquido; } }
    const [a, mm] = m.split("-").map(Number);
    return { mes: m, rotulo: `${MESES_ABBR[mm - 1]}/${String(a).slice(2)}`, faturamento: fat, resultado: res, tem };
  });
}

/** Os N meses "AAAA-MM" que terminam em `ate` (inclusive). */
export function mesesAte(ate: string, n: number): string[] {
  const [a, m] = ate.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(a, m - 1 - (n - 1 - i), 1));
    return k(d.getUTCFullYear(), d.getUTCMonth() + 1);
  });
}

/** Variação % entre dois valores (null quando a base é zero). */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

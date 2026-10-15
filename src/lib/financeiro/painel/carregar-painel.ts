// LavSync · Financeiro · Painel Geral inteligente — carga do mês (server)
//
// Monta tudo o que o Painel Geral mostra para UM mês (?mes=AAAA-MM) e um
// escopo (unidade ou consolidado):
//   · DRE do mês, do anterior, do mesmo mês do ano passado e dos 12 meses —
//     sempre pelo motor único (carregarDadosDRE + calcularDREPeriodo/serieMensal);
//   · ponto de equilíbrio por mês (calcularBreakEven do engine, com o rbt12 da
//     mesma projeção que o DRE usa);
//   · vendas da janela de 12 meses numa consulta paginada por unidade (fuso BR):
//     ciclos e ticket por mês, faturamento por dia, por dia da semana e o mix
//     lavagem × secagem;
//   · custo e margem de contribuição por ciclo (margem-engine);
//   · payback no ritmo dos últimos 3 meses fechados × projetado da franqueadora;
//   · qualidade do dado (custos pagos × estimados).
// Recebe o client de quem chama (sessão do usuário — RLS).
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { paginarTodos } from "@/lib/supabase/pagination";
import { nowBR } from "@/lib/timezone-br";
import { carregarDadosDRE } from "../dre-dados";
import {
  calcularDREPeriodo, serieMensal, mesesAte, tituloPeriodo,
  type DadosDREUnidade, type DREPeriodoResultado,
} from "../dre-periodo";
import { projetar60Meses, mapearDespesasReais, calcularBreakEven, type ProjecaoMes } from "../engine";
import { calcularMargemContribuicao } from "../margem-engine";
import { getEngenhariaCustos } from "../margem-queries";
import { getProjecaoAtiva } from "../projecao/queries";
import { GRUPOS_CUSTO, type Projecao } from "../projecao/tipos";
import type {
  PainelDados, TotaisMesPainel, MesSeriePainel, LinhaCustoPainel, DiaPainel,
  DiaSemanaPainel, MixPainel, UnidadeComparativo, CiclosPainel, PaybackPainel,
  QualidadePainel, ProjecaoFechamento, EscopoPainel,
} from "./tipos";

export const ESCOPO_CONSOLIDADO = "consolidado";

const MESES_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const BR_MS = 3 * 3600_000;

const chave = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}`;
const partes = (k: string) => k.split("-").map(Number) as [number, number];
const rotulo = (k: string) => { const [a, m] = partes(k); return `${MESES_ABBR[m - 1]}/${String(a).slice(2)}`; };
const somaMeses = (k: string, n: number) => {
  const [a, m] = partes(k);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return chave(d.getUTCFullYear(), d.getUTCMonth() + 1);
};
const diffMeses = (de: string, ate: string) => {
  const [a1, m1] = partes(de); const [a2, m2] = partes(ate);
  return (a2 - a1) * 12 + (m2 - m1);
};
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Normaliza ?mes= (AAAA-MM). Inválido ou ausente = mês corrente BR. */
export function lerMesPainel(v: unknown): string {
  const h = nowBR();
  const atual = chave(h.ano, h.mes);
  if (typeof v !== "string" || !/^\d{4}-\d{2}$/.test(v)) return atual;
  const [a, m] = partes(v);
  if (a < 2020 || a > 2100 || m < 1 || m > 12) return atual;
  return v;
}

// ─── Helpers de DRE (sempre o motor único) ────────────────────────────────

function dreMes(dados: DadosDREUnidade[], k: string): DREPeriodoResultado {
  const [ano, numero] = partes(k);
  return calcularDREPeriodo(dados, { tipo: "mensal", ano, numero });
}

function totais(r: DREPeriodoResultado, k: string): TotaisMesPainel {
  const t = r.totais;
  const tem = r.meses_com_dados.length > 0;
  return {
    mes: k, tem,
    faturamento: r2(t.faturamento), simples: r2(t.simples), csp: r2(t.csp), royalties: r2(t.royalties),
    fixos: r2(t.fixos), variaveis: r2(t.variaveis), despesas: r2(t.despesas), resultado: r2(t.resultado),
    margem: tem && t.faturamento > 0 ? t.margem : null,
  };
}

/** Mesma projeção (rbt12 e mês da operação) que o DRE usa — base do ponto de equilíbrio. */
function projecaoDaUnidade(d: DadosDREUnidade): ProjecaoMes[] | null {
  if (!d.ano_inauguracao || !d.mes_inauguracao) return null;
  const custos = [
    ...d.custos_fixos.map((c) => ({ descricao: c.descricao, ativo: c.ativo, tipo: "fixo" })),
    ...d.custos_variaveis.map((c) => ({ descricao: c.descricao, ativo: c.ativo, tipo: c.tipo })),
  ];
  const overridesPorMes = new Map<string, Map<string, number>>();
  for (const [k, itens] of Object.entries(d.despesas_por_mes)) {
    overridesPorMes.set(k, mapearDespesasReais(custos, itens.map((x) => ({ descricao: x.descricao, categoria: x.categoria_nome, valor: x.valor }))));
  }
  const lancamentos = new Map<number, number>();
  for (const [k, fat] of Object.entries(d.faturamento_por_mes)) {
    const [a, m] = partes(k);
    const idx = (a - d.ano_inauguracao) * 12 + (m - d.mes_inauguracao) + 1;
    if (idx >= 1 && idx <= 60) lancamentos.set(idx, fat);
  }
  return projetar60Meses({
    mes_inicio: d.mes_inauguracao, ano_inicio: d.ano_inauguracao,
    potencial_faturamento: d.potencial_faturamento,
    custos_fixos: d.custos_fixos, custos_variaveis: d.custos_variaveis,
    investimento_total: d.investimento_total, lancamentos, overridesPorMes,
  });
}

function pontoEquilibrioUnidade(d: DadosDREUnidade, proj: ProjecaoMes[] | null, k: string): number | null {
  if (!proj || !d.ano_inauguracao || !d.mes_inauguracao) return null;
  const [a, m] = partes(k);
  const idx = (a - d.ano_inauguracao) * 12 + (m - d.mes_inauguracao) + 1;
  const p = proj[idx - 1];
  if (!p) return null;
  return calcularBreakEven({
    custos_fixos: d.custos_fixos, custos_variaveis: d.custos_variaveis,
    mes_index: idx, rbt12: p.rbt12, investimento_total: d.investimento_total,
  });
}

// ─── Projeção da franqueadora ─────────────────────────────────────────────

type MapaProjetado = Map<string, { faturamento: number; resultado: number }>;

/** Faturamento e resultado projetados por mês do calendário — mesmas chaves
 *  canônicas do comparativo (faturamento/resultado); sem a linha "resultado",
 *  resultado = faturamento − linhas de custo (GRUPOS_CUSTO). */
function mapaProjetado(p: Projecao): MapaProjetado {
  const out: MapaProjetado = new Map();
  const fat = p.linhas.find((l) => l.chave === "faturamento");
  const res = p.linhas.find((l) => l.chave === "resultado");
  const custos = res ? [] : p.linhas.filter((l) => GRUPOS_CUSTO.includes(l.grupo));
  const base = chave(p.mes1_ano, p.mes1_mes);
  const n = Math.max(fat?.valores.length ?? 0, res?.valores.length ?? 0);
  for (let i = 0; i < n; i++) {
    const f = Number(fat?.valores[i]) || 0;
    const r = res ? Number(res.valores[i]) || 0 : f - custos.reduce((s, l) => s + (Number(l.valores[i]) || 0), 0);
    out.set(somaMeses(base, i), { faturamento: f, resultado: r });
  }
  return out;
}

// ─── Vendas (uma consulta paginada por unidade) ───────────────────────────

type Venda = { data_venda: string; valor: number | string; tipo_servico: string | null; quantidade_ciclos: number | string | null };
type AgregadoMes = { ciclos: number; faturamento: number; lav: number; sec: number; fatLav: number; fatSec: number; ind: number; fatInd: number; combo: boolean };
type VendasUnidade = {
  porMes: Map<string, AgregadoMes>;
  porDia: Map<number, { faturamento: number; ciclos: number }>;   // só do mês filtrado
};

async function carregarVendas(sb: SupabaseClient, unidadeId: string, inicio: string, fimExclusivo: string, mesFiltro: string): Promise<VendasUnidade> {
  const [ai, mi] = partes(inicio); const [af, mf] = partes(fimExclusivo);
  // 00:00 BR = 03:00 UTC
  const ini = new Date(Date.UTC(ai, mi - 1, 1, 3)).toISOString();
  const fim = new Date(Date.UTC(af, mf - 1, 1, 3)).toISOString();
  const rows = await paginarTodos<Venda>((r) =>
    sb.from("vendas")
      .select("data_venda, valor, tipo_servico, quantidade_ciclos")
      .eq("unidade_id", unidadeId)
      .eq("situacao", "sucesso")
      .gte("data_venda", ini)
      .lt("data_venda", fim)
      .order("id")
      .range(r.from, r.to),
  );
  const porMes = new Map<string, AgregadoMes>();
  const porDia = new Map<number, { faturamento: number; ciclos: number }>();
  for (const v of rows) {
    const d = new Date(Date.parse(v.data_venda) - BR_MS);
    const k = chave(d.getUTCFullYear(), d.getUTCMonth() + 1);
    const ciclos = Number(v.quantidade_ciclos) || 1;
    const valor = Number(v.valor) || 0;
    const a = porMes.get(k) ?? { ciclos: 0, faturamento: 0, lav: 0, sec: 0, fatLav: 0, fatSec: 0, ind: 0, fatInd: 0, combo: false };
    a.ciclos += ciclos; a.faturamento += valor;
    // Mesmo rateio do margem-queries: combo dividido 50/50
    if (v.tipo_servico === "lavagem") { a.lav += ciclos; a.fatLav += valor; }
    else if (v.tipo_servico === "secagem") { a.sec += ciclos; a.fatSec += valor; }
    else if (v.tipo_servico === "combo") {
      a.lav += Math.ceil(ciclos / 2); a.sec += Math.floor(ciclos / 2);
      a.fatLav += valor / 2; a.fatSec += valor / 2; a.combo = true;
    } else {
      // 'indefinido' (default da coluna) ou vazio: conta no total, fora do mix
      a.ind += ciclos; a.fatInd += valor;
    }
    porMes.set(k, a);
    if (k === mesFiltro) {
      const dia = d.getUTCDate();
      const x = porDia.get(dia) ?? { faturamento: 0, ciclos: 0 };
      x.faturamento += valor; x.ciclos += ciclos;
      porDia.set(dia, x);
    }
  }
  return { porMes, porDia };
}

// ─── Loader principal ─────────────────────────────────────────────────────

export async function carregarPainel(
  sb: SupabaseClient,
  args: { unidades: Array<{ id: string; nome: string }>; escopo: string; mes: string },
): Promise<PainelDados | null> {
  const { unidades } = args;
  if (unidades.length === 0) return null;
  const consolidado = args.escopo === ESCOPO_CONSOLIDADO && unidades.length > 1;
  const alvo = consolidado ? unidades : unidades.filter((u) => u.id === args.escopo);
  if (alvo.length === 0) return null;
  const ids = alvo.map((u) => u.id);
  const escopo: EscopoPainel = consolidado
    ? { tipo: "consolidado", unidade_id: null, rotulo: `Consolidado · ${alvo.length} unidades` }
    : { tipo: "unidade", unidade_id: alvo[0].id, rotulo: alvo[0].nome };

  const h = nowBR();
  const mesAtual = chave(h.ano, h.mes);
  const ultimoFechado = somaMeses(mesAtual, -1);
  const hoje = `${mesAtual}-${String(h.dia).padStart(2, "0")}`;
  const mes = args.mes;
  const mesCorrente = mes === mesAtual;
  const meses12 = mesesAte(mes, 12);

  const [dados, vendas, engenharias, projecoes] = await Promise.all([
    carregarDadosDRE(sb, ids),
    Promise.all(ids.map((id) => carregarVendas(sb, id, meses12[0], somaMeses(mes, 1), mes))),
    Promise.all(ids.map((id) => getEngenhariaCustos(id).catch(() => null))),
    Promise.all(ids.map((id) => getProjecaoAtiva(sb, id).catch(() => null))),
  ]);

  // ── DRE: mês, anterior, ano anterior e 12 meses (motor único)
  const mesAnterior = somaMeses(mes, -1);
  const mesAnoAnterior = somaMeses(mes, -12);
  const dreAtual = dreMes(dados, mes);
  const dreAnterior = dreMes(dados, mesAnterior);
  const atual = totais(dreAtual, mes);
  const anterior = totais(dreAnterior, mesAnterior);
  const anoAnterior = totais(dreMes(dados, mesAnoAnterior), mesAnoAnterior);
  const dres12 = meses12.map((k) => (k === mes ? dreAtual : k === mesAnterior ? dreAnterior : dreMes(dados, k)));

  // ── Ponto de equilíbrio por mês (soma das unidades)
  const projs = dados.map(projecaoDaUnidade);
  const peMes = (k: string): number | null => {
    let soma = 0, algum = false;
    dados.forEach((d, i) => {
      const v = pontoEquilibrioUnidade(d, projs[i], k);
      if (v != null) { soma += v; algum = true; }
    });
    return algum ? r2(soma) : null;
  };

  // ── Projeção da franqueadora (consolidado só quando todas as unidades têm)
  const mapas = projecoes.map((p) => (p ? mapaProjetado(p) : null));
  const temProjecao = mapas.length > 0 && mapas.every((m) => m != null);
  const projetadoMes = (k: string): { faturamento: number; resultado: number } | null => {
    if (!temProjecao) return null;
    let fat = 0, res = 0, algum = false;
    for (const m of mapas) { const x = m!.get(k); if (x) { fat += x.faturamento; res += x.resultado; algum = true; } }
    return algum ? { faturamento: r2(fat), resultado: r2(res) } : null;
  };

  // ── Vendas agregadas no escopo
  const vendasMes = (k: string) => {
    let ciclos = 0, fat = 0, tem = false;
    for (const v of vendas) { const a = v.porMes.get(k); if (a) { ciclos += a.ciclos; fat += a.faturamento; tem = true; } }
    return tem ? { ciclos, fat } : null;
  };

  const serie: MesSeriePainel[] = meses12.map((k, i) => {
    const t = totais(dres12[i], k);
    const v = vendasMes(k);
    const proj = projetadoMes(k);
    return {
      mes: k, rotulo: rotulo(k), tem: t.tem,
      faturamento: t.faturamento, resultado: t.resultado, margem: t.margem,
      despesas_pct: t.tem && t.faturamento > 0 ? (t.despesas / t.faturamento) * 100 : null,
      ponto_equilibrio: peMes(k),
      ciclos: v ? v.ciclos : null,
      ticket_ciclo: v && v.ciclos > 0 ? r2(v.fat / v.ciclos) : null,
      projetado_faturamento: proj?.faturamento ?? null,
      projetado_resultado: proj?.resultado ?? null,
    };
  });

  // ── Linhas de custo do mês (com o mês anterior para comparação)
  const valorAnterior = new Map(dreAnterior.linhas.map((l) => [l.chave, -l.total]));
  const temAnterior = dreAnterior.meses_com_dados.length > 0;
  const linhas: LinhaCustoPainel[] = [];
  for (const l of dreAtual.linhas) {
    const g = l.grupo;
    let grupo: LinhaCustoPainel["grupo"] | null = null;
    if (l.chave === "simples") grupo = "simples";
    else if (l.chave === "roy") grupo = "royalties";
    else if (g === "csp" || g === "fixo" || g === "variavel") grupo = g;
    if (!grupo) continue;
    const valor = -l.total;
    if (Math.abs(valor) < 0.005) continue;
    linhas.push({
      chave: l.chave, descricao: l.chave === "simples" ? "Simples Nacional" : l.chave === "roy" ? "Royalties" : l.descricao,
      grupo, valor: r2(valor),
      anterior: temAnterior && valorAnterior.has(l.chave) ? r2(valorAnterior.get(l.chave)!) : null,
      origem: grupo === "simples" || grupo === "royalties" ? "calculado" : (l.origem ?? "estimado"),
    });
  }
  linhas.sort((a, b) => b.valor - a.valor);

  // ── Qualidade do dado (o que é lançável: CSP, fixos e variáveis)
  const qualidade: QualidadePainel = { total: 0, pago: 0, parcial: 0, estimado: 0, pct_pago: 0, linhas_estimadas: [] };
  for (const l of linhas) {
    if (l.origem === "calculado") continue;
    qualidade.total += l.valor;
    if (l.origem === "real") qualidade.pago += l.valor;
    else if (l.origem === "parcial") qualidade.parcial += l.valor;
    else { qualidade.estimado += l.valor; qualidade.linhas_estimadas.push(l.descricao); }
  }
  qualidade.pct_pago = qualidade.total > 0 ? (qualidade.pago / qualidade.total) * 100 : 0;

  // ── Ciclos, ticket, custo e margem de contribuição por ciclo
  let ciclos: CiclosPainel | null = null;
  const vAtual = vendasMes(mes);
  if (vAtual) {
    let lav = 0, sec = 0, ind = 0, custo = 0, mc = 0, ciclosEng = 0, fatEng = 0;
    const semEng: string[] = [];
    vendas.forEach((v, i) => {
      const a = v.porMes.get(mes);
      if (!a) return;
      lav += a.lav; sec += a.sec; ind += a.ind;
      const eng = engenharias[i];
      if (!eng) { semEng.push(alvo[i].nome); return; }
      const m = calcularMargemContribuicao(eng, a.lav, a.sec, a.fatLav, a.fatSec);
      custo += m.custoTotalInsumosMes; mc += m.margemContribuicaoMes;
      ciclosEng += a.lav + a.sec; fatEng += a.fatLav + a.fatSec;
    });
    ciclos = {
      total: vAtual.ciclos, lavagem: lav, secagem: sec, indefinido: ind,
      faturamento_vendas: r2(vAtual.fat),
      ticket_ciclo: vAtual.ciclos > 0 ? r2(vAtual.fat / vAtual.ciclos) : null,
      custo_ciclo: ciclosEng > 0 ? custo / ciclosEng : null,
      mc_ciclo: ciclosEng > 0 ? mc / ciclosEng : null,
      mc_pct: fatEng > 0 ? (mc / fatEng) * 100 : null,
      unidades_sem_engenharia: semEng,
    };
  }
  const vAnt = vendasMes(mesAnterior);
  const ciclos_anterior = vAnt ? { total: vAnt.ciclos, ticket_ciclo: vAnt.ciclos > 0 ? r2(vAnt.fat / vAnt.ciclos) : null } : null;

  // ── Mix lavagem × secagem
  let mix: MixPainel | null = null;
  if (vAtual) {
    mix = { lavagem: { ciclos: 0, faturamento: 0 }, secagem: { ciclos: 0, faturamento: 0 }, indefinido: { ciclos: 0, faturamento: 0 }, combo_rateado: false };
    for (const v of vendas) {
      const a = v.porMes.get(mes);
      if (!a) continue;
      mix.lavagem.ciclos += a.lav; mix.lavagem.faturamento += a.fatLav;
      mix.secagem.ciclos += a.sec; mix.secagem.faturamento += a.fatSec;
      mix.indefinido.ciclos += a.ind; mix.indefinido.faturamento += a.fatInd;
      if (a.combo) mix.combo_rateado = true;
    }
    mix.lavagem.faturamento = r2(mix.lavagem.faturamento);
    mix.secagem.faturamento = r2(mix.secagem.faturamento);
    mix.indefinido.faturamento = r2(mix.indefinido.faturamento);
  }

  // ── Dias do mês e dias da semana
  const [anoF, mesF] = partes(mes);
  const diasNoMes = new Date(Date.UTC(anoF, mesF, 0)).getUTCDate();
  const futuroAPartir = mesCorrente ? h.dia + 1 : mes > mesAtual ? 1 : diasNoMes + 1;
  const dias: DiaPainel[] = Array.from({ length: diasNoMes }, (_, i) => {
    const dia = i + 1;
    let fat = 0, cic = 0;
    for (const v of vendas) { const x = v.porDia.get(dia); if (x) { fat += x.faturamento; cic += x.ciclos; } }
    return {
      dia, data: `${mes}-${String(dia).padStart(2, "0")}`,
      dow: new Date(Date.UTC(anoF, mesF - 1, dia)).getUTCDay(),
      faturamento: r2(fat), ciclos: cic, futuro: dia >= futuroAPartir,
      // Hoje ainda não terminou: aparece no gráfico, mas fora de média/melhor/pior/dia da semana
      parcial: mesCorrente && dia === h.dia,
    };
  });
  const dias_semana: DiaSemanaPainel[] = DIAS_SEMANA.map((rot, dow) => {
    const ds = dias.filter((d) => d.dow === dow && !d.futuro && !d.parcial);
    const total = ds.reduce((s, d) => s + d.faturamento, 0);
    return { dow, rotulo: rot, total: r2(total), ocorrencias: ds.length, media: ds.length > 0 ? r2(total / ds.length) : 0 };
  });
  // Segunda primeiro (semana comercial)
  dias_semana.push(dias_semana.shift()!);

  // ── Projeção de fechamento (mês corrente: ritmo dos dias completos)
  let fechamento: ProjecaoFechamento | null = null;
  if (mesCorrente) {
    const completos = h.dia - 1;
    if (completos >= 1) {
      const fatCompletos = dias.filter((d) => d.dia <= completos).reduce((s, d) => s + d.faturamento, 0);
      const ritmo = fatCompletos / completos;
      fechamento = {
        dias_decorridos: completos, dias_mes: diasNoMes, ritmo_diario: r2(ritmo),
        faturamento_previsto: r2(fatCompletos + ritmo * (diasNoMes - completos)),
      };
    }
  }

  // ── Payback (real até o mês filtrado × projetado da franqueadora)
  const inaug = dados
    .filter((d) => d.ano_inauguracao && d.mes_inauguracao)
    .map((d) => chave(d.ano_inauguracao!, d.mes_inauguracao!))
    .sort();
  const primeiro_mes = inaug[0] ?? null;
  const investimento = dados.reduce((s, d) => s + d.investimento_total, 0);
  let acumulado = 0;
  let ritmo: number | null = null, mesesRitmo = 0;
  const refRitmo = mes < ultimoFechado ? mes : ultimoFechado;
  if (primeiro_mes && diffMeses(primeiro_mes, mes) >= 0) {
    const n = Math.min(120, diffMeses(primeiro_mes, mes) + 1);
    const hist = serieMensal(dados, mesesAte(mes, n));
    // Só meses FECHADOS: o mês corrente parcial não abate o investimento e
    // depois volta a contar como mês restante (mes_estimado parte de refRitmo)
    acumulado = hist.filter((x) => x.tem && x.mes <= refRitmo).reduce((s, x) => s + x.resultado, 0);
    const fechados = hist.filter((x) => x.tem && x.mes <= refRitmo).slice(-3);
    mesesRitmo = fechados.length;
    if (mesesRitmo > 0) ritmo = fechados.reduce((s, x) => s + x.resultado, 0) / mesesRitmo;
  }
  const falta = Math.max(0, investimento - acumulado);
  let mesesRestantes: number | null = null;
  if (investimento > 0 && falta === 0) mesesRestantes = 0;
  else if (ritmo != null && ritmo > 0) mesesRestantes = Math.ceil(falta / ritmo);
  let projetadoPayback: string | null = null;
  if (temProjecao && investimento > 0) {
    const invProj = projecoes.reduce((s, p, i) => s + (p?.investimento?.total || dados[i].investimento_total), 0);
    const todos = new Set<string>();
    for (const m of mapas) for (const k of m!.keys()) todos.add(k);
    let acc = 0;
    for (const k of [...todos].sort()) {
      acc += projetadoMes(k)?.resultado ?? 0;
      if (acc >= invProj) { projetadoPayback = k; break; }
    }
  }
  const payback: PaybackPainel = {
    investimento: r2(investimento), acumulado: r2(acumulado),
    pct: investimento > 0 ? (acumulado / investimento) * 100 : 0,
    falta: r2(falta), ritmo_3m: ritmo != null ? r2(ritmo) : null, meses_ritmo: mesesRitmo,
    meses_restantes: mesesRestantes,
    mes_estimado: mesesRestantes != null && mesesRestantes > 0 ? somaMeses(refRitmo, mesesRestantes) : null,
    projetado_mes: projetadoPayback,
  };

  // ── Comparativo das unidades (consolidado)
  let comparativo: UnidadeComparativo[] | null = null;
  if (consolidado) {
    comparativo = dados.map((d, i) => {
      const t = totais(dreMes([d], mes), mes);
      const pe = pontoEquilibrioUnidade(d, projs[i], mes);
      return {
        unidade_id: d.unidade_id, nome: alvo[i].nome, tem: t.tem,
        faturamento: t.faturamento, resultado: t.resultado, margem: t.margem,
        ponto_equilibrio: pe != null ? r2(pe) : null,
        pct_equilibrio: pe && pe > 0 && t.tem ? (t.faturamento / pe) * 100 : null,
      };
    }).sort((a, b) => b.faturamento - a.faturamento);
  }

  const projAtual = projetadoMes(mes);
  return {
    mes, titulo: tituloPeriodo({ tipo: "mensal", ano: anoF, numero: mesF }).titulo,
    mes_atual: mesAtual, ultimo_fechado: ultimoFechado, hoje, mes_corrente: mesCorrente,
    primeiro_mes, escopo, unidades,
    atual, anterior, ano_anterior: anoAnterior,
    linhas, serie,
    ponto_equilibrio: peMes(mes),
    ciclos, ciclos_anterior, payback, qualidade,
    dias, dias_semana, mix,
    projetado: projAtual,
    projecao_nome: temProjecao ? (alvo.length === 1 ? projecoes[0]!.nome : "Projeções da franqueadora") : null,
    comparativo, fechamento,
  };
}

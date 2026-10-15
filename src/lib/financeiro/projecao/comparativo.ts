// LavSync · Financeiro · Projetado da franqueadora × Real — comparativo
//
// O REAL vem do motor único do DRE (calcularDREPeriodo mensal sobre
// carregarDadosDRE): faturamento das vendas no fuso BR, despesas pagas na
// competência ou % de referência (marcado como estimado). Só meses FECHADOS
// entram no real (o mês corrente está em aberto).
//
// Mês 1 da projeção = mes1_ano/mes1_mes. Consolidado soma as unidades por mês
// do calendário; o acumulado só compara meses em que a unidade tem real. No
// consolidado mes_index é só a posição na linha do tempo (as unidades podem ter
// mês 1 diferentes), então os textos citam o mês do calendário.
// Payback real = no ritmo dos 3 últimos meses com real. Insights
// determinísticos: acumulado, descolamento da rampa, meses abaixo de 50%,
// faturamento necessário para recuperar o payback, método do Simples da
// franqueadora × lei, linhas de custo com desvio > 2 p.p. e ROI.
// Puro (sem server-only): a carga dos dados fica em actions/queries.

import { calcularDREPeriodo, type DadosDREUnidade } from "../dre-periodo";
import { normDesc } from "../engine";
import { simplesPorMetodo } from "./calculo";
import {
  GRUPOS_CUSTO, N_MESES, chaveMesDoIndice, infoChave,
  type ComparativoMes, type ComparativoProjecao, type LinhaProjecao, type Projecao,
} from "./tipos";

export type EntradaComparativo = { projecao: Projecao; dados: DadosDREUnidade };

const HREF = "/financeiro?aba=projecao";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (v: number, casas = 0) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
const r2 = (v: number) => Math.round(v * 100) / 100;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ─── Linhas do nosso DRE → chaves canônicas ──────────────────────────────

/** Classifica um custo do DRE (fixo/variável) numa chave canônica pela descrição. */
export function chaveDoCustoReal(descricao: string): string {
  const n = normDesc(descricao);
  const tem = (...s: string[]) => s.some((x) => n.includes(x));
  if (tem("fundo de propaganda", "fundo de publicidade", "publicidade e propaganda", "fundo de marketing")) return "fundo_propaganda";
  if (tem("royalt")) return "royalties";
  if (tem("aluguel", "iptu", "condominio")) return "aluguel";
  if (tem("energia", "luz", "eletrica")) return "energia";
  if (tem("agua", "esgoto", "copasa", "saneamento")) return "agua";
  if (tem("telefone", "internet", "telecom")) return "telefone";
  if (tem("contador", "contabil", "contabilidade")) return "contador";
  if (tem("software", "sistema", "assinatura")) return "software";
  if (tem("seguro")) return "seguro";
  if (tem("cartao", "maquininha", "adquirente", "meios de pagamento")) return "taxa_cartao";
  if (tem("bancari", "tarifa", "banco")) return "servicos_bancarios";
  if (tem("publicidade", "marketing", "propaganda", "anuncio", "trafego")) return "marketing_local";
  if (tem("material", "materiais", "limpeza", "consumo")) return "materiais";
  if (tem("salario", "folha", "pessoal", "encargo", "funcionario", "pro-labore", "pro labore", "beneficio")) return "pessoal";
  return "outras_despesas";
}

type RealMes = { faturamento: number; resultado: number; linhas: Record<string, number>; estimadas: Set<string> };

/** DRE real de um mês fechado de uma unidade, pelo motor do DRE (null sem faturamento real). */
function realDoMes(dados: DadosDREUnidade, chaveMes: string): RealMes | null {
  const [ano, mes] = chaveMes.split("-").map(Number);
  const dre = calcularDREPeriodo([dados], { tipo: "mensal", ano, numero: mes });
  if (dre.meses_com_dados.length === 0) return null;
  const linhas: Record<string, number> = {};
  const estimadas = new Set<string>();
  const add = (k: string, v: number) => { linhas[k] = r2((linhas[k] ?? 0) + v); };
  for (const l of dre.linhas) {
    const v = -(l.valores[0] ?? 0);                    // custos vêm negativos no DRE
    let k: string | null = null;
    if (l.chave === "simples") k = "simples";
    else if (l.chave === "roy") k = "royalties";
    else if (l.chave.startsWith("csp:")) k = "csp";
    else if (l.chave.startsWith("fixo:") || l.chave.startsWith("variavel:")) k = chaveDoCustoReal(l.descricao);
    if (!k) continue;
    add(k, v);
    if (l.origem && l.origem !== "real" && Math.abs(v) > 0.005) estimadas.add(k);
  }
  return { faturamento: dre.totais.faturamento, resultado: dre.totais.resultado, linhas, estimadas };
}

/** Valor projetado de cada linha (sem indicadores) no índice 1..60. */
function projetadoNoIndice(linhas: LinhaProjecao[], idx: number): { faturamento: number; resultado: number; linhas: Record<string, number> } {
  const out: Record<string, number> = {};
  let fat = 0, res = 0;
  for (const l of linhas) {
    const v = l.valores[idx - 1] ?? 0;
    if (l.chave === "faturamento") fat = v;
    else if (l.chave === "resultado") res = v;
    if (l.grupo !== "indicador") out[l.chave] = v;
  }
  if (!linhas.some((l) => l.chave === "resultado")) {
    res = fat - linhas.filter((l) => GRUPOS_CUSTO.includes(l.grupo)).reduce((s, l) => s + (l.valores[idx - 1] ?? 0), 0);
    out.resultado = res;
  }
  return { faturamento: fat, resultado: res, linhas: out };
}

/** Reta resultado = a·faturamento + b ajustada na própria projeção (meses com faturamento). */
function retaResultado(pares: Array<{ f: number; r: number }>): { a: number; b: number } | null {
  const p = pares.filter((x) => x.f > 0);
  if (p.length < 3) return null;
  const mf = p.reduce((s, x) => s + x.f, 0) / p.length;
  const mr = p.reduce((s, x) => s + x.r, 0) / p.length;
  const sxx = p.reduce((s, x) => s + (x.f - mf) ** 2, 0);
  if (sxx <= 0) return null;
  const a = p.reduce((s, x) => s + (x.f - mf) * (x.r - mr), 0) / sxx;
  return a > 0 ? { a, b: mr - a * mf } : null;
}

const ROTULO_CHAVE = (k: string, linhas: LinhaProjecao[]) =>
  linhas.find((l) => l.chave === k)?.descricao ?? infoChave(k)?.descricao ?? k;

// ─── Montagem ────────────────────────────────────────────────────────────

export function montarComparativo(escopo: string, entradas: EntradaComparativo[], hoje: { ano: number; mes: number }): ComparativoProjecao | null {
  if (entradas.length === 0) return null;
  const mesAtual = `${hoje.ano}-${String(hoje.mes).padStart(2, "0")}`;
  const unico = entradas.length === 1;
  const hrefEscopo = unico ? `${HREF}&unidade=${entradas[0].projecao.unidade_id}` : HREF;

  // Linha do tempo (calendário) e acumuladores por mês
  type Celula = { proj: { faturamento: number; resultado: number; linhas: Record<string, number> }; real: RealMes | null; projComReal: { fat: number; res: number } };
  const porMes = new Map<string, Celula>();
  type SerieUnidade = { nome: string; projecao: Projecao; pontos: Array<{ idx: number; chave: string; fatProj: number; fatReal: number }> };
  const series: SerieUnidade[] = [];
  const somaProjLinha = new Map<string, number>(), somaRealLinha = new Map<string, number>();
  const linhasEstimadas = new Set<string>();
  let fatProjPar = 0, fatRealPar = 0, resProjPar = 0, resRealPar = 0;

  for (const { projecao, dados } of entradas) {
    const serie: SerieUnidade = { nome: dados.unidade_nome, projecao, pontos: [] };
    for (let idx = 1; idx <= N_MESES; idx++) {
      const chave = chaveMesDoIndice(projecao.mes1_ano, projecao.mes1_mes, idx);
      const proj = projetadoNoIndice(projecao.linhas, idx);
      const cel = porMes.get(chave) ?? { proj: { faturamento: 0, resultado: 0, linhas: {} }, real: null, projComReal: { fat: 0, res: 0 } };
      cel.proj.faturamento += proj.faturamento;
      cel.proj.resultado += proj.resultado;
      for (const [k, v] of Object.entries(proj.linhas)) cel.proj.linhas[k] = r2((cel.proj.linhas[k] ?? 0) + v);

      const real = chave < mesAtual ? realDoMes(dados, chave) : null;
      if (real) {
        const acc = cel.real ?? { faturamento: 0, resultado: 0, linhas: {}, estimadas: new Set<string>() };
        acc.faturamento += real.faturamento;
        acc.resultado += real.resultado;
        for (const [k, v] of Object.entries(real.linhas)) acc.linhas[k] = r2((acc.linhas[k] ?? 0) + v);
        real.estimadas.forEach((k) => acc.estimadas.add(k));
        cel.real = acc;
        cel.projComReal.fat += proj.faturamento;
        cel.projComReal.res += proj.resultado;
        fatProjPar += proj.faturamento; fatRealPar += real.faturamento;
        resProjPar += proj.resultado; resRealPar += real.resultado;
        for (const [k, v] of Object.entries(proj.linhas)) somaProjLinha.set(k, (somaProjLinha.get(k) ?? 0) + v);
        for (const [k, v] of Object.entries(real.linhas)) somaRealLinha.set(k, (somaRealLinha.get(k) ?? 0) + v);
        real.estimadas.forEach((k) => linhasEstimadas.add(k));
        serie.pontos.push({ idx, chave, fatProj: proj.faturamento, fatReal: real.faturamento });
      }
      porMes.set(chave, cel);
    }
    series.push(serie);
  }

  const chaves = [...porMes.keys()].sort();
  const meses: ComparativoMes[] = chaves.map((chave, i) => {
    const c = porMes.get(chave)!;
    return {
      mes_index: i + 1,
      chave_mes: chave,
      projetado: { faturamento: r2(c.proj.faturamento), resultado: r2(c.proj.resultado), linhas: c.proj.linhas },
      real: c.real ? {
        faturamento: r2(c.real.faturamento), resultado: r2(c.real.resultado), linhas: c.real.linhas, estimado: c.real.estimadas.size > 0,
      } : null,
    };
  });

  // Rótulo de um índice: por unidade "mês N"; no consolidado, o mês do calendário
  const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const rotIdx = (idx: number): string => {
    if (unico || chaves.length === 0) return `mês ${idx}`;
    const [a0, m0] = chaves[0].split("-").map(Number);
    const [a, m] = chaveMesDoIndice(a0, m0, idx).split("-").map(Number);
    return `${MESES_CURTOS[m - 1]}/${String(a).slice(2)}`;
  };

  const acumulado = {
    fat_proj: r2(fatProjPar), fat_real: r2(fatRealPar), res_proj: r2(resProjPar), res_real: r2(resRealPar),
    pct_atingido: fatProjPar > 0 ? r2((fatRealPar / fatProjPar) * 100) : 0,
  };

  // ─── Payback ───
  const investimento = r2(entradas.reduce((s, e) => s + (e.projecao.investimento?.total || e.dados.investimento_total || 0), 0));
  let projetado_mes: number | null = null;
  { let acc = 0; for (const m of meses) { acc += m.projetado.resultado; if (investimento > 0 && acc >= investimento) { projetado_mes = m.mes_index; break; } } }

  const comReal = meses.filter((m) => m.real);
  let real_estimado_mes: number | null = null;
  let ritmo = 0, faltaRecuperar = investimento;
  if (investimento > 0 && comReal.length > 0) {
    let acc = 0;
    for (const m of comReal) { acc += m.real!.resultado; if (acc >= investimento && real_estimado_mes == null) real_estimado_mes = m.mes_index; }
    faltaRecuperar = investimento - acc;
    const ult = comReal.slice(-3);
    ritmo = ult.reduce((s, m) => s + m.real!.resultado, 0) / ult.length;
    if (real_estimado_mes == null && ritmo > 0) real_estimado_mes = comReal[comReal.length - 1].mes_index + Math.ceil(faltaRecuperar / ritmo);
  }

  // ─── Insights ───
  const insights: ComparativoProjecao["insights"] = [];
  const nMesesReal = comReal.length;

  if (nMesesReal === 0) {
    insights.push({ tom: "neutro", texto: "Ainda não há mês fechado com faturamento real dentro do período da projeção — a comparação começa no primeiro mês fechado.", href: hrefEscopo });
  } else {
    const p = acumulado.pct_atingido;
    insights.push({
      tom: p >= 95 ? "positivo" : p < 80 ? "negativo" : "neutro",
      texto: `Em ${nMesesReal} ${nMesesReal === 1 ? "mês fechado" : "meses fechados"}, o faturamento real somou ${brl(fatRealPar)} contra ${brl(fatProjPar)} projetados pela franqueadora (${pct(p)} do projetado; diferença de ${brl(fatRealPar - fatProjPar)}).`,
      href: hrefEscopo,
    });
  }

  // Descolamento da rampa e salto da franqueadora (por unidade)
  for (const s of series) {
    const pts = s.pontos.filter((x) => x.fatProj > 0).map((x) => ({ ...x, pct: x.fatReal / x.fatProj }));
    if (pts.length < 2) continue;
    const pre = unico ? "" : `${s.nome}: `;
    let d = -1;
    for (let i = 0; i < pts.length; i++) if (pts.slice(i).every((x) => x.pct < 0.7)) { d = i; break; }
    if (d > 0) {
      const antes = pts.slice(0, d), depois = pts.slice(d);
      const faixa = (v: typeof pts, sep: string) => { const ps = v.map((x) => x.pct * 100); return `${pct(Math.min(...ps))}${sep}${pct(Math.max(...ps))}`; };
      insights.push({ tom: "negativo", texto: cap(`${pre}acompanhou a rampa da franqueadora até o mês ${antes[antes.length - 1].idx} (${faixa(antes, " a ")} do projetado) e descolou a partir do mês ${depois[0].idx}: desde então ficou entre ${faixa(depois, " e ")} do projetado.`) });
    } else if (d === 0) {
      insights.push({ tom: "negativo", texto: cap(`${pre}o faturamento real ficou abaixo de 70% do projetado em todos os ${pts.length} meses comparados.`) });
    } else if (pts.every((x) => x.pct >= 0.9)) {
      insights.push({ tom: "positivo", texto: cap(`${pre}o faturamento acompanha a rampa da franqueadora em todos os ${pts.length} meses comparados (90% ou mais do projetado).`) });
    }
    const rampa = s.projecao.linhas.find((l) => l.chave === "percentual_potencial")?.valores ?? s.projecao.premissas?.rampa;
    if (rampa) {
      for (const x of pts) {
        const salto = (rampa[x.idx - 1] ?? 0) - (rampa[x.idx - 2] ?? rampa[x.idx - 1] ?? 0);
        if (x.idx > 1 && salto > 0.15 && x.pct < 0.6) {
          insights.push({ tom: "negativo", texto: cap(`${pre}no mês ${x.idx} a franqueadora salta para ${pct((rampa[x.idx - 1] ?? 0) * 100)} do potencial (${brl(x.fatProj)}); o real ficou em ${brl(x.fatReal)} (${pct(x.pct * 100)}).`) });
        }
      }
    }
  }

  // Meses abaixo de 50%
  {
    const baixos = comReal.filter((m) => m.projetado.faturamento > 0 && m.real!.faturamento / m.projetado.faturamento < 0.5);
    if (baixos.length > 0) {
      const lista = baixos.map((m) => (unico ? String(m.mes_index) : rotIdx(m.mes_index)));
      insights.push({ tom: "negativo", texto: `${baixos.length} de ${nMesesReal} meses ficaram abaixo de 50% do faturamento projetado (${unico ? "meses " : ""}${lista.length > 8 ? `${lista.slice(0, 8).join(", ")} e mais ${lista.length - 8}` : lista.join(", ")}).` });
    }
  }

  // Faturamento necessário para recuperar o payback projetado
  if (investimento > 0 && nMesesReal > 0) {
    const ultimo = comReal[comReal.length - 1].mes_index;
    if (faltaRecuperar <= 0) {
      insights.push({ tom: "positivo", texto: `O investimento de ${brl(investimento)} já foi recuperado no real (${rotIdx(real_estimado_mes!)}${projetado_mes ? `; a franqueadora projetava ${rotIdx(projetado_mes)}` : ""}).` });
    } else if (projetado_mes != null && projetado_mes > ultimo) {
      const restantes = projetado_mes - ultimo;
      const resNecessario = faltaRecuperar / restantes;
      const reta = retaResultado(meses.map((m) => ({ f: m.projetado.faturamento, r: m.projetado.resultado })));
      const fatNecessario = reta ? (resNecessario - reta.b) / reta.a : null;
      const ult3 = comReal.slice(-3);
      const fatMedio = ult3.reduce((s, m) => s + m.real!.faturamento, 0) / ult3.length;
      insights.push({
        tom: "negativo",
        texto: `Para recuperar o investimento em ${rotIdx(projetado_mes)}, como a franqueadora projeta, faltam ${brl(faltaRecuperar)} em ${restantes} meses: resultado de ${brl(resNecessario)} por mês`
          + (fatNecessario && fatNecessario > 0 ? `, o que pede cerca de ${brl(fatNecessario)} de faturamento mensal pelas margens do próprio estudo` : "")
          + ` — contra média de ${brl(fatMedio)} nos últimos ${ult3.length} meses.`
          + (real_estimado_mes ? ` No ritmo atual, o payback fica em ${rotIdx(real_estimado_mes)}.` : " No ritmo atual, o resultado não paga o investimento."),
        href: hrefEscopo,
      });
    } else if (projetado_mes != null) {
      insights.push({ tom: "negativo", texto: `O payback projetado (${rotIdx(projetado_mes)}) já passou; faltam ${brl(faltaRecuperar)} para recuperar o investimento.`
        + (real_estimado_mes ? ` No ritmo dos últimos meses, ele vem em ${rotIdx(real_estimado_mes)}.` : " No ritmo atual, o resultado não paga o investimento.") });
    }
  }

  // Método do Simples: franqueadora × lei
  let simples_divergente = false;
  for (const { projecao, dados } of entradas) {
    if (projecao.premissas?.metodo_simples !== "franqueadora") continue;
    const fat = projecao.linhas.find((l) => l.chave === "faturamento")?.valores;
    if (!fat) continue;
    const franq = simplesPorMetodo(fat, "franqueadora"), lei = simplesPorMetodo(fat, "legal");
    const dif = lei.reduce((s, v, i) => s + v - franq[i], 0);
    if (Math.abs(dif) <= 1) continue;
    simples_divergente = true;
    let mx = 0;
    lei.forEach((v, i) => { if (Math.abs(v - franq[i]) > Math.abs(lei[mx] - franq[mx])) mx = i; });
    insights.push({
      tom: "negativo",
      texto: `${unico ? "A" : `${dados.unidade_nome}: a`} franqueadora calcula o Simples com RBT12 = faturamento do próprio mês × 12; a lei (LC 123, art. 18) usa a receita dos 12 meses anteriores. `
        + `No mês ${mx + 1} da projeção isso dá ${brl(franq[mx])} pelo método dela contra ${brl(lei[mx])} pela lei; pela lei, o imposto dos 60 meses fica ${brl(Math.abs(dif))} ${dif > 0 ? "acima" : "abaixo"} do que o estudo mostra.`,
      href: hrefEscopo,
    });
  }

  // Linhas de custo com desvio > 2 p.p. do faturamento
  if (fatProjPar > 0 && fatRealPar > 0) {
    const refLinhas = entradas[0].projecao.linhas;
    const ks = new Set([...somaProjLinha.keys(), ...somaRealLinha.keys()]);
    const desvios: Array<{ k: string; pp: number; pr: number; rr: number; vp: number; vr: number }> = [];
    for (const k of ks) {
      if (k === "faturamento" || k === "resultado" || k === "fluxo_acumulado" || k === "percentual_potencial") continue;
      if (!somaRealLinha.has(k)) continue;   // custo que o nosso DRE não modela: sem base real para comparar
      const vp = somaProjLinha.get(k) ?? 0, vr = somaRealLinha.get(k) ?? 0;
      const pr = (vp / fatProjPar) * 100, rr = (vr / fatRealPar) * 100;
      if (Math.abs(rr - pr) > 2) desvios.push({ k, pp: rr - pr, pr, rr, vp, vr });
    }
    desvios.sort((a, b) => Math.abs(b.pp) - Math.abs(a.pp));
    for (const d of desvios.slice(0, 5)) {
      const n = Math.max(1, nMesesReal);
      insights.push({
        tom: d.pp > 0 ? "negativo" : "positivo",
        texto: `${ROTULO_CHAVE(d.k, refLinhas)}: ${pct(d.rr, 1)} do faturamento no real contra ${pct(d.pr, 1)} no projetado (${d.pp > 0 ? "+" : ""}${d.pp.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.; média de ${brl(d.vr / n)} contra ${brl(d.vp / n)} por mês)`
          + (linhasEstimadas.has(d.k) ? " — real estimado pelo % de referência em parte dos meses." : "."),
        href: hrefEscopo,
      });
    }
  }

  // ROI real × projetado no mesmo período
  if (investimento > 0 && nMesesReal > 0) {
    const roiR = (resRealPar / investimento) * 100, roiP = (resProjPar / investimento) * 100;
    insights.push({
      tom: roiR >= roiP ? "positivo" : "negativo",
      texto: `Retorno sobre o investimento acumulado nos ${nMesesReal} meses: ${pct(roiR, 1)} no real contra ${pct(roiP, 1)} projetado (resultado de ${brl(resRealPar)} contra ${brl(resProjPar)}).`,
    });
  }

  return {
    escopo,
    unidades: entradas.map((e) => e.dados.unidade_nome),
    meses,
    acumulado,
    payback: { projetado_mes, real_estimado_mes, investimento },
    insights,
    simples_divergente,
  };
}

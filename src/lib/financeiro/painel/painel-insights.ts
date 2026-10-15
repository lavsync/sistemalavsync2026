// LavSync · Financeiro · Painel Geral — motor de insights (puro, testável)
//
// Recebe os dados já calculados do mês (PainelDados) e devolve frases
// determinísticas em pt-BR, cada uma com número, base de comparação e uma ação
// sugerida. Nada de IA aqui: mesma entrada, mesma saída. Sem dado = sem frase
// (nunca inventa número). Usado pela tela e pode ser usado pelo CLOCK.
import type { PainelDados, InsightPainel, TomInsight } from "./tipos";

const MESES_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function rotuloMes(k: string): string {
  const [a, m] = k.split("-").map(Number);
  return `${MESES_ABBR[m - 1]}/${String(a).slice(2)}`;
}

export function fmtReais(n: number, casas = 0): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function fmtPct(n: number, casas = 1): string {
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

const variacao = (a: number, b: number): number | null => (b ? ((a - b) / Math.abs(b)) * 100 : null);
const sinal = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");
const pctAbs = (n: number) => fmtPct(Math.abs(n));

/** Limiar de "mudou de verdade" para faturamento (abaixo disso é estável). */
const LIMIAR_PCT = 3;

export function gerarInsights(d: PainelDados): InsightPainel[] {
  const out: InsightPainel[] = [];
  const add = (i: InsightPainel) => out.push(i);
  const q = (aba: string) => {
    const p = new URLSearchParams({ aba });
    if (d.escopo.tipo === "unidade") p.set("unidade", d.escopo.unidade_id);
    return `/financeiro?${p.toString()}`;
  };
  const a = d.atual;
  const nomeMes = rotuloMes(d.mes);

  // Sem faturamento no mês: um único aviso honesto
  if (!a.tem) {
    add({
      id: "sem-dados", tom: "neutro", peso: 100, titulo: "Mês sem faturamento",
      texto: d.mes > d.mes_atual
        ? `${nomeMes} ainda não começou. Escolha um mês com vendas para ver a análise.`
        : `Não há vendas nem faturamento lançado em ${nomeMes}. Os indicadores aparecem assim que o mês tiver dados.`,
      acao: { rotulo: "Lançar faturamento", href: q("config") },
    });
    return out;
  }

  // Base do mês: no corrente usa a projeção de fechamento (comparar mês parcial engana)
  const fech = d.mes_corrente ? d.fechamento : null;
  const fatBase = fech ? fech.faturamento_previsto : a.faturamento;
  const rotBase = fech ? "a projeção de fechamento" : "o faturamento";
  // Dia 1 do mês corrente: sem dia completo não há previsão, e o parcial de
  // poucas horas não pode ser comparado com meses cheios
  const semBase = d.mes_corrente && !fech;

  if (semBase) {
    add({
      id: "mes-inicio", tom: "neutro", peso: 95, titulo: "Mês em andamento",
      texto: `${nomeMes} começou hoje: ainda não há dia completo para projetar o fechamento. As comparações com outros meses aparecem a partir de amanhã.`,
      acao: { rotulo: "Ver vendas do dia", href: "/performance" },
    });
  }

  // 1. Projeção de fechamento (mês corrente)
  if (fech) {
    const v = d.anterior.tem ? variacao(fech.faturamento_previsto, d.anterior.faturamento) : null;
    add({
      id: "fechamento", tom: v == null ? "neutro" : v >= 0 ? "positivo" : "negativo", peso: 95,
      titulo: "Projeção de fechamento",
      texto: `No ritmo de ${fmtReais(fech.ritmo_diario)}/dia (${fech.dias_decorridos} dias completos), ${nomeMes} fecha em cerca de ${fmtReais(fech.faturamento_previsto)}`
        + (v != null ? `, ${sinal(v)}${pctAbs(v)} vs ${rotuloMes(d.anterior.mes)}.` : "."),
      acao: { rotulo: "Ver vendas do dia", href: "/performance" },
    });
  }

  // 2. Evolução vs mês anterior (mês fechado)
  if (!d.mes_corrente && d.anterior.tem) {
    const v = variacao(a.faturamento, d.anterior.faturamento);
    if (v != null) {
      const tom: TomInsight = v >= LIMIAR_PCT ? "positivo" : v <= -LIMIAR_PCT ? "negativo" : "neutro";
      add({
        id: "vs-anterior", tom, peso: 90,
        titulo: tom === "positivo" ? "Faturamento em alta" : tom === "negativo" ? "Faturamento em queda" : "Faturamento estável",
        texto: `${nomeMes} faturou ${fmtReais(a.faturamento)}, ${sinal(v)}${pctAbs(v)} vs ${rotuloMes(d.anterior.mes)} (${fmtReais(d.anterior.faturamento)}).`,
        acao: tom === "negativo" ? { rotulo: "Ver vendas e ciclos", href: "/performance" } : undefined,
      });
    }
  }

  // 3. Mesmo mês do ano anterior
  if (!semBase && d.ano_anterior.tem) {
    const v = variacao(fatBase, d.ano_anterior.faturamento);
    if (v != null) {
      add({
        id: "vs-ano", tom: v >= LIMIAR_PCT ? "positivo" : v <= -LIMIAR_PCT ? "negativo" : "neutro", peso: 70,
        titulo: "Comparado ao ano passado",
        texto: `${fech ? "A projeção de " + nomeMes : nomeMes} está ${sinal(v)}${pctAbs(v)} vs ${rotuloMes(d.ano_anterior.mes)} (${fmtReais(d.ano_anterior.faturamento)}).`,
      });
    }
  }

  // 4. Tendência dos últimos 3 meses fechados
  const fechados = d.serie.filter((s) => s.tem && s.mes <= d.ultimo_fechado);
  const ult = fechados.slice(-3);
  if (ult.length === 3) {
    const v1 = variacao(ult[1].faturamento, ult[0].faturamento);
    const v2 = variacao(ult[2].faturamento, ult[1].faturamento);
    if (v1 != null && v2 != null) {
      const periodo = `${ult[0].rotulo} a ${ult[2].rotulo}`;
      if (v1 > 0 && v2 > 0) {
        add({
          id: "tendencia", tom: "positivo", peso: 60,
          titulo: v2 > v1 ? "Crescimento acelerando" : "Dois meses seguidos de alta",
          texto: `Faturamento subiu ${fmtPct(v1)} e depois ${fmtPct(v2)} (${periodo})${v2 > v1 ? " — o ritmo de crescimento aumentou." : ", com o ritmo desacelerando."}`,
        });
      } else if (v1 < 0 && v2 < 0) {
        add({
          id: "tendencia", tom: "negativo", peso: 75,
          titulo: v2 < v1 ? "Queda acelerando" : "Dois meses seguidos de queda",
          texto: `Faturamento caiu ${pctAbs(v1)} e depois ${pctAbs(v2)} (${periodo}). Hora de agir em captação e retenção.`,
          acao: { rotulo: "Ver indicadores", href: "/metricas" },
        });
      }
    }
  }

  // 5. Distância do ponto de equilíbrio
  if (!semBase && d.ponto_equilibrio != null && d.ponto_equilibrio > 0) {
    const dif = fatBase - d.ponto_equilibrio;
    const pct = (fatBase / d.ponto_equilibrio) * 100;
    add({
      id: "equilibrio", tom: dif >= 0 ? "positivo" : "negativo", peso: dif >= 0 ? 55 : 92,
      titulo: dif >= 0 ? "Acima do ponto de equilíbrio" : "Abaixo do ponto de equilíbrio",
      texto: dif >= 0
        ? `${fech ? "A projeção de fechamento" : "O faturamento"} está ${fmtReais(dif)} acima do equilíbrio de ${fmtReais(d.ponto_equilibrio)} (${fmtPct(pct, 0)} do necessário).`
        : `Faltam ${fmtReais(-dif)} para o equilíbrio de ${fmtReais(d.ponto_equilibrio)}: ${rotBase} cobre ${fmtPct(pct, 0)} do necessário.`,
      acao: dif < 0 ? { rotulo: "Revisar custos", href: q("config") } : undefined,
    });
  }

  // 6. Margem líquida (p.p. vs anterior) — só mês fechado
  if (!d.mes_corrente && a.margem != null && d.anterior.margem != null) {
    const pp = a.margem - d.anterior.margem;
    if (Math.abs(pp) >= 2) {
      add({
        id: "margem", tom: pp > 0 ? "positivo" : "negativo", peso: 65,
        titulo: pp > 0 ? "Margem melhorou" : "Margem piorou",
        texto: `Margem líquida de ${fmtPct(a.margem)} em ${nomeMes}, ${sinal(pp)}${Math.abs(pp).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p. vs ${rotuloMes(d.anterior.mes)}.`,
        acao: { rotulo: "Abrir DRE do mês", href: q("dre") },
      });
    }
  }

  // 7. Custo que mais subiu
  const subidas = d.linhas
    .filter((l) => l.anterior != null && l.anterior > 0 && l.grupo !== "simples")
    .map((l) => ({ l, dif: l.valor - (l.anterior as number), pct: ((l.valor - (l.anterior as number)) / (l.anterior as number)) * 100 }))
    .filter((x) => x.dif >= 50 && x.pct >= 10)
    .sort((x, y) => y.dif - x.dif);
  if (subidas[0]) {
    const { l, dif, pct } = subidas[0];
    add({
      id: "custo-subiu", tom: "negativo", peso: 68,
      titulo: "Custo que mais subiu",
      texto: `${l.descricao} foi a ${fmtReais(l.valor)}, ${fmtReais(dif)} (+${fmtPct(pct, 0)}) acima de ${rotuloMes(d.anterior.mes)}${l.origem === "estimado" ? " — valor ainda estimado" : ""}.`,
      acao: { rotulo: "Ver no DRE", href: q("dre") },
    });
  }

  // 8. Dia da semana mais fraco
  const dsValidos = d.dias_semana.filter((x) => x.ocorrencias >= 2);
  if (dsValidos.length >= 5) {
    const media = dsValidos.reduce((s, x) => s + x.media, 0) / dsValidos.length;
    const fraco = [...dsValidos].sort((x, y) => x.media - y.media)[0];
    const forte = [...dsValidos].sort((x, y) => y.media - x.media)[0];
    if (media > 0 && fraco.media < media * 0.75) {
      const gap = (1 - fraco.media / media) * 100;
      add({
        id: "dia-fraco", tom: "neutro", peso: 45,
        titulo: "Dia da semana mais fraco",
        texto: `${nomeSemana(fraco.dow)} rendem em média ${fmtReais(fraco.media)}, ${fmtPct(gap, 0)} abaixo da média diária; ${nomeSemana(forte.dow).toLowerCase()} lideram com ${fmtReais(forte.media)}. Espaço para promoção no dia fraco.`,
        acao: { rotulo: "Ver performance", href: "/performance" },
      });
    }
  }

  // 9. Gap vs projetado da franqueadora
  if (!semBase && d.projetado && d.projetado.faturamento > 0) {
    const v = variacao(fatBase, d.projetado.faturamento)!;
    add({
      id: "vs-projetado", tom: v >= 0 ? "positivo" : v <= -5 ? "negativo" : "neutro", peso: 80,
      titulo: "Projetado pela franqueadora",
      texto: `${fech ? "A projeção de fechamento" : "O faturamento"} está ${sinal(v)}${pctAbs(v)} vs o projetado de ${fmtReais(d.projetado.faturamento)} para ${nomeMes}.`,
      acao: { rotulo: "Projetado × real", href: q("projecao") },
    });
  }

  // 10. Payback
  const pb = d.payback;
  if (pb.investimento > 0 && pb.meses_restantes != null && pb.meses_restantes > 0 && pb.mes_estimado) {
    let comp = "";
    let tom: TomInsight = "neutro";
    if (pb.projetado_mes) {
      const atraso = mesesEntre(pb.projetado_mes, pb.mes_estimado);
      comp = atraso > 0 ? `, ${atraso} ${atraso === 1 ? "mês" : "meses"} depois do projetado (${rotuloMes(pb.projetado_mes)})`
        : atraso < 0 ? `, ${-atraso} ${atraso === -1 ? "mês" : "meses"} antes do projetado (${rotuloMes(pb.projetado_mes)})` : ", no prazo projetado";
      tom = atraso > 0 ? "negativo" : "positivo";
    }
    add({
      id: "payback", tom, peso: 50, titulo: "Retorno do investimento",
      texto: `${fmtPct(pb.pct)} do investimento recuperado. No ritmo de ${fmtReais(pb.ritmo_3m ?? 0)}/mês (média de ${pb.meses_ritmo} ${pb.meses_ritmo === 1 ? "mês" : "meses"}), o payback chega em ${rotuloMes(pb.mes_estimado)}${comp}.`,
    });
  } else if (pb.investimento > 0 && pb.ritmo_3m != null && pb.ritmo_3m <= 0 && pb.falta > 0) {
    add({
      id: "payback", tom: "negativo", peso: 72, titulo: "Payback parado",
      texto: `Resultado médio de ${fmtReais(pb.ritmo_3m)}/mês nos últimos ${pb.meses_ritmo} meses: nesse ritmo o investimento (faltam ${fmtReais(pb.falta)}) não se paga.`,
      acao: { rotulo: "Abrir DRE", href: q("dre") },
    });
  }

  // 11. Dado estimado
  if (d.qualidade.total > 0 && d.qualidade.pct_pago < 100) {
    const est = 100 - d.qualidade.pct_pago;
    add({
      id: "qualidade", tom: d.qualidade.pct_pago < 50 ? "negativo" : "neutro", peso: d.qualidade.pct_pago < 50 ? 58 : 30,
      titulo: "Custos ainda estimados",
      texto: `${fmtPct(est, 0)} dos custos de ${nomeMes} (${fmtReais(d.qualidade.estimado + d.qualidade.parcial)}) ainda são estimativa${d.qualidade.linhas_estimadas.length > 0 ? `: ${d.qualidade.linhas_estimadas.slice(0, 3).join(", ")}${d.qualidade.linhas_estimadas.length > 3 ? "…" : ""}` : ""}. Lance os valores pagos para o resultado ficar exato.`,
      acao: { rotulo: "Lançar despesas", href: q("config") },
    });
  }

  return out.sort((x, y) => y.peso - x.peso);
}

const NOMES_SEMANA = ["Domingos", "Segundas", "Terças", "Quartas", "Quintas", "Sextas", "Sábados"];
function nomeSemana(dow: number): string { return NOMES_SEMANA[dow] ?? ""; }

function mesesEntre(de: string, ate: string): number {
  const [a1, m1] = de.split("-").map(Number); const [a2, m2] = ate.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}

/** Pergunta pronta para o CLOCK sobre o mês filtrado. */
export function perguntaClock(d: PainelDados): string {
  const a = d.atual;
  const partes = [
    `Analise o financeiro de ${d.titulo.toLowerCase()} (${d.escopo.rotulo}).`,
    a.tem ? `Faturamento ${fmtReais(a.faturamento)}, resultado ${fmtReais(a.resultado)}${a.margem != null ? ` (margem ${fmtPct(a.margem)})` : ""}.` : "O mês ainda não tem faturamento.",
    d.ponto_equilibrio ? `Ponto de equilíbrio ${fmtReais(d.ponto_equilibrio)}.` : "",
    "O que explica esse resultado, quais os maiores riscos e que 3 ações você recomenda para o próximo mês?",
  ];
  return partes.filter(Boolean).join(" ");
}

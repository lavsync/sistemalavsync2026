// LavSync · Financeiro · Leitura automática do DRE (texto para sócios)
//
// Determinística: só afirma o que os números mostram — evolução contra o
// período anterior, maiores pesos de custo, linhas que mais subiram/caíram e
// quanto do DRE é valor pago × estimado.

import { variacao, type DREPeriodoResultado } from "./dre-periodo";

const brl = (n: number) =>
  `R$ ${Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number, casas = 1) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;

export type Destaque = { tom: "positivo" | "negativo" | "neutro"; texto: string };

export function analisarDRE(atual: DREPeriodoResultado, anterior: DREPeriodoResultado | null): Destaque[] {
  const out: Destaque[] = [];
  const t = atual.totais;

  if (atual.meses_com_dados.length === 0) {
    return [{ tom: "neutro", texto: "Não há faturamento real registrado neste período." }];
  }

  // Resultado e margem
  out.push({
    tom: t.resultado >= 0 ? "positivo" : "negativo",
    texto: t.resultado >= 0
      ? `O período fechou com lucro de ${brl(t.resultado)}, margem líquida de ${pct(t.margem)} sobre o faturamento.`
      : `O período fechou com prejuízo de ${brl(t.resultado)} (margem de ${pct(t.margem)}).`,
  });

  // Evolução contra o período anterior
  if (anterior && anterior.meses_com_dados.length > 0) {
    const a = anterior.totais;
    const vf = variacao(t.faturamento, a.faturamento);
    if (vf != null) {
      out.push({
        tom: vf >= 0 ? "positivo" : "negativo",
        texto: `Faturamento ${vf >= 0 ? "cresceu" : "caiu"} ${pct(Math.abs(vf))} contra ${anterior.titulo.toLowerCase()} (de ${brl(a.faturamento)} para ${brl(t.faturamento)}).`,
      });
    }
    const dr = t.resultado - a.resultado;
    if (Math.abs(dr) >= 1) {
      out.push({
        tom: dr >= 0 ? "positivo" : "negativo",
        texto: `Resultado líquido ${dr >= 0 ? "melhorou" : "piorou"} ${brl(dr)} no comparativo; a margem foi de ${pct(a.margem)} para ${pct(t.margem)} (${t.margem - a.margem >= 0 ? "+" : "−"}${pct(Math.abs(t.margem - a.margem))} p.p.).`,
      });
    }

    // Linhas de custo que mais mudaram
    const custos = atual.linhas.filter((l) => ["csp", "fixo", "variavel", "royalties"].includes(l.grupo));
    const mudancas = custos.map((l) => {
      const ant = anterior.linhas.find((x) => x.chave === l.chave);
      return { l, delta: -(l.total) - -(ant?.total ?? 0) };
    }).filter((x) => Math.abs(x.delta) >= 50).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, 2);
    for (const m of mudancas) {
      out.push({
        tom: m.delta > 0 ? "negativo" : "positivo",
        texto: `${m.l.descricao.replace(/^\(.\)\s*/, "")} ${m.delta > 0 ? "subiu" : "caiu"} ${brl(m.delta)} contra o período anterior.`,
      });
    }
  } else {
    out.push({ tom: "neutro", texto: "Sem dados no período anterior para comparativo." });
  }

  // Maior peso de custo
  const custos = atual.linhas.filter((l) => ["csp", "fixo", "variavel", "royalties"].includes(l.grupo) && l.total < 0)
    .sort((x, y) => x.total - y.total);
  if (custos[0] && t.faturamento > 0) {
    out.push({
      tom: "neutro",
      texto: `Maior custo do período: ${custos[0].descricao} (${brl(custos[0].total)}, ${pct((-custos[0].total / t.faturamento) * 100)} do faturamento).`,
    });
  }

  // Ponto de equilíbrio aproximado
  const custoFixoPeriodo = t.fixos + t.royalties;
  const variavelSobreFat = t.faturamento > 0 ? (t.simples + t.csp + t.variaveis) / t.faturamento : 0;
  if (variavelSobreFat < 1 && custoFixoPeriodo > 0) {
    const equilibrio = custoFixoPeriodo / (1 - variavelSobreFat);
    const meses = Math.max(1, atual.meses_com_dados.length);
    out.push({
      tom: t.faturamento >= equilibrio ? "positivo" : "negativo",
      texto: `Ponto de equilíbrio estimado: ${brl(equilibrio / meses)} de faturamento por mês (realizado: ${brl(t.faturamento / meses)} por mês).`,
    });
  }

  // Qualidade do dado
  const estimadas = atual.linhas.filter((l) => l.origem === "estimado" || l.origem === "parcial");
  if (estimadas.length > 0) {
    out.push({
      tom: "neutro",
      texto: `${estimadas.length} ${estimadas.length === 1 ? "linha de custo usa" : "linhas de custo usam"} estimativa pelo % de referência (marcadas com *). Lance os valores pagos em Financeiro › Configurações para fechar o DRE com dado real.`,
    });
  }
  if (atual.meses_sem_dados.length > 0) {
    out.push({ tom: "neutro", texto: `Meses do período sem faturamento registrado (unidade ainda não operava ou sem importação): ${atual.meses_sem_dados.map((m) => m.split("-").reverse().join("/")).join(", ")}.` });
  }
  return out;
}

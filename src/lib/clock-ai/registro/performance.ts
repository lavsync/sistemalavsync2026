// LavSync · CLOCK v2 · Registro · Performance (evolução mensal e mix)
//
// Série de até 24 meses com evolução/involução mês a mês, dias da semana
// (últimos 30 dias a partir da última venda, como na tela), meios de
// pagamento e cupons/vouchers do mês. Ticket médio = faturamento ÷ ciclos.
import "server-only";
import {
  getEvolucaoMensal, getPorDiaSemana, getFaturamentoPorPagamento, getCuponsUsados, getVouchersUsados, parseMesRef,
} from "@/lib/vendas-queries";
import type { DefConsulta } from "./tipos";
import { resolverUnidades, inteiro, mesRef, r2, variacaoPct } from "./comum";

const evolucaoMensal: DefConsulta = {
  id: "evolucao_mensal",
  modulo: "performance",
  descricao:
    "Série mensal (padrão 12 meses) de faturamento, ciclos, clientes e ticket médio (= faturamento ÷ ciclos) com a variação de cada mês contra o anterior; " +
    "mais faturamento por dia da semana (últimos 30 dias), por meio de pagamento e cupons/vouchers do mês de referência.",
  permissao: "performance.view",
  params: {
    type: "object",
    properties: {
      unidade: { type: "string", description: "Nome ou id da unidade. Vazio = todas as liberadas." },
      meses: { type: "integer", description: "Quantidade de meses na série (1 a 24, padrão 12)" },
      mes: { type: "string", description: "Mês de referência AAAA-MM para pagamento/cupons (padrão: mês atual)" },
    },
  },
  async executar(ctx, p) {
    const us = resolverUnidades(ctx, p.unidade);
    const ids = us.map((u) => u.id);
    const meses = inteiro(p, "meses", 12, 1, 24);
    const ref = mesRef(p, "mes");
    const refDate = parseMesRef(ref ? ref.slice(0, 7) : null);

    const serie = await getEvolucaoMensal(ids, meses);
    const porDia = await getPorDiaSemana(ids, refDate);
    const pagamento = await getFaturamentoPorPagamento(ids, refDate);
    const cupons = await getCuponsUsados(ids, refDate);
    const vouchers = await getVouchersUsados(ids, refDate);

    const linhas = serie.map((m, i) => {
      const ant = i > 0 ? serie[i - 1] : null;
      return {
        mes: m.mes,
        faturamento: r2(m.faturamento),
        ciclos: m.ciclos,
        clientes: m.clientes,
        ticket_medio: m.ciclos ? r2(m.faturamento / m.ciclos) : 0,
        variacao_faturamento_pct: ant ? variacaoPct(m.faturamento, ant.faturamento) : null,
      };
    });
    return {
      unidades: us.map((u) => u.nome),
      base_da_variacao: "cada mês contra o mês anterior",
      serie: linhas,
      por_dia_semana_ultimos_30d: porDia.map((d) => ({ dia: d.dia, faturamento: r2(d.faturamento), clientes: d.clientes })),
      por_pagamento: pagamento.map((s) => ({ meio: s.label, vendas: s.count, valor: r2(s.valor), pct: r2(s.percent) })),
      cupons: { mes: cupons.mesRef, top: cupons.items.slice(0, 8).map((c) => ({ codigo: c.codigo, usos: c.qtd, valor: r2(c.valor), desconto: r2(c.desconto) })) },
      vouchers: { mes: vouchers.mesRef, top: vouchers.items.slice(0, 8).map((v) => ({ codigo: v.codigo, categoria: v.categoria, usos: v.qtd, valor: r2(v.valor) })) },
    };
  },
};

export const CONSULTAS_PERFORMANCE: DefConsulta[] = [evolucaoMensal];

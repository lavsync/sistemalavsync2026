// LavSync · CLOCK v2 · Registro · Comparativo (janela A x janela B)
//
// Reaproveita getAgregado (mesma conta da tela /comparativo) e acrescenta
// ciclos e ticket médio na métrica única do CLOCK (faturamento ÷ ciclos).
import "server-only";
import { getAgregado, type AgregadoJanela } from "@/lib/comparativo/queries";
import type { DefConsulta } from "./tipos";
import { resolverPeriodo, resolverUnidadeUnica, variacaoPct, r2, PERIODOS } from "./comum";
import { lerVendas, agregar } from "./vendas";

const P_PER = (lado: string) => ({ type: "string", enum: [...PERIODOS], description: `Período da janela ${lado}` });

function resumo(a: AgregadoJanela, ciclos: number) {
  return {
    unidade: a.unidadeNome,
    janela: a.rotuloJanela,
    faturamento: r2(a.faturamento),
    vendas: a.qtdVendas,
    ciclos,
    ticket_medio: ciclos ? r2(a.faturamento / ciclos) : 0,
    clientes_unicos: a.cpfsUnicos,
    clientes_novos: a.cpfsNovos,
    cupons_usados: a.cupomUsos,
    vouchers_usados: a.voucherUsos,
    faturamento_lavagem: r2(a.faturamentoLavagem),
    faturamento_secagem: r2(a.faturamentoSecagem),
    dias_com_venda: a.diasUnicos,
    vendas_por_dia: r2(a.vendasPorDia),
    melhor_hora: a.melhorHora,
    melhor_dia_semana: a.melhorDow ? { dia: a.melhorDow.nome, vendas: a.melhorDow.vendas } : null,
  };
}

const compararPeriodos: DefConsulta = {
  id: "comparar_periodos",
  modulo: "comparativo",
  descricao:
    "Compara duas janelas e/ou duas unidades lado a lado (ex.: este mês x mês passado; Buritis x Castelo no mesmo período): faturamento, vendas, ciclos, " +
    "ticket médio (= faturamento ÷ ciclos), clientes únicos e novos, cupons, mix lavagem/secagem, melhor hora e dia. Sem janela B, usa a base justa da janela A.",
  permissao: "comparativo.view",
  params: {
    type: "object",
    properties: {
      unidade_a: { type: "string", description: "Unidade da janela A (nome ou id)" },
      unidade_b: { type: "string", description: "Unidade da janela B (padrão: a mesma de A)" },
      periodo_a: P_PER("A"), de_a: { type: "string" }, ate_a: { type: "string" },
      periodo_b: P_PER("B"), de_b: { type: "string" }, ate_b: { type: "string" },
    },
  },
  async executar(ctx, p) {
    const ua = resolverUnidadeUnica(ctx, p.unidade_a);
    const ub = p.unidade_b ? resolverUnidadeUnica(ctx, p.unidade_b) : ua;
    const ja = resolverPeriodo({ ...p, periodo_a: p.periodo_a ?? "mes" }, "periodo_a", "de_a", "ate_a");
    const temB = p.periodo_b || p.de_b || p.ate_b;
    const jb = temB ? resolverPeriodo(p, "periodo_b", "de_b", "ate_b").atual : ja.base ?? ja.atual;
    const baseDesc = temB ? "janela B informada" : ub.id !== ua.id ? "mesma janela, outra unidade" : ja.base_descricao;
    const janelaB = !temB && ub.id !== ua.id ? ja.atual : jb;

    const A = await getAgregado(ua.id, ja.atual.from, ja.atual.to, ua.nome);
    const B = await getAgregado(ub.id, janelaB.from, janelaB.to, ub.nome);
    const ciclosA = agregar(await lerVendas(ctx, [ua.id], ja.atual.from, ja.atual.to)).ciclos;
    const ciclosB = agregar(await lerVendas(ctx, [ub.id], janelaB.from, janelaB.to)).ciclos;
    const ra = resumo(A, ciclosA), rb = resumo(B, ciclosB);
    return {
      a: { ...ra, intervalo: ja.atual.rotulo },
      b: { ...rb, intervalo: janelaB.rotulo },
      base_da_comparacao: baseDesc,
      variacao_a_sobre_b_pct: {
        faturamento: variacaoPct(ra.faturamento, rb.faturamento),
        ciclos: variacaoPct(ra.ciclos, rb.ciclos),
        ticket_medio: variacaoPct(ra.ticket_medio, rb.ticket_medio),
        clientes_unicos: variacaoPct(ra.clientes_unicos, rb.clientes_unicos),
        vendas: variacaoPct(ra.vendas, rb.vendas),
      },
    };
  },
};

export const CONSULTAS_COMPARATIVO: DefConsulta[] = [compararPeriodos];

// LavSync · CLOCK v2 · Registro · Financeiro
//
// DRE por período (mensal, trimestral, semestral, anual) pela MESMA fonte
// da tela e do PDF (dre-relatorio.ts:montarDRE → dre-periodo.ts), projeção
// de 60 meses com payback e break-even, margem de contribuição por ciclo,
// despesas reais do mês, arquivo de relatórios DRE salvos e o projetado da
// franqueadora × real (projecao/comparativo.ts sobre a sessão).
//
// Escopo "consolidado": para quem enxerga todas as unidades usa montarDRE
// direto; para usuário restrito, consolida SÓ as unidades liberadas a ele
// (montarDRE consolidaria tudo o que a RLS de tenant mostra).
import "server-only";
import { montarDRE, lerPeriodo, ESCOPO_CONSOLIDADO } from "@/lib/financeiro/dre-relatorio";
import { carregarDadosDRE } from "@/lib/financeiro/dre-dados";
import {
  calcularDREPeriodo, periodoAnterior, ultimoPeriodoFechado, tituloPeriodo, variacao,
  type Periodo, type DREPeriodoResultado, type TipoPeriodo,
} from "@/lib/financeiro/dre-periodo";
import { analisarDRE } from "@/lib/financeiro/dre-analise";
import { projetar60Meses, calcularPayback, calcularBreakEven, mapearDespesasReais } from "@/lib/financeiro/engine";
import { getDespesasPorMes } from "@/lib/financeiro/queries";
import { getEngenhariaCustos, getCiclosDoMes } from "@/lib/financeiro/margem-queries";
import { calcularMargemContribuicao } from "@/lib/financeiro/margem-engine";
import { salvarRelatorioDRE, listarRelatoriosDRE, excluirRelatorioDRE } from "@/lib/financeiro/dre-relatorios-actions";
import { nowBR } from "@/lib/timezone-br";
import { getProjecaoAtiva } from "@/lib/financeiro/projecao/queries";
import { montarComparativo } from "@/lib/financeiro/projecao/comparativo";
import type { Projecao } from "@/lib/financeiro/projecao/tipos";
import type { CtxClock, DefAcao, DefConsulta, Params } from "./tipos";
import {
  resolverUnidades, resolverUnidadeUnica, temAcessoTotal, texto, textoObrig, inteiro, umDe, mesRef, mesBR, nomeMesRef, r2, ErroClock,
} from "./comum";

const TIPOS: TipoPeriodo[] = ["mensal", "trimestral", "semestral", "anual"];
const P_ESCOPO = { type: "string", description: "Nome/id da unidade, ou 'consolidado' (todas as liberadas). Padrão: consolidado." };
const P_TIPO = { type: "string", enum: TIPOS, description: "Tipo do período (padrão: mensal)" };
const P_ANO = { type: "integer", description: "Ano (padrão: o do último período fechado)" };
const P_NUM = { type: "integer", description: "Mês 1-12, trimestre 1-4 ou semestre 1-2 (anual: 1). Padrão: último período fechado." };

/** Período pedido ou, sem ano/número, o último FECHADO do tipo (o corrente está em aberto). */
function periodoDe(p: Params): Periodo {
  const tipo = umDe(p, "tipo", TIPOS, "mensal");
  if (p.ano == null && p.numero == null) {
    const { ano, mes } = nowBR();
    return ultimoPeriodoFechado(tipo, { ano, mes });
  }
  const { ano: anoAtual } = nowBR();
  const per = lerPeriodo(tipo, p.ano ?? anoAtual, p.numero ?? 1);
  if (!per) throw new ErroClock("Período inválido: confira tipo, ano e número.");
  return per;
}

type EscopoDRE = { escopo: string; ids: string[]; rotulo: string; consolidado: boolean };

async function escopoDe(ctx: CtxClock, p: Params): Promise<EscopoDRE> {
  const e = texto(p, "escopo") ?? texto(p, "unidade");
  if (!e || ["consolidado", "todas", "rede"].includes(e.toLowerCase())) {
    return { escopo: ESCOPO_CONSOLIDADO, ids: ctx.unidades.map((u) => u.id), rotulo: `Consolidado · ${ctx.unidades.map((u) => u.nome).join(", ")}`, consolidado: true };
  }
  const u = resolverUnidadeUnica(ctx, e);
  return { escopo: u.id, ids: [u.id], rotulo: `Unidade ${u.nome}`, consolidado: false };
}

function totaisDRE(r: DREPeriodoResultado) {
  const t = r.totais;
  return {
    faturamento: r2(t.faturamento), simples: r2(t.simples), receita_liquida: r2(t.receita_liquida), csp: r2(t.csp),
    resultado_bruto: r2(t.resultado_bruto), royalties: r2(t.royalties), fixos: r2(t.fixos), variaveis: r2(t.variaveis),
    despesas: r2(t.despesas), resultado: r2(t.resultado), margem_pct: r2(t.margem), roi_pct: r2(t.roi),
  };
}

const drePeriodo: DefConsulta = {
  id: "dre_periodo",
  modulo: "financeiro",
  descricao:
    "DRE de um período (mensal, trimestral, semestral ou anual), consolidado ou por unidade, contra o período anterior equivalente: faturamento, Simples, " +
    "custos, resultado, margem, ROI, linhas principais (real, parcial ou estimado), meses sem dado e destaques prontos. Sem período, usa o último fechado.",
  permissao: "financeiro.view",
  params: { type: "object", properties: { escopo: P_ESCOPO, tipo: P_TIPO, ano: P_ANO, numero: P_NUM } },
  async executar(ctx, p) {
    const periodo = periodoDe(p);
    const esc = await escopoDe(ctx, p);
    let atual: DREPeriodoResultado, anterior: DREPeriodoResultado, rotulo = esc.rotulo;
    if (!esc.consolidado || (await temAcessoTotal(ctx))) {
      const m = await montarDRE(ctx.sb, esc.escopo, periodo);
      if (!m) throw new ErroClock("Nenhuma unidade encontrada para esse escopo.");
      atual = m.atual; anterior = m.anterior; rotulo = m.escopoRotulo;
    } else {
      const dados = await carregarDadosDRE(ctx.sb, esc.ids);
      atual = calcularDREPeriodo(dados, periodo);
      anterior = calcularDREPeriodo(dados, periodoAnterior(periodo));
    }
    const temAnterior = anterior.meses_com_dados.length > 0;
    const ta = totaisDRE(atual), tb = temAnterior ? totaisDRE(anterior) : null;
    return {
      escopo: rotulo,
      periodo: { ...periodo, titulo: atual.titulo, intervalo: atual.intervalo },
      base: temAnterior ? { descricao: "período anterior equivalente", titulo: anterior.titulo } : null,
      meses_com_dados: atual.meses_com_dados,
      meses_sem_dados: atual.meses_sem_dados,
      totais: ta,
      totais_anterior: tb,
      variacao_pct: tb ? {
        faturamento: variacao(ta.faturamento, tb.faturamento),
        resultado: variacao(ta.resultado, tb.resultado),
        despesas: variacao(ta.despesas, tb.despesas),
      } : null,
      linhas: atual.linhas.filter((l) => l.total !== 0 || l.destaque).map((l) => ({ linha: l.descricao, grupo: l.grupo, total: r2(l.total), origem: l.origem ?? null })),
      destaques: analisarDRE(atual, temAnterior ? anterior : null).map((d) => ({ tom: d.tom, texto: d.texto })),
      pdf_href: `/api/financeiro/dre-pdf?escopo=${encodeURIComponent(esc.escopo)}&tipo=${periodo.tipo}&ano=${periodo.ano}&numero=${periodo.numero}`,
    };
  },
};

const projecaoFinanceira: DefConsulta = {
  id: "projecao_financeira",
  modulo: "financeiro",
  descricao:
    "Projeção de 60 meses da unidade (real onde há faturamento, projetado no resto), payback (investimento, lucro acumulado real, % recuperado, mês previsto) " +
    "e break-even (faturamento mínimo do mês para resultado zero).",
  permissao: "financeiro.view",
  params: { type: "object", properties: { unidade: { type: "string", description: "Nome ou id da unidade" } } },
  async executar(ctx, p) {
    const u = resolverUnidadeUnica(ctx, p.unidade);
    const [d] = await carregarDadosDRE(ctx.sb, [u.id]);
    if (!d || !d.ano_inauguracao || !d.mes_inauguracao) {
      throw new ErroClock(`A unidade ${u.nome} ainda não tem mês de inauguração configurado no Financeiro.`);
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
    const proj = projetar60Meses({
      mes_inicio: d.mes_inauguracao, ano_inicio: d.ano_inauguracao, potencial_faturamento: d.potencial_faturamento,
      custos_fixos: d.custos_fixos, custos_variaveis: d.custos_variaveis, investimento_total: d.investimento_total,
      lancamentos, overridesPorMes,
    });
    const payback = calcularPayback(proj, d.investimento_total);
    const { ano, mes } = nowBR();
    const idxHoje = Math.min(60, Math.max(1, (ano - d.ano_inauguracao) * 12 + (mes - d.mes_inauguracao) + 1));
    const breakEven = calcularBreakEven({
      custos_fixos: d.custos_fixos, custos_variaveis: d.custos_variaveis, mes_index: idxHoje,
      rbt12: proj[idxHoje - 1]?.rbt12 ?? 0, investimento_total: d.investimento_total,
    });
    const reais = proj.filter((x) => x.faturamento_real != null);
    const mesPayback = payback.mes_payback_projetado ? proj[payback.mes_payback_projetado - 1]?.rotulo ?? null : null;
    return {
      unidade: u.nome,
      investimento: r2(d.investimento_total),
      potencial_faturamento_mes: r2(d.potencial_faturamento),
      payback: { ...payback, mes_previsto: mesPayback },
      break_even_mes_atual: breakEven,
      meses_com_faturamento_real: reais.length,
      ultimos_meses_reais: reais.slice(-6).map((x) => ({
        mes: x.rotulo, faturamento: x.faturamento_real, meta: x.faturamento_projetado, pct_da_meta: x.pct_da_meta != null ? r2(x.pct_da_meta) : null,
        resultado: x.resultado_real, status: x.status,
      })),
      proximos_meses_projetados: proj.slice(idxHoje, idxHoje + 6).map((x) => ({ mes: x.rotulo, faturamento: x.faturamento_projetado, resultado: x.resultado_projetado })),
    };
  },
};

const margemContribuicao: DefConsulta = {
  id: "margem_contribuicao",
  modulo: "financeiro",
  descricao:
    "Margem de contribuição por ciclo da unidade num mês (padrão: mês atual): custo de insumos por lavagem e por secagem, margem unitária e %, " +
    "ciclos e faturamento do mês e margem total, a partir da engenharia de custos cadastrada.",
  permissao: "financeiro.view",
  params: { type: "object", properties: { unidade: { type: "string" }, mes: { type: "string", description: "AAAA-MM" } } },
  async executar(ctx, p) {
    const u = resolverUnidadeUnica(ctx, p.unidade);
    const ref = mesRef(p, "mes") ?? mesBR(0);
    const eng = await getEngenhariaCustos(u.id);
    if (!eng) throw new ErroClock(`A unidade ${u.nome} não tem engenharia de custos cadastrada (Financeiro, aba Configurações).`);
    const [a, m] = ref.split("-").map(Number);
    const c = await getCiclosDoMes(u.id, a, m);
    const mg = calcularMargemContribuicao(eng, c.ciclosLavagem, c.ciclosSecagem, c.faturamentoLavagem, c.faturamentoSecagem);
    return {
      unidade: u.nome,
      mes: nomeMesRef(ref),
      por_ciclo: {
        lavagem: { custo: r2(mg.custoLavagem.total), margem: r2(mg.margemUnitariaLavagem), margem_pct: r2(mg.margemPercLavagem) },
        secagem: { custo: r2(mg.custoSecagem.total), margem: r2(mg.margemUnitariaSecagem), margem_pct: r2(mg.margemPercSecagem) },
      },
      mes_total: {
        ciclos_lavagem: mg.ciclosLavagemMes, ciclos_secagem: mg.ciclosSecagemMes,
        faturamento_lavagem: r2(mg.faturamentoLavagemMes), faturamento_secagem: r2(mg.faturamentoSecagemMes),
        custo_insumos: r2(mg.custoTotalInsumosMes), margem_contribuicao: r2(mg.margemContribuicaoMes), margem_pct: r2(mg.margemContribuicaoPctMes),
      },
      overhead_eletrico_mes: r2(mg.overheadCustoMes),
    };
  },
};

const despesasDoMes: DefConsulta = {
  id: "despesas_do_mes",
  modulo: "financeiro",
  descricao: "Despesas reais lançadas na competência (padrão: mês atual) por unidade, somadas por categoria, com as maiores e o que ainda não foi pago.",
  permissao: "financeiro.view",
  params: { type: "object", properties: { unidade: { type: "string", description: "Nome/id ou vazio para todas" }, mes: { type: "string", description: "AAAA-MM" } } },
  async executar(ctx, p) {
    const us = resolverUnidades(ctx, p.unidade);
    const ref = mesRef(p, "mes") ?? mesBR(0);
    const chave = ref.slice(0, 7);
    const porUnidade = [];
    for (const u of us) {
      const mapa = await getDespesasPorMes(u.id);
      const itens = mapa[chave] ?? [];
      const porCat: Record<string, number> = {};
      for (const d of itens) porCat[d.categoria_nome] = r2((porCat[d.categoria_nome] ?? 0) + d.valor);
      porUnidade.push({
        unidade: u.nome,
        total: r2(itens.reduce((s, d) => s + d.valor, 0)),
        lancamentos: itens.length,
        a_pagar: r2(itens.filter((d) => !d.pago_em).reduce((s, d) => s + d.valor, 0)),
        por_categoria: Object.entries(porCat).sort((x, y) => y[1] - x[1]).map(([categoria, valor]) => ({ categoria, valor })),
        maiores: [...itens].sort((x, y) => y.valor - x.valor).slice(0, 5).map((d) => ({ descricao: d.descricao, categoria: d.categoria_nome, valor: r2(d.valor), pago: !!d.pago_em })),
      });
    }
    return { competencia: nomeMesRef(ref), por_unidade: porUnidade };
  },
};

const relatoriosDreSalvos: DefConsulta = {
  id: "relatorios_dre_salvos",
  modulo: "financeiro",
  descricao: "PDFs de DRE já salvos no arquivo (Financeiro, aba Relatórios): escopo, período, quem gerou e quando. Os mais recentes primeiro.",
  permissao: "financeiro.view",
  params: { type: "object", properties: { limite: { type: "integer", description: "Padrão 10" } } },
  async executar(_ctx, p) {
    const lista = await listarRelatoriosDRE();
    const lim = inteiro(p, "limite", 10, 1, 50);
    return {
      total: lista.length,
      relatorios: lista.slice(0, lim).map((r) => ({
        path: r.path, escopo: r.escopo, periodo: tituloPeriodo({ tipo: r.tipo, ano: r.ano, numero: r.numero }).titulo,
        gerado_em: r.gerado_em, gerado_por: r.gerado_por,
      })),
    };
  },
};

const projetadoVsReal: DefConsulta = {
  id: "projetado_vs_real",
  modulo: "financeiro",
  descricao:
    "Projetado pela franqueadora (DRE de 60 meses da venda da franquia) × real do DRE, por unidade ou consolidado: faturamento e resultado acumulados " +
    "nos meses fechados, % do projetado atingido, payback projetado × no ritmo real, últimos meses mês a mês e leituras prontas (descolamento da rampa, " +
    "custos fora do projetado, Simples, ROI). Só meses fechados entram no real.",
  permissao: "financeiro.view",
  params: { type: "object", properties: { escopo: P_ESCOPO } },
  async executar(ctx, p) {
    // Mesmo escopo do DRE: consolidado = SÓ as unidades liberadas ao usuário
    const esc = await escopoDe(ctx, p);
    const ativas = await Promise.all(esc.ids.map((id) => getProjecaoAtiva(ctx.sb, id)));
    const projecoes = ativas.filter((x): x is Projecao => x != null);
    const nome = (id: string) => ctx.unidades.find((u) => u.id === id)?.nome ?? id;
    const semProjecao = esc.ids.filter((_, i) => ativas[i] == null).map(nome);
    if (projecoes.length === 0) {
      return {
        escopo: esc.rotulo, tem_projecao: false,
        mensagem: "Nenhuma projeção da franqueadora ativa nesse escopo. Importe o arquivo em Financeiro, aba Projetado × Real.",
        href: "/financeiro?aba=projecao",
      };
    }
    const dados = await carregarDadosDRE(ctx.sb, projecoes.map((x) => x.unidade_id));
    const { ano, mes } = nowBR();
    const c = montarComparativo(esc.consolidado ? "consolidado" : esc.escopo, projecoes.map((projecao, i) => ({ projecao, dados: dados[i] })), { ano, mes });
    if (!c) throw new ErroClock("Não foi possível montar o comparativo.");
    const realizados = c.meses.filter((m) => m.real);
    const semInauguracao = dados.filter((d) => !d.ano_inauguracao || !d.mes_inauguracao).map((d) => d.unidade_nome);
    return {
      escopo: esc.rotulo,
      tem_projecao: true,
      unidades_comparadas: c.unidades,
      unidades_sem_projecao: semProjecao,
      unidades_sem_inauguracao: semInauguracao,
      mes_index: esc.consolidado ? "posição na linha do tempo do consolidado (cite o mês do calendário)" : "mês da projeção (1 = mês inicial)",
      acumulado: { ...c.acumulado, pct_atingido_unidade: "pontos percentuais" },
      meses_fechados_comparados: realizados.length,
      payback: c.payback,
      ultimos_meses: realizados.slice(-6).map((m) => ({
        mes: m.chave_mes, mes_index: m.mes_index,
        faturamento_projetado: r2(m.projetado.faturamento), faturamento_real: r2(m.real!.faturamento),
        resultado_projetado: r2(m.projetado.resultado), resultado_real: r2(m.real!.resultado),
        custo_estimado: m.real!.estimado,
      })),
      simples_divergente: c.simples_divergente,
      leituras: c.insights.map((i) => ({ tom: i.tom, texto: i.texto })),
      href: esc.consolidado ? "/financeiro?aba=projecao" : `/financeiro?aba=projecao&unidade=${esc.ids[0]}`,
    };
  },
};

// ─── Ações ──────────────────────────────────────────────────────────────────

const gerarPdfDre: DefAcao = {
  id: "gerar_pdf_dre",
  modulo: "financeiro",
  descricao: "Gera o PDF do DRE de um período e escopo e salva no arquivo de relatórios do Financeiro (não altera números).",
  permissao: "financeiro.view",
  risco: "baixo",
  params: { type: "object", properties: { escopo: P_ESCOPO, tipo: P_TIPO, ano: P_ANO, numero: P_NUM } },
  async resumir(ctx, p) {
    const periodo = periodoDe(p);
    const esc = await escopoDe(ctx, p);
    if (esc.consolidado && !(await temAcessoTotal(ctx))) throw new ErroClock("O PDF consolidado exige acesso a todas as unidades. Gere por unidade.");
    return `Vou gerar e salvar o PDF do DRE ${tituloPeriodo(periodo).titulo}, ${esc.rotulo}. Fica no arquivo de relatórios do Financeiro. Confirma?`;
  },
  async executar(ctx, p) {
    const periodo = periodoDe(p);
    const esc = await escopoDe(ctx, p);
    if (esc.consolidado && !(await temAcessoTotal(ctx))) throw new ErroClock("O PDF consolidado exige acesso a todas as unidades.");
    const r = await salvarRelatorioDRE({ escopo: esc.escopo, tipo: periodo.tipo, ano: periodo.ano, numero: periodo.numero });
    if (!r.ok) throw new ErroClock(r.erro);
    return { salvo: true, arquivo: r.relatorio.arquivo, path: r.relatorio.path, href: "/financeiro?aba=relatorios" };
  },
};

const excluirRelatorioDre: DefAcao = {
  id: "excluir_relatorio_dre",
  modulo: "financeiro",
  descricao: "Exclui um PDF de DRE do arquivo (path vindo de relatorios_dre_salvos). Irreversível.",
  permissao: "financeiro.config.update",
  risco: "alto",
  params: { type: "object", properties: { path: { type: "string", description: "path do relatório salvo" } }, required: ["path"] },
  async resumir(ctx, p) {
    const path = textoObrig(p, "path");
    if (!path.startsWith(`${ctx.tenantId}/`)) throw new ErroClock("Relatório fora do seu espaço.");
    return `Vou excluir o relatório ${path.split("/").pop()}. Não dá para desfazer. Confirma?`;
  },
  async executar(ctx, p) {
    const path = textoObrig(p, "path");
    if (!path.startsWith(`${ctx.tenantId}/`)) throw new ErroClock("Relatório fora do seu espaço.");
    const r = await excluirRelatorioDRE(path);
    if (!r.ok) throw new ErroClock(r.erro ?? "Falha ao excluir.");
    return { excluido: true };
  },
};

export const CONSULTAS_FINANCEIRO: DefConsulta[] = [drePeriodo, projecaoFinanceira, margemContribuicao, despesasDoMes, relatoriosDreSalvos, projetadoVsReal];
export const ACOES_FINANCEIRO: DefAcao[] = [gerarPdfDre, excluirRelatorioDre];

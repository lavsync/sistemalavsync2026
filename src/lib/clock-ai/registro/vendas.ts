// LavSync · CLOCK v2 · Registro · Vendas (Visão Geral + Painel ao Vivo)
//
// Métrica única de ticket médio no CLOCK: faturamento ÷ ciclos (o mesmo
// do Painel ao Vivo). Ciclos = max(1, quantidade_ciclos); venda válida =
// situacao 'sucesso'. Tudo com a sessão do usuário, filtrado pelas
// unidades liberadas a ele.
import "server-only";
import { paginarTodos } from "@/lib/supabase/pagination";
import { getRevenueTimeseries, getHourlyOccupation, type Janela } from "@/lib/dashboard/queries";
import { getPainelAoVivo } from "@/lib/painel-ao-vivo-queries";
import { gerarInsightsUnidade } from "@/lib/insights/engine";
import { addDaysBR, todayBRiso, isoDayBR } from "@/lib/timezone-br";
import type { CtxClock, DefConsulta, Params } from "./tipos";
import {
  resolverPeriodo, resolverUnidades, booleano, dia, r2, variacaoPct, mascararTelefone, ErroClock, PERIODOS,
} from "./comum";

const P_UNIDADE = { type: "string", description: "Nome ou id da unidade (ex.: Castelo). Vazio = todas as liberadas." };
const P_PERIODO = { type: "string", enum: [...PERIODOS], description: "Período (padrão: hoje). Use de/ate para datas exatas." };
const P_DE = { type: "string", description: "Data inicial AAAA-MM-DD (horário de Brasília)" };
const P_ATE = { type: "string", description: "Data final AAAA-MM-DD (inclusive)" };

// ─── Agregação de vendas (compartilhada com comparativo) ────────────────────

type VendaRow = {
  unidade_id: string; cliente_id: string | null; cpf: string | null;
  valor: number | string; quantidade_ciclos: number | string | null; tipo_servico: string | null;
};

export type Agregado = {
  faturamento: number; ciclos: number; lavagens: number; secagens: number;
  vendas: number; clientes_unicos: number; ticket_medio: number;
};

export async function lerVendas(ctx: CtxClock, unidadeIds: string[], from: Date, to: Date): Promise<VendaRow[]> {
  if (unidadeIds.length === 0) return [];
  return paginarTodos<VendaRow>((r) =>
    ctx.sb.from("vendas")
      .select("unidade_id, cliente_id, cpf, valor, quantidade_ciclos, tipo_servico")
      .in("unidade_id", unidadeIds)
      .eq("situacao", "sucesso")
      .gte("data_venda", from.toISOString())
      .lte("data_venda", to.toISOString())
      .range(r.from, r.to),
  );
}

export function agregar(rows: VendaRow[]): Agregado {
  let fat = 0, ciclos = 0, lav = 0, sec = 0;
  const clientes = new Set<string>();
  for (const v of rows) {
    const c = Math.max(1, Number(v.quantidade_ciclos) || 1);
    fat += Number(v.valor) || 0;
    ciclos += c;
    if (v.tipo_servico === "lavagem") lav += c;
    else if (v.tipo_servico === "secagem") sec += c;
    else if (v.tipo_servico === "combo") { lav += c / 2; sec += c / 2; }
    const chave = v.cliente_id ?? v.cpf;
    if (chave) clientes.add(chave);
  }
  return {
    faturamento: r2(fat), ciclos, lavagens: Math.round(lav), secagens: Math.round(sec),
    vendas: rows.length, clientes_unicos: clientes.size,
    ticket_medio: ciclos ? r2(fat / ciclos) : 0,
  };
}

function comparar(atual: Agregado, base: Agregado | null) {
  if (!base) return null;
  return {
    faturamento_pct: variacaoPct(atual.faturamento, base.faturamento),
    ciclos_pct: variacaoPct(atual.ciclos, base.ciclos),
    clientes_pct: variacaoPct(atual.clientes_unicos, base.clientes_unicos),
    ticket_pct: variacaoPct(atual.ticket_medio, base.ticket_medio),
  };
}

function janelaDash(from: Date, to: Date, label: string): Janela {
  return { from, to, label, periodo: "custom" };
}

// ─── Consultas ──────────────────────────────────────────────────────────────

const kpisPeriodo: DefConsulta = {
  id: "kpis_periodo",
  modulo: "vendas",
  descricao:
    "Faturamento, ciclos, lavagens/secagens, clientes únicos e ticket médio (= faturamento ÷ ciclos) por unidade e no total, " +
    "com a base de comparação justa (hoje x mesmo dia da semana passada até o mesmo horário; mês x mesmo intervalo do mês anterior etc.) e a variação em %.",
  permissao: "dashboard.view",
  params: {
    type: "object",
    properties: { periodo: P_PERIODO, de: P_DE, ate: P_ATE, unidade: P_UNIDADE, comparar: { type: "boolean", description: "Comparar com a base (padrão: true)" } },
  },
  async executar(ctx, p) {
    const us = resolverUnidades(ctx, p.unidade);
    const j = resolverPeriodo(p);
    const comBase = booleano(p, "comparar", true) && j.base != null;
    const ids = us.map((u) => u.id);
    const [rowsA, rowsB] = await Promise.all([
      lerVendas(ctx, ids, j.atual.from, j.atual.to),
      comBase && j.base ? lerVendas(ctx, ids, j.base.from, j.base.to) : Promise.resolve(null),
    ]);
    const total = agregar(rowsA);
    const totalBase = rowsB ? agregar(rowsB) : null;
    return {
      periodo: j.atual.rotulo,
      base: comBase ? { descricao: j.base_descricao, intervalo: j.base?.rotulo } : null,
      metrica_ticket: "ticket médio = faturamento ÷ ciclos",
      total: { ...total, base: totalBase, variacao: comparar(total, totalBase) },
      por_unidade: us.length > 1 ? us.map((u) => {
        const a = agregar(rowsA.filter((v) => v.unidade_id === u.id));
        const b = rowsB ? agregar(rowsB.filter((v) => v.unidade_id === u.id)) : null;
        return { unidade: u.nome, ...a, variacao: comparar(a, b) };
      }).sort((x, y) => y.faturamento - x.faturamento) : undefined,
    };
  },
};

const agoraAoVivo: DefConsulta = {
  id: "agora_ao_vivo",
  modulo: "painel",
  descricao:
    "Situação de HOJE até agora por unidade (tempo real): faturamento, ciclos, lavagens/secagens, clientes únicos, ticket médio (faturamento ÷ ciclos), " +
    "última hora, minutos desde a última venda e comparação com ontem até o mesmo horário.",
  permissao: "painel_vivo.view",
  params: { type: "object", properties: { unidade: P_UNIDADE } },
  async executar(ctx, p) {
    const us = resolverUnidades(ctx, p.unidade);
    const r = await getPainelAoVivo(us);
    const linha = (u: { faturamentoHoje: number; ciclosHoje: number; lavagensHoje: number; secagensHoje: number; clientesUnicosHoje: number;
      faturamentoUltimaHora: number; vendasUltimaHora: number }, ontemMesmoHorario: number) => ({
      faturamento_hoje: r2(u.faturamentoHoje),
      ciclos_hoje: u.ciclosHoje,
      lavagens: u.lavagensHoje,
      secagens: u.secagensHoje,
      clientes_unicos: u.clientesUnicosHoje,
      ticket_medio: u.ciclosHoje ? r2(u.faturamentoHoje / u.ciclosHoje) : 0,
      ultima_hora: { faturamento: r2(u.faturamentoUltimaHora), vendas: u.vendasUltimaHora },
      ontem_mesmo_horario: r2(ontemMesmoHorario),
      variacao_vs_ontem_pct: variacaoPct(u.faturamentoHoje, ontemMesmoHorario),
    });
    return {
      gerado_em: r.geradoEm,
      base: "ontem até o mesmo horário",
      total: linha(r.total, r.unidades.reduce((s, u) => s + u.faturamentoOntemMesmoHorario, 0)),
      por_unidade: r.unidades.map((u) => ({
        unidade: u.unidade_nome,
        ...linha(u, u.faturamentoOntemMesmoHorario),
        minutos_desde_ultima_venda: u.minutosDesdeUltimaVenda,
      })),
    };
  },
};

const serieDiariaOcupacao: DefConsulta = {
  id: "serie_diaria_e_ocupacao",
  modulo: "vendas",
  descricao: "Faturamento dia a dia e ocupação por hora (vendas por faixa horária) no período, com melhor/pior dia e horários de pico e vale.",
  permissao: "dashboard.view",
  params: { type: "object", properties: { periodo: { ...P_PERIODO, description: "Período (padrão: 30d)" }, de: P_DE, ate: P_ATE, unidade: P_UNIDADE } },
  async executar(ctx, p) {
    const us = resolverUnidades(ctx, p.unidade);
    const j = resolverPeriodo({ ...p, periodo: p.periodo ?? "30d" });
    const jd = janelaDash(j.atual.from, j.atual.to, j.atual.rotulo);
    const ids = us.map((u) => u.id);
    const serie = await getRevenueTimeseries(ids, jd);
    const ocup = await getHourlyOccupation(ids, jd);
    const dias = serie.map((s) => ({ dia: s.day, valor: r2(s.value) }));
    const comVenda = dias.filter((d) => d.valor > 0);
    const ord = [...comVenda].sort((a, b) => b.valor - a.valor);
    const horas = ocup.filter((h) => h.vendas > 0).sort((a, b) => b.vendas - a.vendas);
    return {
      periodo: j.atual.rotulo,
      unidades: us.map((u) => u.nome),
      melhor_dia: ord[0] ?? null,
      pior_dia_com_venda: ord[ord.length - 1] ?? null,
      media_diaria: comVenda.length ? r2(comVenda.reduce((s, d) => s + d.valor, 0) / dias.length) : 0,
      horas_pico: horas.slice(0, 3).map((h) => ({ hora: h.hour, vendas: h.vendas })),
      horas_vale: horas.slice(-3).reverse().map((h) => ({ hora: h.hour, vendas: h.vendas })),
      serie_diaria: dias,
      ocupacao_por_hora: ocup.map((h) => ({ hora: h.hour, vendas: h.vendas })),
    };
  },
};

const insightsAutomaticos: DefConsulta = {
  id: "insights_automaticos",
  modulo: "vendas",
  descricao: "Insights automáticos priorizados por unidade (90 dias a partir da última venda): quedas, picos, clientes, cupons, horários. Use para iniciativa própria.",
  permissao: "dashboard.view",
  params: { type: "object", properties: { unidade: P_UNIDADE } },
  async executar(ctx, p) {
    const us = resolverUnidades(ctx, p.unidade);
    const out: Array<{ unidade: string; insights: unknown[] }> = [];
    // Sequencial: pool de conexões do banco é limitado
    for (const u of us) {
      const ins = await gerarInsightsUnidade(u.id);
      out.push({
        unidade: u.nome,
        insights: ins.sort((a, b) => b.prioridade - a.prioridade).slice(0, 6).map((i) => ({
          titulo: i.titulo, descricao: i.descricao, destaque: i.destaque ?? null,
          sugestao: i.acao_sugerida ?? null, severidade: i.severidade, prioridade: i.prioridade,
        })),
      });
    }
    return { por_unidade: out };
  },
};

const usuariosDoDia: DefConsulta = {
  id: "usuarios_do_dia",
  modulo: "vendas",
  descricao:
    "Clientes que usaram a lavanderia num dia (padrão: ontem), com gasto do dia (= LavCoins ganhos), ciclos, saldo de LavCoins e dias de casa. " +
    "Base da rotina diária de mensagem de saldo. Telefone sai mascarado.",
  permissao: "marketing.clube.view",
  params: { type: "object", properties: { data: { type: "string", description: "Dia AAAA-MM-DD (padrão: ontem)" }, unidade: P_UNIDADE } },
  async executar(ctx, p: Params) {
    const us = resolverUnidades(ctx, p.unidade);
    const d = dia(p, "data") ?? isoDayBR(addDaysBR(new Date(), -1));
    if (d > todayBRiso()) throw new ErroClock("Data no futuro.");
    type V = { cliente_id: string | null; unidade_id: string; valor: number | string; quantidade_ciclos: number | string | null };
    const vendas = await paginarTodos<V>((r) =>
      ctx.sb.from("vendas")
        .select("cliente_id, unidade_id, valor, quantidade_ciclos")
        .in("unidade_id", us.map((u) => u.id))
        .eq("situacao", "sucesso")
        .gte("data_venda", `${d}T00:00:00-03:00`)
        .lte("data_venda", `${d}T23:59:59.999-03:00`)
        .not("cliente_id", "is", null)
        .range(r.from, r.to),
    );
    const agg = new Map<string, { gasto: number; ciclos: number; unidade_id: string }>();
    for (const v of vendas) {
      if (!v.cliente_id) continue;
      const cur = agg.get(v.cliente_id) ?? { gasto: 0, ciclos: 0, unidade_id: v.unidade_id };
      cur.gasto += Number(v.valor) || 0;
      cur.ciclos += Math.max(1, Number(v.quantidade_ciclos) || 1);
      agg.set(v.cliente_id, cur);
    }
    const ids = [...agg.keys()];
    const cli = new Map<string, { nome: string; telefone: string | null; cadastrado_em: string | null }>();
    const saldo = new Map<string, number>();
    for (let i = 0; i < ids.length; i += 500) {
      const fatia = ids.slice(i, i + 500);
      const { data: cs } = await ctx.sb.from("clientes").select("id, nome, telefone, cadastrado_em").in("id", fatia);
      const { data: ss } = await ctx.sb.from("xoclub_saldos").select("cliente_id, saldo_atual").in("cliente_id", fatia);
      for (const c of (cs ?? []) as Array<{ id: string; nome: string; telefone: string | null; cadastrado_em: string | null }>) cli.set(c.id, c);
      for (const s of (ss ?? []) as Array<{ cliente_id: string; saldo_atual: number }>) saldo.set(s.cliente_id, Number(s.saldo_atual) || 0);
    }
    const agora = Date.now();
    const lista = [...agg.entries()].map(([id, a]) => {
      const c = cli.get(id);
      return {
        cliente_id: id,
        nome: c?.nome ?? "sem nome",
        telefone: mascararTelefone(c?.telefone),
        unidade: us.find((u) => u.id === a.unidade_id)?.nome ?? null,
        lavcoins_ganhos_no_dia: Math.round(a.gasto),
        ciclos: a.ciclos,
        saldo_lavcoins: saldo.get(id) ?? 0,
        dias_de_cliente: c?.cadastrado_em ? Math.max(0, Math.floor((agora - new Date(c.cadastrado_em).getTime()) / 86_400_000)) : null,
      };
    }).sort((a, b) => b.lavcoins_ganhos_no_dia - a.lavcoins_ganhos_no_dia);
    return { dia: d, total_clientes: lista.length, clientes: lista };
  },
};

export const CONSULTAS_VENDAS: DefConsulta[] = [kpisPeriodo, agoraAoVivo, serieDiariaOcupacao, insightsAutomaticos, usuariosDoDia];

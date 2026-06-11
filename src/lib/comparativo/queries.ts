// LavSync · Comparativo entre períodos/unidades
// Agrega KPIs de uma janela (unidade + from/to) num único objeto pra ser
// comparado lado a lado com outra janela.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { paginarTodos } from "@/lib/supabase/pagination";
import { startOfDayBR, endOfDayBR, addDaysBR, startOfMonthBR, startOfYearBR } from "@/lib/timezone-br";

export type AgregadoJanela = {
  unidadeId: string;
  unidadeNome: string;
  rotuloJanela: string;
  from: string;       // ISO
  to: string;         // ISO

  faturamento: number;
  qtdVendas: number;
  ticketMedio: number;
  cpfsUnicos: number;
  cpfsNovos: number;          // primeira venda dentro da janela (histórico geral)
  cupomUsos: number;
  voucherUsos: number;

  faturamentoLavagem: number;
  faturamentoSecagem: number;

  diasUnicos: number;
  vendasPorDia: number;

  melhorHora: { hora: number; vendas: number } | null;
  melhorDow: { dow: number; nome: string; vendas: number } | null;

  porDia: Array<{ data: string; rotulo: string; valor: number; vendas: number }>;
};

const DOW_NOMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function fmtBR(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

type VendaLite = {
  data_venda: string;
  valor: number | string;
  cpf: string | null;
  tipo_servico: string | null;
  cupom_codigo: string | null;
  voucher_codigo: string | null;
};

export async function getAgregado(
  unidadeId: string,
  from: Date,
  to: Date,
  unidadeNome: string,
): Promise<AgregadoJanela> {
  const supabase = await createClient();
  const rows = await paginarTodos<VendaLite>((r) =>
    supabase
      .from("vendas")
      .select("data_venda, valor, cpf, tipo_servico, cupom_codigo, voucher_codigo")
      .eq("unidade_id", unidadeId)
      .eq("situacao", "sucesso")
      .gte("data_venda", from.toISOString())
      .lte("data_venda", to.toISOString())
      .range(r.from, r.to),
  );

  let fat = 0;
  let fatLav = 0;
  let fatSec = 0;
  let cupom = 0;
  let voucher = 0;
  const cpfs = new Set<string>();
  const porHora = new Array<number>(24).fill(0);
  const porDow = new Array<number>(7).fill(0);
  const porDia = new Map<string, { valor: number; vendas: number; d: Date }>();
  const diasSet = new Set<string>();

  for (const r of rows) {
    const v = Number(r.valor) || 0;
    fat += v;
    if (r.tipo_servico === "lavagem") fatLav += v;
    else if (r.tipo_servico === "secagem") fatSec += v;
    if (r.cupom_codigo) cupom++;
    if (r.voucher_codigo) voucher++;
    if (r.cpf) cpfs.add(r.cpf);
    // Hora/dia da semana SEMPRE em Brasília (offset -3h aplicado via cálculo manual)
    const dUTC = new Date(r.data_venda);
    const dBR = new Date(dUTC.getTime() - 3 * 3600 * 1000);
    porHora[dBR.getUTCHours()]++;
    porDow[dBR.getUTCDay()]++;
    const inicioDiaBR = startOfDayBR(dUTC);
    const diaIso = inicioDiaBR.toISOString();
    const cur = porDia.get(diaIso) ?? { valor: 0, vendas: 0, d: inicioDiaBR };
    cur.valor += v;
    cur.vendas += 1;
    porDia.set(diaIso, cur);
    diasSet.add(diaIso);
  }

  // CPFs novos = aqueles cuja primeira venda HISTÓRICA caiu na janela
  let cpfsNovos = 0;
  if (cpfs.size > 0) {
    type P = { cpf: string; data_venda: string };
    const cpfArr = Array.from(cpfs);
    for (let i = 0; i < cpfArr.length; i += 100) {
      const slice = cpfArr.slice(i, i + 100);
      const primeiras = await paginarTodos<P>((r) =>
        supabase
          .from("vendas")
          .select("cpf, data_venda")
          .eq("unidade_id", unidadeId)
          .eq("situacao", "sucesso")
          .in("cpf", slice)
          .order("data_venda", { ascending: true })
          .range(r.from, r.to),
      );
      const primeiraPorCpf = new Map<string, string>();
      for (const r of primeiras) {
        if (!primeiraPorCpf.has(r.cpf)) primeiraPorCpf.set(r.cpf, r.data_venda);
      }
      for (const [, dt] of primeiraPorCpf) {
        const d = new Date(dt);
        if (d >= from && d <= to) cpfsNovos++;
      }
    }
  }

  // Melhor hora / DOW
  let melhorHora: { hora: number; vendas: number } | null = null;
  for (let h = 0; h < 24; h++) {
    if (porHora[h] > 0 && (!melhorHora || porHora[h] > melhorHora.vendas)) {
      melhorHora = { hora: h, vendas: porHora[h] };
    }
  }
  let melhorDow: { dow: number; nome: string; vendas: number } | null = null;
  for (let dw = 0; dw < 7; dw++) {
    if (porDow[dw] > 0 && (!melhorDow || porDow[dw] > melhorDow.vendas)) {
      melhorDow = { dow: dw, nome: DOW_NOMES[dw], vendas: porDow[dw] };
    }
  }

  const porDiaArr = Array.from(porDia.values())
    .sort((a, b) => a.d.getTime() - b.d.getTime())
    .map((p) => ({
      data: p.d.toISOString(),
      rotulo: `${String(p.d.getDate()).padStart(2, "0")}/${String(p.d.getMonth() + 1).padStart(2, "0")}`,
      valor: Math.round(p.valor * 100) / 100,
      vendas: p.vendas,
    }));

  const diasUnicos = diasSet.size;
  return {
    unidadeId,
    unidadeNome,
    rotuloJanela: `${fmtBR(from)} – ${fmtBR(to)}`,
    from: from.toISOString(),
    to: to.toISOString(),
    faturamento: Math.round(fat * 100) / 100,
    qtdVendas: rows.length,
    ticketMedio: rows.length > 0 ? Math.round((fat / rows.length) * 100) / 100 : 0,
    cpfsUnicos: cpfs.size,
    cpfsNovos,
    cupomUsos: cupom,
    voucherUsos: voucher,
    faturamentoLavagem: Math.round(fatLav * 100) / 100,
    faturamentoSecagem: Math.round(fatSec * 100) / 100,
    diasUnicos,
    vendasPorDia: diasUnicos > 0 ? Math.round((rows.length / diasUnicos) * 10) / 10 : 0,
    melhorHora,
    melhorDow,
    porDia: porDiaArr,
  };
}

// ─── Resolver janelas A/B a partir de query string ─────────────────────────
export type PeriodoComp = "hoje" | "ontem" | "7d" | "30d" | "mes" | "mes_anterior" | "90d" | "ano" | "ano_anterior" | "custom";

const presetLabels: Record<PeriodoComp, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  "7d": "Últimos 7d",
  "30d": "Últimos 30d",
  mes: "Mês atual",
  mes_anterior: "Mês anterior",
  "90d": "Últimos 90d",
  ano: "Ano atual",
  ano_anterior: "Ano anterior",
  custom: "Personalizado",
};

export function rotuloPreset(p: PeriodoComp): string { return presetLabels[p] ?? p; }

export function resolverPreset(p: PeriodoComp, fromStr?: string, toStr?: string): { from: Date; to: Date } {
  // Tudo no fuso Brasília (-03:00). Server roda em UTC.
  const agora = new Date();
  if (p === "hoje")    return { from: startOfDayBR(), to: endOfDayBR() };
  if (p === "ontem")   { const o = addDaysBR(agora, -1); return { from: o, to: endOfDayBR(o) }; }
  if (p === "7d")      return { from: addDaysBR(agora, -6), to: endOfDayBR() };
  if (p === "30d")     return { from: addDaysBR(agora, -29), to: endOfDayBR() };
  if (p === "90d")     return { from: addDaysBR(agora, -89), to: endOfDayBR() };
  if (p === "mes")     return { from: startOfMonthBR(), to: endOfDayBR() };
  if (p === "mes_anterior") {
    // Primeiro dia do mês passado em BR
    const mesAnt = new Date(startOfMonthBR().getTime() - 1);  // último ms do mês anterior
    const ini = startOfMonthBR(mesAnt);
    const fim = endOfDayBR(new Date(startOfMonthBR().getTime() - 1));
    return { from: ini, to: fim };
  }
  if (p === "ano")     return { from: startOfYearBR(), to: endOfDayBR() };
  if (p === "ano_anterior") {
    const yPassado = new Date(startOfYearBR().getTime() - 1);
    return { from: startOfYearBR(yPassado), to: endOfDayBR(yPassado) };
  }
  // custom — datas YYYY-MM-DD são interpretadas como dias BR
  const f = fromStr ? startOfDayBR(new Date(`${fromStr}T12:00:00-03:00`)) : addDaysBR(agora, -29);
  const t = toStr   ? endOfDayBR(new Date(`${toStr}T12:00:00-03:00`))     : endOfDayBR();
  return { from: f, to: t };
}

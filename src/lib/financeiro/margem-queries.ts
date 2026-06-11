import "server-only";
import { createClient } from "@/lib/supabase/server";
import { paginarTodos } from "@/lib/supabase/pagination";
import type { EngenhariaCustos } from "./margem-engine";

export async function getEngenhariaCustos(unidadeId: string): Promise<EngenhariaCustos | null> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("financeiro_engenharia_custos")
    .select("*")
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (error || !data) return null;
  const d = data as Record<string, unknown>;
  return {
    preco_galao_sabao_litros:     Number(d.preco_galao_sabao_litros),
    preco_galao_sabao_valor:      Number(d.preco_galao_sabao_valor),
    ml_sabao_por_ciclo:           Number(d.ml_sabao_por_ciclo),
    preco_galao_amaciante_litros: Number(d.preco_galao_amaciante_litros),
    preco_galao_amaciante_valor:  Number(d.preco_galao_amaciante_valor),
    ml_amaciante_por_ciclo:       Number(d.ml_amaciante_por_ciclo),
    tarifa_kwh:                   Number(d.tarifa_kwh),
    kwh_por_ciclo_lavagem:        Number(d.kwh_por_ciclo_lavagem),
    kwh_por_ciclo_secagem:        Number(d.kwh_por_ciclo_secagem),
    conta_agua_mensal:            Number(d.conta_agua_mensal),
    ar_condicionado_btus:         Number(d.ar_condicionado_btus),
    ar_condicionado_kwh_hora:     Number(d.ar_condicionado_kwh_hora),
    lampadas_qtd:                 Number(d.lampadas_qtd),
    lampada_kwh_hora:             Number(d.lampada_kwh_hora),
    cameras_qtd:                  Number(d.cameras_qtd),
    camera_kwh_hora:              Number(d.camera_kwh_hora),
    tv_kwh_hora:                  Number(d.tv_kwh_hora),
    totem_kwh_hora:               Number(d.totem_kwh_hora),
    internet_kwh_hora:            Number(d.internet_kwh_hora),
    horas_operacao_dia:           Number(d.horas_operacao_dia),
    dias_operacao_mes:            Number(d.dias_operacao_mes),
    preco_lavagem:                Number(d.preco_lavagem),
    preco_secagem:                Number(d.preco_secagem),
  };
}

/** Agrega ciclos+faturamento de lavagens e secagens da unidade num mês específico. */
export async function getCiclosDoMes(
  unidadeId: string, ano: number, mes: number,
): Promise<{
  ciclosLavagem: number; ciclosSecagem: number;
  faturamentoLavagem: number; faturamentoSecagem: number;
}> {
  const sb = await createClient();
  const ini = new Date(Date.UTC(ano, mes - 1, 1)).toISOString();
  const fim = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999)).toISOString();
  type Row = { tipo_servico: string; quantidade_ciclos: number | string | null; valor: number | string };
  const rows = await paginarTodos<Row>((r) =>
    sb.from("vendas")
      .select("tipo_servico, quantidade_ciclos, valor")
      .eq("unidade_id", unidadeId)
      .eq("situacao", "sucesso")
      .gte("data_venda", ini)
      .lte("data_venda", fim)
      .range(r.from, r.to),
  );
  let cLav = 0, cSec = 0, fLav = 0, fSec = 0;
  for (const r of rows) {
    const ciclos = Number(r.quantidade_ciclos) || 1;
    const valor = Number(r.valor) || 0;
    if (r.tipo_servico === "lavagem") { cLav += ciclos; fLav += valor; }
    else if (r.tipo_servico === "secagem") { cSec += ciclos; fSec += valor; }
    else if (r.tipo_servico === "combo") {
      // Rateio 50/50 — futuras versões podem detalhar
      cLav += Math.ceil(ciclos / 2); cSec += Math.floor(ciclos / 2);
      fLav += valor / 2; fSec += valor / 2;
    }
  }
  return {
    ciclosLavagem: cLav,
    ciclosSecagem: cSec,
    faturamentoLavagem: Math.round(fLav * 100) / 100,
    faturamentoSecagem: Math.round(fSec * 100) / 100,
  };
}

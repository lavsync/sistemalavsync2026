// LavSync · Painel de Vendas ao Vivo (estilo MELI)
// Server queries que rodam por unidade pra alimentar dashboard em tempo real.
import "server-only";
import { createClient } from "@/lib/supabase/server";

export type VendaLiveItem = {
  id: string;
  data_venda: string;
  valor: number;
  tipo_servico: string;
  tipo_pagamento: string;
  nome_cliente: string | null;
  cpf: string | null;
};

export type UnidadePainelAoVivo = {
  unidade_id: string;
  unidade_nome: string;
  // Hoje
  faturamentoHoje: number;
  ciclosHoje: number;
  lavagensHoje: number;
  secagensHoje: number;
  ticketMedioHoje: number;
  clientesUnicosHoje: number;
  // Última hora
  faturamentoUltimaHora: number;
  vendasUltimaHora: number;
  // Comparativos
  faturamentoOntemMesmoHorario: number; // até a mesma hora de ontem
  // Stream
  ultimasVendas: VendaLiveItem[];
  faturamentoPorHora: Array<{ hora: string; valor: number; vendas: number }>;
  // Status
  ultimaVendaEm: string | null;
  minutosDesdeUltimaVenda: number | null;
};

export type PainelAoVivoTotal = {
  faturamentoHoje: number;
  ciclosHoje: number;
  lavagensHoje: number;
  secagensHoje: number;
  ticketMedioHoje: number;
  clientesUnicosHoje: number;
  faturamentoUltimaHora: number;
  vendasUltimaHora: number;
};

function inicioHoje(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function inicioOntem(): Date {
  const d = inicioHoje();
  d.setDate(d.getDate() - 1);
  return d;
}

function umaHoraAtras(): Date {
  return new Date(Date.now() - 60 * 60 * 1000);
}

async function getDadosUnidade(
  unidade: { id: string; nome: string },
): Promise<UnidadePainelAoVivo> {
  const supabase = await createClient();
  const hoje = inicioHoje();
  const ontem = inicioOntem();
  const agora = new Date();
  const horaCorrente = agora.getHours();
  // Mesmo horário de ontem (até agora-24h)
  const ontemAteMesmaHora = new Date(ontem);
  ontemAteMesmaHora.setHours(horaCorrente, agora.getMinutes(), agora.getSeconds(), 0);
  const haUmaHora = umaHoraAtras();

  const [vendasHoje, vendasOntem, vendasUltHora, ultimas] = await Promise.all([
    supabase
      .from("vendas")
      .select("id, valor, tipo_servico, quantidade_ciclos, cpf, data_venda")
      .eq("unidade_id", unidade.id)
      .eq("situacao", "sucesso")
      .gte("data_venda", hoje.toISOString()),
    supabase
      .from("vendas")
      .select("valor")
      .eq("unidade_id", unidade.id)
      .eq("situacao", "sucesso")
      .gte("data_venda", ontem.toISOString())
      .lte("data_venda", ontemAteMesmaHora.toISOString()),
    supabase
      .from("vendas")
      .select("valor")
      .eq("unidade_id", unidade.id)
      .eq("situacao", "sucesso")
      .gte("data_venda", haUmaHora.toISOString()),
    supabase
      .from("vendas")
      .select("id, data_venda, valor, tipo_servico, tipo_pagamento, nome_cliente, cpf")
      .eq("unidade_id", unidade.id)
      .eq("situacao", "sucesso")
      .order("data_venda", { ascending: false })
      .limit(12),
  ]);

  if (vendasHoje.error) throw vendasHoje.error;

  const rowsHoje = (vendasHoje.data ?? []) as Array<{
    id: string; valor: number | string; tipo_servico: string;
    quantidade_ciclos: number | string; cpf: string | null; data_venda: string;
  }>;

  let faturamentoHoje = 0, ciclosHoje = 0, lavagensHoje = 0, secagensHoje = 0;
  const cpfsHoje = new Set<string>();
  // Faturamento por hora (00h → 23h)
  const fatHora = Array.from({ length: 24 }, (_, h) => ({ hora: `${String(h).padStart(2, "0")}h`, valor: 0, vendas: 0 }));

  for (const r of rowsHoje) {
    const v = Number(r.valor) || 0;
    const c = Number(r.quantidade_ciclos) || 1;
    faturamentoHoje += v;
    ciclosHoje += c;
    if (r.tipo_servico === "lavagem") lavagensHoje += c;
    else if (r.tipo_servico === "secagem") secagensHoje += c;
    if (r.cpf) cpfsHoje.add(r.cpf);
    const h = new Date(r.data_venda).getHours();
    fatHora[h].valor += v;
    fatHora[h].vendas += 1;
  }

  const faturamentoOntem = ((vendasOntem.data ?? []) as Array<{ valor: number | string }>)
    .reduce((s, r) => s + (Number(r.valor) || 0), 0);

  const rowsUltHora = (vendasUltHora.data ?? []) as Array<{ valor: number | string }>;
  const faturamentoUltimaHora = rowsUltHora.reduce((s, r) => s + (Number(r.valor) || 0), 0);

  const ultimasVendas = ((ultimas.data ?? []) as Array<VendaLiveItem & { valor: number | string }>)
    .map((v) => ({ ...v, valor: Number(v.valor) || 0 }));

  const ultimaVendaEm = ultimasVendas[0]?.data_venda ?? null;
  const minutosDesdeUltimaVenda = ultimaVendaEm
    ? Math.round((Date.now() - new Date(ultimaVendaEm).getTime()) / 60000)
    : null;

  return {
    unidade_id: unidade.id,
    unidade_nome: unidade.nome,
    faturamentoHoje: round2(faturamentoHoje),
    ciclosHoje,
    lavagensHoje,
    secagensHoje,
    ticketMedioHoje: rowsHoje.length > 0 ? round2(faturamentoHoje / rowsHoje.length) : 0,
    clientesUnicosHoje: cpfsHoje.size,
    faturamentoUltimaHora: round2(faturamentoUltimaHora),
    vendasUltimaHora: rowsUltHora.length,
    faturamentoOntemMesmoHorario: round2(faturamentoOntem),
    ultimasVendas: ultimasVendas.slice(0, 8),
    faturamentoPorHora: fatHora,
    ultimaVendaEm,
    minutosDesdeUltimaVenda,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function getPainelAoVivo(
  unidades: Array<{ id: string; nome: string }>,
): Promise<{
  unidades: UnidadePainelAoVivo[];
  total: PainelAoVivoTotal;
  geradoEm: string;
}> {
  const dados = await Promise.all(unidades.map(getDadosUnidade));
  const total: PainelAoVivoTotal = {
    faturamentoHoje: round2(dados.reduce((s, u) => s + u.faturamentoHoje, 0)),
    ciclosHoje: dados.reduce((s, u) => s + u.ciclosHoje, 0),
    lavagensHoje: dados.reduce((s, u) => s + u.lavagensHoje, 0),
    secagensHoje: dados.reduce((s, u) => s + u.secagensHoje, 0),
    ticketMedioHoje: 0,
    clientesUnicosHoje: dados.reduce((s, u) => s + u.clientesUnicosHoje, 0),
    faturamentoUltimaHora: round2(dados.reduce((s, u) => s + u.faturamentoUltimaHora, 0)),
    vendasUltimaHora: dados.reduce((s, u) => s + u.vendasUltimaHora, 0),
  };
  const totalVendas = dados.reduce((s, u) => s + u.ultimasVendas.length, 0);
  if (totalVendas > 0) {
    total.ticketMedioHoje = round2(total.faturamentoHoje / dados.reduce((s, u) => s + u.ciclosHoje, 0) || 0);
  }
  return { unidades: dados, total, geradoEm: new Date().toISOString() };
}

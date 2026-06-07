// LavSync · Manutenção · Queries
import "server-only";
import { createClient } from "@/lib/supabase/server";

export type MaquinaTipo = "lavadora" | "secadora" | "dobradora" | "totem";
export type MaquinaStatus = "ativa" | "manutencao" | "inativa";

export type Maquina = {
  id: string;
  unidade_id: string;
  unidade_nome: string;
  codigo: string;
  tipo: MaquinaTipo;
  status: MaquinaStatus;
  capacidade_kg: number | null;
  equipamento_match: string | null;
  fabricante: string | null;
  modelo: string | null;
  serial_number: string | null;
  data_aquisicao: string | null;
  valor_aquisicao: number | null;
  ultima_manutencao_em: string | null;
  proxima_manutencao_em: string | null;
  localizacao: string | null;
  observacoes: string | null;
};

export type MaquinaComStats = Maquina & {
  vendas_30d: number;
  faturamento_30d: number;
  ultima_venda_em: string | null;
  dias_sem_uso: number | null;
};

export type OrdemServico = {
  id: string;
  unidade_id: string;
  maquina_id: string | null;
  maquina_codigo: string | null;
  tipo: "preventiva" | "corretiva" | "revisao";
  titulo: string;
  descricao: string | null;
  status: "aberta" | "em_andamento" | "concluida" | "cancelada";
  prioridade: "baixa" | "media" | "alta" | "critica";
  custo_estimado: number | null;
  custo_real: number | null;
  aberta_em: string;
  concluida_em: string | null;
};

export async function listarMaquinas(unidadeId?: string): Promise<MaquinaComStats[]> {
  const sb = await createClient();
  let q = sb.from("maquinas")
    .select("*, unidade:unidades(nome)")
    .order("codigo");
  if (unidadeId) q = q.eq("unidade_id", unidadeId);
  const { data: maqs, error } = await q;
  if (error) throw error;

  type Raw = Omit<Maquina, "unidade_nome"> & { unidade: { nome: string } | Array<{ nome: string }> | null };
  const lista = ((maqs ?? []) as Raw[]).map((m) => {
    const un = Array.isArray(m.unidade) ? m.unidade[0]?.nome : m.unidade?.nome;
    return { ...m, unidade_nome: un ?? "—" } as Maquina;
  });

  // Stats: vendas dos últimos 30d agrupadas por equipamento_match (substring no campo equipamento)
  // Buscar todas as vendas dos últimos 30d das unidades das máquinas
  const unidadeIds = Array.from(new Set(lista.map((m) => m.unidade_id)));
  if (unidadeIds.length === 0) return [];

  const desde30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: vendas } = await sb
    .from("vendas")
    .select("equipamento, valor, data_venda, unidade_id")
    .in("unidade_id", unidadeIds)
    .eq("situacao", "sucesso")
    .gte("data_venda", desde30);

  type Vd = { equipamento: string | null; valor: number | string; data_venda: string; unidade_id: string };
  const vendasArr = (vendas ?? []) as Vd[];

  const stats = new Map<string, { vendas: number; faturamento: number; ultima: Date | null }>();
  for (const m of lista) {
    let count = 0; let fat = 0; let ultima: Date | null = null;
    const match = (m.equipamento_match ?? m.codigo ?? "").trim();
    if (match) {
      for (const v of vendasArr) {
        if (v.unidade_id !== m.unidade_id) continue;
        if (!v.equipamento) continue;
        if (v.equipamento.includes(match)) {
          count++;
          fat += Number(v.valor) || 0;
          const d = new Date(v.data_venda);
          if (!ultima || d > ultima) ultima = d;
        }
      }
    }
    stats.set(m.id, { vendas: count, faturamento: Math.round(fat * 100) / 100, ultima });
  }

  return lista.map((m) => {
    const s = stats.get(m.id)!;
    const dias = s.ultima ? Math.floor((Date.now() - s.ultima.getTime()) / (24 * 60 * 60 * 1000)) : null;
    return {
      ...m,
      vendas_30d: s.vendas,
      faturamento_30d: s.faturamento,
      ultima_venda_em: s.ultima ? s.ultima.toISOString() : null,
      dias_sem_uso: dias,
    };
  });
}

/** Lista equipamentos que aparecem nas vendas mas não têm máquina cadastrada (sugestões). */
export async function detectarEquipamentosNaoCadastrados(unidadeId: string): Promise<Array<{ equipamento: string; vendas: number; ultima: string }>> {
  const sb = await createClient();
  // Tudo do último mês
  const desde30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: vendas } = await sb
    .from("vendas")
    .select("equipamento, data_venda")
    .eq("unidade_id", unidadeId)
    .eq("situacao", "sucesso")
    .gte("data_venda", desde30)
    .not("equipamento", "is", null);
  const { data: maqs } = await sb
    .from("maquinas")
    .select("codigo, equipamento_match")
    .eq("unidade_id", unidadeId);

  type M = { codigo: string; equipamento_match: string | null };
  const matches = ((maqs ?? []) as M[]).map((m) => (m.equipamento_match ?? m.codigo).trim()).filter(Boolean);

  const agg = new Map<string, { count: number; ultima: Date }>();
  for (const v of (vendas ?? []) as Array<{ equipamento: string; data_venda: string }>) {
    if (!v.equipamento) continue;
    if (matches.some((m) => v.equipamento.includes(m))) continue;
    const cur = agg.get(v.equipamento) ?? { count: 0, ultima: new Date(0) };
    cur.count++;
    const d = new Date(v.data_venda);
    if (d > cur.ultima) cur.ultima = d;
    agg.set(v.equipamento, cur);
  }
  return Array.from(agg.entries())
    .map(([equipamento, x]) => ({ equipamento, vendas: x.count, ultima: x.ultima.toISOString() }))
    .sort((a, b) => b.vendas - a.vendas);
}

export async function listarOrdensServico(unidadeId?: string, limite = 50): Promise<OrdemServico[]> {
  const sb = await createClient();
  let q = sb.from("ordens_servico")
    .select("*, maquina:maquinas(codigo)")
    .order("aberta_em", { ascending: false })
    .limit(limite);
  if (unidadeId) q = q.eq("unidade_id", unidadeId);
  const { data, error } = await q;
  if (error) throw error;
  type Raw = Omit<OrdemServico, "maquina_codigo"> & { maquina: { codigo: string } | Array<{ codigo: string }> | null };
  return ((data ?? []) as Raw[]).map((r) => {
    const mc = Array.isArray(r.maquina) ? r.maquina[0]?.codigo : r.maquina?.codigo;
    return { ...r, maquina_codigo: mc ?? null };
  });
}

// LavSync · Financeiro · Carga dos dados do DRE (server)
//
// Recebe o client Supabase de quem chama: sessão do usuário (RLS) na tela e
// no PDF, service role no CLOCK. Mesmas regras do /financeiro: faturamento
// das vendas no fuso BR tem prioridade sobre lançamento manual; despesas
// agrupadas pela competência.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { paginarTodos } from "@/lib/supabase/pagination";
import type { CustoFixo, CustoVariavel } from "./engine";
import type { DadosDREUnidade, DespesaPaga } from "./dre-periodo";

const chave = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}`;

export async function carregarDadosDRE(sb: SupabaseClient, unidadeIds: string[]): Promise<DadosDREUnidade[]> {
  return Promise.all(unidadeIds.map((id) => carregarUnidade(sb, id)));
}

async function carregarUnidade(sb: SupabaseClient, unidadeId: string): Promise<DadosDREUnidade> {
  type Venda = { data_venda: string; valor: number | string };
  type Desp = { descricao: string; valor: number | string; vencimento: string; data_competencia: string | null;
    categoria: { nome: string } | Array<{ nome: string }> | null };

  const [unid, cfg, fixos, variaveis, lancs, itensInv, vendas, despesas] = await Promise.all([
    sb.from("unidades").select("nome").eq("id", unidadeId).maybeSingle(),
    sb.from("financeiro_unidades_config").select("*").eq("unidade_id", unidadeId).maybeSingle(),
    sb.from("financeiro_custos_fixos").select("*").eq("unidade_id", unidadeId).order("ordem"),
    sb.from("financeiro_custos_variaveis").select("*").eq("unidade_id", unidadeId).order("ordem"),
    sb.from("financeiro_lancamentos").select("ano, mes, faturamento_real").eq("unidade_id", unidadeId),
    sb.from("financeiro_investimento_itens").select("valor_projetado").eq("unidade_id", unidadeId),
    paginarTodos<Venda>((r) => sb.from("vendas").select("data_venda, valor")
      .eq("unidade_id", unidadeId).eq("situacao", "sucesso").order("id").range(r.from, r.to)),
    paginarTodos<Desp>((r) => sb.from("despesas")
      .select("descricao, valor, vencimento, data_competencia, categoria:categorias_financeiras(nome)")
      .eq("unidade_id", unidadeId).neq("status", "cancelada").order("id").range(r.from, r.to)),
  ]);

  const c = (cfg.data ?? {}) as Record<string, unknown>;

  // Faturamento: manual primeiro, vendas (fuso BR) sobrescrevem
  const faturamento_por_mes: Record<string, number> = {};
  for (const l of (lancs.data ?? []) as Array<{ ano: number; mes: number; faturamento_real: number | string | null }>) {
    if (l.faturamento_real != null && Number(l.faturamento_real) > 0) faturamento_por_mes[chave(l.ano, l.mes)] = Number(l.faturamento_real);
  }
  const vendasMes: Record<string, number> = {};
  for (const v of vendas) {
    const d = new Date(new Date(v.data_venda).getTime() - 3 * 3600_000);
    const kk = chave(d.getUTCFullYear(), d.getUTCMonth() + 1);
    vendasMes[kk] = (vendasMes[kk] ?? 0) + (Number(v.valor) || 0);
  }
  for (const [kk, v] of Object.entries(vendasMes)) if (v > 0) faturamento_por_mes[kk] = Math.round(v * 100) / 100;

  const despesas_por_mes: Record<string, DespesaPaga[]> = {};
  for (const d of despesas) {
    const cat = Array.isArray(d.categoria) ? d.categoria[0]?.nome : d.categoria?.nome;
    const kk = (d.data_competencia ?? d.vencimento).slice(0, 7);
    (despesas_por_mes[kk] ??= []).push({ descricao: d.descricao, categoria_nome: cat ?? "Sem categoria", valor: Number(d.valor) || 0 });
  }

  return {
    unidade_id: unidadeId,
    unidade_nome: (unid.data as { nome: string } | null)?.nome ?? "Unidade",
    mes_inauguracao: (c.mes_inauguracao as number | null) ?? null,
    ano_inauguracao: (c.ano_inauguracao as number | null) ?? null,
    potencial_faturamento: Number(c.potencial_faturamento ?? 42000),
    custos_fixos: ((fixos.data ?? []) as Array<Record<string, unknown>>).map((r): CustoFixo => ({
      id: r.id as string, descricao: r.descricao as string, valor_mensal: Number(r.valor_mensal),
      valor_inaugural: r.valor_inaugural != null ? Number(r.valor_inaugural) : null,
      meses_inaugural: r.meses_inaugural != null ? Number(r.meses_inaugural) : null,
      ativo: Boolean(r.ativo),
    })),
    custos_variaveis: ((variaveis.data ?? []) as Array<Record<string, unknown>>).map((r): CustoVariavel => ({
      id: r.id as string, descricao: r.descricao as string, tipo: r.tipo as CustoVariavel["tipo"],
      percentual_faturamento: r.percentual_faturamento != null ? Number(r.percentual_faturamento) : null,
      valor_minimo: r.valor_minimo != null ? Number(r.valor_minimo) : null,
      a_partir_do_mes: r.a_partir_do_mes != null ? Number(r.a_partir_do_mes) : null,
      ativo: Boolean(r.ativo),
    })),
    faturamento_por_mes,
    despesas_por_mes,
    investimento_total: ((itensInv.data ?? []) as Array<{ valor_projetado: number | string }>)
      .reduce((s, i) => s + (Number(i.valor_projetado) || 0), 0),
  };
}

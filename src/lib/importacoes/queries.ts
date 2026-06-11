// LavSync · Gerenciamento de importações (vendas + clientes)
import "server-only";
import { createClient } from "@/lib/supabase/server";

export type TipoImportacao = "vendas" | "clientes";

export type ImportacaoRow = {
  id: string;
  unidade_id: string;
  unidade_nome: string;
  arquivo_nome: string;
  arquivo_tamanho: number | null;
  origem_sistema: string;
  modo: string;
  total_linhas: number;
  total_inseridos: number;
  total_ignorados: number;
  total_erros: number;
  total_clientes_linkados: number;
  status: string;
  snapshot_em: string | null;
  criado_em: string;
  concluido_em: string | null;
  vendas_atualmente: number;   // vendas que ainda existem (não foram apagadas)
  erros_json: unknown;
};

export async function listarImportacoesVendas(): Promise<ImportacaoRow[]> {
  const sb = await createClient();
  const { data: imps, error } = await sb
    .from("vendas_importacoes")
    .select(`
      id, unidade_id, arquivo_nome, arquivo_tamanho, origem_sistema, modo,
      total_linhas, total_inseridos, total_ignorados, total_erros,
      total_clientes_linkados, status, snapshot_em, criado_em, concluido_em, erros,
      unidade:unidades(nome)
    `)
    .order("criado_em", { ascending: false })
    .limit(200);
  if (error) throw error;

  type Raw = {
    id: string; unidade_id: string; arquivo_nome: string; arquivo_tamanho: number | null;
    origem_sistema: string; modo: string; total_linhas: number; total_inseridos: number;
    total_ignorados: number; total_erros: number; total_clientes_linkados: number;
    status: string; snapshot_em: string | null; criado_em: string; concluido_em: string | null;
    erros: unknown;
    unidade: { nome: string } | Array<{ nome: string }> | null;
  };
  const rows = (imps ?? []) as Raw[];

  // Contagem agregada em SQL — evita corte de 1000 do PostgREST
  const ids = rows.map((r) => r.id);
  const vendasPorImp = new Map<string, number>();
  if (ids.length > 0) {
    const { data: contagens } = await sb.rpc("get_vendas_por_importacao", { imp_ids: ids });
    for (const c of (contagens ?? []) as Array<{ importacao_id: string; total: number | string }>) {
      vendasPorImp.set(c.importacao_id, Number(c.total) || 0);
    }
  }

  return rows.map((r) => {
    const unidadeNome = Array.isArray(r.unidade) ? r.unidade[0]?.nome : r.unidade?.nome;
    return {
      id: r.id,
      unidade_id: r.unidade_id,
      unidade_nome: unidadeNome ?? "—",
      arquivo_nome: r.arquivo_nome,
      arquivo_tamanho: r.arquivo_tamanho,
      origem_sistema: r.origem_sistema,
      modo: r.modo,
      total_linhas: r.total_linhas,
      total_inseridos: r.total_inseridos,
      total_ignorados: r.total_ignorados,
      total_erros: r.total_erros,
      total_clientes_linkados: r.total_clientes_linkados,
      status: r.status,
      snapshot_em: r.snapshot_em,
      criado_em: r.criado_em,
      concluido_em: r.concluido_em,
      vendas_atualmente: vendasPorImp.get(r.id) ?? 0,
      erros_json: r.erros,
    };
  });
}

// ─── IMPORTAÇÕES DE CLIENTES ─────────────────────────────────────────
export type ImportacaoClienteRow = {
  id: string;
  unidade_id: string;
  unidade_nome: string;
  arquivo_nome: string;
  arquivo_tamanho: number | null;
  origem_sistema: string;
  modo: string;
  total_linhas: number;
  total_inseridos: number;
  total_atualizados: number;
  total_ignorados: number;
  total_erros: number;
  status: string;
  snapshot_em: string | null;
  criado_em: string;
  concluido_em: string | null;
  clientes_atualmente: number;     // clientes ainda no banco vinculados a essa importação
  clientes_com_venda: number;      // os que têm vendas associadas (não podem ser apagados sem perder histórico)
  erros_json: unknown;
};

export async function listarImportacoesClientes(): Promise<ImportacaoClienteRow[]> {
  const sb = await createClient();
  const { data: imps, error } = await sb
    .from("clientes_importacoes")
    .select(`
      id, unidade_id, arquivo_nome, arquivo_tamanho, origem_sistema, modo,
      total_linhas, total_inseridos, total_atualizados, total_ignorados, total_erros,
      status, snapshot_em, criado_em, concluido_em, erros,
      unidade:unidades(nome)
    `)
    .order("criado_em", { ascending: false })
    .limit(200);
  if (error) throw error;

  type Raw = {
    id: string; unidade_id: string; arquivo_nome: string; arquivo_tamanho: number | null;
    origem_sistema: string; modo: string; total_linhas: number; total_inseridos: number;
    total_atualizados: number; total_ignorados: number; total_erros: number;
    status: string; snapshot_em: string | null; criado_em: string; concluido_em: string | null;
    erros: unknown;
    unidade: { nome: string } | Array<{ nome: string }> | null;
  };
  const rows = (imps ?? []) as Raw[];
  const ids = rows.map((r) => r.id);

  const totaisPorImp = new Map<string, { total: number; com_venda: number }>();
  if (ids.length > 0) {
    const { data: contagens } = await sb.rpc("get_clientes_por_importacao", { imp_ids: ids });
    for (const c of (contagens ?? []) as Array<{ importacao_id: string; total: number | string; com_venda: number | string }>) {
      totaisPorImp.set(c.importacao_id, {
        total: Number(c.total) || 0,
        com_venda: Number(c.com_venda) || 0,
      });
    }
  }

  return rows.map((r) => {
    const unidadeNome = Array.isArray(r.unidade) ? r.unidade[0]?.nome : r.unidade?.nome;
    const t = totaisPorImp.get(r.id) ?? { total: 0, com_venda: 0 };
    return {
      id: r.id,
      unidade_id: r.unidade_id,
      unidade_nome: unidadeNome ?? "—",
      arquivo_nome: r.arquivo_nome,
      arquivo_tamanho: r.arquivo_tamanho,
      origem_sistema: r.origem_sistema,
      modo: r.modo,
      total_linhas: r.total_linhas,
      total_inseridos: r.total_inseridos,
      total_atualizados: r.total_atualizados,
      total_ignorados: r.total_ignorados,
      total_erros: r.total_erros,
      status: r.status,
      snapshot_em: r.snapshot_em,
      criado_em: r.criado_em,
      concluido_em: r.concluido_em,
      clientes_atualmente: t.total,
      clientes_com_venda: t.com_venda,
      erros_json: r.erros,
    };
  });
}

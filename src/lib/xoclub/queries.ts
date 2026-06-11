import "server-only";
import { createClient } from "@/lib/supabase/server";
import { paginarTodos } from "@/lib/supabase/pagination";
import type { NivelXoClub } from "./niveis";

export type SaldoCliente = {
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  cliente_cpf: string;
  unidade_id: string | null;
  unidade_nome: string;
  saldo_atual: number;
  total_ganho_lifetime: number;
  total_resgatado_lifetime: number;
  nivel: NivelXoClub;
  ultima_movimentacao: string | null;
};

export type ResumoXoClub = {
  total_clientes: number;
  clientes_ativos: number;
  clientes_inativos: number;
  total_xc_emitidos: number;
  total_xc_resgatados: number;
  total_xc_em_circulacao: number;
  por_nivel: Record<NivelXoClub, number>;
  saldo_top10: SaldoCliente[];
};

export type Produto = {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: "fisico" | "operacional";
  custo_xc: number;
  valor_percebido_brl: number | null;
  custo_operacional_brl: number | null;
  estoque: number | null;
  estoque_alerta: number | null;
  imagem_url: string | null;
  efeito_tipo: string | null;
  efeito_valor_brl: number | null;
  validade_dias: number | null;
  ativo: boolean;
  ordem: number;
};

export type Resgate = {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  produto_id: string;
  produto_nome: string;
  produto_categoria: "fisico" | "operacional";
  unidade_id: string | null;
  unidade_nome: string;
  custo_xc: number;
  status: "solicitado" | "aprovado" | "entregue" | "cancelado";
  voucher_codigo: string | null;
  voucher_expira_em: string | null;
  solicitado_em: string;
  aprovado_em: string | null;
  entregue_em: string | null;
  cancelado_em: string | null;
};

export type Movimento = {
  id: string;
  cliente_id: string;
  tipo: string;
  valor: number;
  observacoes: string | null;
  data_movimento: string;
  expira_em: string | null;
};

export type XoClubConfig = {
  tenant_id: string;
  conversao_brl_xc: number;
  vencimento_meses: number | null;
  bonus_primeira_lavagem: number;
  bonus_cadastro_completo: number;
  bonus_aniversario: number;
  bonus_avaliacao_google: number;
  bonus_indicador: number;
  bonus_indicado: number;
  nivel_prata_min: number;
  nivel_ouro_min: number;
  nivel_diamante_min: number;
  store_gera_xc: boolean;
  alerta_proximo_resgate_xc: number;
  alerta_proximo_nivel_xc: number;
  alerta_inativo_dias: number;
  alerta_expiracao_dias: number;
  ativo: boolean;
};

export async function getConfigXoClub(): Promise<XoClubConfig | null> {
  const sb = await createClient();
  const { data } = await sb.from("xoclub_config").select("*").limit(1).maybeSingle();
  return (data ?? null) as XoClubConfig | null;
}

export async function getResumoXoClub(unidadeIds: string[]): Promise<ResumoXoClub> {
  const sb = await createClient();

  // Saldos (todos os clientes do programa)
  let qSaldo = sb.from("xoclub_saldos").select("nivel, saldo_atual, total_ganho_lifetime, total_resgatado_lifetime, ultima_movimentacao, unidade_id");
  if (unidadeIds.length > 0) qSaldo = qSaldo.in("unidade_id", unidadeIds);
  type SR = { nivel: NivelXoClub; saldo_atual: number; total_ganho_lifetime: number; total_resgatado_lifetime: number; ultima_movimentacao: string | null; unidade_id: string | null };
  const saldos = await paginarTodos<SR>((r) => {
    let q = sb.from("xoclub_saldos").select("nivel, saldo_atual, total_ganho_lifetime, total_resgatado_lifetime, ultima_movimentacao, unidade_id");
    if (unidadeIds.length > 0) q = q.in("unidade_id", unidadeIds);
    return q.range(r.from, r.to);
  });
  void qSaldo;

  const porNivel: Record<NivelXoClub, number> = { bronze: 0, prata: 0, ouro: 0, diamante: 0 };
  let emitidos = 0, resgatados = 0, emCirculacao = 0;
  let ativos = 0;
  const limiteAtividade = Date.now() - 45 * 24 * 3600 * 1000;
  for (const s of saldos) {
    porNivel[s.nivel] = (porNivel[s.nivel] ?? 0) + 1;
    emitidos += s.total_ganho_lifetime;
    resgatados += s.total_resgatado_lifetime;
    emCirculacao += s.saldo_atual;
    if (s.ultima_movimentacao && new Date(s.ultima_movimentacao).getTime() >= limiteAtividade) {
      ativos += 1;
    }
  }
  const total = saldos.length;

  // Top 10 com cliente + unidade resolvidos
  const top10 = await getSaldosClientes(unidadeIds, { limit: 10 });

  return {
    total_clientes: total,
    clientes_ativos: ativos,
    clientes_inativos: total - ativos,
    total_xc_emitidos: emitidos,
    total_xc_resgatados: resgatados,
    total_xc_em_circulacao: emCirculacao,
    por_nivel: porNivel,
    saldo_top10: top10,
  };
}

export async function getSaldosClientes(
  unidadeIds: string[],
  opts?: { limit?: number; offset?: number; nivel?: NivelXoClub | "todos"; busca?: string },
): Promise<SaldoCliente[]> {
  const sb = await createClient();
  const limit = opts?.limit ?? 100;
  const offset = opts?.offset ?? 0;
  let q = sb
    .from("xoclub_saldos")
    .select(`
      cliente_id, saldo_atual, total_ganho_lifetime, total_resgatado_lifetime, nivel, ultima_movimentacao, unidade_id,
      cliente:clientes(nome, telefone, cpf),
      unidade:unidades(nome)
    `)
    .order("saldo_atual", { ascending: false })
    .range(offset, offset + limit - 1);
  if (unidadeIds.length > 0) q = q.in("unidade_id", unidadeIds);
  if (opts?.nivel && opts.nivel !== "todos") q = q.eq("nivel", opts.nivel);
  const { data } = await q;
  type Raw = {
    cliente_id: string;
    saldo_atual: number;
    total_ganho_lifetime: number;
    total_resgatado_lifetime: number;
    nivel: NivelXoClub;
    ultima_movimentacao: string | null;
    unidade_id: string | null;
    cliente: { nome: string; telefone: string | null; cpf: string } | Array<{ nome: string; telefone: string | null; cpf: string }> | null;
    unidade: { nome: string } | Array<{ nome: string }> | null;
  };
  const rows = (data ?? []) as unknown as Raw[];
  const buscaNorm = (opts?.busca ?? "").trim().toLowerCase();
  return rows
    .map((r) => {
      const cli = Array.isArray(r.cliente) ? r.cliente[0] : r.cliente;
      const und = Array.isArray(r.unidade) ? r.unidade[0] : r.unidade;
      return {
        cliente_id: r.cliente_id,
        cliente_nome: cli?.nome ?? "—",
        cliente_telefone: cli?.telefone ?? null,
        cliente_cpf: cli?.cpf ?? "",
        unidade_id: r.unidade_id,
        unidade_nome: und?.nome ?? "—",
        saldo_atual: r.saldo_atual,
        total_ganho_lifetime: r.total_ganho_lifetime,
        total_resgatado_lifetime: r.total_resgatado_lifetime,
        nivel: r.nivel,
        ultima_movimentacao: r.ultima_movimentacao,
      };
    })
    .filter((s) => !buscaNorm
      || s.cliente_nome.toLowerCase().includes(buscaNorm)
      || s.cliente_cpf.replace(/\D/g, "").includes(buscaNorm.replace(/\D/g, ""))
      || (s.cliente_telefone ?? "").includes(buscaNorm));
}

export async function getProdutos(somenteAtivos = false): Promise<Produto[]> {
  const sb = await createClient();
  let q = sb.from("xoclub_produtos").select("*").order("ordem");
  if (somenteAtivos) q = q.eq("ativo", true);
  const { data } = await q;
  return ((data ?? []) as Produto[]);
}

export async function getResgates(opts?: { status?: Resgate["status"] | "todos"; limit?: number }): Promise<Resgate[]> {
  const sb = await createClient();
  const limit = opts?.limit ?? 200;
  let q = sb
    .from("xoclub_resgates")
    .select(`
      id, cliente_id, produto_id, unidade_id, custo_xc, status,
      voucher_codigo, voucher_expira_em, solicitado_em, aprovado_em, entregue_em, cancelado_em,
      cliente:clientes(nome, telefone),
      produto:xoclub_produtos(nome, categoria),
      unidade:unidades(nome)
    `)
    .order("solicitado_em", { ascending: false })
    .limit(limit);
  if (opts?.status && opts.status !== "todos") q = q.eq("status", opts.status);
  const { data } = await q;
  type Raw = {
    id: string; cliente_id: string; produto_id: string; unidade_id: string | null;
    custo_xc: number; status: Resgate["status"];
    voucher_codigo: string | null; voucher_expira_em: string | null;
    solicitado_em: string; aprovado_em: string | null; entregue_em: string | null; cancelado_em: string | null;
    cliente: { nome: string; telefone: string | null } | Array<{ nome: string; telefone: string | null }> | null;
    produto: { nome: string; categoria: "fisico" | "operacional" } | Array<{ nome: string; categoria: "fisico" | "operacional" }> | null;
    unidade: { nome: string } | Array<{ nome: string }> | null;
  };
  return ((data ?? []) as unknown as Raw[]).map((r) => {
    const cli = Array.isArray(r.cliente) ? r.cliente[0] : r.cliente;
    const prd = Array.isArray(r.produto) ? r.produto[0] : r.produto;
    const und = Array.isArray(r.unidade) ? r.unidade[0] : r.unidade;
    return {
      id: r.id,
      cliente_id: r.cliente_id,
      cliente_nome: cli?.nome ?? "—",
      cliente_telefone: cli?.telefone ?? null,
      produto_id: r.produto_id,
      produto_nome: prd?.nome ?? "—",
      produto_categoria: prd?.categoria ?? "fisico",
      unidade_id: r.unidade_id,
      unidade_nome: und?.nome ?? "—",
      custo_xc: r.custo_xc,
      status: r.status,
      voucher_codigo: r.voucher_codigo,
      voucher_expira_em: r.voucher_expira_em,
      solicitado_em: r.solicitado_em,
      aprovado_em: r.aprovado_em,
      entregue_em: r.entregue_em,
      cancelado_em: r.cancelado_em,
    };
  });
}

export async function getMovimentosCliente(clienteId: string, limit = 50): Promise<Movimento[]> {
  const sb = await createClient();
  const { data } = await sb
    .from("xoclub_movimentos")
    .select("id, cliente_id, tipo, valor, observacoes, data_movimento, expira_em")
    .eq("cliente_id", clienteId)
    .order("data_movimento", { ascending: false })
    .limit(limit);
  return (data ?? []) as Movimento[];
}

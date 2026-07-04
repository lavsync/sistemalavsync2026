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
  // XÔ Club Recompensas não tem título/nível — o que vale é o SALDO,
  // desde quando o cliente é nosso e há quanto tempo:
  cadastrado_em: string | null;
  dias_de_cliente: number | null;
  ultima_compra_em: string | null;
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

  // Top 10 com cliente + unidade resolvidos (lista completa vem ordenada por saldo)
  const top10 = (await getSaldosClientes(unidadeIds)).slice(0, 10);

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
  // XÔ Club Recompensas: lista TODOS os clientes que já lavaram ou secaram
  // alguma vez, desde o primeiro dia da unidade (base = clientes com compra),
  // com o saldo LavCoin (1 LavCoin por R$1 gasto). Sem título/nível.
  const sb = await createClient();

  type Cli = {
    id: string; nome: string; telefone: string | null; cpf: string;
    unidade_id: string | null; cadastrado_em: string | null; ultima_compra_em: string | null;
  };
  const clientes = await paginarTodos<Cli>((r) => {
    let q = sb.from("clientes")
      .select("id, nome, telefone, cpf, unidade_id, cadastrado_em, ultima_compra_em")
      .gte("compras_total_qtd", 1);
    if (unidadeIds.length > 0) q = q.in("unidade_id", unidadeIds);
    return q.order("id").range(r.from, r.to);
  });

  // saldos em lote
  const saldoMap = new Map<string, { saldo_atual: number; total_ganho_lifetime: number; total_resgatado_lifetime: number; nivel: NivelXoClub; ultima_movimentacao: string | null }>();
  const ids = clientes.map((c) => c.id);
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await sb.from("xoclub_saldos")
      .select("cliente_id, saldo_atual, total_ganho_lifetime, total_resgatado_lifetime, nivel, ultima_movimentacao")
      .in("cliente_id", ids.slice(i, i + 500));
    for (const s of (data ?? []) as Array<{ cliente_id: string; saldo_atual: number; total_ganho_lifetime: number; total_resgatado_lifetime: number; nivel: NivelXoClub; ultima_movimentacao: string | null }>) {
      saldoMap.set(s.cliente_id, s);
    }
  }
  const { data: unds } = await sb.from("unidades").select("id, nome");
  const undMap = new Map(((unds ?? []) as Array<{ id: string; nome: string }>).map((u) => [u.id, u.nome]));

  const agora = Date.now();
  const buscaNorm = (opts?.busca ?? "").trim().toLowerCase();
  return clientes
    .map((c) => {
      const s = saldoMap.get(c.id);
      return {
        cliente_id: c.id,
        cliente_nome: c.nome,
        cliente_telefone: c.telefone,
        cliente_cpf: c.cpf,
        unidade_id: c.unidade_id,
        unidade_nome: c.unidade_id ? (undMap.get(c.unidade_id) ?? "—") : "—",
        saldo_atual: s?.saldo_atual ?? 0,
        total_ganho_lifetime: s?.total_ganho_lifetime ?? 0,
        total_resgatado_lifetime: s?.total_resgatado_lifetime ?? 0,
        nivel: s?.nivel ?? ("bronze" as NivelXoClub),
        ultima_movimentacao: s?.ultima_movimentacao ?? null,
        cadastrado_em: c.cadastrado_em,
        dias_de_cliente: c.cadastrado_em
          ? Math.max(0, Math.floor((agora - new Date(c.cadastrado_em).getTime()) / 86400000))
          : null,
        ultima_compra_em: c.ultima_compra_em,
      };
    })
    .sort((a, b) => b.saldo_atual - a.saldo_atual)
    .filter((s) => !buscaNorm
      || s.cliente_nome.toLowerCase().includes(buscaNorm)
      || s.cliente_cpf.replace(/\D/g, "").includes(buscaNorm.replace(/\D/g, ""))
      || (s.cliente_telefone ?? "").includes(buscaNorm));
}

// ─── Quem usou a lavanderia ONTEM (mensagem de atualização de saldo) ────────
export type UsuarioDoDia = {
  cliente_id: string;
  nome: string;
  telefone: string | null;
  cpf: string;
  unidade_id: string;
  unidade_nome: string;
  gasto_dia: number;          // R$ gastos no dia = LavCoins ganhos
  ciclos_dia: number;
  saldo_lavcoins: number;     // saldo total atual
  dias_de_cliente: number | null;
};

export async function getUsuariosDeOntem(): Promise<{ dia: string; usuarios: UsuarioDoDia[] }> {
  const sb = await createClient();
  const hojeBR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const ontem = new Date(hojeBR.getTime() - 86400000);
  const dia = `${ontem.getFullYear()}-${String(ontem.getMonth() + 1).padStart(2, "0")}-${String(ontem.getDate()).padStart(2, "0")}`;

  type V = { cliente_id: string | null; unidade_id: string; valor: number | string; quantidade_ciclos: number | string | null };
  const vendas = await paginarTodos<V>((r) =>
    sb.from("vendas")
      .select("cliente_id, unidade_id, valor, quantidade_ciclos")
      .eq("situacao", "sucesso")
      .gte("data_venda", `${dia}T00:00:00-03:00`)
      .lte("data_venda", `${dia}T23:59:59.999-03:00`)
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
  const cliMap = new Map<string, { nome: string; telefone: string | null; cpf: string; cadastrado_em: string | null }>();
  const saldoMap = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 500) {
    const slice = ids.slice(i, i + 500);
    const [{ data: cs }, { data: ss }] = await Promise.all([
      sb.from("clientes").select("id, nome, telefone, cpf, cadastrado_em").in("id", slice),
      sb.from("xoclub_saldos").select("cliente_id, saldo_atual").in("cliente_id", slice),
    ]);
    for (const c of (cs ?? []) as Array<{ id: string; nome: string; telefone: string | null; cpf: string; cadastrado_em: string | null }>) cliMap.set(c.id, c);
    for (const s of (ss ?? []) as Array<{ cliente_id: string; saldo_atual: number }>) saldoMap.set(s.cliente_id, s.saldo_atual);
  }
  const { data: unds } = await sb.from("unidades").select("id, nome");
  const undMap = new Map(((unds ?? []) as Array<{ id: string; nome: string }>).map((u) => [u.id, u.nome]));

  const agora = Date.now();
  const usuarios: UsuarioDoDia[] = [...agg.entries()].map(([cid, a]) => {
    const c = cliMap.get(cid);
    return {
      cliente_id: cid,
      nome: c?.nome ?? "—",
      telefone: c?.telefone ?? null,
      cpf: c?.cpf ?? "",
      unidade_id: a.unidade_id,
      unidade_nome: undMap.get(a.unidade_id) ?? "—",
      gasto_dia: Math.round(a.gasto * 100) / 100,
      ciclos_dia: a.ciclos,
      saldo_lavcoins: saldoMap.get(cid) ?? 0,
      dias_de_cliente: c?.cadastrado_em
        ? Math.max(0, Math.floor((agora - new Date(c.cadastrado_em).getTime()) / 86400000))
        : null,
    };
  }).sort((a, b) => b.gasto_dia - a.gasto_dia);

  return { dia, usuarios };
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

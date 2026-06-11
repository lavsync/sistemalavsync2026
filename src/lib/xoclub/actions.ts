"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function gerarVoucher(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "XC-";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// ─── PRODUTOS ─────────────────────────────────────────────────────
export type ProdutoInput = {
  nome: string;
  descricao?: string | null;
  categoria: "fisico" | "operacional";
  custo_xc: number;
  valor_percebido_brl?: number | null;
  custo_operacional_brl?: number | null;
  estoque?: number | null;
  estoque_alerta?: number | null;
  imagem_url?: string | null;
  efeito_tipo?: string | null;
  efeito_valor_brl?: number | null;
  validade_dias?: number | null;
  ativo?: boolean;
  ordem?: number;
};

export async function salvarProduto(id: string | null, input: ProdutoInput) {
  const sb = await createClient();
  if (id) {
    const { error } = await sb.from("xoclub_produtos").update(input).eq("id", id);
    if (error) throw error;
  } else {
    const { data: tenant } = await sb.from("tenants").select("id").limit(1).maybeSingle();
    if (!tenant) throw new Error("tenant não encontrado");
    const { error } = await sb.from("xoclub_produtos").insert({ ...input, tenant_id: (tenant as { id: string }).id });
    if (error) throw error;
  }
  revalidatePath("/publicidade");
}

export async function deletarProduto(id: string) {
  const sb = await createClient();
  const { error } = await sb.from("xoclub_produtos").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/publicidade");
}

// ─── RESGATES ─────────────────────────────────────────────────────
/** Cliente solicita resgate. Debita XC e cria registro em status 'solicitado'. */
export async function solicitarResgate(clienteId: string, produtoId: string, observacoes?: string) {
  const sb = await createClient();

  const { data: prod } = await sb.from("xoclub_produtos")
    .select("id, tenant_id, nome, custo_xc, ativo, estoque, validade_dias")
    .eq("id", produtoId).maybeSingle();
  if (!prod) throw new Error("Produto não encontrado");
  type P = { id: string; tenant_id: string; nome: string; custo_xc: number; ativo: boolean; estoque: number | null; validade_dias: number | null };
  const p = prod as P;
  if (!p.ativo) throw new Error("Produto inativo");

  const { data: saldo } = await sb.from("xoclub_saldos")
    .select("saldo_atual, unidade_id").eq("cliente_id", clienteId).maybeSingle();
  if (!saldo) throw new Error("Cliente sem saldo XÔ Club");
  const s = saldo as { saldo_atual: number; unidade_id: string | null };
  if (s.saldo_atual < p.custo_xc) {
    throw new Error(`Saldo insuficiente. Tem ${s.saldo_atual} XC · precisa de ${p.custo_xc} XC`);
  }
  if (p.estoque != null && p.estoque <= 0) throw new Error("Sem estoque");

  // 1. Debita XC (movimento negativo)
  const { data: mov, error: errMov } = await sb.from("xoclub_movimentos").insert({
    tenant_id: p.tenant_id,
    cliente_id: clienteId,
    unidade_id: s.unidade_id,
    tipo: "resgate",
    valor: -p.custo_xc,
    observacoes: `Resgate · ${p.nome}` + (observacoes ? ` · ${observacoes}` : ""),
  }).select("id").single();
  if (errMov) throw errMov;

  // 2. Cria resgate
  const validade = p.validade_dias
    ? new Date(Date.now() + p.validade_dias * 24 * 3600 * 1000).toISOString()
    : null;
  const { data: resg, error: errResg } = await sb.from("xoclub_resgates").insert({
    tenant_id: p.tenant_id,
    cliente_id: clienteId,
    produto_id: p.id,
    unidade_id: s.unidade_id,
    custo_xc: p.custo_xc,
    status: "solicitado",
    voucher_expira_em: validade,
    observacoes,
    movimento_id: (mov as { id: string }).id,
  }).select("id").single();
  if (errResg) throw errResg;

  // 3. Reduz estoque se aplicável
  if (p.estoque != null) {
    await sb.from("xoclub_produtos").update({ estoque: p.estoque - 1 }).eq("id", p.id);
  }

  revalidatePath("/publicidade");
  return { resgateId: (resg as { id: string }).id };
}

export async function aprovarResgate(resgateId: string) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const voucher = gerarVoucher();
  const { error } = await sb.from("xoclub_resgates").update({
    status: "aprovado",
    voucher_codigo: voucher,
    aprovado_em: new Date().toISOString(),
    aprovado_por: user?.id ?? null,
  }).eq("id", resgateId);
  if (error) throw error;
  revalidatePath("/publicidade");
  return { voucher };
}

export async function entregarResgate(resgateId: string) {
  const sb = await createClient();
  const { error } = await sb.from("xoclub_resgates").update({
    status: "entregue",
    entregue_em: new Date().toISOString(),
  }).eq("id", resgateId);
  if (error) throw error;
  revalidatePath("/publicidade");
}

/** Cancela resgate e estorna XC. */
export async function cancelarResgate(resgateId: string, motivo: string) {
  const sb = await createClient();

  const { data: r } = await sb.from("xoclub_resgates")
    .select("id, status, cliente_id, unidade_id, custo_xc, tenant_id, produto_id")
    .eq("id", resgateId).maybeSingle();
  if (!r) throw new Error("Resgate não encontrado");
  type R = { id: string; status: string; cliente_id: string; unidade_id: string | null; custo_xc: number; tenant_id: string; produto_id: string };
  const rr = r as R;
  if (rr.status === "entregue") throw new Error("Resgate já entregue não pode ser cancelado");
  if (rr.status === "cancelado") throw new Error("Resgate já cancelado");

  // Estorna XC
  await sb.from("xoclub_movimentos").insert({
    tenant_id: rr.tenant_id,
    cliente_id: rr.cliente_id,
    unidade_id: rr.unidade_id,
    tipo: "estorno",
    valor: rr.custo_xc,
    observacoes: `Cancelamento de resgate · ${motivo}`,
  });

  // Marca resgate como cancelado
  await sb.from("xoclub_resgates").update({
    status: "cancelado",
    cancelado_em: new Date().toISOString(),
    cancelado_motivo: motivo,
  }).eq("id", resgateId);

  // Devolve estoque
  const { data: prod } = await sb.from("xoclub_produtos")
    .select("estoque").eq("id", rr.produto_id).maybeSingle();
  if (prod && (prod as { estoque: number | null }).estoque != null) {
    await sb.from("xoclub_produtos")
      .update({ estoque: ((prod as { estoque: number }).estoque) + 1 })
      .eq("id", rr.produto_id);
  }

  revalidatePath("/publicidade");
}

// ─── AJUSTE MANUAL ──────────────────────────────────────────────
export async function creditarAjusteManual(clienteId: string, xc: number, motivo: string) {
  if (xc === 0) throw new Error("Valor não pode ser zero");
  const sb = await createClient();
  const { data: cli } = await sb.from("clientes")
    .select("tenant_id, unidade_id").eq("id", clienteId).maybeSingle();
  if (!cli) throw new Error("Cliente não encontrado");
  const c = cli as { tenant_id: string; unidade_id: string };
  const { error } = await sb.from("xoclub_movimentos").insert({
    tenant_id: c.tenant_id,
    cliente_id: clienteId,
    unidade_id: c.unidade_id,
    tipo: "ajuste_manual",
    valor: xc,
    observacoes: motivo,
  });
  if (error) throw error;
  revalidatePath("/publicidade");
}

// ─── CONFIG ─────────────────────────────────────────────────────
export async function salvarConfigXoClub(patch: Record<string, unknown>) {
  const sb = await createClient();
  const { data: cfg } = await sb.from("xoclub_config").select("tenant_id").limit(1).maybeSingle();
  if (!cfg) throw new Error("config não encontrada");
  const { error } = await sb.from("xoclub_config")
    .update({ ...patch, atualizado_em: new Date().toISOString() })
    .eq("tenant_id", (cfg as { tenant_id: string }).tenant_id);
  if (error) throw error;
  revalidatePath("/publicidade");
}

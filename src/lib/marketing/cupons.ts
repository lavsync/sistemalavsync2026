// LavSync · Marketing · Uso de cupons, vouchers e benefícios
//
// Varre a planilha de vendas (voucher_codigo / cupom_codigo) no mês e
// agrupa por código. Detecta possível COMPARTILHAMENTO: mesmo código
// usado por mais de um CPF (ex.: cliente Diamante passando o cupom
// exclusivo pra terceiros). O PDV MaxLav ainda não vincula cupom a CPF —
// este controle é a ponte até lá.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { paginarTodos } from "@/lib/supabase/pagination";
import { janelaMesBR } from "@/lib/clube/engine";

export type UsoCupom = {
  data: string;
  codigo: string;
  origem: "voucher" | "cupom";
  categoria: string | null;
  cliente_nome: string;
  cpf: string;
  unidade_nome: string;
  valor: number;
  desconto: number;
};

export type CodigoCupom = {
  codigo: string;
  origem: "voucher" | "cupom";
  categoria: string | null;
  usos: number;
  cpfs_distintos: number;
  compartilhado: boolean;         // >1 CPF no mesmo código = investigar
  valor_total: number;
  desconto_total: number;
  clientes: Array<{ nome: string; cpf: string; usos: number }>;
  unidades: string[];
};

export type RelatorioCupons = {
  mes: string;
  total_usos: number;
  total_codigos: number;
  codigos_compartilhados: number;
  valor_total: number;
  desconto_total: number;
  codigos: CodigoCupom[];
  usos: UsoCupom[];
};

export async function relatorioCupons(mesRef: string): Promise<RelatorioCupons> {
  const sb = await createClient();
  const { ini, fim } = janelaMesBR(mesRef);

  type V = {
    data_venda: string; unidade_id: string; cliente_id: string | null;
    cpf: string | null; nome_cliente: string | null;
    valor: number | string; desconto: number | string | null;
    voucher_codigo: string | null; voucher_categoria: string | null;
    cupom_codigo: string | null;
  };
  const vendas = await paginarTodos<V>((r) =>
    sb.from("vendas")
      .select("data_venda, unidade_id, cliente_id, cpf, nome_cliente, valor, desconto, voucher_codigo, voucher_categoria, cupom_codigo")
      .eq("situacao", "sucesso")
      .gte("data_venda", ini)
      .lte("data_venda", fim)
      .or("voucher_codigo.not.is.null,cupom_codigo.not.is.null")
      .range(r.from, r.to),
  );

  const { data: unds } = await sb.from("unidades").select("id, nome");
  const undMap = new Map(((unds ?? []) as Array<{ id: string; nome: string }>).map((u) => [u.id, u.nome]));

  // Nome do cliente pelo cadastro (fallback: nome da venda)
  const ids = [...new Set(vendas.map((v) => v.cliente_id).filter(Boolean))] as string[];
  const nomeMap = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await sb.from("clientes").select("id, nome").in("id", ids.slice(i, i + 500));
    for (const c of (data ?? []) as Array<{ id: string; nome: string }>) nomeMap.set(c.id, c.nome);
  }

  const usos: UsoCupom[] = [];
  for (const v of vendas) {
    const codigo = v.voucher_codigo ?? v.cupom_codigo;
    if (!codigo) continue;
    usos.push({
      data: v.data_venda,
      codigo,
      origem: v.voucher_codigo ? "voucher" : "cupom",
      categoria: v.voucher_categoria,
      cliente_nome: (v.cliente_id ? nomeMap.get(v.cliente_id) : null) ?? v.nome_cliente ?? "—",
      cpf: (v.cpf ?? "").replace(/\D/g, ""),
      unidade_nome: undMap.get(v.unidade_id) ?? "—",
      valor: Number(v.valor) || 0,
      desconto: Number(v.desconto) || 0,
    });
  }
  usos.sort((a, b) => b.data.localeCompare(a.data));

  // Agrupar por código
  const porCodigo = new Map<string, CodigoCupom & { _cpfs: Map<string, { nome: string; usos: number }>; _unidades: Set<string> }>();
  for (const u of usos) {
    const cur = porCodigo.get(u.codigo) ?? {
      codigo: u.codigo, origem: u.origem, categoria: u.categoria,
      usos: 0, cpfs_distintos: 0, compartilhado: false,
      valor_total: 0, desconto_total: 0, clientes: [], unidades: [],
      _cpfs: new Map(), _unidades: new Set<string>(),
    };
    cur.usos += 1;
    cur.valor_total += u.valor;
    cur.desconto_total += u.desconto;
    cur._unidades.add(u.unidade_nome);
    const chaveCpf = u.cpf || `sem-cpf:${u.cliente_nome}`;
    const c = cur._cpfs.get(chaveCpf) ?? { nome: u.cliente_nome, usos: 0 };
    c.usos += 1;
    cur._cpfs.set(chaveCpf, c);
    porCodigo.set(u.codigo, cur);
  }

  const codigos: CodigoCupom[] = [...porCodigo.values()].map((c) => ({
    codigo: c.codigo,
    origem: c.origem,
    categoria: c.categoria,
    usos: c.usos,
    cpfs_distintos: c._cpfs.size,
    compartilhado: c._cpfs.size > 1,
    valor_total: Math.round(c.valor_total * 100) / 100,
    desconto_total: Math.round(c.desconto_total * 100) / 100,
    clientes: [...c._cpfs.entries()]
      .map(([cpf, d]) => ({ nome: d.nome, cpf: cpf.startsWith("sem-cpf:") ? "" : cpf, usos: d.usos }))
      .sort((a, b) => b.usos - a.usos),
    unidades: [...c._unidades],
  })).sort((a, b) => (Number(b.compartilhado) - Number(a.compartilhado)) || b.usos - a.usos);

  return {
    mes: mesRef,
    total_usos: usos.length,
    total_codigos: codigos.length,
    codigos_compartilhados: codigos.filter((c) => c.compartilhado).length,
    valor_total: Math.round(usos.reduce((s, u) => s + u.valor, 0) * 100) / 100,
    desconto_total: Math.round(usos.reduce((s, u) => s + u.desconto, 0) * 100) / 100,
    codigos,
    usos,
  };
}

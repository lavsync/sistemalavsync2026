// LavSync · Fidelidade · Relatório gerencial de classificação
//
// Dataset completo do mês (aplicação) com demografia do cliente + LavCoins,
// para a central de visualização/filtro/export do gestor de marketing.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { paginarTodos } from "@/lib/supabase/pagination";

export type LinhaRelatorio = {
  cliente_id: string;
  nome: string;
  cpf: string;
  telefone: string | null;
  genero: string | null;
  idade: number | null;
  cadastrado_em: string | null;
  unidade_id: string;
  unidade_nome: string;
  nivel: string;
  desconto_pct: number;
  ciclos_mes: number;
  ciclos_lavagem: number;
  ciclos_secagem: number;
  faturamento_mes: number;
  lavcoins_saldo: number;
  ultima_compra_em: string | null;
};

function idadeDe(nascimento: string | null): number | null {
  if (!nascimento) return null;
  const n = new Date(nascimento + "T12:00:00");
  if (isNaN(n.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - n.getFullYear();
  const m = hoje.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < n.getDate())) idade--;
  return idade;
}

export async function relatorioFidelidade(mesAplicacao: string): Promise<LinhaRelatorio[]> {
  const sb = await createClient();

  type Raw = {
    cliente_id: string; unidade_id: string; nivel: string; desconto_pct: number;
    ciclos_mes: number; ciclos_lavagem: number; ciclos_secagem: number; faturamento_mes: number;
    cliente: { nome: string; cpf: string; telefone: string | null; genero: string | null; data_nascimento: string | null; cadastrado_em: string | null; ultima_compra_em: string | null } | Array<{ nome: string; cpf: string; telefone: string | null; genero: string | null; data_nascimento: string | null; cadastrado_em: string | null; ultima_compra_em: string | null }> | null;
    unidade: { nome: string } | Array<{ nome: string }> | null;
  };

  const rows = await paginarTodos<Raw>((r) =>
    sb.from("clube_classificacoes")
      .select(`
        cliente_id, unidade_id, nivel, desconto_pct,
        ciclos_mes, ciclos_lavagem, ciclos_secagem, faturamento_mes,
        cliente:clientes(nome, cpf, telefone, genero, data_nascimento, cadastrado_em, ultima_compra_em),
        unidade:unidades(nome)
      `)
      .eq("mes_aplicacao", mesAplicacao)
      .order("ciclos_mes", { ascending: false })
      .range(r.from, r.to) as never,
  );

  const ids = rows.map((r) => r.cliente_id);
  const saldos = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await sb
      .from("xoclub_saldos").select("cliente_id, saldo_atual").in("cliente_id", ids.slice(i, i + 500));
    for (const s of (data ?? []) as Array<{ cliente_id: string; saldo_atual: number }>) {
      saldos.set(s.cliente_id, s.saldo_atual);
    }
  }

  return rows.map((r) => {
    const cli = Array.isArray(r.cliente) ? (r.cliente[0] ?? null) : r.cliente;
    const uni = Array.isArray(r.unidade) ? (r.unidade[0] ?? null) : r.unidade;
    return {
      cliente_id: r.cliente_id,
      nome: cli?.nome ?? "—",
      cpf: cli?.cpf ?? "—",
      telefone: cli?.telefone ?? null,
      genero: cli?.genero ?? null,
      idade: idadeDe(cli?.data_nascimento ?? null),
      cadastrado_em: cli?.cadastrado_em ?? null,
      unidade_id: r.unidade_id,
      unidade_nome: uni?.nome ?? "—",
      nivel: r.nivel,
      desconto_pct: Number(r.desconto_pct) || 0,
      ciclos_mes: r.ciclos_mes,
      ciclos_lavagem: r.ciclos_lavagem,
      ciclos_secagem: r.ciclos_secagem,
      faturamento_mes: Number(r.faturamento_mes) || 0,
      lavcoins_saldo: saldos.get(r.cliente_id) ?? 0,
      ultima_compra_em: cli?.ultima_compra_em ?? null,
    };
  });
}

"use server";
// LavSync · Clube · Portal público de consulta do cliente (/meu-clube)
//
// Ação anônima: cliente digita o CPF e vê SÓ os dados do programa
// (primeiro nome, nível/desconto vigente, ciclos do mês, LavCoins).
// Nunca expor telefone/CPF completo/endereço — LGPD.
import { createAdminClient } from "@/lib/supabase/admin";
import { classificar, proximoNivel } from "./niveis";
import { janelaMesBR } from "./engine";

export type ConsultaClube = {
  ok: boolean;
  erro?: string;
  primeiroNome?: string;
  nivelVigente?: string;          // nível que dá desconto NESTE mês
  descontoVigente?: number;
  ciclosMesAtual?: number;
  nivelProjetado?: string;        // nível que os ciclos atuais garantem pro mês que vem
  faltamCiclos?: number;
  proximoNivel?: string | null;
  descontoProximo?: number;
  lavcoins?: number;
  pontosClube?: number;
};

export async function consultarMeuClube(cpfInput: string): Promise<ConsultaClube> {
  const cpf = (cpfInput ?? "").replace(/\D/g, "");
  if (cpf.length !== 11) return { ok: false, erro: "Informe um CPF válido (11 dígitos)." };

  const sb = createAdminClient();
  const { data: cli } = await sb
    .from("clientes")
    .select("id, nome")
    .eq("cpf", cpf)
    .maybeSingle();
  const cliente = cli as { id: string; nome: string } | null;
  if (!cliente) return { ok: false, erro: "CPF não encontrado. Use o mesmo CPF digitado nas máquinas." };

  const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;

  // Nível vigente (classificação aplicada neste mês)
  const { data: cl } = await sb
    .from("clube_classificacoes")
    .select("nivel, desconto_pct")
    .eq("cliente_id", cliente.id)
    .eq("mes_aplicacao", mesAtual)
    .maybeSingle();
  const vigente = cl as { nivel: string; desconto_pct: number } | null;

  // Ciclos do mês corrente (mesma janela BR do motor)
  const { ini, fim } = janelaMesBR(mesAtual);
  const { data: vendas } = await sb
    .from("vendas")
    .select("quantidade_ciclos")
    .eq("cliente_id", cliente.id)
    .eq("situacao", "sucesso")
    .gte("data_venda", ini)
    .lte("data_venda", fim)
    .limit(1000);
  const ciclos = ((vendas ?? []) as Array<{ quantidade_ciclos: number | null }>)
    .reduce((s, v) => s + Math.max(1, Number(v.quantidade_ciclos) || 1), 0);
  const nivelAtual = classificar(ciclos);
  const prox = proximoNivel(ciclos);

  // Saldos
  const [{ data: xc }, { data: pts }] = await Promise.all([
    sb.from("xoclub_saldos").select("saldo_atual").eq("cliente_id", cliente.id).maybeSingle(),
    sb.from("clube_pontos").select("saldo_pontos").eq("cliente_id", cliente.id).maybeSingle(),
  ]);

  return {
    ok: true,
    primeiroNome: cliente.nome.split(" ")[0],
    nivelVigente: vigente?.nivel ?? undefined,
    descontoVigente: vigente ? Number(vigente.desconto_pct) : 0,
    ciclosMesAtual: ciclos,
    nivelProjetado: nivelAtual.key,
    faltamCiclos: prox.faltam,
    proximoNivel: prox.proximo?.key ?? null,
    descontoProximo: prox.proximo?.descontoPct ?? 0,
    lavcoins: (xc as { saldo_atual: number } | null)?.saldo_atual ?? 0,
    pontosClube: (pts as { saldo_pontos: number } | null)?.saldo_pontos ?? 0,
  };
}

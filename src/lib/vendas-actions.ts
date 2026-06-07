"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type VendaPayload = {
  _linha: number;
  data_venda: string;
  equipamento: string | null;
  pdv: string | null;
  situacao: string;
  tipo_pagamento: string;
  valor: number;
  valor_sem_desconto: number | null;
  bandeira_cartao: string | null;
  tipo_cartao: string | null;
  numero_cartao: string | null;
  autorizador: string | null;
  voucher_codigo: string | null;
  voucher_categoria: string | null;
  cupom_codigo: string | null;
  cupom_requisicao: string | null;
  cpf: string | null;
  nome_cliente: string | null;
  telefone_cliente: string | null;
  requisicao: string | null;
  cod_autorizacao: string | null;
  erro: string | null;
  detalhes_erro: string | null;
  provedor: string | null;
  adquirente: string | null;
  tipo_servico: string;
  quantidade_ciclos: number;
};

export type ImportVendasResult = {
  importacaoId: string;
  totalLinhas: number;
  inseridos: number;
  ignorados: number;
  clientesLinkados: number;
  erros: Array<{ linha: number; motivo: string }>;
};

function digitos(s: string | null): string {
  return (s ?? "").replace(/\D/g, "");
}

export async function importarVendas(
  unidadeId: string,
  payloads: VendaPayload[],
  meta: {
    arquivoNome: string;
    arquivoTamanho?: number;
    origemSistema?: string;
    snapshotEm?: string | null;
  },
): Promise<ImportVendasResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: unid, error: errUnid } = await supabase
    .from("unidades").select("id, tenant_id").eq("id", unidadeId).maybeSingle();
  if (errUnid) throw errUnid;
  if (!unid) throw new Error("Unidade não encontrada");

  const { data: usrApp } = await supabase
    .from("usuarios").select("id").eq("id", user.id).maybeSingle();

  // Cria importacao em estado "processando"
  const { data: imp, error: errImp } = await supabase
    .from("vendas_importacoes")
    .insert({
      tenant_id: unid.tenant_id,
      unidade_id: unidadeId,
      usuario_id: usrApp?.id ?? null,
      arquivo_nome: meta.arquivoNome,
      arquivo_tamanho: meta.arquivoTamanho ?? null,
      origem_sistema: meta.origemSistema ?? "maxpan",
      modo: "append",
      total_linhas: payloads.length,
      status: "processando",
      snapshot_em: meta.snapshotEm ?? null,
    })
    .select("id")
    .single();
  if (errImp) throw errImp;
  const importacaoId = imp!.id as string;

  // Buscar mapping CPF → cliente_id pra unidade
  const cpfsPayload = Array.from(new Set(payloads.map((p) => p.cpf).filter(Boolean))) as string[];
  const cpfToId = new Map<string, string>();
  if (cpfsPayload.length > 0) {
    // Buscar em batches de 200 (limite IN)
    for (let i = 0; i < cpfsPayload.length; i += 200) {
      const slice = cpfsPayload.slice(i, i + 200);
      const { data: cli } = await supabase
        .from("clientes")
        .select("id, cpf")
        .eq("unidade_id", unidadeId)
        .in("cpf", slice);
      for (const c of (cli ?? []) as Array<{ id: string; cpf: string }>) {
        cpfToId.set(digitos(c.cpf), c.id);
      }
    }
  }

  // Buscar requisicoes já existentes (dedupe pra MAXPAN/VM modernas, que trazem requisicao).
  // Vendas SEM requisicao são aceitas como entradas legítimas — o mesmo cliente pode
  // comprar várias lavagens de R$17 seguidas no mesmo dia.
  const reqsExistentes = new Set<string>();
  const reqsPayload = Array.from(new Set(payloads.map((p) => p.requisicao).filter(Boolean))) as string[];
  if (reqsPayload.length > 0) {
    for (let i = 0; i < reqsPayload.length; i += 200) {
      const slice = reqsPayload.slice(i, i + 200);
      const { data: exs } = await supabase
        .from("vendas")
        .select("requisicao")
        .eq("unidade_id", unidadeId)
        .in("requisicao", slice);
      for (const r of (exs ?? []) as Array<{ requisicao: string }>) {
        if (r.requisicao) reqsExistentes.add(r.requisicao);
      }
    }
  }

  const erros: ImportVendasResult["erros"] = [];
  let clientesLinkados = 0;
  const linhasInserir: Array<Record<string, unknown>> = [];

  for (const p of payloads) {
    if (p.requisicao && reqsExistentes.has(p.requisicao)) continue;

    let clienteId: string | null = null;
    if (p.cpf) {
      const id = cpfToId.get(digitos(p.cpf));
      if (id) {
        clienteId = id;
        clientesLinkados += 1;
      }
    }

    linhasInserir.push({
      tenant_id: unid.tenant_id,
      unidade_id: unidadeId,
      cliente_id: clienteId,
      requisicao: p.requisicao,
      importacao_id: importacaoId,
      data_venda: p.data_venda,
      equipamento: p.equipamento,
      pdv: p.pdv,
      situacao: p.situacao,
      tipo_pagamento: p.tipo_pagamento,
      valor: p.valor,
      valor_sem_desconto: p.valor_sem_desconto,
      bandeira_cartao: p.bandeira_cartao,
      tipo_cartao: p.tipo_cartao,
      numero_cartao: p.numero_cartao,
      autorizador: p.autorizador,
      cod_autorizacao: p.cod_autorizacao,
      voucher_codigo: p.voucher_codigo,
      voucher_categoria: p.voucher_categoria,
      cupom_codigo: p.cupom_codigo,
      cupom_requisicao: p.cupom_requisicao,
      tipo_servico: p.tipo_servico,
      quantidade_ciclos: p.quantidade_ciclos ?? 1,
      cpf: p.cpf,
      nome_cliente: p.nome_cliente,
      telefone_cliente: p.telefone_cliente,
      provedor: p.provedor,
      adquirente: p.adquirente,
      origem_sistema: meta.origemSistema ?? "maxpan",
      erro: p.erro,
      detalhes_erro: p.detalhes_erro,
    });
  }

  let inseridos = 0;
  const CHUNK = 200;
  for (let i = 0; i < linhasInserir.length; i += CHUNK) {
    const chunk = linhasInserir.slice(i, i + CHUNK);
    const { error, count } = await supabase
      .from("vendas")
      .insert(chunk, { count: "exact" });
    if (error) {
      erros.push({ linha: -1, motivo: `Erro batch insert: ${error.message}` });
    } else {
      inseridos += count ?? chunk.length;
    }
  }

  const ignorados = payloads.length - linhasInserir.length - erros.filter((e) => e.linha > 0).length;

  await supabase.from("vendas_importacoes").update({
    total_inseridos: inseridos,
    total_ignorados: Math.max(0, ignorados),
    total_erros: erros.length,
    total_clientes_linkados: clientesLinkados,
    erros: erros.length > 0 ? erros : null,
    status: "concluido",
    concluido_em: new Date().toISOString(),
  }).eq("id", importacaoId);

  revalidatePath("/performance");

  return {
    importacaoId,
    totalLinhas: payloads.length,
    inseridos,
    ignorados: Math.max(0, ignorados),
    clientesLinkados,
    erros,
  };
}

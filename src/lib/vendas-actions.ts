"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { inferirGenero } from "@/lib/genero/inferir";

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
  /** MAXPAN salesReport traz o LTV qtd do cliente em cada linha — útil pra atualizar snapshot */
  total_compras_cliente?: number | null;
};

export type ImportVendasResult = {
  importacaoId: string;
  totalLinhas: number;
  inseridos: number;
  ignorados: number;
  clientesLinkados: number;
  clientesCriados: number;
  clientesAtualizados: number;
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

  // Buscar mapping CPF → cliente pra unidade (busca por dígitos pra ignorar máscara)
  const cpfsPayloadFormatado = Array.from(new Set(payloads.map((p) => p.cpf).filter(Boolean))) as string[];
  const cpfsDigitos = Array.from(new Set(cpfsPayloadFormatado.map(digitos).filter((d) => d.length === 11)));
  type ClienteExistente = {
    id: string;
    cpf: string;
    nome: string | null;
    telefone: string | null;
    compras_total_qtd: number | null;
  };
  const cpfToCliente = new Map<string, ClienteExistente>();
  if (cpfsPayloadFormatado.length > 0) {
    for (let i = 0; i < cpfsPayloadFormatado.length; i += 200) {
      const slice = cpfsPayloadFormatado.slice(i, i + 200);
      const { data: cli } = await supabase
        .from("clientes")
        .select("id, cpf, nome, telefone, compras_total_qtd")
        .eq("unidade_id", unidadeId)
        .in("cpf", slice);
      for (const c of (cli ?? []) as ClienteExistente[]) {
        cpfToCliente.set(digitos(c.cpf), c);
      }
    }
  }

  // ─── Auto-criar/atualizar clientes a partir das vendas (foco MAXPAN salesReport) ──
  // Cada linha MAXPAN traz nome+cpf+telefone+total_compras_cliente. Agrupamos por CPF
  // e ficamos com o MAIOR total_compras_cliente (snapshot mais recente da janela).
  const porCpfBest = new Map<string, {
    cpf: string; nome: string; telefone: string | null; total: number | null; ultimaVenda: string;
  }>();
  for (const p of payloads) {
    if (!p.cpf || !p.nome_cliente) continue;
    const d = digitos(p.cpf);
    if (d.length !== 11) continue;
    const cur = porCpfBest.get(d);
    const total = p.total_compras_cliente ?? null;
    const data = p.data_venda;
    if (!cur) {
      porCpfBest.set(d, {
        cpf: p.cpf, nome: p.nome_cliente, telefone: p.telefone_cliente,
        total, ultimaVenda: data,
      });
    } else {
      if (total != null && (cur.total == null || total > cur.total)) cur.total = total;
      if (data > cur.ultimaVenda) cur.ultimaVenda = data;
      if (!cur.telefone && p.telefone_cliente) cur.telefone = p.telefone_cliente;
    }
  }

  let clientesCriados = 0;
  let clientesAtualizados = 0;
  const novosClientes: Array<Record<string, unknown>> = [];
  const updatesClientes: Array<{
    id: string;
    patch: Record<string, unknown>;
  }> = [];

  for (const [cpfDig, info] of porCpfBest) {
    const existente = cpfToCliente.get(cpfDig);
    if (!existente) {
      novosClientes.push({
        tenant_id: unid.tenant_id,
        unidade_id: unidadeId,
        nome: info.nome,
        cpf: info.cpf,
        telefone: info.telefone,
        genero: inferirGenero(info.nome),
        cadastrado_em: info.ultimaVenda,
        ultima_compra_em: info.ultimaVenda,
        compras_total_qtd: info.total ?? 1,
        origem_sistema: meta.origemSistema ?? "maxpan",
        snapshot_em: meta.snapshotEm ?? null,
      });
    } else {
      const patch: Record<string, unknown> = {};
      if (!existente.nome && info.nome) patch.nome = info.nome;
      if (!existente.telefone && info.telefone) patch.telefone = info.telefone;
      if (info.total != null && (existente.compras_total_qtd ?? 0) < info.total) {
        patch.compras_total_qtd = info.total;
      }
      patch.ultima_compra_em = info.ultimaVenda;
      patch.snapshot_em = meta.snapshotEm ?? new Date().toISOString();
      if (Object.keys(patch).length > 0) {
        updatesClientes.push({ id: existente.id, patch });
      }
    }
  }

  // Insere novos clientes em batches
  if (novosClientes.length > 0) {
    for (let i = 0; i < novosClientes.length; i += 200) {
      const chunk = novosClientes.slice(i, i + 200);
      const { data: inseridos, error } = await supabase
        .from("clientes")
        .insert(chunk)
        .select("id, cpf");
      if (!error && inseridos) {
        clientesCriados += inseridos.length;
        for (const c of inseridos as Array<{ id: string; cpf: string }>) {
          cpfToCliente.set(digitos(c.cpf), {
            id: c.id, cpf: c.cpf, nome: null, telefone: null, compras_total_qtd: null,
          });
        }
      }
    }
  }

  // Atualiza clientes existentes
  for (const u of updatesClientes) {
    const { error } = await supabase.from("clientes").update(u.patch).eq("id", u.id);
    if (!error) clientesAtualizados += 1;
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
    // Marca a requisicao como vista pra deduplicar linhas repetidas DENTRO do
    // mesmo arquivo (MAXPAN às vezes exporta a mesma transação duas vezes)
    if (p.requisicao) reqsExistentes.add(p.requisicao);

    let clienteId: string | null = null;
    if (p.cpf) {
      const c = cpfToCliente.get(digitos(p.cpf));
      if (c) {
        clienteId = c.id;
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
      // Postgres rejeita o chunk inteiro se uma linha violar unique index;
      // reinsere linha a linha pra não perder as vendas válidas do lote
      for (const linha of chunk) {
        const { error: e1 } = await supabase.from("vendas").insert(linha);
        if (!e1) {
          inseridos += 1;
        } else if (e1.code !== "23505") {
          erros.push({ linha: -1, motivo: `Erro insert: ${e1.message}` });
        }
      }
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
  revalidatePath("/clientes");
  revalidatePath("/");

  return {
    importacaoId,
    totalLinhas: payloads.length,
    inseridos,
    ignorados: Math.max(0, ignorados),
    clientesLinkados,
    clientesCriados,
    clientesAtualizados,
    erros,
  };
}

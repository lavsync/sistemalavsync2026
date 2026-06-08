"use server";
import { createClient } from "@/lib/supabase/server";
import { gerarCsv, fmt, type CsvHeader } from "@/lib/csv";

export type TipoExport =
  | "clientes" | "vendas" | "despesas"
  | "ordens_servico" | "campanhas" | "envios_marketing"
  | "maquinas" | "importacoes_vendas" | "importacoes_clientes";

export type ExportInput = {
  tipo: TipoExport;
  unidadeIds?: string[];       // null = todas
  from?: string;            // YYYY-MM-DD
  to?: string;              // YYYY-MM-DD
};

export type ExportResult = {
  filename: string;
  content: string;
  rows: number;
};

const SQL_PAGE_SIZE = 1000;

async function fetchAll(supabase: Awaited<ReturnType<typeof createClient>>, baseQuery: () => ReturnType<typeof supabase.from>): Promise<Record<string, unknown>[]> {
  // não usado — placeholder pra futura paginação se necessário
  void supabase; void baseQuery;
  return [];
}
void fetchAll; void SQL_PAGE_SIZE;

export async function gerarExport(input: ExportInput): Promise<ExportResult> {
  const sb = await createClient();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  switch (input.tipo) {
    case "clientes": {
      let q = sb.from("clientes")
        .select("nome, cpf, telefone, email, data_nascimento, genero, cadastrado_em, ultima_compra_em, compras_total_qtd, compras_total_valor, compras_90d_qtd, compras_90d_valor, compras_30d_qtd, compras_30d_valor, origem_sistema, unidade:unidades(nome)")
        .order("nome");
      if (input.unidadeIds && input.unidadeIds.length > 0) q = q.in("unidade_id", input.unidadeIds);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []).map((r) => {
        const rec = r as Record<string, unknown>;
        const un = rec.unidade as { nome: string } | Array<{ nome: string }> | null;
        const unNome = Array.isArray(un) ? un[0]?.nome : un?.nome;
        return { ...rec, unidade_nome: unNome ?? "" };
      });
      const headers: CsvHeader[] = [
        { key: "nome", label: "Nome" },
        { key: "cpf", label: "CPF" },
        { key: "telefone", label: "Telefone" },
        { key: "email", label: "E-mail" },
        { key: "data_nascimento", label: "Nascimento", transform: fmt.dataBR },
        { key: "genero", label: "Gênero" },
        { key: "unidade_nome", label: "Unidade" },
        { key: "cadastrado_em", label: "Cadastrado em", transform: fmt.dataHoraBR },
        { key: "ultima_compra_em", label: "Última compra", transform: fmt.dataHoraBR },
        { key: "compras_total_qtd", label: "Total Compras (qtd)", transform: fmt.numero },
        { key: "compras_total_valor", label: "Total Compras (R$)", transform: fmt.brl },
        { key: "compras_90d_qtd", label: "90d (qtd)", transform: fmt.numero },
        { key: "compras_90d_valor", label: "90d (R$)", transform: fmt.brl },
        { key: "compras_30d_qtd", label: "30d (qtd)", transform: fmt.numero },
        { key: "compras_30d_valor", label: "30d (R$)", transform: fmt.brl },
        { key: "origem_sistema", label: "Origem" },
      ];
      return {
        filename: `lavsync-clientes-${stamp}.csv`,
        content: gerarCsv(headers, rows),
        rows: rows.length,
      };
    }

    case "vendas": {
      let q = sb.from("vendas")
        .select("data_venda, valor, valor_sem_desconto, situacao, tipo_pagamento, bandeira_cartao, tipo_cartao, tipo_servico, quantidade_ciclos, equipamento, pdv, cpf, nome_cliente, telefone_cliente, cupom_codigo, voucher_codigo, requisicao, provedor, adquirente, origem_sistema, unidade:unidades(nome)")
        .order("data_venda", { ascending: false });
      if (input.unidadeIds && input.unidadeIds.length > 0) q = q.in("unidade_id", input.unidadeIds);
      if (input.from) q = q.gte("data_venda", `${input.from}T00:00:00`);
      if (input.to) q = q.lte("data_venda", `${input.to}T23:59:59`);
      const { data, error } = await q.limit(50000);
      if (error) throw error;
      const rows = (data ?? []).map((r) => {
        const rec = r as Record<string, unknown>;
        const un = rec.unidade as { nome: string } | Array<{ nome: string }> | null;
        return { ...rec, unidade_nome: Array.isArray(un) ? un[0]?.nome : un?.nome ?? "" };
      });
      const headers: CsvHeader[] = [
        { key: "data_venda", label: "Data", transform: fmt.dataHoraBR },
        { key: "unidade_nome", label: "Unidade" },
        { key: "valor", label: "Valor (R$)", transform: fmt.brl },
        { key: "valor_sem_desconto", label: "Valor Bruto (R$)", transform: fmt.brl },
        { key: "tipo_servico", label: "Serviço" },
        { key: "quantidade_ciclos", label: "Ciclos", transform: fmt.numero },
        { key: "tipo_pagamento", label: "Pagamento" },
        { key: "tipo_cartao", label: "Cartão Tipo" },
        { key: "bandeira_cartao", label: "Bandeira" },
        { key: "equipamento", label: "Equipamento" },
        { key: "cpf", label: "CPF" },
        { key: "nome_cliente", label: "Cliente" },
        { key: "telefone_cliente", label: "Telefone" },
        { key: "cupom_codigo", label: "Cupom" },
        { key: "voucher_codigo", label: "Voucher" },
        { key: "requisicao", label: "Requisição" },
        { key: "provedor", label: "Provedor" },
        { key: "adquirente", label: "Adquirente" },
        { key: "origem_sistema", label: "Origem" },
        { key: "situacao", label: "Situação" },
      ];
      return {
        filename: `lavsync-vendas-${stamp}.csv`,
        content: gerarCsv(headers, rows),
        rows: rows.length,
      };
    }

    case "despesas": {
      let q = sb.from("despesas")
        .select("descricao, valor, vencimento, pago_em, data_competencia, periodicidade, status, numero_documento, observacoes, unidade:unidades(nome), categoria:categorias_financeiras(nome), fornecedor:fornecedores(nome)")
        .order("vencimento", { ascending: false });
      if (input.unidadeIds && input.unidadeIds.length > 0) q = q.in("unidade_id", input.unidadeIds);
      if (input.from) q = q.gte("vencimento", input.from);
      if (input.to) q = q.lte("vencimento", input.to);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []).map((r) => {
        const rec = r as Record<string, unknown>;
        const flat = (k: string) => {
          const x = rec[k] as { nome: string } | Array<{ nome: string }> | null;
          return Array.isArray(x) ? x[0]?.nome : x?.nome;
        };
        return {
          ...rec,
          unidade_nome: flat("unidade") ?? "",
          categoria_nome: flat("categoria") ?? "",
          fornecedor_nome: flat("fornecedor") ?? "",
        };
      });
      const headers: CsvHeader[] = [
        { key: "vencimento", label: "Vencimento", transform: fmt.dataBR },
        { key: "descricao", label: "Descrição" },
        { key: "valor", label: "Valor (R$)", transform: fmt.brl },
        { key: "categoria_nome", label: "Categoria" },
        { key: "fornecedor_nome", label: "Fornecedor" },
        { key: "unidade_nome", label: "Unidade" },
        { key: "status", label: "Status" },
        { key: "pago_em", label: "Pago em", transform: fmt.dataBR },
        { key: "data_competencia", label: "Competência", transform: fmt.dataBR },
        { key: "periodicidade", label: "Periodicidade" },
        { key: "numero_documento", label: "Documento" },
        { key: "observacoes", label: "Observações" },
      ];
      return {
        filename: `lavsync-despesas-${stamp}.csv`,
        content: gerarCsv(headers, rows),
        rows: rows.length,
      };
    }

    case "ordens_servico": {
      let q = sb.from("ordens_servico")
        .select("aberta_em, titulo, descricao, tipo, prioridade, status, custo_estimado, custo_real, concluida_em, unidade:unidades(nome), maquina:maquinas(codigo)")
        .order("aberta_em", { ascending: false });
      if (input.unidadeIds && input.unidadeIds.length > 0) q = q.in("unidade_id", input.unidadeIds);
      if (input.from) q = q.gte("aberta_em", `${input.from}T00:00:00`);
      if (input.to) q = q.lte("aberta_em", `${input.to}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []).map((r) => {
        const rec = r as Record<string, unknown>;
        const un = rec.unidade as { nome: string } | Array<{ nome: string }> | null;
        const mc = rec.maquina as { codigo: string } | Array<{ codigo: string }> | null;
        return {
          ...rec,
          unidade_nome: Array.isArray(un) ? un[0]?.nome : un?.nome ?? "",
          maquina_codigo: Array.isArray(mc) ? mc[0]?.codigo : mc?.codigo ?? "",
        };
      });
      const headers: CsvHeader[] = [
        { key: "aberta_em", label: "Aberta em", transform: fmt.dataHoraBR },
        { key: "titulo", label: "Título" },
        { key: "tipo", label: "Tipo" },
        { key: "prioridade", label: "Prioridade" },
        { key: "status", label: "Status" },
        { key: "maquina_codigo", label: "Máquina" },
        { key: "unidade_nome", label: "Unidade" },
        { key: "custo_estimado", label: "Custo Estimado (R$)", transform: fmt.brl },
        { key: "custo_real", label: "Custo Real (R$)", transform: fmt.brl },
        { key: "concluida_em", label: "Concluída em", transform: fmt.dataHoraBR },
        { key: "descricao", label: "Descrição" },
      ];
      return {
        filename: `lavsync-ordens-servico-${stamp}.csv`,
        content: gerarCsv(headers, rows),
        rows: rows.length,
      };
    }

    case "campanhas": {
      let q = sb.from("marketing_campanhas")
        .select("nome, descricao, canal, segmento, template_mensagem, status, total_destinatarios, total_enviados, total_entregues, total_erros, criado_em, concluida_em, unidade:unidades(nome)")
        .order("criado_em", { ascending: false });
      if (input.unidadeIds && input.unidadeIds.length > 0) q = q.in("unidade_id", input.unidadeIds);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []).map((r) => {
        const rec = r as Record<string, unknown>;
        const un = rec.unidade as { nome: string } | Array<{ nome: string }> | null;
        return { ...rec, unidade_nome: Array.isArray(un) ? un[0]?.nome : un?.nome ?? "" };
      });
      const headers: CsvHeader[] = [
        { key: "criado_em", label: "Criada em", transform: fmt.dataHoraBR },
        { key: "nome", label: "Nome" },
        { key: "canal", label: "Canal" },
        { key: "segmento", label: "Segmento" },
        { key: "unidade_nome", label: "Unidade" },
        { key: "status", label: "Status" },
        { key: "total_destinatarios", label: "Destinatários", transform: fmt.numero },
        { key: "total_enviados", label: "Enviados", transform: fmt.numero },
        { key: "total_entregues", label: "Entregues", transform: fmt.numero },
        { key: "total_erros", label: "Erros", transform: fmt.numero },
        { key: "concluida_em", label: "Concluída em", transform: fmt.dataHoraBR },
        { key: "template_mensagem", label: "Mensagem" },
        { key: "descricao", label: "Descrição" },
      ];
      return {
        filename: `lavsync-campanhas-${stamp}.csv`,
        content: gerarCsv(headers, rows),
        rows: rows.length,
      };
    }

    case "envios_marketing": {
      const { data, error } = await sb.from("marketing_envios")
        .select("destinatario_nome, destinatario_telefone, destinatario_cpf, mensagem_renderizada, status, erro, provider, criado_em, enviado_em, campanha:marketing_campanhas(nome, canal)")
        .order("criado_em", { ascending: false })
        .limit(20000);
      if (error) throw error;
      const rows = (data ?? []).map((r) => {
        const rec = r as Record<string, unknown>;
        const c = rec.campanha as { nome: string; canal: string } | Array<{ nome: string; canal: string }> | null;
        const cAtual = Array.isArray(c) ? c[0] : c;
        return {
          ...rec,
          campanha_nome: cAtual?.nome ?? "",
          campanha_canal: cAtual?.canal ?? "",
        };
      });
      const headers: CsvHeader[] = [
        { key: "criado_em", label: "Criado em", transform: fmt.dataHoraBR },
        { key: "campanha_nome", label: "Campanha" },
        { key: "campanha_canal", label: "Canal" },
        { key: "destinatario_nome", label: "Cliente" },
        { key: "destinatario_telefone", label: "Telefone" },
        { key: "destinatario_cpf", label: "CPF" },
        { key: "mensagem_renderizada", label: "Mensagem" },
        { key: "status", label: "Status" },
        { key: "erro", label: "Erro" },
        { key: "provider", label: "Provider" },
        { key: "enviado_em", label: "Enviado em", transform: fmt.dataHoraBR },
      ];
      return {
        filename: `lavsync-envios-marketing-${stamp}.csv`,
        content: gerarCsv(headers, rows),
        rows: rows.length,
      };
    }

    case "maquinas": {
      let q = sb.from("maquinas")
        .select("codigo, tipo, status, capacidade_kg, fabricante, modelo, serial_number, localizacao, equipamento_match, data_aquisicao, valor_aquisicao, ultima_manutencao_em, proxima_manutencao_em, observacoes, unidade:unidades(nome)")
        .order("codigo");
      if (input.unidadeIds && input.unidadeIds.length > 0) q = q.in("unidade_id", input.unidadeIds);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []).map((r) => {
        const rec = r as Record<string, unknown>;
        const un = rec.unidade as { nome: string } | Array<{ nome: string }> | null;
        return { ...rec, unidade_nome: Array.isArray(un) ? un[0]?.nome : un?.nome ?? "" };
      });
      const headers: CsvHeader[] = [
        { key: "codigo", label: "Código" },
        { key: "tipo", label: "Tipo" },
        { key: "status", label: "Status" },
        { key: "capacidade_kg", label: "Capacidade (kg)", transform: fmt.numero },
        { key: "unidade_nome", label: "Unidade" },
        { key: "fabricante", label: "Fabricante" },
        { key: "modelo", label: "Modelo" },
        { key: "serial_number", label: "Serial" },
        { key: "localizacao", label: "Localização" },
        { key: "equipamento_match", label: "Match Vendas" },
        { key: "data_aquisicao", label: "Aquisição", transform: fmt.dataBR },
        { key: "valor_aquisicao", label: "Valor Aquisição (R$)", transform: fmt.brl },
        { key: "ultima_manutencao_em", label: "Última Manutenção", transform: fmt.dataBR },
        { key: "proxima_manutencao_em", label: "Próxima Manutenção", transform: fmt.dataBR },
        { key: "observacoes", label: "Observações" },
      ];
      return {
        filename: `lavsync-maquinas-${stamp}.csv`,
        content: gerarCsv(headers, rows),
        rows: rows.length,
      };
    }

    case "importacoes_vendas":
    case "importacoes_clientes": {
      const table = input.tipo === "importacoes_vendas" ? "vendas_importacoes" : "clientes_importacoes";
      const tipoLabel = input.tipo === "importacoes_vendas" ? "vendas" : "clientes";
      let q = sb.from(table)
        .select(`*, unidade:unidades(nome)`)
        .order("criado_em", { ascending: false });
      if (input.unidadeIds && input.unidadeIds.length > 0) q = q.in("unidade_id", input.unidadeIds);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []).map((r) => {
        const rec = r as Record<string, unknown>;
        const un = rec.unidade as { nome: string } | Array<{ nome: string }> | null;
        return { ...rec, unidade_nome: Array.isArray(un) ? un[0]?.nome : un?.nome ?? "" };
      });
      const headers: CsvHeader[] = [
        { key: "criado_em", label: "Importada em", transform: fmt.dataHoraBR },
        { key: "arquivo_nome", label: "Arquivo" },
        { key: "unidade_nome", label: "Unidade" },
        { key: "origem_sistema", label: "Origem" },
        { key: "modo", label: "Modo" },
        { key: "total_linhas", label: "Linhas", transform: fmt.numero },
        { key: "total_inseridos", label: "Inseridos", transform: fmt.numero },
        ...(input.tipo === "importacoes_clientes" ? [{ key: "total_atualizados", label: "Atualizados", transform: fmt.numero }] : []),
        { key: "total_ignorados", label: "Ignorados", transform: fmt.numero },
        { key: "total_erros", label: "Erros", transform: fmt.numero },
        { key: "status", label: "Status" },
        { key: "concluido_em", label: "Concluído em", transform: fmt.dataHoraBR },
      ];
      return {
        filename: `lavsync-importacoes-${tipoLabel}-${stamp}.csv`,
        content: gerarCsv(headers, rows),
        rows: rows.length,
      };
    }
  }
}

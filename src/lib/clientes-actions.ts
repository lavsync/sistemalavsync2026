"use server";
// LavSync · Clientes · Server actions (UPSERT em lote, criar, atualizar, deletar)
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ClientePayload = {
  nome: string;
  cpf: string;
  email?: string | null;
  telefone?: string | null;
  data_nascimento?: string | null;       // YYYY-MM-DD
  genero?: string | null;
  cadastrado_em?: string | null;          // ISO
  ultima_compra_em?: string | null;       // ISO
  snapshot_em?: string | null;            // ISO
  compras_total_qtd?: number;
  compras_total_valor?: number;
  compras_90d_qtd?: number;
  compras_90d_valor?: number;
  compras_30d_qtd?: number;
  compras_30d_valor?: number;
  compras_7d_qtd?: number;
  compras_7d_valor?: number;
  origem_sistema?: string;
  observacoes?: string | null;
};

export type ImportResult = {
  importacaoId: string;
  totalLinhas: number;
  inseridos: number;
  atualizados: number;
  ignorados: number;
  erros: Array<{ linha: number; motivo: string }>;
};

function normalizarCpfDigitos(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

export async function importarClientes(
  unidadeId: string,
  payloads: Array<ClientePayload & { _linha: number }>,
  meta: {
    arquivoNome: string;
    arquivoTamanho?: number;
    origemSistema?: string;
    modo?: "append" | "upsert";
    snapshotEm?: string | null;
  },
): Promise<ImportResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  // Buscar tenant_id da unidade
  const { data: unid, error: errUnid } = await supabase
    .from("unidades")
    .select("id, tenant_id")
    .eq("id", unidadeId)
    .maybeSingle();
  if (errUnid) throw errUnid;
  if (!unid) throw new Error("Unidade não encontrada");

  // Buscar usuario_id na tabela usuarios (mapeada de auth.users.id)
  const { data: usrApp } = await supabase
    .from("usuarios")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  // Criar registro de importação (pendente)
  const { data: importacao, error: errImp } = await supabase
    .from("clientes_importacoes")
    .insert({
      tenant_id: unid.tenant_id,
      unidade_id: unidadeId,
      usuario_id: usrApp?.id ?? null,
      arquivo_nome: meta.arquivoNome,
      arquivo_tamanho: meta.arquivoTamanho ?? null,
      origem_sistema: meta.origemSistema ?? "maxlav",
      modo: meta.modo ?? "upsert",
      total_linhas: payloads.length,
      status: "processando",
      snapshot_em: meta.snapshotEm ?? null,
    })
    .select("id")
    .single();
  if (errImp) throw errImp;
  const importacaoId = importacao!.id as string;

  // Preparar linhas (dedup por CPF dígitos dentro do próprio batch)
  const erros: ImportResult["erros"] = [];
  const cpfsVistos = new Set<string>();
  const linhasValidas: Array<Record<string, unknown>> = [];

  for (const p of payloads) {
    if (!p.nome?.trim()) {
      erros.push({ linha: p._linha, motivo: "Nome vazio" });
      continue;
    }
    const cpfDig = normalizarCpfDigitos(p.cpf ?? "");
    if (cpfDig.length !== 11) {
      erros.push({ linha: p._linha, motivo: `CPF inválido ("${p.cpf}")` });
      continue;
    }
    if (cpfsVistos.has(cpfDig)) {
      erros.push({ linha: p._linha, motivo: "CPF duplicado dentro do arquivo" });
      continue;
    }
    cpfsVistos.add(cpfDig);

    linhasValidas.push({
      tenant_id: unid.tenant_id,
      unidade_id: unidadeId,
      nome: p.nome.trim(),
      cpf: p.cpf.trim(),
      email: p.email?.trim() || null,
      telefone: p.telefone?.trim() || null,
      data_nascimento: p.data_nascimento || null,
      genero: p.genero || null,
      cadastrado_em: p.cadastrado_em || null,
      ultima_compra_em: p.ultima_compra_em || null,
      snapshot_em: p.snapshot_em || meta.snapshotEm || null,
      compras_total_qtd: p.compras_total_qtd ?? 0,
      compras_total_valor: p.compras_total_valor ?? 0,
      compras_90d_qtd: p.compras_90d_qtd ?? 0,
      compras_90d_valor: p.compras_90d_valor ?? 0,
      compras_30d_qtd: p.compras_30d_qtd ?? 0,
      compras_30d_valor: p.compras_30d_valor ?? 0,
      compras_7d_qtd: p.compras_7d_qtd ?? 0,
      compras_7d_valor: p.compras_7d_valor ?? 0,
      origem_sistema: p.origem_sistema || meta.origemSistema || "maxlav",
      observacoes: p.observacoes || null,
      importacao_id: importacaoId,
    });
  }

  // Insert em lotes; em modo upsert usamos onConflict para atualizar (constraint = unique parcial,
  // não dá pra usar ON CONFLICT direto no PostgREST → fazemos query manual de upsert via SQL).
  // Estratégia simples: tentar insert; em duplicata, atualizar via update.

  let inseridos = 0;
  let atualizados = 0;
  let ignorados = 0;

  const CHUNK = 100;
  for (let i = 0; i < linhasValidas.length; i += CHUNK) {
    const chunk = linhasValidas.slice(i, i + CHUNK);
    // Buscar quais CPFs já existem nessa unidade
    const cpfsChunk = chunk.map((r) => normalizarCpfDigitos(r.cpf as string));
    const { data: existentes } = await supabase
      .from("clientes")
      .select("id, cpf")
      .eq("unidade_id", unidadeId)
      .in("cpf", chunk.map((r) => r.cpf as string));

    const mapaExistentes = new Map<string, string>(); // cpfDigitos → id
    for (const e of (existentes ?? []) as Array<{ id: string; cpf: string }>) {
      mapaExistentes.set(normalizarCpfDigitos(e.cpf), e.id);
    }

    const aInserir = chunk.filter((r) => !mapaExistentes.has(normalizarCpfDigitos(r.cpf as string)));
    const aAtualizar = chunk.filter((r) => mapaExistentes.has(normalizarCpfDigitos(r.cpf as string)));

    if (aInserir.length > 0) {
      const { error: e1, count } = await supabase
        .from("clientes")
        .insert(aInserir, { count: "exact" });
      if (e1) {
        erros.push({ linha: -1, motivo: `Erro batch insert: ${e1.message}` });
      } else {
        inseridos += count ?? aInserir.length;
      }
    }

    if (aAtualizar.length > 0) {
      if ((meta.modo ?? "upsert") === "append") {
        ignorados += aAtualizar.length;
      } else {
        // upsert manual: 1 update por linha (poucas linhas geralmente)
        for (const row of aAtualizar) {
          const id = mapaExistentes.get(normalizarCpfDigitos(row.cpf as string))!;
          const { error: eU } = await supabase
            .from("clientes")
            .update({
              nome: row.nome,
              email: row.email,
              telefone: row.telefone,
              data_nascimento: row.data_nascimento,
              genero: row.genero,
              cadastrado_em: row.cadastrado_em,
              ultima_compra_em: row.ultima_compra_em,
              snapshot_em: row.snapshot_em,
              compras_total_qtd: row.compras_total_qtd,
              compras_total_valor: row.compras_total_valor,
              compras_90d_qtd: row.compras_90d_qtd,
              compras_90d_valor: row.compras_90d_valor,
              compras_30d_qtd: row.compras_30d_qtd,
              compras_30d_valor: row.compras_30d_valor,
              compras_7d_qtd: row.compras_7d_qtd,
              compras_7d_valor: row.compras_7d_valor,
              origem_sistema: row.origem_sistema,
              importacao_id: importacaoId,
            })
            .eq("id", id);
          if (eU) erros.push({ linha: -1, motivo: `Erro update id=${id}: ${eU.message}` });
          else atualizados += 1;
        }
      }
    }
  }

  // Atualizar registro de importação
  await supabase
    .from("clientes_importacoes")
    .update({
      total_inseridos: inseridos,
      total_atualizados: atualizados,
      total_ignorados: ignorados,
      total_erros: erros.length,
      erros: erros.length > 0 ? erros : null,
      status: erros.length > 0 ? "concluido" : "concluido",
      concluido_em: new Date().toISOString(),
    })
    .eq("id", importacaoId);

  revalidatePath("/clientes");

  return {
    importacaoId,
    totalLinhas: payloads.length,
    inseridos,
    atualizados,
    ignorados,
    erros,
  };
}

export async function deletarCliente(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/clientes");
}

export async function atualizarCliente(
  id: string,
  patch: Partial<ClientePayload>,
) {
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update(patch).eq("id", id);
  if (error) throw error;
  revalidatePath("/clientes");
}

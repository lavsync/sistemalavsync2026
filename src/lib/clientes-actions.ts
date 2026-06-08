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
  enriquecidos: number;
  semMudanca: number;
  ignorados: number;
  erros: Array<{ linha: number; motivo: string }>;
};

export type ImportMode = "append" | "upsert" | "merge" | "sync";

// Tipos auxiliares pra merge
type ClienteExistente = {
  id: string;
  cpf: string;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  genero: string | null;
  cadastrado_em: string | null;
  ultima_compra_em: string | null;
  observacoes: string | null;
};

function normalizarCpfDigitos(cpf: string): string {
  // MAXPAN exporta CPF numérico; Excel/Sheets podem suprimir zeros à esquerda
  // (Ex: "01903311608" vira 1903311608 quando salvo como número).
  // Pad com zeros à esquerda quando 9 ou 10 dígitos pra recuperar.
  let d = cpf.replace(/\D/g, "");
  if (d.length === 9 || d.length === 10) d = d.padStart(11, "0");
  return d;
}

export async function importarClientes(
  unidadeId: string,
  payloads: Array<ClientePayload & { _linha: number }>,
  meta: {
    arquivoNome: string;
    arquivoTamanho?: number;
    origemSistema?: string;
    modo?: ImportMode;
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
  let enriquecidos = 0;
  let semMudanca = 0;
  let ignorados = 0;

  // Default = "sync": preserva cadastrado_em mais antigo + enriquece campos nulos.
  // "upsert" sobrescreve tudo (perigoso quando a planilha não tem todos os campos).
  const modo: ImportMode = meta.modo ?? "sync";

  const CHUNK = 100;
  for (let i = 0; i < linhasValidas.length; i += CHUNK) {
    const chunk = linhasValidas.slice(i, i + CHUNK);

    // Buscar quais CPFs já existem nessa unidade (com campos necessários pra merge)
    const { data: existentesRaw } = await supabase
      .from("clientes")
      .select("id, cpf, email, telefone, data_nascimento, genero, cadastrado_em, ultima_compra_em, observacoes")
      .eq("unidade_id", unidadeId)
      .in("cpf", chunk.map((r) => r.cpf as string));

    const mapaExistentes = new Map<string, ClienteExistente>();
    for (const e of (existentesRaw ?? []) as ClienteExistente[]) {
      mapaExistentes.set(normalizarCpfDigitos(e.cpf), e);
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
      if (modo === "append") {
        ignorados += aAtualizar.length;
      } else if (modo === "upsert") {
        // upsert: sobrescreve TUDO com o que veio (use só quando o novo dado é o mais recente)
        for (const row of aAtualizar) {
          const ex = mapaExistentes.get(normalizarCpfDigitos(row.cpf as string))!;
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
            .eq("id", ex.id);
          if (eU) erros.push({ linha: -1, motivo: `Erro update id=${ex.id}: ${eU.message}` });
          else atualizados += 1;
        }
      } else if (modo === "merge") {
        // merge: enriquece sem sobrescrever (uso pra backup/legado)
        // - campos de contato/cadastro: preenche só se base estiver vazia
        // - cadastrado_em: mantém o MAIS ANTIGO
        // - ultima_compra_em: mantém o MAIS RECENTE
        // - métricas (compras_*): NUNCA sobrescreve
        const ts = new Date().toISOString().slice(0, 10);
        const origemRotulo = (meta.origemSistema ?? "vm_tecnologia").toUpperCase();

        for (const row of aAtualizar) {
          const cpfDig = normalizarCpfDigitos(row.cpf as string);
          const ex = mapaExistentes.get(cpfDig)!;
          const patch: Record<string, unknown> = {};
          const novo = (k: string) => row[k as keyof typeof row];

          if (!ex.email && novo("email")) patch.email = novo("email");
          if (!ex.telefone && novo("telefone")) patch.telefone = novo("telefone");
          if (!ex.data_nascimento && novo("data_nascimento")) patch.data_nascimento = novo("data_nascimento");
          if (!ex.genero && novo("genero")) patch.genero = novo("genero");

          const novoCad = novo("cadastrado_em") as string | null;
          if (novoCad && (!ex.cadastrado_em || new Date(novoCad) < new Date(ex.cadastrado_em))) {
            patch.cadastrado_em = novoCad;
          }
          const novaUlt = novo("ultima_compra_em") as string | null;
          if (novaUlt && (!ex.ultima_compra_em || new Date(novaUlt) > new Date(ex.ultima_compra_em))) {
            patch.ultima_compra_em = novaUlt;
          }

          if (Object.keys(patch).length === 0) {
            semMudanca += 1;
            continue;
          }
          const nota = `[${ts}] Enriquecido com ${origemRotulo}: ${Object.keys(patch).join(", ")}`;
          patch.observacoes = ex.observacoes ? `${ex.observacoes}\n${nota}` : nota;
          patch.importacao_id = importacaoId;

          const { error: eM } = await supabase.from("clientes").update(patch).eq("id", ex.id);
          if (eM) erros.push({ linha: -1, motivo: `Erro merge id=${ex.id}: ${eM.message}` });
          else enriquecidos += 1;
        }
      } else {
        // modo "sync" (default pra alimentação contínua MAXPAN):
        // - métricas (compras_*) SEMPRE atualiza (snapshot novo é canônico)
        // - cadastrado_em: MIN (preserva primeiro contato)
        // - ultima_compra_em: MAX
        // - contato (nome/email/telefone): atualiza se diferente (nova fonte é canônica),
        //   mas NÃO sobrescreve com null (se MAXPAN não tem o campo, mantém antigo)
        // - data_nascimento/gênero: preenche só se base vazia (MAXPAN não traz)
        // - origem_sistema: atualiza pra refletir fonte ativa
        // - snapshot_em: SEMPRE atualiza
        const ts = new Date().toISOString().slice(0, 10);
        const origemRotulo = (meta.origemSistema ?? "maxpan").toUpperCase();
        const snapshotAtual = meta.snapshotEm ?? new Date().toISOString();

        for (const row of aAtualizar) {
          const cpfDig = normalizarCpfDigitos(row.cpf as string);
          const ex = mapaExistentes.get(cpfDig)!;
          const patch: Record<string, unknown> = {};
          const camposAlterados: string[] = [];
          const novo = (k: string) => row[k as keyof typeof row];

          // Contato: atualiza só se valor novo é não-vazio E diferente
          const txt = (v: unknown) => (typeof v === "string" ? v.trim() : v);
          const nomeNovo = txt(novo("nome")) as string;
          if (nomeNovo && nomeNovo !== txt(row.nome)) patch.nome = nomeNovo;
          // (nome sempre é overridable pelo novo se vier — MAXPAN normaliza)

          const emailNovo = novo("email") as string | null;
          if (emailNovo && emailNovo !== ex.email) {
            patch.email = emailNovo;
            camposAlterados.push("email");
          }
          const telNovo = novo("telefone") as string | null;
          if (telNovo && telNovo !== ex.telefone) {
            patch.telefone = telNovo;
            camposAlterados.push("telefone");
          }
          // Campos que MAXPAN não traz: coalesce
          if (!ex.data_nascimento && novo("data_nascimento")) patch.data_nascimento = novo("data_nascimento");
          if (!ex.genero && novo("genero")) patch.genero = novo("genero");

          // Datas
          const novoCad = novo("cadastrado_em") as string | null;
          if (novoCad && (!ex.cadastrado_em || new Date(novoCad) < new Date(ex.cadastrado_em))) {
            patch.cadastrado_em = novoCad;
            camposAlterados.push("cadastrado_em");
          }
          const novaUlt = novo("ultima_compra_em") as string | null;
          if (novaUlt && (!ex.ultima_compra_em || new Date(novaUlt) > new Date(ex.ultima_compra_em))) {
            patch.ultima_compra_em = novaUlt;
            camposAlterados.push("ultima_compra_em");
          }

          // Métricas: SEMPRE sobrescreve (snapshot é canônico)
          const metricFields = [
            "compras_total_qtd", "compras_total_valor",
            "compras_90d_qtd", "compras_90d_valor",
            "compras_30d_qtd", "compras_30d_valor",
            "compras_7d_qtd", "compras_7d_valor",
          ] as const;
          let metricasMudaram = false;
          for (const f of metricFields) {
            const val = novo(f) ?? 0;
            patch[f] = val;
            if (Number(val) !== 0) metricasMudaram = true; // só conta como mudança se tem dado
          }
          if (metricasMudaram) camposAlterados.push("métricas");

          patch.snapshot_em = snapshotAtual;
          patch.origem_sistema = meta.origemSistema ?? "maxpan";
          patch.importacao_id = importacaoId;

          if (camposAlterados.length === 0) {
            semMudanca += 1;
            // ainda assim atualiza snapshot pra registrar que foi verificado
            await supabase.from("clientes")
              .update({ snapshot_em: snapshotAtual, importacao_id: importacaoId })
              .eq("id", ex.id);
            continue;
          }

          const nota = `[${ts}] Sync ${origemRotulo}: ${camposAlterados.join(", ")}`;
          patch.observacoes = ex.observacoes ? `${ex.observacoes}\n${nota}` : nota;

          const { error: eS } = await supabase.from("clientes").update(patch).eq("id", ex.id);
          if (eS) erros.push({ linha: -1, motivo: `Erro sync id=${ex.id}: ${eS.message}` });
          else atualizados += 1;
        }
      }
    }
  }

  // Atualizar registro de importação (enriquecidos contam como atualizados pra fins de auditoria)
  await supabase
    .from("clientes_importacoes")
    .update({
      total_inseridos: inseridos,
      total_atualizados: atualizados + enriquecidos,
      total_ignorados: ignorados + semMudanca,
      total_erros: erros.length,
      erros: erros.length > 0 ? erros : null,
      status: "concluido",
      concluido_em: new Date().toISOString(),
    })
    .eq("id", importacaoId);

  revalidatePath("/clientes");

  return {
    importacaoId,
    totalLinhas: payloads.length,
    inseridos,
    atualizados,
    enriquecidos,
    semMudanca,
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

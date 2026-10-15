"use server";
// LavSync · Financeiro · Projetado da franqueadora — server actions
//
// Importar (o CLOCK lê o arquivo e devolve um RASCUNHO, sem salvar a
// projeção; o arquivo original vai para o bucket privado), salvar (ativa=true
// desativa a anterior da unidade, numa transação via RPC
// financeiro_projecao_salvar), listar, carregar, excluir e comparar com o
// real (motor do DRE). Sessão obrigatória; storage e service role só depois
// do gate. O tenant de gravação e o prefixo do arquivo vêm da UNIDADE (não da
// sessão: um master enxerga vários tenants). Todas devolvem
// {ok:true,...} | {ok:false, erro}.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nowBR } from "@/lib/timezone-br";
import { carregarDadosDRE } from "../dre-dados";
import { extrairProjecao, tipoDoArquivo, TAMANHO_MAXIMO_ARQUIVO, TAMANHO_MAXIMO_IMAGEM } from "./extracao";
import { validarProjecao } from "./validacao";
import { montarComparativo, type EntradaComparativo } from "./comparativo";
import { BUCKET_PROJECOES, getProjecao, getProjecaoAtiva, listarProjecoesDaUnidade, type ProjecaoResumo } from "./queries";
import { GRUPOS_CUSTO, serie60, type ComparativoProjecao, type GrupoProjecao, type Projecao } from "./tipos";

type Falha = { ok: false; erro: string };
const falha = (e: unknown): Falha => ({ ok: false, erro: e instanceof Error ? e.message : String(e) });

async function sessao() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  return { sb, user };
}

type Sb = Awaited<ReturnType<typeof createClient>>;
type UnidadeVisivel = { id: string; nome: string; tenant_id: string };

/** A unidade existe e a sessão enxerga (RLS)? Traz o tenant DONO da unidade. */
async function unidadeVisivel(sb: Sb, unidadeId: string): Promise<UnidadeVisivel | null> {
  if (!unidadeId) return null;
  const { data } = await sb.from("unidades").select("id, nome, tenant_id").eq("id", unidadeId).maybeSingle();
  return (data as UnidadeVisivel | null) ?? null;
}

/** Caminho no bucket no formato exato gerado pelo importar: <tenant>/<unidade>/<AAAAMMDDhhmmss>__<slug>. */
function caminhoValido(path: string, tenant: string, unidadeId: string): boolean {
  if (path.includes("..")) return false;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${esc(tenant)}/${esc(unidadeId)}/\\d{14}__[A-Za-z0-9.-]+$`).test(path);
}

/** Maior |valor| que cabe em numeric(14,4). */
const VALOR_MAXIMO = 1e10;

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9.]+/g, "-").replace(/\.{2,}/g, ".").replace(/^-|-$/g, "").slice(0, 80) || "arquivo";
const GRUPOS_VALIDOS: GrupoProjecao[] = [...GRUPOS_CUSTO, "receita", "resultado", "indicador"];

// ─── Importar (rascunho) ─────────────────────────────────────────────────

export async function importarArquivoProjecao(form: FormData): Promise<{ ok: true; rascunho: Projecao } | Falha> {
  try {
    const { sb } = await sessao();
    const arquivo = form.get("arquivo");
    const unidadeId = String(form.get("unidade_id") ?? "");
    if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erro: "Escolha o arquivo da franqueadora." };
    if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO) return { ok: false, erro: "Arquivo acima de 15 MB." };
    const tipo = tipoDoArquivo(arquivo.name, arquivo.type);
    if (!tipo) return { ok: false, erro: "Formato não suportado. Envie PDF, XLSX, XLS, ODS, CSV ou imagem (PNG, JPG, WEBP)." };
    if (tipo.tipo === "imagem" && arquivo.size > TAMANHO_MAXIMO_IMAGEM) {
      return { ok: false, erro: "Imagem acima de 5 MB: reduza a resolução ou envie o estudo em PDF." };
    }
    const unidade = await unidadeVisivel(sb, unidadeId);
    if (!unidade) return { ok: false, erro: "Unidade não encontrada." };
    const tenant = unidade.tenant_id;

    const buffer = Buffer.from(await arquivo.arrayBuffer());

    // Mês 1 = inauguração da unidade (fallback: mês corrente BR)
    const { data: cfg } = await sb.from("financeiro_unidades_config")
      .select("mes_inauguracao, ano_inauguracao").eq("unidade_id", unidadeId).maybeSingle();
    const c = cfg as { mes_inauguracao: number | null; ano_inauguracao: number | null } | null;
    const hoje = nowBR();
    const mes1_ano = c?.ano_inauguracao ?? hoje.ano;
    const mes1_mes = c?.mes_inauguracao ?? hoje.mes;

    // Arquivo original no bucket privado (service role só depois do gate)
    const carimbo = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 19).replace(/[-:T]/g, "");
    const path = `${tenant}/${unidadeId}/${carimbo}__${slug(arquivo.name)}`;
    const admin = createAdminClient();
    const up = await admin.storage.from(BUCKET_PROJECOES).upload(path, buffer, { contentType: tipo.mime, upsert: false });
    if (up.error) return { ok: false, erro: `Falha ao guardar o arquivo: ${up.error.message}` };

    let lido;
    try {
      lido = await extrairProjecao({ buffer, nome: arquivo.name, mime: tipo.mime });
    } catch (e) {
      await admin.storage.from(BUCKET_PROJECOES).remove([path]);
      return falha(e);
    }

    const avisos = [...lido.avisos];
    if (!c?.ano_inauguracao || !c?.mes_inauguracao) {
      avisos.unshift("A unidade não tem mês de inauguração configurado: o mês 1 da projeção ficou no mês atual — ajuste antes de salvar.");
    }
    for (const a of validarProjecao(lido)) if (!avisos.includes(a)) avisos.push(a);

    const rascunho: Projecao = {
      unidade_id: unidadeId,
      nome: `Projeção da franqueadora · ${arquivo.name.replace(/\.[^.]+$/, "")}`.slice(0, 120),
      origem: "importacao",
      arquivo_path: path,
      arquivo_nome: arquivo.name,
      mes1_ano, mes1_mes,
      premissas: lido.premissas,
      investimento: lido.investimento,
      linhas: lido.linhas,
      avisos,
      ativa: true,
    };
    return { ok: true, rascunho };
  } catch (e) {
    return falha(e);
  }
}

// ─── Salvar ──────────────────────────────────────────────────────────────

export async function salvarProjecao(p: Projecao): Promise<{ ok: true; id: string } | Falha> {
  try {
    const { sb } = await sessao();
    const unidade = await unidadeVisivel(sb, p.unidade_id);
    if (!unidade) return { ok: false, erro: "Unidade não encontrada." };
    const nome = String(p.nome ?? "").trim();
    if (!nome) return { ok: false, erro: "Dê um nome à projeção." };
    if (!Number.isInteger(p.mes1_ano) || p.mes1_ano < 2000 || p.mes1_ano > 2100 || !Number.isInteger(p.mes1_mes) || p.mes1_mes < 1 || p.mes1_mes > 12) {
      return { ok: false, erro: "Mês 1 da projeção inválido." };
    }
    const chaves = new Set<string>();
    for (const l of p.linhas ?? []) {
      if (!l.chave || chaves.has(l.chave)) return { ok: false, erro: `Linha repetida ou sem chave: ${l.descricao || l.chave}.` };
      if (!GRUPOS_VALIDOS.includes(l.grupo)) return { ok: false, erro: `Grupo inválido na linha ${l.descricao}.` };
      if (serie60(l.valores).some((v) => Math.abs(v) >= VALOR_MAXIMO)) {
        return { ok: false, erro: `Valor fora do limite na linha ${l.descricao || l.chave} (máximo de R$ 9.999.999.999).` };
      }
      chaves.add(l.chave);
    }

    let id = p.id ?? null;
    let arquivo_path: string | null = null;
    let arquivo_nome: string | null = null;
    if (id) {
      // Atualização: o arquivo é o que já está gravado (nunca o que veio do cliente)
      const atual = await getProjecao(sb, id);
      if (!atual || atual.unidade_id !== p.unidade_id) return { ok: false, erro: "Projeção não encontrada." };
      arquivo_path = atual.arquivo_path ?? null;
      arquivo_nome = atual.arquivo_nome ?? null;
    } else if (p.arquivo_path) {
      // Nova: só um caminho no formato do importar, desta unidade, e que nenhuma
      // outra projeção use (senão excluir uma apagaria o arquivo da outra)
      if (!caminhoValido(p.arquivo_path, unidade.tenant_id, unidade.id)) return { ok: false, erro: "Arquivo da projeção inválido. Importe o arquivo de novo." };
      const { count } = await sb.from("financeiro_projecoes").select("id", { count: "exact", head: true }).eq("arquivo_path", p.arquivo_path);
      if ((count ?? 0) > 0) return { ok: false, erro: "Este arquivo já está ligado a outra projeção. Importe o arquivo de novo." };
      arquivo_path = p.arquivo_path;
      arquivo_nome = p.arquivo_nome ?? null;
    }

    const registro = {
      unidade_id: p.unidade_id, nome, origem: p.origem === "manual" ? "manual" : "importacao",
      arquivo_path, arquivo_nome,
      mes1_ano: p.mes1_ano, mes1_mes: p.mes1_mes,
      premissas: p.premissas ? { ...p.premissas, rampa: serie60(p.premissas.rampa) } : null,
      investimento: p.investimento ?? null,
      observacoes_ia: (p.avisos ?? []).map(String),
      ativa: Boolean(p.ativa),
    };
    const linhas = (p.linhas ?? []).map((l, i) => ({
      chave: l.chave, descricao: l.descricao || l.chave, grupo: l.grupo,
      ordem: Number.isFinite(l.ordem) ? Math.round(l.ordem) : i, valores: serie60(l.valores),
      editado: Boolean(l.editado), conferir: Boolean(l.conferir),
    }));

    // Uma transação: desativa as outras, grava o cabeçalho e troca as linhas
    const { data, error } = await sb.rpc("financeiro_projecao_salvar", { p_id: id, p_registro: registro, p_linhas: linhas });
    if (error) return { ok: false, erro: error.message };
    id = String(data);
    revalidatePath("/financeiro");
    return { ok: true, id };
  } catch (e) {
    return falha(e);
  }
}

/** Mês de inauguração da unidade (default do mês 1 de uma projeção manual). */
export async function inauguracaoDaUnidade(unidadeId: string): Promise<{ ok: true; ano: number | null; mes: number | null } | Falha> {
  try {
    const { sb } = await sessao();
    if (!(await unidadeVisivel(sb, unidadeId))) return { ok: false, erro: "Unidade não encontrada." };
    const { data } = await sb.from("financeiro_unidades_config")
      .select("mes_inauguracao, ano_inauguracao").eq("unidade_id", unidadeId).maybeSingle();
    const c = data as { mes_inauguracao: number | null; ano_inauguracao: number | null } | null;
    return { ok: true, ano: c?.ano_inauguracao ?? null, mes: c?.mes_inauguracao ?? null };
  } catch (e) {
    return falha(e);
  }
}

// ─── Listar / carregar / excluir ─────────────────────────────────────────

export async function listarProjecoes(unidadeId: string): Promise<{ ok: true; projecoes: ProjecaoResumo[] } | Falha> {
  try {
    const { sb } = await sessao();
    if (!(await unidadeVisivel(sb, unidadeId))) return { ok: false, erro: "Unidade não encontrada." };
    return { ok: true, projecoes: await listarProjecoesDaUnidade(sb, unidadeId) };
  } catch (e) {
    return falha(e);
  }
}

export async function carregarProjecao(id: string): Promise<{ ok: true; projecao: Projecao } | Falha> {
  try {
    const { sb } = await sessao();
    const projecao = await getProjecao(sb, id);
    if (!projecao) return { ok: false, erro: "Projeção não encontrada." };
    return { ok: true, projecao };
  } catch (e) {
    return falha(e);
  }
}

export async function excluirProjecao(id: string): Promise<{ ok: true } | Falha> {
  try {
    const { sb } = await sessao();
    const projecao = await getProjecao(sb, id);
    if (!projecao) return { ok: false, erro: "Projeção não encontrada." };
    const unidade = await unidadeVisivel(sb, projecao.unidade_id);
    const { error } = await sb.from("financeiro_projecoes").delete().eq("id", id);
    if (error) return { ok: false, erro: error.message };
    const path = projecao.arquivo_path;
    if (path && unidade && caminhoValido(path, unidade.tenant_id, unidade.id)) {
      // Só remove se nenhuma outra projeção aponta para o mesmo arquivo
      const { count } = await sb.from("financeiro_projecoes").select("id", { count: "exact", head: true }).eq("arquivo_path", path);
      if ((count ?? 0) === 0) await createAdminClient().storage.from(BUCKET_PROJECOES).remove([path]);
    }
    revalidatePath("/financeiro");
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

/** URL assinada (10 min) do arquivo original da franqueadora. */
export async function urlArquivoProjecao(id: string): Promise<{ ok: true; url: string } | Falha> {
  try {
    const { sb } = await sessao();
    const projecao = await getProjecao(sb, id);
    const path = projecao?.arquivo_path;
    const unidade = projecao ? await unidadeVisivel(sb, projecao.unidade_id) : null;
    if (!path || !unidade || !caminhoValido(path, unidade.tenant_id, unidade.id)) return { ok: false, erro: "Arquivo não encontrado." };
    const { data, error } = await createAdminClient().storage.from(BUCKET_PROJECOES)
      .createSignedUrl(path, 600, { download: projecao.arquivo_nome ?? undefined });
    if (error || !data) return { ok: false, erro: error?.message ?? "Arquivo não encontrado." };
    return { ok: true, url: data.signedUrl };
  } catch (e) {
    return falha(e);
  }
}

// ─── Comparar com o real ─────────────────────────────────────────────────

export async function compararProjecao(escopo: string): Promise<{ ok: true; comparativo: ComparativoProjecao | null } | Falha> {
  try {
    const { sb } = await sessao();
    const { data } = await sb.from("unidades").select("id, nome").order("nome");
    const todas = (data ?? []) as Array<{ id: string; nome: string }>;
    const alvo = escopo === "consolidado" ? todas : todas.filter((u) => u.id === escopo);
    if (alvo.length === 0) return { ok: false, erro: "Unidade não encontrada." };

    const ativas = await Promise.all(alvo.map((u) => getProjecaoAtiva(sb, u.id)));
    const projecoes = ativas.filter((p): p is Projecao => p != null);
    if (projecoes.length === 0) return { ok: true, comparativo: null };
    const semProjecao = alvo.filter((_, i) => ativas[i] == null).map((u) => u.nome);

    const dados = await carregarDadosDRE(sb, projecoes.map((p) => p.unidade_id));
    const entradas: EntradaComparativo[] = projecoes.map((projecao, i) => ({ projecao, dados: dados[i] }));
    const hoje = nowBR();
    const comparativo = montarComparativo(escopo, entradas, { ano: hoje.ano, mes: hoje.mes });
    if (comparativo && escopo === "consolidado" && semProjecao.length > 0) {
      // O consolidado soma só quem tem projeção ativa: deixar isso explícito
      comparativo.unidades_sem_projecao = semProjecao;
      comparativo.insights.unshift({
        tom: "neutro",
        texto: `Consolidado de ${projecoes.length} de ${alvo.length} unidades: ${semProjecao.join(", ")} ${semProjecao.length === 1 ? "não tem" : "não têm"} projeção ativa e ${semProjecao.length === 1 ? "fica" : "ficam"} fora de todas as somas (projetado e real).`,
        href: "/financeiro?aba=projecao",
      });
    }
    if (comparativo) {
      const semInauguracao = dados.filter((d) => !d.ano_inauguracao || !d.mes_inauguracao).map((d) => d.unidade_nome);
      if (semInauguracao.length) {
        comparativo.insights.unshift({
          tom: "neutro",
          texto: `${semInauguracao.join(", ")} sem mês de inauguração configurado: o DRE real dessa unidade não entra na comparação até ajustar em Financeiro › Configuração.`,
          href: "/financeiro?aba=config",
        });
      }
    }
    return { ok: true, comparativo };
  } catch (e) {
    return falha(e);
  }
}

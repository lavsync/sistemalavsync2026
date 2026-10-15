"use server";
// LavSync · Financeiro · Arquivo de relatórios DRE (bucket privado)
// Gerar+salvar, listar, abrir (URL assinada) e excluir. Sessão obrigatória;
// o storage é acessado com service role só depois do gate.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BUCKET_DRE, lerPeriodo, montarDREPdf, nomeDoUsuario, lerNomeArquivo, type RelatorioSalvo,
} from "./dre-relatorio";

async function sessao() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: t } = await sb.from("tenants").select("id").limit(1).maybeSingle();
  const tenant = (t as { id: string } | null)?.id;
  if (!tenant) throw new Error("Tenant não encontrado");
  return { sb, user, tenant };
}

export async function salvarRelatorioDRE(input: { escopo: string; tipo: string; ano: number; numero: number }):
  Promise<{ ok: true; relatorio: RelatorioSalvo } | { ok: false; erro: string }> {
  try {
    const { sb, user, tenant } = await sessao();
    const periodo = lerPeriodo(input.tipo, input.ano, input.numero);
    if (!periodo) return { ok: false, erro: "Período inválido." };
    const r = await montarDREPdf(sb, input.escopo, periodo, await nomeDoUsuario(sb, user.id, user.email));
    if (!r) return { ok: false, erro: "Unidade não encontrada." };
    const path = `${tenant}/${r.arquivo}`;
    const { error } = await createAdminClient().storage.from(BUCKET_DRE)
      .upload(path, r.pdf, { contentType: "application/pdf", upsert: false });
    if (error) return { ok: false, erro: error.message };
    revalidatePath("/financeiro");
    return { ok: true, relatorio: lerNomeArquivo(path, r.pdf.length)! };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

export async function listarRelatoriosDRE(): Promise<RelatorioSalvo[]> {
  const { tenant } = await sessao();
  const { data } = await createAdminClient().storage.from(BUCKET_DRE)
    .list(tenant, { limit: 500, sortBy: { column: "created_at", order: "desc" } });
  return (data ?? [])
    .map((o) => lerNomeArquivo(`${tenant}/${o.name}`, (o.metadata as { size?: number } | null)?.size ?? null))
    .filter((x): x is RelatorioSalvo => x != null);
}

export async function urlRelatorioDRE(path: string, download = false): Promise<string | null> {
  const { tenant } = await sessao();
  if (!path.startsWith(`${tenant}/`)) return null;
  const { data } = await createAdminClient().storage.from(BUCKET_DRE)
    .createSignedUrl(path, 600, download ? { download: path.split("/").pop() } : undefined);
  return data?.signedUrl ?? null;
}

export async function excluirRelatorioDRE(path: string): Promise<{ ok: boolean; erro?: string }> {
  const { tenant } = await sessao();
  if (!path.startsWith(`${tenant}/`)) return { ok: false, erro: "Arquivo fora do seu espaço." };
  const { error } = await createAdminClient().storage.from(BUCKET_DRE).remove([path]);
  revalidatePath("/financeiro");
  return error ? { ok: false, erro: error.message } : { ok: true };
}

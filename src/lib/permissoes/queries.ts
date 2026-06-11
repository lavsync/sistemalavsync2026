// LavSync · Permissões · Server queries
import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Acao = "view" | "create" | "update" | "delete" | "execute" | "importar" | "exportar";

export type PermissaoCatalogo = {
  chave: string;
  modulo: string;
  acao: Acao;
  label: string;
  descricao: string | null;
  ordem: number;
};

export type Papel = "master" | "admin" | "gerente" | "operador" | "viewer";

export async function listarCatalogoPermissoes(): Promise<PermissaoCatalogo[]> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("permissoes_catalogo")
    .select("chave, modulo, acao, label, descricao, ordem")
    .order("ordem");
  if (error) throw error;
  return (data ?? []) as PermissaoCatalogo[];
}

/** Quais permissões um papel tem por padrão */
export async function listarPermissoesPorPapel(): Promise<Record<Papel, string[]>> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("papeis_permissoes")
    .select("papel, permissao_chave");
  if (error) throw error;

  const result: Record<Papel, string[]> = {
    master: [], admin: [], gerente: [], operador: [], viewer: [],
  };
  for (const r of (data ?? []) as Array<{ papel: Papel; permissao_chave: string }>) {
    if (result[r.papel]) result[r.papel].push(r.permissao_chave);
  }
  return result;
}

/** Override individual de um usuário (chave → concedida) */
export async function listarOverridesUsuario(
  usuarioId: string,
): Promise<Record<string, boolean>> {
  const sb = await createClient();
  const { data, error } = await sb
    .from("usuarios_permissoes")
    .select("permissao_chave, concedida")
    .eq("usuario_id", usuarioId);
  if (error) throw error;
  const map: Record<string, boolean> = {};
  for (const r of (data ?? []) as Array<{ permissao_chave: string; concedida: boolean }>) {
    map[r.permissao_chave] = r.concedida;
  }
  return map;
}

/** Permissões efetivas (papel + override) — usado pra dar guard nos rotas */
export async function listarPermissoesEfetivas(usuarioId: string): Promise<Set<string>> {
  const sb = await createClient();
  const { data: u } = await sb.from("usuarios").select("papel").eq("id", usuarioId).maybeSingle();
  const papel = (u as { papel?: Papel } | null)?.papel;
  if (papel === "master") {
    const cat = await listarCatalogoPermissoes();
    return new Set(cat.map((c) => c.chave));
  }
  if (!papel) return new Set();

  const [byPapel, overrides] = await Promise.all([
    listarPermissoesPorPapel(),
    listarOverridesUsuario(usuarioId),
  ]);
  const efetivas = new Set<string>(byPapel[papel] ?? []);
  for (const [chave, concedida] of Object.entries(overrides)) {
    if (concedida) efetivas.add(chave);
    else efetivas.delete(chave);
  }
  return efetivas;
}

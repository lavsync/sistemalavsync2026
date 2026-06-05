// LavSync · Usuários (Configurações) — Server queries
import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Papel = "master" | "admin" | "operador" | "viewer";

export type UsuarioRow = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  telefone: string | null;
  unidades_permitidas: string[] | null;
  ultimo_acesso_em: string | null;
  criado_em: string;
  observacoes: string | null;
};

export async function listarUsuarios(): Promise<UsuarioRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, email, papel, ativo, telefone, unidades_permitidas, ultimo_acesso_em, criado_em, observacoes")
    .order("ativo", { ascending: false })
    .order("nome");
  if (error) throw error;
  return (data ?? []) as UsuarioRow[];
}

export async function getUsuarioAtual(): Promise<UsuarioRow | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, email, papel, ativo, telefone, unidades_permitidas, ultimo_acesso_em, criado_em, observacoes")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as UsuarioRow | null;
}

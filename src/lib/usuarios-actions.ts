"use server";
// LavSync · Usuários · Server actions (precisa SUPABASE_SERVICE_ROLE_KEY)
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

type Papel = "master" | "admin" | "operador" | "viewer";

function admin() {
  // Cliente service_role pra Auth Admin API
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function podeGerenciarUsuarios(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("usuarios")
    .select("papel")
    .eq("id", user.id)
    .maybeSingle();
  const papel = (data as { papel?: string } | null)?.papel;
  return papel === "master" || papel === "admin";
}

function gerarSenhaForte(tamanho: number = 14): string {
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digit = "23456789";
  const sym = "!@#$%&*";
  const todos = lower + upper + digit + sym;
  // garante 1 de cada tipo
  let s =
    lower[Math.floor(Math.random() * lower.length)] +
    upper[Math.floor(Math.random() * upper.length)] +
    digit[Math.floor(Math.random() * digit.length)] +
    sym[Math.floor(Math.random() * sym.length)];
  for (let i = s.length; i < tamanho; i++) {
    s += todos[Math.floor(Math.random() * todos.length)];
  }
  // shuffle
  return s.split("").sort(() => Math.random() - 0.5).join("");
}

export type CriarUsuarioInput = {
  nome: string;
  email: string;
  papel: Papel;
  telefone?: string | null;
  unidades_permitidas?: string[] | null;
  observacoes?: string | null;
};

export type CriarUsuarioResult = {
  ok: true;
  usuarioId: string;
  senhaTemporaria: string;
} | {
  ok: false;
  motivo: string;
};

export async function criarUsuario(input: CriarUsuarioInput): Promise<CriarUsuarioResult> {
  if (!(await podeGerenciarUsuarios())) {
    return { ok: false, motivo: "Sem permissão. Apenas master/admin podem criar usuários." };
  }

  const sb = admin();
  const supabase = await createServerClient();

  // 1. Pegar tenant_id (assumindo tenant único Xô Varal por enquanto)
  const { data: tenant } = await supabase.from("tenants").select("id").limit(1).maybeSingle();
  if (!tenant) return { ok: false, motivo: "Tenant não encontrado" };

  // 2. Gerar senha forte
  const senhaTemporaria = gerarSenhaForte(14);

  // 3. Criar no Auth (já confirmado)
  const { data: authData, error: errAuth } = await sb.auth.admin.createUser({
    email: input.email.trim().toLowerCase(),
    password: senhaTemporaria,
    email_confirm: true,
    user_metadata: { full_name: input.nome.trim(), role: input.papel },
  });
  if (errAuth || !authData.user) {
    return { ok: false, motivo: errAuth?.message ?? "Falha ao criar usuário no Auth" };
  }

  // 4. Criar na tabela usuarios (id = auth.uid)
  const { error: errIns } = await supabase.from("usuarios").insert({
    id: authData.user.id,
    tenant_id: (tenant as { id: string }).id,
    nome: input.nome.trim(),
    email: input.email.trim().toLowerCase(),
    papel: input.papel,
    telefone: input.telefone || null,
    unidades_permitidas:
      input.papel === "master" || input.papel === "admin"
        ? null
        : (input.unidades_permitidas ?? null),
    observacoes: input.observacoes || null,
    ativo: true,
  });
  if (errIns) {
    // rollback: remove auth user
    await sb.auth.admin.deleteUser(authData.user.id);
    return { ok: false, motivo: `Falha ao inserir em usuarios: ${errIns.message}` };
  }

  revalidatePath("/configuracoes");
  return { ok: true, usuarioId: authData.user.id, senhaTemporaria };
}

export type AtualizarUsuarioInput = {
  id: string;
  nome?: string;
  papel?: Papel;
  telefone?: string | null;
  unidades_permitidas?: string[] | null;
  observacoes?: string | null;
};

export async function atualizarUsuario(input: AtualizarUsuarioInput) {
  if (!(await podeGerenciarUsuarios())) {
    throw new Error("Sem permissão");
  }
  const supabase = await createServerClient();
  const patch: Record<string, unknown> = {};
  if (input.nome !== undefined) patch.nome = input.nome.trim();
  if (input.papel !== undefined) {
    patch.papel = input.papel;
    // Se virou master/admin, libera todas as unidades automaticamente
    if (input.papel === "master" || input.papel === "admin") {
      patch.unidades_permitidas = null;
    }
  }
  if (input.telefone !== undefined) patch.telefone = input.telefone;
  if (input.unidades_permitidas !== undefined) patch.unidades_permitidas = input.unidades_permitidas;
  if (input.observacoes !== undefined) patch.observacoes = input.observacoes;

  const { error } = await supabase.from("usuarios").update(patch).eq("id", input.id);
  if (error) throw error;

  // Atualizar metadata no Auth se mudou nome ou papel
  if (input.nome !== undefined || input.papel !== undefined) {
    const sb = admin();
    await sb.auth.admin.updateUserById(input.id, {
      user_metadata: { full_name: input.nome, role: input.papel },
    });
  }

  revalidatePath("/configuracoes");
}

export async function alternarAtivoUsuario(id: string, ativo: boolean) {
  if (!(await podeGerenciarUsuarios())) throw new Error("Sem permissão");
  const supabase = await createServerClient();
  const { error } = await supabase.from("usuarios").update({ ativo }).eq("id", id);
  if (error) throw error;

  // Desativar no Auth = bloquear login via ban_duration
  const sb = admin();
  await sb.auth.admin.updateUserById(id, {
    ban_duration: ativo ? "none" : "876000h", // ~100 anos
  });

  revalidatePath("/configuracoes");
}

export async function resetarSenha(id: string): Promise<{ senhaTemporaria: string }> {
  if (!(await podeGerenciarUsuarios())) throw new Error("Sem permissão");
  const sb = admin();
  const senhaTemporaria = gerarSenhaForte(14);
  const { error } = await sb.auth.admin.updateUserById(id, { password: senhaTemporaria });
  if (error) throw error;
  revalidatePath("/configuracoes");
  return { senhaTemporaria };
}

export async function deletarUsuario(id: string) {
  if (!(await podeGerenciarUsuarios())) throw new Error("Sem permissão");
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id === id) throw new Error("Você não pode deletar a si mesmo.");

  const sb = admin();
  // Apaga do Auth (cascade vai limpar usuarios via FK auth.users → public.usuarios)
  const { error: errAuth } = await sb.auth.admin.deleteUser(id);
  if (errAuth) throw errAuth;

  // Garantir delete na tabela app (caso FK não cascade)
  await supabase.from("usuarios").delete().eq("id", id);
  revalidatePath("/configuracoes");
}

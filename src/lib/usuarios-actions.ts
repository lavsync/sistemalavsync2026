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
  /** Se fornecida, usa essa senha. Senão gera automaticamente. */
  senhaPersonalizada?: string | null;
};

export type CriarUsuarioResult = {
  ok: true;
  usuarioId: string;
  senhaTemporaria: string;
  senhaFoiGerada: boolean;
} | {
  ok: false;
  motivo: string;
};

const MIN_PASSWORD = 8;

export async function criarUsuario(input: CriarUsuarioInput): Promise<CriarUsuarioResult> {
  if (!(await podeGerenciarUsuarios())) {
    return { ok: false, motivo: "Sem permissão. Apenas master/admin podem criar usuários." };
  }

  // service_role bypassa RLS — necessário pra inserir em usuarios + criar no Auth
  const sb = admin();
  const supabase = await createServerClient();

  // 1. Pegar tenant_id (assumindo tenant único Xô Varal por enquanto)
  const { data: tenant, error: errTenant } = await sb
    .from("tenants").select("id").limit(1).maybeSingle();
  if (errTenant) return { ok: false, motivo: `Falha ao buscar tenant: ${errTenant.message}` };
  if (!tenant) return { ok: false, motivo: "Tenant não encontrado" };

  // 2. Senha: personalizada (validada) ou gerada
  let senha: string;
  let senhaFoiGerada: boolean;
  if (input.senhaPersonalizada && input.senhaPersonalizada.trim().length > 0) {
    const p = input.senhaPersonalizada.trim();
    if (p.length < MIN_PASSWORD) {
      return { ok: false, motivo: `Senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.` };
    }
    senha = p;
    senhaFoiGerada = false;
  } else {
    senha = gerarSenhaForte(14);
    senhaFoiGerada = true;
  }

  // 3. Criar no Auth (já confirmado)
  const { data: authData, error: errAuth } = await sb.auth.admin.createUser({
    email: input.email.trim().toLowerCase(),
    password: senha,
    email_confirm: true,
    user_metadata: { full_name: input.nome.trim(), role: input.papel },
  });
  if (errAuth || !authData.user) {
    return { ok: false, motivo: errAuth?.message ?? "Falha ao criar usuário no Auth" };
  }

  // 4. Inserir na tabela usuarios usando service_role (bypassa RLS)
  const { error: errIns } = await sb.from("usuarios").insert({
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

  void supabase; // mantido pra checagem de permissão
  revalidatePath("/configuracoes");
  return { ok: true, usuarioId: authData.user.id, senhaTemporaria: senha, senhaFoiGerada };
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
  // service_role bypassa RLS pra updates administrativos
  const sb = admin();
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

  const { error } = await sb.from("usuarios").update(patch).eq("id", input.id);
  if (error) throw error;

  // Atualizar metadata no Auth se mudou nome ou papel
  if (input.nome !== undefined || input.papel !== undefined) {
    await sb.auth.admin.updateUserById(input.id, {
      user_metadata: { full_name: input.nome, role: input.papel },
    });
  }

  revalidatePath("/configuracoes");
}

export async function alternarAtivoUsuario(id: string, ativo: boolean) {
  if (!(await podeGerenciarUsuarios())) throw new Error("Sem permissão");
  const sb = admin();
  const { error } = await sb.from("usuarios").update({ ativo }).eq("id", id);
  if (error) throw error;

  // Desativar no Auth = bloquear login via ban_duration
  await sb.auth.admin.updateUserById(id, {
    ban_duration: ativo ? "none" : "876000h", // ~100 anos
  });

  revalidatePath("/configuracoes");
}

export type ResetSenhaInput = {
  id: string;
  /** Se fornecida, usa essa. Senão gera aleatória. */
  senhaPersonalizada?: string | null;
};

export type ResetSenhaResult = {
  senhaTemporaria: string;
  senhaFoiGerada: boolean;
};

export async function resetarSenha(input: ResetSenhaInput | string): Promise<ResetSenhaResult> {
  if (!(await podeGerenciarUsuarios())) throw new Error("Sem permissão");
  const sb = admin();

  // Compat: aceita string (id direto) ou input com senha
  const id = typeof input === "string" ? input : input.id;
  const personalizada = typeof input === "string" ? null : input.senhaPersonalizada;

  let senha: string;
  let senhaFoiGerada: boolean;
  if (personalizada && personalizada.trim().length > 0) {
    const p = personalizada.trim();
    if (p.length < MIN_PASSWORD) {
      throw new Error(`Senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
    }
    senha = p;
    senhaFoiGerada = false;
  } else {
    senha = gerarSenhaForte(14);
    senhaFoiGerada = true;
  }

  const { error } = await sb.auth.admin.updateUserById(id, { password: senha });
  if (error) throw error;
  revalidatePath("/configuracoes");
  return { senhaTemporaria: senha, senhaFoiGerada };
}

export async function deletarUsuario(id: string) {
  if (!(await podeGerenciarUsuarios())) throw new Error("Sem permissão");
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id === id) throw new Error("Você não pode deletar a si mesmo.");

  const sb = admin();
  // Apaga do Auth + garante delete na tabela app
  const { error: errAuth } = await sb.auth.admin.deleteUser(id);
  if (errAuth) throw errAuth;
  await sb.from("usuarios").delete().eq("id", id);
  revalidatePath("/configuracoes");
}

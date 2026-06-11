"use server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

function admin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function podeGerenciarPermissoes(): Promise<boolean> {
  const sb = await createServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return false;
  const { data } = await sb.from("usuarios").select("papel").eq("id", user.id).maybeSingle();
  const papel = (data as { papel?: string } | null)?.papel;
  return papel === "master" || papel === "admin";
}

/** Define o override de uma permissão para um usuário.
 *  concedida=null → remove override (volta a herdar do papel) */
export async function definirOverride(
  usuarioId: string,
  permissaoChave: string,
  concedida: boolean | null,
) {
  if (!(await podeGerenciarPermissoes())) throw new Error("Sem permissão");
  const sb = admin();
  const me = await createServerClient();
  const { data: { user } } = await me.auth.getUser();

  if (concedida === null) {
    const { error } = await sb
      .from("usuarios_permissoes")
      .delete()
      .eq("usuario_id", usuarioId)
      .eq("permissao_chave", permissaoChave);
    if (error) throw error;
  } else {
    const { error } = await sb
      .from("usuarios_permissoes")
      .upsert({
        usuario_id: usuarioId,
        permissao_chave: permissaoChave,
        concedida,
        concedido_por: user?.id ?? null,
        concedido_em: new Date().toISOString(),
      });
    if (error) throw error;
  }
  revalidatePath("/configuracoes");
}

/** Reset: apaga todos os overrides do usuário (volta a herdar do papel) */
export async function resetarOverridesUsuario(usuarioId: string) {
  if (!(await podeGerenciarPermissoes())) throw new Error("Sem permissão");
  const sb = admin();
  const { error } = await sb
    .from("usuarios_permissoes")
    .delete()
    .eq("usuario_id", usuarioId);
  if (error) throw error;
  revalidatePath("/configuracoes");
}

/** Altera UM lote de overrides (usado quando o usuário clica "Salvar") */
export async function aplicarOverridesLote(
  usuarioId: string,
  overrides: Array<{ chave: string; concedida: boolean | null }>,
) {
  if (!(await podeGerenciarPermissoes())) throw new Error("Sem permissão");
  const sb = admin();
  const me = await createServerClient();
  const { data: { user } } = await me.auth.getUser();

  const remover = overrides.filter((o) => o.concedida === null).map((o) => o.chave);
  const upsert = overrides
    .filter((o) => o.concedida !== null)
    .map((o) => ({
      usuario_id: usuarioId,
      permissao_chave: o.chave,
      concedida: o.concedida as boolean,
      concedido_por: user?.id ?? null,
      concedido_em: new Date().toISOString(),
    }));

  if (remover.length > 0) {
    const { error } = await sb
      .from("usuarios_permissoes")
      .delete()
      .eq("usuario_id", usuarioId)
      .in("permissao_chave", remover);
    if (error) throw error;
  }
  if (upsert.length > 0) {
    const { error } = await sb.from("usuarios_permissoes").upsert(upsert);
    if (error) throw error;
  }
  revalidatePath("/configuracoes");
}

"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@mi/lib/supabase/server";

export type LoginState =
  | { ok: true; method: "magic" | "oauth"; message?: string }
  | { ok: false; error: string }
  | undefined;

/**
 * Envia magic link para o e-mail do parceiro.
 * Cria conta automaticamente se não existir.
 */
export async function sendMagicLinkAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "E-mail inválido" };
  }

  const h = await headers();
  const origin = h.get("origin") ?? "https://midindoor.grupoescalize.com.br";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/parceiro/auth/callback?next=/parceiro/dashboard`,
      shouldCreateUser: true,
      data: { role: "parceiro" },
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    method: "magic",
    message: `Link de acesso enviado para ${email}. Verifique sua caixa de entrada.`,
  };
}

/**
 * Inicia login com Google OAuth.
 * Redireciona para o consent do Google, que volta pra /parceiro/auth/callback.
 */
export async function signInWithGoogleAction() {
  const h = await headers();
  const origin = h.get("origin") ?? "https://midindoor.grupoescalize.com.br";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/parceiro/auth/callback?next=/parceiro/dashboard`,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error) {
    throw new Error(error.message);
  }
  if (data.url) {
    redirect(data.url);
  }
}

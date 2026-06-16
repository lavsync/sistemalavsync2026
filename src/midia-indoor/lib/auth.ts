import { redirect } from "next/navigation";
import { createClient } from "@mi/lib/supabase/server";
import { getUnidadeAtiva } from "@/lib/unidade-ativa";

// ── Shim de auth do Mídia Indoor sobre a auth do LavSync ────────────────────
// O sistema Xô Varal usava public.profiles (role master/gestor/parceiro + unidade_id).
// No LavSync isso vira: auth.users + public.usuarios (papel) + unidade ativa (cookie).
export type MiRole = "master" | "gestor" | "parceiro";
export interface MiProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: MiRole;
  unidade_id: string | null;
}

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const unidade = await getUnidadeAtiva();
  const { data: u } = await supabase
    .from("usuarios")
    .select("nome, email, papel")
    .eq("id", user.id)
    .maybeSingle();

  const role: MiRole = u?.papel === "master" ? "master" : "gestor";
  const profile: MiProfile = {
    id: user.id,
    email: (u?.email as string) ?? user.email ?? "",
    full_name: (u?.nome as string) ?? null,
    role,
    unidade_id: unidade.id,
  };
  return { user, profile };
}

export async function requireRole(allowed: MiRole[]) {
  const { user, profile } = await requireUser();
  if (!allowed.includes(profile.role)) {
    redirect("/publicidade/midia-indoor?error=forbidden");
  }
  return { user, profile };
}

export async function getCurrentProfile(): Promise<MiProfile | null> {
  try {
    const { profile } = await requireUser();
    return profile;
  } catch {
    return null;
  }
}

export function initials(name: string | null | undefined, email?: string) {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

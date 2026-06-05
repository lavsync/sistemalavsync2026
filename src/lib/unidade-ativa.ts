// LavSync · seleção de unidade ativa
// Persistida em cookie pra sobreviver a navegações e SSR.
// Server: getUnidadeAtiva() → ID + dados básicos da unidade.
// Client: setUnidadeAtivaAction() (server action em ./unidade-actions.ts).
import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const UNIDADE_COOKIE = "lavsync_unidade";
export const UNIDADE_BURITIS = "10000000-0000-0000-0000-000000000001";

export type Unidade = {
  id: string;
  nome: string;
  tenant_id: string;
};

export async function listarUnidades(): Promise<Unidade[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Master e admin veem todas; demais respeitam unidades_permitidas
  const { data: usrApp } = user
    ? await supabase
        .from("usuarios")
        .select("papel, unidades_permitidas")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const { data, error } = await supabase
    .from("unidades")
    .select("id, nome, tenant_id")
    .order("nome");
  if (error) throw error;
  let unidades = (data ?? []) as Unidade[];

  const papel = (usrApp as { papel?: string } | null)?.papel;
  const permitidas = (usrApp as { unidades_permitidas?: string[] | null } | null)?.unidades_permitidas;

  if (papel && papel !== "master" && papel !== "admin" && permitidas && permitidas.length > 0) {
    const allow = new Set(permitidas);
    unidades = unidades.filter((u) => allow.has(u.id));
  }
  return unidades;
}

export async function getUnidadeAtiva(): Promise<Unidade> {
  const store = await cookies();
  const cookieId = store.get(UNIDADE_COOKIE)?.value;
  const unidades = await listarUnidades();

  const escolhida = unidades.find((u) => u.id === cookieId)
    ?? unidades.find((u) => u.id === UNIDADE_BURITIS)
    ?? unidades[0];

  if (!escolhida) {
    throw new Error("Nenhuma unidade cadastrada pro tenant atual.");
  }
  return escolhida;
}

export async function getUnidadeAtivaId(): Promise<string> {
  const u = await getUnidadeAtiva();
  return u.id;
}

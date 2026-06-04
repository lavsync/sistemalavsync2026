"use server";
// LavSync · server actions de unidade ativa
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { UNIDADE_COOKIE } from "./unidade-ativa";

export async function setUnidadeAtivaAction(unidadeId: string) {
  const store = await cookies();
  store.set(UNIDADE_COOKIE, unidadeId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 ano
    sameSite: "lax",
  });
  // Revalida tudo — qualquer rota pode mudar com a unidade
  revalidatePath("/", "layout");
}

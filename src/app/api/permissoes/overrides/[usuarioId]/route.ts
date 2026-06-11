import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listarOverridesUsuario } from "@/lib/permissoes/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ usuarioId: string }> },
) {
  const { usuarioId } = await ctx.params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });
  const { data: me } = await sb.from("usuarios").select("papel").eq("id", user.id).maybeSingle();
  const papel = (me as { papel?: string } | null)?.papel;
  if (papel !== "master" && papel !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const overrides = await listarOverridesUsuario(usuarioId);
  return NextResponse.json(overrides);
}

// LavSync · Financeiro · DRE em PDF (visualizar/baixar)
// GET ?escopo=consolidado|<unidade_id>&tipo=mensal|trimestral|semestral|anual&ano=2026&numero=3[&download=1]
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lerPeriodo, montarDREPdf, nomeDoUsuario } from "@/lib/financeiro/dre-relatorio";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const periodo = lerPeriodo(q.get("tipo"), q.get("ano"), q.get("numero"));
  if (!periodo) return NextResponse.json({ erro: "Período inválido" }, { status: 400 });

  const r = await montarDREPdf(sb, q.get("escopo") ?? "consolidado", periodo, await nomeDoUsuario(sb, user.id, user.email));
  if (!r) return NextResponse.json({ erro: "Unidade não encontrada" }, { status: 404 });

  const disp = q.get("download") === "1" ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(r.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disp}; filename="${r.arquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}

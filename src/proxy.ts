// Next.js 16 — proxy.ts (renomeado de middleware.ts)
// Guarda de autenticação Supabase em todas as rotas, exceto assets/imagens.
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy-helper";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Todas as rotas, exceto:
    // - _next/static, _next/image (assets)
    // - favicon, sitemap, robots
    // - arquivos com extensão (.svg, .png, .jpg, .jpeg, .gif, .webp)
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

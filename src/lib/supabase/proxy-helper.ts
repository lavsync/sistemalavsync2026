// Helper usado pelo proxy.ts para sincronizar a sessão Supabase via cookies em cada request.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    // ─── Endpoints máquina-a-máquina (autenticam via Bearer próprio) ──
    // Cron Vercel (CRON_SECRET) e webhooks externos (secret próprio).
    // Não podem ser redirecionados pro HTML de login.
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/webhooks") ||
    // ─── Mídia Indoor — rotas públicas (player TV, sites de clube, QR) ──
    pathname.startsWith("/m/") ||
    pathname.startsWith("/player") ||
    pathname.startsWith("/qr") ||
    pathname.startsWith("/parceiro") ||
    pathname.startsWith("/quero-ser-parceiro") ||
    pathname.startsWith("/api/midia-indoor/player") ||
    pathname.startsWith("/api/midia-indoor/qr-codes") ||
    pathname.startsWith("/api/midia-indoor/stocks") ||
    // ─── Páginas legais públicas (LGPD) ──────────────────────────────
    pathname.startsWith("/politica-de-privacidade") ||
    pathname.startsWith("/termos-de-uso") ||
    pathname.startsWith("/politica-de-cookies") ||
    pathname.startsWith("/direitos-lgpd");

  // Não autenticado e tentando acessar área restrita → redireciona pra /login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Autenticado tentando acessar /login → manda pro app
  if (user && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

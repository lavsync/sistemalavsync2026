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
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isAdminRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/unidades") ||
    pathname.startsWith("/parceiros") ||
    pathname.startsWith("/ofertas") ||
    pathname.startsWith("/campanhas") ||
    pathname.startsWith("/templates") ||
    pathname.startsWith("/leads") ||
    pathname.startsWith("/metricas") ||
    pathname.startsWith("/qr-codes") ||
    pathname.startsWith("/clube") ||
    pathname.startsWith("/configuracoes");

  // Portal do parceiro: tudo sob /parceiro/ EXCETO /parceiro/login, /parceiro/cadastro
  // e /parceiro/auth/ (callback OAuth)
  const isPartnerRoute =
    pathname.startsWith("/parceiro/") &&
    !pathname.startsWith("/parceiro/login") &&
    !pathname.startsWith("/parceiro/cadastro") &&
    !pathname.startsWith("/parceiro/auth");

  const isAuthRoute = pathname === "/login" || pathname === "/parceiro/login";

  if (isAdminRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (isPartnerRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/parceiro/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    // Redireciona admin pra /dashboard e parceiro pra /parceiro/dashboard
    url.pathname = pathname.startsWith("/parceiro") ? "/parceiro/dashboard" : "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

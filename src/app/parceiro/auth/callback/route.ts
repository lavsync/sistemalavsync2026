import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Callback do magic link e do OAuth (Google) do portal de parceiros.
 * Troca o code (ou token_hash) por session, grava cookies no response e redireciona.
 *
 * Importante: criamos um client local que escreve diretamente no NextResponse —
 * isso garante que os cookies de sessão são persistidos antes do redirect.
 *
 * O guard de role (impedir admin/gestor de cair no portal parceiro)
 * é feito em src/lib/partner-auth.ts, na próxima request.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/parceiro/dashboard";

  const cookieStore = await cookies();
  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Magic link / OTP via token_hash
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      return NextResponse.redirect(
        `${origin}/parceiro/login?error=${encodeURIComponent(error.message)}`,
      );
    }
    return response;
  }

  // OAuth (Google) e magic link PKCE via code
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/parceiro/login?error=${encodeURIComponent(error.message)}`,
      );
    }
    return response;
  }

  return NextResponse.redirect(`${origin}/parceiro/login?error=invalid_callback`);
}

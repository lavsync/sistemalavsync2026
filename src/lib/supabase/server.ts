// Supabase client para uso em SERVER COMPONENTS, SERVER ACTIONS e ROUTE HANDLERS.
// Usa cookies() do Next 16 para manter a sessão sincronizada via SSR.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context: cookies() é read-only.
            // O proxy.ts cuida da renovação via setAll do request/response.
          }
        },
      },
    }
  );
}

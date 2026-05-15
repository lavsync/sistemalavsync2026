import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Entrar · LavSync",
  description: "Acesso ao sistema operacional de lavanderias autosserviço.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <main className="min-h-screen relative overflow-hidden flex items-center justify-center px-4 bg-mesh-dark">
      {/* Camadas de fundo premium */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(700px 500px at 18% 22%, rgba(34,211,238,0.12), transparent 60%), radial-gradient(800px 600px at 82% 78%, rgba(139,92,246,0.16), transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.4] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>\")",
          }}
        />
      </div>

      <div className="w-full max-w-[420px]">
        <Suspense>
          <LoginForm searchParamsPromise={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

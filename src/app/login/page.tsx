import { Suspense } from "react";
import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Entrar · LavSync",
  description:
    "Acesso ao LavSync · A plataforma de gestão inteligente para lavanderias de autosserviço.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <main className="min-h-screen relative overflow-hidden bg-dark-tech grid lg:grid-cols-[1.2fr_1fr]">
      {/* ============ LEFT · KEY VISUAL · DARK TECH PREMIUM ============ */}
      <section className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 particles-glow">
        {/* Glow radial extra no topo */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(700px 700px at 30% 30%, rgba(25,199,203,0.18), transparent 65%), radial-gradient(500px 500px at 80% 80%, rgba(15,133,154,0.12), transparent 70%)",
          }}
        />

        {/* Logo topo esquerdo (Brandbook §02: horizontal branco em fundo escuro) */}
        <div className="relative z-10 flex items-center">
          <Image
            src="/brand/logo/lavsync-horizontal-branco.png"
            alt="LavSync"
            width={220}
            height={56}
            priority
            className="h-12 w-auto object-contain"
          />
        </div>

        {/* Hero copy (Brandbook §07 Voz da Marca) */}
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-cyan/10 border border-brand-cyan/25 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse" />
            <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-brand-cyan">
              Operations OS
            </span>
          </div>

          <h1 className="font-display text-4xl xl:text-5xl font-bold tracking-tight text-white leading-[1.05]">
            Tudo da sua
            <br />
            <span className="text-gradient-brand">lavanderia.</span>
          </h1>
          <p className="font-display text-2xl xl:text-3xl font-semibold mt-2 text-white/85 tracking-tight">
            Sincronizado. Inteligente. Lucrativo.
          </p>

          <p className="text-[14px] xl:text-[15px] text-white/60 mt-6 leading-relaxed max-w-md">
            A única plataforma construída de dentro para fora das lavanderias de
            autosserviço — gestão, dados e decisão em um único painel.
          </p>

          {/* 3 pilares */}
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
            <Pillar value="01" label="Clareza" />
            <Pillar value="02" label="Precisão" />
            <Pillar value="03" label="Escala" />
          </div>
        </div>

        {/* Footer brandbook */}
        <div className="relative z-10 flex items-center justify-between text-[11px] text-white/35">
          <span>© LavSync 2026 · Documento confidencial</span>
          <span className="font-mono uppercase tracking-wider">
            v1.0 · {process.env.NEXT_PUBLIC_APP_ENV ?? "prod"}
          </span>
        </div>
      </section>

      {/* ============ RIGHT · FORM CARD ============ */}
      <section className="relative flex flex-col items-center justify-center p-6 md:p-10 lg:bg-[#0F1A2E]/40">
        {/* Glow radial no lado direito */}
        <div
          className="pointer-events-none absolute inset-0 lg:hidden"
          style={{
            background:
              "radial-gradient(600px 500px at 50% 30%, rgba(25,199,203,0.15), transparent 65%)",
          }}
        />

        {/* Logo mobile (só aparece em telas pequenas) */}
        <div className="lg:hidden mb-8 relative z-10 flex flex-col items-center gap-3">
          <Image
            src="/brand/logo/lavsync-vertical-branco.png"
            alt="LavSync"
            width={120}
            height={140}
            priority
            className="h-24 w-auto object-contain"
          />
          <p className="text-[12px] text-white/60 text-center max-w-xs">
            Tudo da sua lavanderia.{" "}
            <span className="text-brand-cyan font-semibold">
              Sincronizado.
            </span>
          </p>
        </div>

        <div className="w-full max-w-[420px] relative z-10">
          <Suspense>
            <LoginForm searchParamsPromise={searchParams} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}

function Pillar({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] backdrop-blur-sm px-3 py-2.5">
      <div className="font-display text-[10px] font-semibold tracking-[0.18em] text-brand-cyan/80 uppercase">
        {value}
      </div>
      <div className="font-display text-[15px] font-bold text-white mt-0.5">
        {label}
      </div>
    </div>
  );
}

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Shield } from "lucide-react";
import { LegalFooter } from "./legal-footer";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export function LegalShell({
  title,
  subtitle,
  versao,
  vigenteDesde,
  children,
}: {
  title: string;
  subtitle: string;
  versao?: string;
  vigenteDesde?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-dark-tech text-white">
      {/* Header */}
      <header className="border-b border-white/8 bg-[#0B1220]/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/brand/logo/lavsync-horizontal-branco.png"
              alt="LavSync"
              width={180}
              height={48}
              priority
              className="h-9 w-auto object-contain"
            />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold text-white/70 hover:text-white border border-white/10 hover:border-white/20 transition-smooth"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 md:px-6 pt-10 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-cyan/10 border border-brand-cyan/25 mb-4">
          <Shield className="w-3 h-3 text-brand-cyan" />
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-brand-cyan">
            Documento legal
          </span>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
        <p className="text-[14px] text-white/65 mt-2 max-w-2xl">{subtitle}</p>
        <div className="flex flex-wrap items-center gap-3 mt-4 text-[11px] text-white/45">
          {versao && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/8">
              Versão {versao}
            </span>
          )}
          {vigenteDesde && (
            <span>Vigente desde {new Date(vigenteDesde).toLocaleDateString("pt-BR")}</span>
          )}
          <span className="font-mono">{LEGAL_CONFIG.empresa.nomeFantasia}</span>
        </div>
      </section>

      {/* Conteúdo */}
      <main className="max-w-4xl mx-auto px-4 md:px-6 pb-16">
        <article className="legal-prose">
          {children}
        </article>
      </main>

      <LegalFooter />
    </div>
  );
}

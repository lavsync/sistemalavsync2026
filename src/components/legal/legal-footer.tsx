import Link from "next/link";
import { Mail, ShieldCheck } from "lucide-react";
import { LEGAL_CONFIG, LEGAL_LINKS } from "@/lib/legal-config";

export function LegalFooter() {
  const ano = new Date().getFullYear();
  return (
    <footer className="border-t border-white/8 bg-[#0B1220]">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[12px] text-white/55">
          <div>
            <div className="font-display font-bold text-white text-sm mb-2">{LEGAL_CONFIG.empresa.nomeFantasia}</div>
            <div className="space-y-0.5 text-[11px]">
              <div>{LEGAL_CONFIG.empresa.razaoSocial}</div>
              <div className="font-mono">{LEGAL_CONFIG.empresa.cnpj}</div>
              <a href={`mailto:${LEGAL_CONFIG.empresa.email}`} className="hover:text-brand-cyan inline-flex items-center gap-1 mt-1">
                <Mail className="w-3 h-3" /> {LEGAL_CONFIG.empresa.email}
              </a>
            </div>
          </div>
          <div>
            <div className="font-display font-bold text-white text-sm mb-2">Documentos legais</div>
            <ul className="space-y-1">
              {LEGAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-brand-cyan transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-display font-bold text-white text-sm mb-2 inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-cyan" /> Encarregado de Dados
            </div>
            <div className="space-y-0.5 text-[11px]">
              <div>{LEGAL_CONFIG.dpo.nome}</div>
              <a href={`mailto:${LEGAL_CONFIG.dpo.email}`} className="hover:text-brand-cyan inline-flex items-center gap-1">
                <Mail className="w-3 h-3" /> {LEGAL_CONFIG.dpo.email}
              </a>
              <div className="text-[10px] text-white/45 mt-1">{LEGAL_CONFIG.dpo.horario}</div>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-5 border-t border-white/8 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-[10px] text-white/40">
          <div>© {ano} {LEGAL_CONFIG.empresa.nomeFantasia} · Todos os direitos reservados</div>
          <div className="uppercase tracking-[0.18em] font-semibold text-brand-cyan/60">
            Tudo da sua lavanderia. Sincronizado. Inteligente. Lucrativo.
          </div>
        </div>
      </div>
    </footer>
  );
}

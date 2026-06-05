"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X, Settings, Check } from "lucide-react";
import { registrarConsentimento } from "@/lib/lgpd-actions";
import { LEGAL_CONFIG } from "@/lib/legal-config";

const STORAGE_KEY = "lavsync.cookies.consent.v1";
const VERSAO = LEGAL_CONFIG.versoes.politicaCookies;

type Consent = {
  essenciais: true; // sempre true
  analytics: boolean;
  funcionais: boolean;
  marketing: boolean;
  decidiuEm: string;
  versao: string;
};

export function CookieBanner() {
  const [visivel, setVisivel] = React.useState(false);
  const [modoDetalhes, setModoDetalhes] = React.useState(false);
  const [analytics, setAnalytics] = React.useState(true);
  const [funcionais, setFuncionais] = React.useState(true);
  const [marketing, setMarketing] = React.useState(false);

  React.useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) {
      setVisivel(true);
      return;
    }
    try {
      const c = JSON.parse(raw) as Consent;
      if (c.versao !== VERSAO) setVisivel(true);
    } catch {
      setVisivel(true);
    }
  }, []);

  async function persistir(input: { analytics: boolean; funcionais: boolean; marketing: boolean }) {
    const consent: Consent = {
      essenciais: true,
      analytics: input.analytics,
      funcionais: input.funcionais,
      marketing: input.marketing,
      decidiuEm: new Date().toISOString(),
      versao: VERSAO,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    setVisivel(false);

    // Registra no banco (fire and forget, sem bloquear UI)
    try {
      await Promise.all([
        registrarConsentimento({ tipo: "cookies_essenciais", concedido: true, versaoDocumento: VERSAO, origem: "site" }),
        registrarConsentimento({ tipo: "cookies_analytics", concedido: input.analytics, versaoDocumento: VERSAO, origem: "site" }),
        registrarConsentimento({ tipo: "cookies_marketing", concedido: input.marketing, versaoDocumento: VERSAO, origem: "site" }),
      ]);
    } catch {
      // silencioso — usuário não pode ser bloqueado por falha de log
    }
  }

  function aceitarTodos() {
    persistir({ analytics: true, funcionais: true, marketing: true });
  }
  function recusarOpcionais() {
    persistir({ analytics: false, funcionais: false, marketing: false });
  }
  function salvarPersonalizado() {
    persistir({ analytics, funcionais, marketing });
  }

  return (
    <AnimatePresence>
      {visivel && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-4 left-4 right-4 md:bottom-6 md:left-6 md:right-auto md:max-w-[440px] z-50"
        >
          <div
            className="rounded-2xl border border-white/12 shadow-2xl overflow-hidden"
            style={{
              background: "rgba(11, 18, 32, 0.95)",
              backdropFilter: "blur(20px) saturate(150%)",
              boxShadow: "0 30px 80px -30px rgba(0,0,0,0.7), 0 12px 40px -16px rgba(25,199,203,0.25)",
            }}
          >
            {!modoDetalhes ? (
              // ──────────── Modo simples ────────────
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-cyan/15 border border-brand-cyan/30 flex items-center justify-center shrink-0">
                    <Cookie className="w-4 h-4 text-brand-cyan" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-white text-[14px]">Usamos cookies</div>
                    <p className="text-[12px] text-white/65 mt-1 leading-relaxed">
                      Cookies essenciais mantêm o sistema funcionando. Os opcionais ajudam a melhorar
                      sua experiência. Você decide.{" "}
                      <Link href="/politica-de-cookies" className="text-brand-cyan hover:underline">
                        Saber mais
                      </Link>
                      .
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    onClick={aceitarTodos}
                    className="w-full h-10 rounded-xl font-semibold text-[13px] text-white inline-flex items-center justify-center gap-1.5"
                    style={{
                      background: "linear-gradient(135deg, #01385B 0%, #0F859A 35%, #19C7CB 70%, #73D8D8 100%)",
                      boxShadow: "0 8px 20px -8px rgba(25,199,203,0.5)",
                    }}
                  >
                    <Check className="w-4 h-4" /> Aceitar todos
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={recusarOpcionais}
                      className="h-9 rounded-lg text-[12px] font-semibold text-white/75 hover:text-white border border-white/10 hover:border-white/20"
                    >
                      Só essenciais
                    </button>
                    <button
                      onClick={() => setModoDetalhes(true)}
                      className="h-9 rounded-lg text-[12px] font-semibold text-brand-cyan hover:text-white border border-brand-cyan/30 hover:border-brand-cyan/60 inline-flex items-center justify-center gap-1"
                    >
                      <Settings className="w-3 h-3" /> Personalizar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // ──────────── Modo detalhes ────────────
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-display font-bold text-white text-[14px] inline-flex items-center gap-2">
                    <Settings className="w-4 h-4 text-brand-cyan" /> Preferências
                  </div>
                  <button onClick={() => setModoDetalhes(false)} className="w-7 h-7 rounded-md text-white/55 hover:text-white hover:bg-white/5 flex items-center justify-center">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-2.5">
                  <CategoriaToggle
                    nome="Essenciais"
                    descricao="Login, segurança, preferências básicas. Não podem ser desativados."
                    ativo
                    bloqueado
                    onChange={() => {}}
                  />
                  <CategoriaToggle
                    nome="Funcionais"
                    descricao="Lembrar filtros, layout do menu, copiloto recolhido."
                    ativo={funcionais}
                    onChange={setFuncionais}
                  />
                  <CategoriaToggle
                    nome="Analíticos"
                    descricao="Métricas anônimas de uso pra melhorar a plataforma."
                    ativo={analytics}
                    onChange={setAnalytics}
                  />
                  <CategoriaToggle
                    nome="Marketing"
                    descricao="Personalizar comunicações e ofertas (não ativo no momento)."
                    ativo={marketing}
                    onChange={setMarketing}
                  />
                </div>
                <button
                  onClick={salvarPersonalizado}
                  className="mt-4 w-full h-10 rounded-xl font-semibold text-[13px] text-white inline-flex items-center justify-center gap-1.5"
                  style={{
                    background: "linear-gradient(135deg, #01385B 0%, #0F859A 35%, #19C7CB 70%, #73D8D8 100%)",
                  }}
                >
                  <Check className="w-4 h-4" /> Salvar preferências
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CategoriaToggle({
  nome, descricao, ativo, bloqueado = false, onChange,
}: {
  nome: string;
  descricao: string;
  ativo: boolean;
  bloqueado?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-white/8 bg-white/[0.02]">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[12px] text-white">{nome}</div>
        <div className="text-[10.5px] text-white/55 mt-0.5 leading-snug">{descricao}</div>
      </div>
      <button
        type="button"
        disabled={bloqueado}
        onClick={() => onChange(!ativo)}
        aria-checked={ativo}
        role="switch"
        className={`relative shrink-0 inline-flex items-center w-10 h-6 rounded-full transition-colors ${
          ativo ? "bg-brand-cyan" : "bg-white/20"
        } ${bloqueado ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span
          className={`inline-block w-4 h-4 rounded-full bg-white shadow transition-transform ${
            ativo ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

"use client";

import { use, useActionState, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { signInAction, type LoginState } from "./actions";

export function LoginForm({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ next?: string }>;
}) {
  const sp = use(searchParamsPromise);
  const next = sp.next ?? "/";
  const [showPwd, setShowPwd] = useState(false);

  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    signInAction,
    null
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-3xl overflow-hidden"
      style={{
        // Glassmorphism oficial (Brandbook §09)
        background: "rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(18px) saturate(150%)",
        WebkitBackdropFilter: "blur(18px) saturate(150%)",
        border: "1px solid rgba(255, 255, 255, 0.10)",
        boxShadow:
          "0 30px 80px -30px rgba(0, 0, 0, 0.8), 0 12px 40px -16px rgba(25, 199, 203, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
      }}
    >
      {/* Borda gradient top */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(25,199,203,0.5), transparent)",
        }}
      />

      <div className="px-8 pt-8 pb-7">
        <h1 className="font-display text-2xl font-bold tracking-tight text-white mb-1.5">
          Entrar no sistema
        </h1>
        <p className="text-[13px] text-white/55 mb-7">
          Acesso restrito a operadores autorizados.
        </p>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />

          <Field label="E-mail" htmlFor="email">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="voce@lavanderia.com"
              className="login-input"
            />
          </Field>

          <Field label="Senha" htmlFor="password">
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="••••••••••"
                className="login-input pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-white/45 hover:text-white/85 hover:bg-white/5 transition-colors"
              >
                {showPwd ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </Field>

          {state?.error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-3 py-2.5 rounded-xl text-[12.5px] font-medium"
              style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                color: "rgb(252, 165, 165)",
              }}
            >
              {state.error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="group relative w-full h-12 rounded-2xl font-display font-semibold text-[14px] text-white overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed transition-transform active:scale-[0.985] mt-1"
            style={{
              // Gradiente Oficial LavSync 135°
              background:
                "linear-gradient(135deg, #01385B 0%, #0F859A 35%, #19C7CB 70%, #73D8D8 100%)",
              boxShadow:
                "0 12px 28px -10px rgba(25, 199, 203, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.22)",
            }}
          >
            <span className="relative z-[2] inline-flex items-center justify-center gap-2">
              {pending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Autenticando…
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </span>
          </button>
        </form>

        <div className="mt-7 pt-5 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-white/40">
          <span>Sincronizado · Inteligente · Lucrativo</span>
          <span className="font-mono">
            {process.env.NEXT_PUBLIC_APP_ENV ?? "prod"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-[10.5px] font-display font-semibold uppercase tracking-[0.16em] text-white/55 mb-2"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

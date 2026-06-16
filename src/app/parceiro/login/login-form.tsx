"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Loader2, Mail, Send, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@mi/components/ui/button";
import { Input } from "@mi/components/ui/input";
import { Label } from "@mi/components/ui/label";
import { toast } from "sonner";
import { sendMagicLinkAction, signInWithGoogleAction, type LoginState } from "./actions";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    sendMagicLinkAction,
    undefined,
  );
  const [oauthPending, startOauth] = useTransition();
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (initialError) toast.error(initialError);
  }, [initialError]);

  useEffect(() => {
    if (state && !state.ok) toast.error(state.error);
  }, [state]);

  // Pós magic link enviado: tela de "verifique seu e-mail"
  if (state?.ok && state.method === "magic") {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-primary">
          <CheckCircle className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-semibold">Link enviado!</h2>
        <p className="text-sm text-muted-foreground">
          Enviamos um link de acesso para <strong>{email}</strong>.<br />
          Confira sua caixa de entrada (e o spam) e clique no link para entrar.
        </p>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          className="w-full"
        >
          Usar outro e-mail
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Google OAuth */}
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        disabled={oauthPending}
        onClick={() => startOauth(async () => { await signInWithGoogleAction(); })}
      >
        {oauthPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.12-.84 2.07-1.79 2.7v2.24h2.9c1.7-1.56 2.69-3.87 2.69-6.58z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.46-.8 5.95-2.18l-2.9-2.24c-.8.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.7H.96v2.32C2.44 15.98 5.48 18 9 18z"/>
            <path fill="#FBBC05" d="M3.95 10.74A5.4 5.4 0 0 1 3.66 9c0-.6.1-1.19.29-1.74V4.94H.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.83.96 4.06l2.99-2.32z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.94l2.99 2.32C4.66 5.16 6.65 3.58 9 3.58z"/>
          </svg>
        )}
        Continuar com Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-card px-2 text-xs uppercase tracking-wider text-muted-foreground">
            ou
          </span>
        </div>
      </div>

      {/* Magic link */}
      <form action={formAction} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            Seu e-mail
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="seu@email.com"
            disabled={pending}
          />
        </div>
        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Enviar link de acesso
        </Button>
      </form>

      {/* WhatsApp OTP — roadmap */}
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Em breve
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Login por WhatsApp 📱
        </p>
      </div>
    </div>
  );
}

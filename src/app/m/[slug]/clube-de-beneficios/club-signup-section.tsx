"use client";

import { useActionState, useEffect } from "react";
import { Loader2, Heart, CheckCircle } from "lucide-react";
import { Button } from "@mi/components/ui/button";
import { Input } from "@mi/components/ui/input";
import { Label } from "@mi/components/ui/label";
import { Card, CardContent } from "@mi/components/ui/card";
import { toast } from "sonner";
import { signUpClubMemberAction, type ClubSignupState } from "./actions";

interface ClubSignupSectionProps {
  unitId: string;
  unitName: string;
  unitSlug: string;
}

export function ClubSignupSection({ unitId, unitName, unitSlug }: ClubSignupSectionProps) {
  const [state, formAction, pending] = useActionState<ClubSignupState, FormData>(
    signUpClubMemberAction,
    undefined,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("Bem-vindo ao Clube! 🎉");
    } else {
      toast.error(state.error);
    }
  }, [state]);

  if (state?.ok) {
    return (
      <section id="cadastro" className="bg-primary/5 py-12">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <CheckCircle className="mx-auto h-12 w-12 text-primary" />
          <h2 className="mt-3 text-2xl font-bold tracking-tight">Você está dentro!</h2>
          <p className="mt-2 text-muted-foreground">
            Seu cadastro foi confirmado. Salve o WhatsApp da unidade e aproveite as ofertas
            sempre que vier lavar.
          </p>
          <Button asChild size="lg" className="mt-6">
            <a href="#parceiros">Ver ofertas dos parceiros</a>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section id="cadastro" className="bg-primary/5 py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mb-6 text-center">
          <Heart className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-3 text-2xl font-bold tracking-tight">
            Entre no Clube de Benefícios — gratuito
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Cadastre-se em 30 segundos e desbloqueie todas as ofertas.
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="unidade_id" value={unitId} />
              <input type="hidden" name="unit_slug" value={unitSlug} />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="full_name">Seu nome *</Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    required
                    placeholder="Nome completo"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">WhatsApp *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    required
                    type="tel"
                    placeholder="(31) 99999-9999"
                    autoComplete="tel"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input
                    id="neighborhood"
                    name="neighborhood"
                    placeholder="Buritis"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail (opcional)</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="voce@email.com"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="birthdate">Data de nascimento (opcional)</Label>
                  <Input
                    id="birthdate"
                    name="birthdate"
                    type="date"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  name="accepted_terms"
                  required
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <span>
                  Aceito receber ofertas e novidades de {unitName} pelo WhatsApp. Posso cancelar
                  a qualquer momento.
                </span>
              </label>

              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Entrar no Clube — gratuito
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

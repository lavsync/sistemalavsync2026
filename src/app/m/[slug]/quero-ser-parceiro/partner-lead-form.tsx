"use client";

import { useActionState, useEffect } from "react";
import { Loader2, CheckCircle } from "lucide-react";
import { Button } from "@mi/components/ui/button";
import { Input } from "@mi/components/ui/input";
import { Label } from "@mi/components/ui/label";
import { Textarea } from "@mi/components/ui/textarea";
import { Select } from "@mi/components/ui/select";
import { toast } from "sonner";
import { CepInput, fillAddressInputs } from "@mi/components/address/cep-input";
import { PARTNER_CATEGORIES } from "@mi/lib/constants";
import { submitPartnerLeadAction, type LeadState } from "./actions";

interface Props {
  unitId: string;
  unitSlug: string;
}

export function PartnerLeadForm({ unitId, unitSlug }: Props) {
  const [state, formAction, pending] = useActionState<LeadState, FormData>(
    submitPartnerLeadAction,
    undefined,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success("Recebido! Entramos em contato em breve.");
    else toast.error(state.error);
  }, [state]);

  if (state?.ok) {
    return (
      <div className="space-y-3 text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-primary" />
        <h3 className="text-lg font-semibold">Recebemos sua proposta!</h3>
        <p className="text-sm text-muted-foreground">
          Vamos analisar e entrar em contato pelo WhatsApp em até 2 dias úteis. Obrigado pelo
          interesse em fazer parte da rede.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="unidade_id" value={unitId} />
      <input type="hidden" name="unit_slug" value={unitSlug} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="responsible_name">Seu nome *</Label>
          <Input
            id="responsible_name"
            name="responsible_name"
            required
            placeholder="Nome completo"
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="business_name">Nome do comércio *</Label>
          <Input
            id="business_name"
            name="business_name"
            required
            placeholder="Padaria Pão Quente"
            autoComplete="organization"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp">WhatsApp *</Label>
          <Input
            id="whatsapp"
            name="whatsapp"
            required
            type="tel"
            placeholder="(31) 99999-9999"
            autoComplete="tel"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="segment">Segmento</Label>
          <Select id="segment" name="segment">
            <option value="">Selecione (opcional)</option>
            {PARTNER_CATEGORIES.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="instagram">Instagram (opcional)</Label>
          <Input
            id="instagram"
            name="instagram"
            placeholder="@seunegocio"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cep">CEP (opcional)</Label>
          <CepInput
            id="cep"
            onResult={(addr) =>
              fillAddressInputs({
                address: [addr.logradouro, addr.bairro, `${addr.localidade}/${addr.uf}`]
                  .filter(Boolean)
                  .join(", "),
              })
            }
          />
          <p className="text-xs text-muted-foreground">Preenche o endereço pra você</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">Endereço do comércio (opcional)</Label>
          <Input
            id="address"
            name="address"
            placeholder="Rua, número, bairro"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="benefit_proposal">Que benefício quer oferecer aos clientes Xô Varal?</Label>
        <Textarea
          id="benefit_proposal"
          name="benefit_proposal"
          rows={2}
          placeholder="Ex: 10% de desconto na primeira compra"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">Mensagem adicional (opcional)</Label>
        <Textarea
          id="message"
          name="message"
          rows={3}
          placeholder="Conte um pouco mais sobre o seu negócio..."
        />
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Enviar proposta
      </Button>
    </form>
  );
}

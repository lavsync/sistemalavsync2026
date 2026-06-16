"use client";

import { useActionState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@mi/components/ui/button";
import { Input } from "@mi/components/ui/input";
import { Label } from "@mi/components/ui/label";
import { Textarea } from "@mi/components/ui/textarea";
import { ImageUpload } from "@mi/components/admin/image-upload";
import { toast } from "sonner";
import { CepInput } from "@mi/components/address/cep-input";
import { updatePartnerProfileAction, type ActionState } from "./actions";
import type { Tables } from "@mi/types/database";

export function PerfilForm({ partner }: { partner: Tables<"partners"> }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updatePartnerProfileAction,
    undefined,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success("Dados atualizados");
    else toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome fantasia *</Label>
        <Input id="name" name="name" required defaultValue={partner.name} maxLength={120} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="short_description">Descrição curta</Label>
        <Input
          id="short_description"
          name="short_description"
          defaultValue={partner.short_description ?? ""}
          maxLength={280}
          placeholder="Frase de 1 linha sobre seu negócio"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="full_description">Descrição completa</Label>
        <Textarea
          id="full_description"
          name="full_description"
          rows={4}
          defaultValue={partner.full_description ?? ""}
          maxLength={2000}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <ImageUpload
          bucket="logos"
          name="logo_url"
          label="Logo"
          defaultUrl={partner.logo_url}
          hint="PNG/JPG/SVG · até 2MB"
        />
        <ImageUpload
          bucket="banners"
          name="cover_url"
          label="Capa (foto principal)"
          aspect="wide"
          defaultUrl={partner.cover_url}
          hint="Ideal 16:9 · até 8MB"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp_business">WhatsApp comercial</Label>
          <Input
            id="whatsapp_business"
            name="whatsapp_business"
            type="tel"
            defaultValue={partner.whatsapp_business ?? ""}
            placeholder="(31) 9999-9999"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="instagram">Instagram</Label>
          <Input
            id="instagram"
            name="instagram"
            defaultValue={partner.instagram ?? ""}
            placeholder="@suaempresa"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="website">Site (opcional)</Label>
          <Input
            id="website"
            name="website"
            type="url"
            defaultValue={partner.website ?? ""}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cep">CEP</Label>
          <CepInput
            id="cep"
            defaultValue={partner.postal_code ?? ""}
            fillIds={{ address: "address", neighborhood: "neighborhood" }}
          />
          <p className="text-xs text-muted-foreground">
            Digite o CEP pra preencher endereço e bairro
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">Endereço</Label>
          <Input
            id="address"
            name="address"
            defaultValue={partner.address ?? ""}
            placeholder="Rua, número"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="neighborhood">Bairro</Label>
          <Input
            id="neighborhood"
            name="neighborhood"
            defaultValue={partner.neighborhood ?? ""}
            placeholder="Buritis"
          />
        </div>
      </div>

      <div className="flex justify-end border-t pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar alterações
        </Button>
      </div>
    </form>
  );
}

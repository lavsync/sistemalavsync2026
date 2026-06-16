"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { Button } from "@mi/components/ui/button";
import { Input } from "@mi/components/ui/input";
import { Label } from "@mi/components/ui/label";
import { Textarea } from "@mi/components/ui/textarea";
import { Switch } from "@mi/components/ui/switch";
import { ImageUpload } from "@mi/components/admin/image-upload";
import { toast } from "sonner";
import { createPartnerOfferAction, type ActionState } from "../actions";

export function OfferForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createPartnerOfferAction,
    undefined,
  );

  useEffect(() => {
    if (state && !state.ok) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="title">Título da oferta *</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={120}
          placeholder="Ex: 10% OFF para clientes Xô Varal"
        />
        <p className="text-xs text-muted-foreground">
          O título principal que vai aparecer no banner e no clube.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="main_call">Chamada (texto secundário)</Label>
        <Input
          id="main_call"
          name="main_call"
          maxLength={120}
          placeholder="Ex: Apresente este QR Code e ganhe!"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="coupon">Cupom (opcional)</Label>
          <Input
            id="coupon"
            name="coupon"
            maxLength={40}
            placeholder="XOVARAL10"
            className="uppercase font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cta_label">Texto do CTA</Label>
          <Input
            id="cta_label"
            name="cta_label"
            maxLength={40}
            placeholder="Aponte a câmera"
            defaultValue="Aponte a câmera"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="price_from">Preço &quot;DE&quot; (opcional)</Label>
          <Input
            id="price_from"
            name="price_from"
            type="number"
            step="0.01"
            min="0"
            placeholder="99.90"
          />
          <p className="text-xs text-muted-foreground">Aparece riscado no banner</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price_by">Preço &quot;POR&quot; (opcional)</Label>
          <Input
            id="price_by"
            name="price_by"
            type="number"
            step="0.01"
            min="0"
            placeholder="79.90"
          />
          <p className="text-xs text-muted-foreground">Destaque amarelo no banner</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição (opcional)</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          placeholder="Detalhes sobre a oferta, regras de uso etc."
        />
      </div>

      <ImageUpload
        bucket="banners"
        name="banner_url"
        label="Foto/banner da oferta (opcional)"
        aspect="wide"
        hint="PNG/JPG/WebP · ideal 16:9. Vai ser usado como fundo do banner gerado."
      />

      <div className="space-y-1.5">
        <Label htmlFor="whatsapp_message">Mensagem WhatsApp pré-pronta</Label>
        <Input
          id="whatsapp_message"
          name="whatsapp_message"
          placeholder="Olá! Vi sua oferta no Clube Xô Varal..."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="starts_at">Inicia em</Label>
          <Input id="starts_at" name="starts_at" type="datetime-local" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expires_at">Expira em</Label>
          <Input id="expires_at" name="expires_at" type="datetime-local" />
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
        <Switch name="is_featured" />
        <div>
          <p className="text-sm font-medium">Marcar como destaque</p>
          <p className="text-xs text-muted-foreground">
            Aparece com estrela amarela no topo do clube
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Criar oferta + gerar banner
        </Button>
      </div>
    </form>
  );
}

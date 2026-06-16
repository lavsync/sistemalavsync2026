"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@mi/components/ui/button";
import { Input } from "@mi/components/ui/input";
import { Label } from "@mi/components/ui/label";
import { Textarea } from "@mi/components/ui/textarea";
import { Select } from "@mi/components/ui/select";
import { Switch } from "@mi/components/ui/switch";
import { Card, CardContent } from "@mi/components/ui/card";
import { ImageUpload } from "@mi/components/admin/image-upload";
import { toast } from "sonner";
import { createOfferAction, updateOfferAction, type ActionState } from "./actions";
import type { Tables } from "@mi/types/database";

interface OfferFormProps {
  offer?: Tables<"offers">;
  partners: Array<Tables<"partners"> & { units?: { name: string } | null }>;
  defaultPartnerId?: string;
}

function toLocalDatetime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function OfferForm({ offer, partners, defaultPartnerId }: OfferFormProps) {
  const router = useRouter();
  const isEdit = !!offer;

  const action = isEdit ? updateOfferAction.bind(null, offer!.id) : createOfferAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(isEdit ? "Oferta atualizada" : "Oferta criada + QR Code gerado");
    else toast.error(state.error);
  }, [state, isEdit]);

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-1.5">
            <Label htmlFor="partner_id">Parceiro *</Label>
            {isEdit ? (
              <>
                <input type="hidden" name="partner_id" value={offer!.partner_id} />
                <Select
                  id="partner_id_display"
                  defaultValue={offer!.partner_id}
                  disabled
                  className="bg-muted cursor-not-allowed"
                >
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.units?.name ? `· ${p.units.name}` : ""}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-amber-700">
                  Parceiro não pode ser alterado após a oferta ser criada.
                </p>
              </>
            ) : (
              <Select
                id="partner_id"
                name="partner_id"
                required
                defaultValue={defaultPartnerId ?? ""}
              >
                <option value="" disabled>
                  Selecione o parceiro
                </option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.units?.name ? `· ${p.units.name}` : ""}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="title">Título da oferta *</Label>
              <Input
                id="title"
                name="title"
                required
                placeholder="10% OFF para clientes Xô Varal"
                defaultValue={offer?.title}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon">Cupom (opcional)</Label>
              <Input
                id="coupon"
                name="coupon"
                placeholder="XOVARAL10"
                defaultValue={offer?.coupon ?? ""}
                maxLength={40}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="main_call">Chamada principal (para a TV)</Label>
            <Input
              id="main_call"
              name="main_call"
              placeholder="Aponte a câmera e ganhe desconto"
              defaultValue={offer?.main_call ?? ""}
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Apresente este benefício e ganhe desconto especial..."
              defaultValue={offer?.description ?? ""}
            />
          </div>

          <ImageUpload
            bucket="banners"
            name="banner_url"
            label="Banner da oferta"
            aspect="wide"
            defaultUrl={offer?.banner_url}
            hint="PNG, JPG ou WebP · até 8MB · ideal 16:9 para a TV"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-sm font-semibold">CTA e regulamento</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cta_label">Texto do botão</Label>
              <Input
                id="cta_label"
                name="cta_label"
                placeholder="Resgatar oferta"
                defaultValue={offer?.cta_label ?? ""}
                maxLength={40}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cta_url">URL do botão</Label>
              <Input
                id="cta_url"
                name="cta_url"
                type="url"
                placeholder="https://..."
                defaultValue={offer?.cta_url ?? ""}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="whatsapp_url">Link de WhatsApp (mensagem pronta)</Label>
              <Input
                id="whatsapp_url"
                name="whatsapp_url"
                type="url"
                placeholder="https://wa.me/55..."
                defaultValue={offer?.whatsapp_url ?? ""}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="terms">Regulamento</Label>
            <Textarea
              id="terms"
              name="terms"
              rows={3}
              placeholder="Válido até... · Não cumulativo · Apresente esta tela..."
              defaultValue={offer?.terms ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-sm font-semibold">Vigência e status</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="starts_at">Inicia em</Label>
              <Input
                id="starts_at"
                name="starts_at"
                type="datetime-local"
                defaultValue={toLocalDatetime(offer?.starts_at)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expires_at">Expira em</Label>
              <Input
                id="expires_at"
                name="expires_at"
                type="datetime-local"
                defaultValue={toLocalDatetime(offer?.expires_at)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={offer?.status ?? "ativa"}>
                <option value="ativa">Ativa</option>
                <option value="inativa">Inativa</option>
                <option value="expirada">Expirada</option>
              </Select>
            </div>
            <div className="flex items-end gap-3">
              <Switch name="is_featured" defaultChecked={offer?.is_featured ?? false} />
              <div>
                <p className="text-sm font-medium">Destaque</p>
                <p className="text-xs text-muted-foreground">Aparece em destaque no clube</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? "Salvar alterações" : "Criar oferta"}
        </Button>
      </div>
    </form>
  );
}

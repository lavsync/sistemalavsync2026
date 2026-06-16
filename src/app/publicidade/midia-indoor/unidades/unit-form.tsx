"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@mi/components/ui/button";
import { Input } from "@mi/components/ui/input";
import { Label } from "@mi/components/ui/label";
import { Textarea } from "@mi/components/ui/textarea";
import { Switch } from "@mi/components/ui/switch";
import { Card, CardContent } from "@mi/components/ui/card";
import { toast } from "sonner";
import { CepInput } from "@mi/components/address/cep-input";
import { slugify } from "@mi/lib/utils";
import { createUnitAction, updateUnitAction, type ActionState } from "./actions";
import type { Tables } from "@mi/types/database";

interface UnitFormProps {
  unit?: Tables<"units">;
}

export function UnitForm({ unit }: UnitFormProps) {
  const router = useRouter();
  const isEdit = !!unit;

  const action = isEdit ? updateUnitAction.bind(null, unit!.id) : createUnitAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(isEdit ? "Unidade atualizada" : "Unidade criada");
    } else {
      toast.error(state.error);
    }
  }, [state, isEdit]);

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome da unidade *</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="Xô Varal Buritis"
                defaultValue={unit?.name}
                onBlur={(e) => {
                  const slugInput = document.getElementById("slug") as HTMLInputElement;
                  if (slugInput && !slugInput.value && !isEdit) {
                    slugInput.value = slugify(e.target.value);
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                name="slug"
                required
                placeholder="buritis"
                defaultValue={unit?.slug}
                pattern="[a-z0-9-]+"
                readOnly={isEdit}
                aria-readonly={isEdit}
                className={isEdit ? "bg-muted cursor-not-allowed" : ""}
                title={isEdit ? "Slug não pode ser alterado depois de criada a unidade" : undefined}
              />
              <p className="text-xs text-muted-foreground">
                URL: /player/<strong>slug</strong> e /<strong>slug</strong>/clube-de-beneficios
                {isEdit && (
                  <span className="ml-1 text-amber-700">
                    · Slug não pode ser alterado após a criação.
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[160px_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="cep">CEP</Label>
              <CepInput
                id="cep"
                fillIds={{
                  address: "address",
                  neighborhood: "neighborhood",
                  city: "city",
                  state: "state",
                }}
              />
              <p className="text-xs text-muted-foreground">Preenche o endereço</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                name="address"
                placeholder="Rua tal, 123"
                defaultValue={unit?.address ?? ""}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input
                id="neighborhood"
                name="neighborhood"
                placeholder="Buritis"
                defaultValue={unit?.neighborhood ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                name="city"
                placeholder="Belo Horizonte"
                defaultValue={unit?.city ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">UF</Label>
              <Input
                id="state"
                name="state"
                maxLength={2}
                placeholder="MG"
                defaultValue={unit?.state ?? ""}
                className="uppercase"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-sm font-semibold">Contato</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone fixo</Label>
              <Input id="phone" name="phone" placeholder="(31) 0000-0000" defaultValue={unit?.phone ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                name="whatsapp"
                placeholder="31973603600"
                defaultValue={unit?.whatsapp ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                name="instagram"
                placeholder="@xovaralburitis"
                defaultValue={unit?.instagram ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opening_hours">Horário de funcionamento</Label>
              <Input
                id="opening_hours"
                name="opening_hours"
                placeholder="Seg a dom, 06h às 22h"
                defaultValue={unit?.opening_hours ?? ""}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <p className="font-medium">Unidade ativa</p>
            <p className="text-sm text-muted-foreground">
              Quando inativa, não aparece no clube público nem no player.
            </p>
          </div>
          <Switch name="is_active" defaultChecked={unit?.is_active ?? true} />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? "Salvar alterações" : "Criar unidade"}
        </Button>
      </div>
    </form>
  );
}

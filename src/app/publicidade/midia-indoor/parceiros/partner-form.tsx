"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@mi/components/ui/button";
import { Input } from "@mi/components/ui/input";
import { Label } from "@mi/components/ui/label";
import { Textarea } from "@mi/components/ui/textarea";
import { Select } from "@mi/components/ui/select";
import { Card, CardContent } from "@mi/components/ui/card";
import { ImageUpload } from "@mi/components/admin/image-upload";
import { toast } from "sonner";
import { CepInput } from "@mi/components/address/cep-input";
import { slugify } from "@mi/lib/utils";
import { createPartnerAction, updatePartnerAction, type ActionState } from "./actions";
import type { Tables, UserRole } from "@mi/types/database";

interface PartnerFormProps {
  partner?: Tables<"partners">;
  categories: Tables<"partner_categories">[];
  units: Tables<"units">[];
  role: UserRole;
  defaultUnitId?: string | null;
}

export function PartnerForm({ partner, categories, units, role, defaultUnitId }: PartnerFormProps) {
  const router = useRouter();
  const isEdit = !!partner;

  const action = isEdit ? updatePartnerAction.bind(null, partner!.id) : createPartnerAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(isEdit ? "Parceiro atualizado" : "Parceiro criado");
    else toast.error(state.error);
  }, [state, isEdit]);

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-6 sm:grid-cols-[180px_1fr]">
            <ImageUpload
              bucket="logos"
              name="logo_url"
              label="Logo"
              defaultUrl={partner?.logo_url}
              hint="PNG, JPG, WebP ou SVG · até 2MB"
            />

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome do parceiro *</Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    placeholder="Padaria Pão Quente"
                    defaultValue={partner?.name}
                    onBlur={(e) => {
                      const slugInput = document.getElementById("slug") as HTMLInputElement;
                      if (slugInput && !slugInput.value && !isEdit) {
                        slugInput.value = slugify(e.target.value);
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    name="slug"
                    placeholder="padaria-pao-quente"
                    defaultValue={partner?.slug}
                    readOnly={isEdit}
                    aria-readonly={isEdit}
                    className={isEdit ? "bg-muted cursor-not-allowed" : ""}
                    title={isEdit ? "Slug não pode ser alterado depois de criado" : undefined}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {role === "master" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="unidade_id">Unidade *</Label>
                    <Select
                      id="unidade_id"
                      name="unidade_id"
                      required
                      defaultValue={partner?.unidade_id ?? defaultUnitId ?? ""}
                    >
                      <option value="" disabled>
                        Selecione a unidade
                      </option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
                {role !== "master" && defaultUnitId && (
                  <input type="hidden" name="unidade_id" value={defaultUnitId} />
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="category_id">Categoria *</Label>
                  <Select
                    id="category_id"
                    name="category_id"
                    required
                    defaultValue={partner?.category_id ?? ""}
                  >
                    <option value="" disabled>
                      Selecione a categoria
                    </option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-sm font-semibold">Descrição</h3>

          <div className="space-y-1.5">
            <Label htmlFor="short_description">Descrição curta</Label>
            <Input
              id="short_description"
              name="short_description"
              maxLength={280}
              placeholder="Padaria artesanal no coração do Buritis"
              defaultValue={partner?.short_description ?? ""}
            />
            <p className="text-xs text-muted-foreground">Aparece em cards e listagens (até 280 caracteres)</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="full_description">Descrição completa</Label>
            <Textarea
              id="full_description"
              name="full_description"
              rows={4}
              placeholder="Detalhe os produtos, ambiente, diferenciais..."
              defaultValue={partner?.full_description ?? ""}
            />
          </div>

          <ImageUpload
            bucket="banners"
            name="cover_url"
            label="Banner da página do parceiro"
            aspect="wide"
            defaultUrl={partner?.cover_url}
            hint="PNG, JPG ou WebP · até 8MB · proporção 16:9"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-sm font-semibold">Contato</h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                name="whatsapp"
                placeholder="31973603600"
                defaultValue={partner?.whatsapp ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                name="instagram"
                placeholder="@padariapaoquente"
                defaultValue={partner?.instagram ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="website">Site</Label>
              <Input
                id="website"
                name="website"
                type="url"
                placeholder="https://padaria.com.br"
                defaultValue={partner?.website ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="external_link">Link externo (cardápio, marketplace...)</Label>
              <Input
                id="external_link"
                name="external_link"
                type="url"
                placeholder="https://..."
                defaultValue={partner?.external_link ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cep">CEP</Label>
              <CepInput
                id="cep"
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
                placeholder="Rua, número, bairro"
                defaultValue={partner?.address ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="neighborhood">Bairro do parceiro</Label>
              <Input
                id="neighborhood"
                name="neighborhood"
                placeholder="Buritis"
                defaultValue={partner?.neighborhood ?? ""}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="plan">Plano</Label>
            <Select id="plan" name="plan" defaultValue={partner?.plan ?? "gratuito"}>
              <option value="gratuito">Gratuito</option>
              <option value="destaque">Destaque (peso 2x na rotação)</option>
              <option value="premium">Premium (peso 3x na rotação)</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue={partner?.status ?? "pendente"}>
              <option value="pendente">Pendente (aguardando aprovação)</option>
              <option value="ativo">Ativo</option>
              <option value="pausado">Pausado</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? "Salvar alterações" : "Criar parceiro"}
        </Button>
      </div>
    </form>
  );
}

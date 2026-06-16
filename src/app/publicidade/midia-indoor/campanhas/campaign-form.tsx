"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, LayoutTemplate, Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@mi/components/ui/button";
import { Input } from "@mi/components/ui/input";
import { Label } from "@mi/components/ui/label";
import { Textarea } from "@mi/components/ui/textarea";
import { Select } from "@mi/components/ui/select";
import { Card, CardContent } from "@mi/components/ui/card";
import { Badge } from "@mi/components/ui/badge";
import { ImageUpload } from "@mi/components/admin/image-upload";
import { toast } from "sonner";
import { cn } from "@mi/lib/utils";
import { createCampaignAction, updateCampaignAction, type ActionState } from "./actions";
import type { Tables, UserRole } from "@mi/types/database";

interface CampaignFormProps {
  campaign?: Tables<"campaigns">;
  templates: Tables<"templates">[];
  editorTemplates: Array<Pick<Tables<"editor_templates">, "id" | "name" | "format" | "category">>;
  units: Tables<"units">[];
  partners: Array<Tables<"partners"> & { units?: { name: string } | null }>;
  offers: Tables<"offers">[];
  role: UserRole;
  defaultUnitId?: string | null;
}

function toLocalDatetime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const PRIORITY_DESCRIPTIONS: Record<string, string> = {
  normal: "Aparece 1x na rotação",
  destaque: "Aparece 2x mais que normal",
  premium: "Aparece 3x mais que normal",
};

type Source = "system" | "editor";

export function CampaignForm({
  campaign,
  templates,
  editorTemplates,
  units,
  partners,
  offers,
  role,
  defaultUnitId,
}: CampaignFormProps) {
  const router = useRouter();
  const isEdit = !!campaign;

  // Detecta origem inicial baseado em campanha existente
  const [source, setSource] = useState<Source>(
    campaign?.editor_template_id ? "editor" : "system",
  );

  const [selectedPartnerId, setSelectedPartnerId] = useState<string>(
    campaign?.partner_id ?? "",
  );

  const filteredOffers = selectedPartnerId
    ? offers.filter((o) => o.partner_id === selectedPartnerId)
    : [];

  const action = isEdit ? updateCampaignAction.bind(null, campaign!.id) : createCampaignAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(isEdit ? "Campanha atualizada" : "Campanha criada");
    else toast.error(state.error);
  }, [state, isEdit]);

  // Garante que pelo menos um dos campos template_id ou editor_template_id é válido
  const systemTemplateRequired = source === "system";

  return (
    <form action={formAction} className="space-y-6">
      {/* Identificação */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome da campanha *</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="Padaria — 10% OFF Dia das Mães"
                defaultValue={campaign?.name}
                maxLength={120}
              />
            </div>
            {role === "master" && (
              <div className="space-y-1.5">
                <Label htmlFor="unidade_id">Unidade *</Label>
                <Select
                  id="unidade_id"
                  name="unidade_id"
                  required
                  defaultValue={campaign?.unidade_id ?? defaultUnitId ?? ""}
                >
                  <option value="" disabled>
                    Selecione
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
          </div>
        </CardContent>
      </Card>

      {/* Origem do conteúdo */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h3 className="text-sm font-semibold">Origem do conteúdo *</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Você pode preencher os campos de um template do sistema, ou usar um template
              completo desenhado no editor visual.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSource("system")}
              className={cn(
                "rounded-lg border-2 p-4 text-left transition-all hover:scale-[1.02]",
                source === "system"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/50",
              )}
            >
              <LayoutTemplate className="mb-2 h-5 w-5 text-primary" />
              <p className="text-sm font-semibold">Template do sistema</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Escolha 1 dos 6 layouts pré-fabricados e preencha headline, mídia, CTA.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setSource("editor")}
              className={cn(
                "rounded-lg border-2 p-4 text-left transition-all hover:scale-[1.02]",
                source === "editor"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/50",
              )}
              disabled={editorTemplates.length === 0}
            >
              <Sparkles className="mb-2 h-5 w-5 text-primary" />
              <p className="text-sm font-semibold">Template do editor visual</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Use um template completo já desenhado no editor (Canva-style). {editorTemplates.length === 0 && "Crie um primeiro."}
              </p>
              {editorTemplates.length > 0 && (
                <Badge variant="success" className="mt-2 text-[10px]">
                  {editorTemplates.length} template{editorTemplates.length !== 1 ? "s" : ""} publicado{editorTemplates.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </button>
          </div>

          {source === "system" && (
            <div className="space-y-1.5 border-t pt-4">
              <Label htmlFor="template_id">Template *</Label>
              <Select
                id="template_id"
                name="template_id"
                required={systemTemplateRequired}
                defaultValue={campaign?.template_id ?? ""}
              >
                <option value="" disabled>
                  Escolha o layout
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              {/* Garante que editor_template_id vai vazio se origem = sistema */}
              <input type="hidden" name="editor_template_id" value="" />
            </div>
          )}

          {source === "editor" && (
            <div className="space-y-1.5 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="editor_template_id">Template do editor *</Label>
                <Link
                  href="/publicidade/midia-indoor/templates"
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Gerenciar templates <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <Select
                id="editor_template_id"
                name="editor_template_id"
                required
                defaultValue={campaign?.editor_template_id ?? ""}
              >
                <option value="" disabled>
                  Selecione um template
                </option>
                {editorTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} · {t.format === "horizontal" ? "16:9" : "9:16"} · {t.category}
                  </option>
                ))}
              </Select>
              {/* Garante template_id válido (campo obrigatório no banco) — usa o primeiro do sistema */}
              <input type="hidden" name="template_id" value={campaign?.template_id ?? templates[0]?.id ?? ""} />
              <p className="text-xs text-emerald-700">
                ✓ O template do editor traz seu próprio design completo (textos, QR Code, imagens, animações).
                Você ainda pode definir prioridade, agendamento e tipo abaixo.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="type">Tipo (interno)</Label>
            <Input
              id="type"
              name="type"
              placeholder="institucional, oferta, sazonal..."
              defaultValue={campaign?.type ?? "padrao"}
            />
            <p className="text-[11px] text-muted-foreground">Texto livre para você se organizar.</p>
          </div>
        </CardContent>
      </Card>

      {/* Vínculo a parceiro/oferta — só pra template do sistema */}
      {source === "system" && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <h3 className="text-sm font-semibold">Vínculo a parceiro/oferta (opcional)</h3>
            <p className="text-xs text-muted-foreground">
              Vincule pra herdar logo, banner e gerar QR Code automaticamente no player.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="partner_id">Parceiro</Label>
                <Select
                  id="partner_id"
                  name="partner_id"
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                >
                  <option value="">Nenhum (campanha institucional)</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.units?.name ? `· ${p.units.name}` : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="offer_id">Oferta</Label>
                <Select id="offer_id" name="offer_id" defaultValue={campaign?.offer_id ?? ""}>
                  <option value="">Sem oferta vinculada</option>
                  {filteredOffers.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
                </Select>
                {selectedPartnerId && filteredOffers.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Esse parceiro ainda não tem ofertas cadastradas
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conteúdo manual — só pra template do sistema */}
      {source === "system" && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <h3 className="text-sm font-semibold">Conteúdo exibido na TV</h3>

            <div className="space-y-1.5">
              <Label htmlFor="headline">Título principal</Label>
              <Input
                id="headline"
                name="headline"
                placeholder="10% OFF para clientes Xô Varal"
                defaultValue={campaign?.headline ?? ""}
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subheadline">Subtítulo</Label>
              <Textarea
                id="subheadline"
                name="subheadline"
                rows={2}
                placeholder="Aponte a câmera e ganhe seu desconto agora"
                defaultValue={campaign?.subheadline ?? ""}
                maxLength={200}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cta_label">CTA (texto do botão/QR)</Label>
                <Input
                  id="cta_label"
                  name="cta_label"
                  placeholder="Aponte a câmera"
                  defaultValue={campaign?.cta_label ?? ""}
                  maxLength={40}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cta_url">URL alvo do CTA/QR</Label>
                <Input
                  id="cta_url"
                  name="cta_url"
                  type="url"
                  placeholder="https://..."
                  defaultValue={campaign?.cta_url ?? ""}
                />
              </div>
            </div>

            <ImageUpload
              bucket="campaigns"
              name="media_url"
              label="Mídia da campanha (imagem ou vídeo curto)"
              aspect="wide"
              defaultUrl={campaign?.media_url}
              hint="PNG, JPG, WebP, MP4 ou WebM · até 200MB · ideal 16:9 (1920×1080)"
            />
            <input
              type="hidden"
              name="media_type"
              defaultValue={campaign?.media_type ?? "image"}
            />
          </CardContent>
        </Card>
      )}

      {/* Quando usa editor template, pula os campos manuais mas mantém hiddens vazios */}
      {source === "editor" && (
        <>
          <input type="hidden" name="headline" value="" />
          <input type="hidden" name="subheadline" value="" />
          <input type="hidden" name="cta_label" value="" />
          <input type="hidden" name="cta_url" value="" />
          <input type="hidden" name="media_url" value="" />
          <input type="hidden" name="partner_id" value="" />
          <input type="hidden" name="offer_id" value="" />
        </>
      )}

      {/* Exibição e agendamento (comum aos dois) */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-sm font-semibold">Exibição e agendamento</h3>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="priority">Prioridade *</Label>
              <Select
                id="priority"
                name="priority"
                defaultValue={campaign?.priority ?? "normal"}
              >
                <option value="normal">Normal</option>
                <option value="destaque">Destaque</option>
                <option value="premium">Premium</option>
              </Select>
              <p className="text-xs text-muted-foreground" id="priority-hint">
                {PRIORITY_DESCRIPTIONS[campaign?.priority ?? "normal"]}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="duration_seconds">Duração na tela (s)</Label>
              <Input
                id="duration_seconds"
                name="duration_seconds"
                type="number"
                min={5}
                max={60}
                defaultValue={campaign?.duration_seconds ?? 15}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={campaign?.status ?? "rascunho"}>
                <option value="rascunho">Rascunho</option>
                <option value="ativa">Ativa</option>
                <option value="pausada">Pausada</option>
                <option value="expirada">Expirada</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="starts_at">Inicia em</Label>
              <Input
                id="starts_at"
                name="starts_at"
                type="datetime-local"
                defaultValue={toLocalDatetime(campaign?.starts_at)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ends_at">Termina em</Label>
              <Input
                id="ends_at"
                name="ends_at"
                type="datetime-local"
                defaultValue={toLocalDatetime(campaign?.ends_at)}
              />
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
          {isEdit ? "Salvar alterações" : "Criar campanha"}
        </Button>
      </div>
    </form>
  );
}

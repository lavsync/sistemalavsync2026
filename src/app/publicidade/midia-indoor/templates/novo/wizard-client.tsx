"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Smartphone, FilePlus, Loader2 } from "lucide-react";
import { Card } from "@mi/components/ui/card";
import { Button } from "@mi/components/ui/button";
import { Badge } from "@mi/components/ui/badge";
import { CANVAS_PRESETS, type CanvasFormat } from "@mi/types/editor";
import { TEMPLATE_PRESETS } from "../_components/template-presets";
import type { TemplatePreset } from "@mi/types/editor";
import { TemplatePreview } from "../_components/template-preview";
import { saveTemplateAction } from "../actions";
import { adaptElementsToVertical } from "../_components/adapt-vertical";
import { toast } from "sonner";
import { cn } from "@mi/lib/utils";

export function WizardClient() {
  const router = useRouter();
  const [format, setFormat] = useState<CanvasFormat>("horizontal");
  const [selected, setSelected] = useState<TemplatePreset | "blank" | null>(null);
  const [pending, startTransition] = useTransition();

  const create = () => {
    if (!selected) return;
    startTransition(async () => {
      const dims = CANVAS_PRESETS[format];
      const rawBuilt = selected === "blank"
        ? { background: { type: "color" as const, value: "#0f1720" }, elements: [] }
        : selected.buildHorizontal();

      // Adapta automaticamente pra vertical se necessário
      const built = format === "vertical" && selected !== "blank"
        ? { ...rawBuilt, elements: adaptElementsToVertical(rawBuilt.elements) }
        : rawBuilt;

      const res = await saveTemplateAction({
        name: selected === "blank" ? "Novo template" : selected.name,
        format,
        background: built.background,
        elements: built.elements,
        durationSeconds: 15,
        category: selected === "blank" ? "custom" : selected.category,
      });

      if (res?.ok && res.id) {
        toast.success("Template criado");
        router.push(`/publicidade/midia-indoor/templates/${res.id}`);
      } else if (res && !res.ok) {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Step 1: formato */}
      <Card className="p-5">
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Passo 1 · Formato
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">Onde sua peça vai aparecer?</p>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setFormat("horizontal")}
            className={cn(
              "rounded-xl border-2 p-6 text-left transition-all hover:scale-[1.02]",
              format === "horizontal"
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/50",
            )}
          >
            <Monitor className="mb-2 h-8 w-8 text-primary" />
            <p className="font-semibold">TV Horizontal</p>
            <p className="text-xs text-muted-foreground">1920×1080 · 16:9</p>
            <Badge variant="outline" className="mt-2">Padrão lavanderia</Badge>
          </button>
          <button
            onClick={() => setFormat("vertical")}
            className={cn(
              "rounded-xl border-2 p-6 text-left transition-all hover:scale-[1.02]",
              format === "vertical"
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/50",
            )}
          >
            <Smartphone className="mb-2 h-8 w-8 text-primary" />
            <p className="font-semibold">TV Vertical</p>
            <p className="text-xs text-muted-foreground">1080×1920 · 9:16</p>
            <Badge variant="outline" className="mt-2">Display estreito</Badge>
          </button>
        </div>
      </Card>

      {/* Step 2: template base */}
      <Card className="p-5">
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Passo 2 · Template base
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">Comece em branco ou parta de um modelo curado.</p>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {/* Blank */}
          <button
            onClick={() => setSelected("blank")}
            className={cn(
              "group flex flex-col overflow-hidden rounded-lg border-2 text-left transition-all hover:scale-[1.02]",
              selected === "blank" ? "border-primary" : "border-border hover:border-primary/50",
            )}
          >
            <div
              className="grid w-full place-items-center bg-secondary/40"
              style={{ aspectRatio: format === "horizontal" ? "16/9" : "9/16" }}
            >
              <FilePlus className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <div className="p-2.5">
              <p className="text-sm font-semibold">Em branco</p>
              <p className="text-xs text-muted-foreground">Crie do zero</p>
            </div>
          </button>

          {/* Presets */}
          {TEMPLATE_PRESETS.filter((p) => p.format.includes(format)).map((preset) => {
            const built = preset.buildHorizontal();
            const isSelected = selected !== "blank" && selected?.slug === preset.slug;
            return (
              <button
                key={preset.slug}
                onClick={() => setSelected(preset)}
                className={cn(
                  "group flex flex-col overflow-hidden rounded-lg border-2 text-left transition-all hover:scale-[1.02]",
                  isSelected ? "border-primary" : "border-border hover:border-primary/50",
                )}
              >
                <div
                  className="relative w-full overflow-hidden bg-black"
                  style={{ aspectRatio: format === "horizontal" ? "16/9" : "9/16" }}
                >
                  <TemplatePreview
                    template={{
                      width: format === "horizontal" ? 1920 : 1080,
                      height: format === "horizontal" ? 1080 : 1920,
                      background: built.background,
                      elements: built.elements,
                    }}
                  />
                </div>
                <div className="p-2.5">
                  <p className="text-sm font-semibold">{preset.name}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{preset.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
        <Button onClick={create} disabled={!selected || pending} size="lg">
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Criar template
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { Loader2, Send, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEditorStore } from "@mi/stores/editor-store";
import { Button } from "@mi/components/ui/button";
import { PanelHeader, SectionLabel } from "./shared";
import { publishTemplateAction, type ActionState } from "../../actions";
import { toast } from "sonner";

export function PublishPanel() {
  const router = useRouter();
  const templateId = useEditorStore((s) => s.templateId);
  const isPublished = useEditorStore((s) => s.isPublished);
  const isDirty = useEditorStore((s) => s.isDirty);
  const durationSeconds = useEditorStore((s) => s.durationSeconds);
  const setDurationSeconds = useEditorStore((s) => s.setDurationSeconds);
  const [pending, startTransition] = useTransition();

  const publish = () => {
    if (!templateId) {
      toast.error("Salve o template antes de publicar");
      return;
    }
    if (isDirty) {
      toast.error("Você tem alterações não salvas. Salve antes de publicar.");
      return;
    }
    startTransition(async () => {
      const res: ActionState = await publishTemplateAction(templateId);
      if (res?.ok) {
        toast.success("Template publicado! Agora pode ser usado em campanhas.");
        router.refresh();
      } else if (res) {
        toast.error(res.error);
      }
    });
  };

  return (
    <div>
      <PanelHeader title="Publicar" subtitle="Tornar disponível para campanhas" />

      <div className="px-3 space-y-4">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs">
          <p className="text-white">
            Status: {isPublished ? (
              <span className="text-emerald-400 font-semibold">✓ Publicado</span>
            ) : (
              <span className="text-amber-400 font-semibold">Rascunho</span>
            )}
          </p>
          <p className="mt-1 text-white/50">
            Templates publicados aparecem como opção ao criar campanhas para a TV.
          </p>
        </div>

        <div>
          <SectionLabel>Duração padrão na TV (segundos)</SectionLabel>
          <input
            type="number"
            min={5}
            max={60}
            value={durationSeconds}
            onChange={(e) => setDurationSeconds(Number(e.target.value))}
            className="w-full rounded-md border-0 bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-primary"
          />
          <p className="mt-1 text-[10px] text-white/40">
            Quanto tempo o slide fica visível na rotação. Recomendado 10-20s.
          </p>
        </div>

        <Button
          onClick={publish}
          disabled={pending || !templateId || isDirty}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {pending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
          {isPublished ? "Republicar" : "Publicar template"}
        </Button>

        {isPublished && templateId && (
          <Button asChild variant="outline" className="w-full border-white/10 bg-white/5 text-white hover:bg-white/10">
            <a href={`/publicidade/midia-indoor/campanhas/nova?template=${templateId}`} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1 h-3 w-3" />
              Criar campanha
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEditorStore } from "@mi/stores/editor-store";
import type { VideoElement } from "@mi/types/editor";
import { FieldLabel, PropSection, TextInput, SelectInput } from "./shared";

export function VideoProperties({ element }: { element: VideoElement }) {
  const update = useEditorStore((s) => s.updateElement);
  const patch = (p: Partial<VideoElement>) => update(element.id, p);

  return (
    <>
      <PropSection title="Vídeo">
        <FieldLabel>URL do vídeo (MP4/WebM)</FieldLabel>
        <TextInput
          value={element.src}
          onChange={(src) => patch({ src })}
          placeholder="https://... ou use o painel Uploads"
        />
        <FieldLabel>Poster (URL imagem) — opcional</FieldLabel>
        <TextInput value={element.poster ?? ""} onChange={(poster) => patch({ poster })} />
      </PropSection>

      <PropSection title="Reprodução">
        <FieldLabel>Ajuste</FieldLabel>
        <SelectInput
          value={element.objectFit}
          onChange={(v) => patch({ objectFit: v as "cover" | "contain" })}
          options={[
            { value: "cover", label: "Cover (preenche cortando)" },
            { value: "contain", label: "Contain (mostra inteiro)" },
          ]}
        />

        <label className="flex items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={element.loop}
            onChange={(e) => patch({ loop: e.target.checked })}
            className="h-4 w-4 rounded border-white/20"
          />
          Loop infinito
        </label>
        <label className="flex items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={element.muted}
            onChange={(e) => patch({ muted: e.target.checked })}
            className="h-4 w-4 rounded border-white/20"
          />
          Mudo (recomendado pra TV)
        </label>
      </PropSection>
    </>
  );
}

"use client";

import { useEditorStore } from "@mi/stores/editor-store";
import type { ImageElement } from "@mi/types/editor";
import { FieldLabel, PropSection, TextInput, NumberInput, SelectInput } from "./shared";

export function ImageProperties({ element }: { element: ImageElement }) {
  const update = useEditorStore((s) => s.updateElement);
  const patch = (p: Partial<ImageElement>) => update(element.id, p);

  return (
    <>
      <PropSection title="Mídia">
        <FieldLabel>URL da imagem</FieldLabel>
        <TextInput
          value={element.src}
          onChange={(src) => patch({ src })}
          placeholder="https://... ou use o painel Uploads"
        />
        <FieldLabel>Texto alternativo (alt)</FieldLabel>
        <TextInput value={element.alt ?? ""} onChange={(alt) => patch({ alt })} />
      </PropSection>

      <PropSection title="Aparência">
        <FieldLabel>Ajuste</FieldLabel>
        <SelectInput
          value={element.objectFit}
          onChange={(v) => patch({ objectFit: v as "cover" | "contain" | "fill" })}
          options={[
            { value: "cover", label: "Cover (preenche cortando)" },
            { value: "contain", label: "Contain (mostra inteira)" },
            { value: "fill", label: "Fill (esticada)" },
          ]}
        />
        <FieldLabel>Borda arredondada</FieldLabel>
        <NumberInput value={element.borderRadius ?? 0} onChange={(borderRadius) => patch({ borderRadius })} min={0} max={500} step={2} suffix="px" />
      </PropSection>
    </>
  );
}

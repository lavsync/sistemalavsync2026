"use client";

import { useEditorStore } from "@mi/stores/editor-store";
import type { ButtonElement } from "@mi/types/editor";
import { FieldLabel, PropSection, TextInput, NumberInput, ColorInput } from "./shared";

export function ButtonProperties({ element }: { element: ButtonElement }) {
  const update = useEditorStore((s) => s.updateElement);
  const patch = (p: Partial<ButtonElement>) => update(element.id, p);

  return (
    <>
      <PropSection title="Conteúdo">
        <FieldLabel>Texto</FieldLabel>
        <TextInput value={element.text} onChange={(text) => patch({ text })} />
      </PropSection>

      <PropSection title="Aparência">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Fundo</FieldLabel>
            <ColorInput value={element.background} onChange={(background) => patch({ background })} />
          </div>
          <div>
            <FieldLabel>Cor texto</FieldLabel>
            <ColorInput value={element.color} onChange={(color) => patch({ color })} />
          </div>
          <div>
            <FieldLabel>Tamanho fonte</FieldLabel>
            <NumberInput value={element.fontSize} onChange={(fontSize) => patch({ fontSize })} min={12} max={80} suffix="px" />
          </div>
          <div>
            <FieldLabel>Borda</FieldLabel>
            <NumberInput value={element.borderRadius} onChange={(borderRadius) => patch({ borderRadius })} min={0} max={100} suffix="px" />
          </div>
        </div>
      </PropSection>
    </>
  );
}

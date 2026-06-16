"use client";

import { useEditorStore } from "@mi/stores/editor-store";
import type { EditorElement } from "@mi/types/editor";
import { FieldLabel, PropSection, NumberInput } from "./shared";

export function CommonProperties({ element }: { element: EditorElement }) {
  const update = useEditorStore((s) => s.updateElement);
  const patch = (p: Partial<EditorElement>) => update(element.id, p);

  return (
    <PropSection title="Posição e tamanho">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>X</FieldLabel>
          <NumberInput value={Math.round(element.x)} onChange={(x) => patch({ x })} step={4} suffix="px" />
        </div>
        <div>
          <FieldLabel>Y</FieldLabel>
          <NumberInput value={Math.round(element.y)} onChange={(y) => patch({ y })} step={4} suffix="px" />
        </div>
        <div>
          <FieldLabel>Largura</FieldLabel>
          <NumberInput value={Math.round(element.width)} onChange={(width) => patch({ width })} min={20} step={4} suffix="px" />
        </div>
        <div>
          <FieldLabel>Altura</FieldLabel>
          <NumberInput value={Math.round(element.height)} onChange={(height) => patch({ height })} min={20} step={4} suffix="px" />
        </div>
        <div>
          <FieldLabel>Rotação</FieldLabel>
          <NumberInput value={Math.round(element.rotation)} onChange={(rotation) => patch({ rotation })} step={5} suffix="°" />
        </div>
        <div>
          <FieldLabel>Opacidade</FieldLabel>
          <NumberInput
            value={Math.round(element.opacity * 100)}
            onChange={(v) => patch({ opacity: Math.max(0, Math.min(1, v / 100)) })}
            min={0}
            max={100}
            step={5}
            suffix="%"
          />
        </div>
      </div>
    </PropSection>
  );
}

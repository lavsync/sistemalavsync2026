"use client";

import { useEditorStore } from "@mi/stores/editor-store";
import type { ShapeElement } from "@mi/types/editor";
import { FieldLabel, PropSection, NumberInput, ColorInput, SelectInput } from "./shared";

export function ShapeProperties({ element }: { element: ShapeElement }) {
  const update = useEditorStore((s) => s.updateElement);
  const patch = (p: Partial<ShapeElement>) => update(element.id, p);

  return (
    <>
      <PropSection title="Forma">
        <FieldLabel>Tipo</FieldLabel>
        <SelectInput
          value={element.shape}
          onChange={(v) => patch({ shape: v as "rect" | "circle" | "line" })}
          options={[
            { value: "rect", label: "Retângulo" },
            { value: "circle", label: "Círculo" },
            { value: "line", label: "Linha" },
          ]}
        />
      </PropSection>

      <PropSection title="Aparência">
        <FieldLabel>Cor</FieldLabel>
        <ColorInput value={element.fill} onChange={(fill) => patch({ fill })} />

        {element.shape === "rect" && (
          <>
            <FieldLabel>Borda arredondada</FieldLabel>
            <NumberInput value={element.borderRadius ?? 0} onChange={(borderRadius) => patch({ borderRadius })} min={0} max={500} step={4} suffix="px" />
          </>
        )}
      </PropSection>
    </>
  );
}

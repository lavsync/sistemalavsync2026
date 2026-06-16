"use client";

import { useEditorStore } from "@mi/stores/editor-store";
import type { TextElement } from "@mi/types/editor";
import { FieldLabel, PropSection, TextInput, NumberInput, ColorInput, SelectInput } from "./shared";
import { BrandPalette } from "./brand-palette";

const FONT_FAMILIES = [
  "Inter", "Arial Black", "Georgia", "Helvetica", "Courier New", "Times New Roman", "Impact",
];

export function TextProperties({ element }: { element: TextElement }) {
  const update = useEditorStore((s) => s.updateElement);
  const patch = (p: Partial<TextElement>) => update(element.id, p);

  return (
    <>
      <PropSection title="Conteúdo">
        <FieldLabel>Texto</FieldLabel>
        <TextInput value={element.text} onChange={(text) => patch({ text })} multiline />
      </PropSection>

      <PropSection title="Tipografia">
        <FieldLabel>Fonte</FieldLabel>
        <SelectInput
          value={element.fontFamily}
          onChange={(fontFamily) => patch({ fontFamily })}
          options={FONT_FAMILIES.map((f) => ({ value: f, label: f }))}
        />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Tamanho</FieldLabel>
            <NumberInput value={element.fontSize} onChange={(fontSize) => patch({ fontSize })} min={8} max={400} step={2} suffix="px" />
          </div>
          <div>
            <FieldLabel>Peso</FieldLabel>
            <SelectInput
              value={String(element.fontWeight)}
              onChange={(v) => patch({ fontWeight: Number(v) })}
              options={[
                { value: "100", label: "Thin (100)" },
                { value: "300", label: "Light (300)" },
                { value: "400", label: "Regular (400)" },
                { value: "500", label: "Medium (500)" },
                { value: "700", label: "Bold (700)" },
                { value: "900", label: "Black (900)" },
              ]}
            />
          </div>
          <div>
            <FieldLabel>Altura linha</FieldLabel>
            <NumberInput value={element.lineHeight} onChange={(lineHeight) => patch({ lineHeight })} min={0.8} max={3} step={0.05} />
          </div>
          <div>
            <FieldLabel>Letter spacing</FieldLabel>
            <NumberInput value={element.letterSpacing} onChange={(letterSpacing) => patch({ letterSpacing })} step={0.5} suffix="px" />
          </div>
        </div>

        <FieldLabel>Alinhamento</FieldLabel>
        <SelectInput
          value={element.align}
          onChange={(v) => patch({ align: v as "left" | "center" | "right" })}
          options={[
            { value: "left", label: "← Esquerda" },
            { value: "center", label: "↔ Centro" },
            { value: "right", label: "Direita →" },
          ]}
        />
      </PropSection>

      <PropSection title="Cor">
        <FieldLabel>Cor do texto</FieldLabel>
        <ColorInput value={element.color} onChange={(color) => patch({ color })} />
        <div className="pt-2">
          <BrandPalette selectedColor={element.color} onColorSelect={(color) => patch({ color })} />
        </div>
      </PropSection>
    </>
  );
}

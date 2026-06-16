"use client";

import { useEditorStore } from "@mi/stores/editor-store";
import type { PriceElement } from "@mi/types/editor";
import { FieldLabel, PropSection, TextInput, NumberInput, ColorInput } from "./shared";

export function PriceProperties({ element }: { element: PriceElement }) {
  const update = useEditorStore((s) => s.updateElement);
  const patch = (p: Partial<PriceElement>) => update(element.id, p);

  return (
    <>
      <PropSection title="Preço DE (riscado)">
        <FieldLabel>Etiqueta</FieldLabel>
        <TextInput value={element.fromLabel ?? ""} onChange={(fromLabel) => patch({ fromLabel })} placeholder="De" />
        <FieldLabel>Valor</FieldLabel>
        <NumberInput value={element.fromValue} onChange={(fromValue) => patch({ fromValue })} step={0.5} min={0} />
      </PropSection>

      <PropSection title="Preço POR (destaque)">
        <FieldLabel>Etiqueta</FieldLabel>
        <TextInput value={element.byLabel ?? ""} onChange={(byLabel) => patch({ byLabel })} placeholder="Por" />
        <FieldLabel>Valor</FieldLabel>
        <NumberInput value={element.byValue} onChange={(byValue) => patch({ byValue })} step={0.5} min={0} />
      </PropSection>

      <PropSection title="Aparência">
        <FieldLabel>Moeda</FieldLabel>
        <TextInput value={element.currency} onChange={(currency) => patch({ currency })} placeholder="R$" />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Cor base</FieldLabel>
            <ColorInput value={element.color} onChange={(color) => patch({ color })} />
          </div>
          <div>
            <FieldLabel>Cor destaque</FieldLabel>
            <ColorInput value={element.highlightColor} onChange={(highlightColor) => patch({ highlightColor })} />
          </div>
        </div>

        <FieldLabel>Escala</FieldLabel>
        <NumberInput value={element.size} onChange={(size) => patch({ size })} min={0.4} max={2.5} step={0.1} />
      </PropSection>
    </>
  );
}

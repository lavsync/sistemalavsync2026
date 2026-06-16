"use client";

import { useEditorStore } from "@mi/stores/editor-store";
import type { PhoneElement } from "@mi/types/editor";
import { FieldLabel, PropSection, TextInput, NumberInput, ColorInput, SelectInput } from "./shared";

export function PhoneProperties({ element }: { element: PhoneElement }) {
  const update = useEditorStore((s) => s.updateElement);
  const patch = (p: Partial<PhoneElement>) => update(element.id, p);

  return (
    <>
      <PropSection title="Telefone">
        <FieldLabel>Número (com DDD)</FieldLabel>
        <TextInput value={element.number} onChange={(number) => patch({ number })} placeholder="(31) 99999-9999" />

        <FieldLabel>Ícone</FieldLabel>
        <SelectInput
          value={element.icon}
          onChange={(v) => patch({ icon: v as "phone" | "whatsapp" })}
          options={[
            { value: "whatsapp", label: "💬 WhatsApp" },
            { value: "phone", label: "📞 Telefone" },
          ]}
        />

        <FieldLabel>Etiqueta (opcional)</FieldLabel>
        <TextInput value={element.label ?? ""} onChange={(label) => patch({ label })} />
      </PropSection>

      <PropSection title="Aparência">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Tamanho fonte</FieldLabel>
            <NumberInput value={element.fontSize} onChange={(fontSize) => patch({ fontSize })} min={16} max={200} suffix="px" />
          </div>
          <div>
            <FieldLabel>Cor</FieldLabel>
            <ColorInput value={element.color} onChange={(color) => patch({ color })} />
          </div>
        </div>
      </PropSection>
    </>
  );
}

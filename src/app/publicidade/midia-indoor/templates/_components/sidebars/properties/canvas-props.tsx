"use client";

import { useEditorStore } from "@mi/stores/editor-store";
import { CANVAS_PRESETS } from "@mi/types/editor";
import { FieldLabel, PropSection, NumberInput, SelectInput, ColorInput, TextInput } from "./shared";
import { BrandPalette } from "./brand-palette";

export function CanvasProperties() {
  const format = useEditorStore((s) => s.format);
  const setFormat = useEditorStore((s) => s.setFormat);
  const background = useEditorStore((s) => s.background);
  const setBackground = useEditorStore((s) => s.setBackground);
  const durationSeconds = useEditorStore((s) => s.durationSeconds);
  const setDurationSeconds = useEditorStore((s) => s.setDurationSeconds);

  return (
    <div className="px-3 pb-6 pt-2">
      <PropSection title="Formato">
        <FieldLabel>Orientação</FieldLabel>
        <SelectInput
          value={format}
          onChange={(v) => setFormat(v as "horizontal" | "vertical")}
          options={[
            { value: "horizontal", label: "16:9 horizontal (1920×1080)" },
            { value: "vertical", label: "9:16 vertical (1080×1920)" },
          ]}
        />
        <p className="text-[10px] text-white/40">
          Mudar formato preserva elementos mas pode cortá-los. Reposicione se necessário.
        </p>
      </PropSection>

      <PropSection title="Fundo">
        <FieldLabel>Tipo</FieldLabel>
        <SelectInput
          value={background.type}
          onChange={(v) =>
            setBackground({
              type: v as "color" | "gradient" | "image",
              value: v === "color" ? "#0f1720" : v === "gradient" ? "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)" : "",
            })
          }
          options={[
            { value: "color", label: "Cor sólida" },
            { value: "gradient", label: "Gradiente" },
            { value: "image", label: "Imagem" },
          ]}
        />

        {background.type === "color" && (
          <>
            <FieldLabel>Cor</FieldLabel>
            <ColorInput value={background.value} onChange={(value) => setBackground({ ...background, value })} />
            <div className="pt-2">
              <BrandPalette
                selectedColor={background.value}
                onColorSelect={(value) => setBackground({ ...background, value })}
              />
            </div>
          </>
        )}

        {background.type === "gradient" && (
          <>
            <FieldLabel>Gradientes prontos</FieldLabel>
            <BrandPalette
              onColorSelect={() => null}
              onGradientSelect={(value) => setBackground({ ...background, value })}
              showGradients
            />
            <FieldLabel>CSS Gradient (avançado)</FieldLabel>
            <TextInput value={background.value} onChange={(value) => setBackground({ ...background, value })} multiline />
          </>
        )}

        {background.type === "image" && (
          <>
            <FieldLabel>URL da imagem</FieldLabel>
            <TextInput value={background.value} onChange={(value) => setBackground({ ...background, value })} />
          </>
        )}
      </PropSection>

      <PropSection title="Duração na TV">
        <FieldLabel>Segundos</FieldLabel>
        <NumberInput value={durationSeconds} onChange={setDurationSeconds} min={5} max={60} suffix="s" />
        <p className="text-[10px] text-white/40">Quanto tempo este slide aparece na rotação da TV.</p>
      </PropSection>
    </div>
  );
}

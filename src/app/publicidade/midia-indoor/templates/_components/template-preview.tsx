"use client";

import type { EditorTemplate } from "@mi/types/editor";
import { ElementRenderer } from "./editor/element-renderer";

interface TemplatePreviewProps {
  template: Pick<EditorTemplate, "width" | "height" | "background" | "elements">;
  /** Modo opcional pra controlar animação */
  mode?: "thumb" | "preview";
}

/**
 * Renderiza um thumbnail proporcional do template usando os mesmos renderers do editor.
 * Escala todo o stage com `transform: scale()` baseado no container pai.
 */
export function TemplatePreview({ template, mode = "thumb" }: TemplatePreviewProps) {
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background:
          template.background.type === "image"
            ? `url(${template.background.value}) center/cover`
            : template.background.value,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: template.width,
          height: template.height,
          transform: `scale(var(--preview-scale, 0.2))`,
          transformOrigin: "top left",
        }}
        ref={(el) => {
          if (!el) return;
          const parent = el.parentElement;
          if (!parent) return;
          const scaleX = parent.clientWidth / template.width;
          const scaleY = parent.clientHeight / template.height;
          const scale = Math.min(scaleX, scaleY);
          el.style.setProperty("--preview-scale", String(scale));
        }}
      >
        {template.elements
          .filter((e) => !e.hidden)
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((el) => (
            <div
              key={el.id}
              style={{
                position: "absolute",
                left: el.x,
                top: el.y,
                width: el.width,
                height: el.height,
                transform: `rotate(${el.rotation}deg)`,
                opacity: el.opacity,
              }}
            >
              <ElementRenderer element={el} mode={mode} />
            </div>
          ))}
      </div>
    </div>
  );
}

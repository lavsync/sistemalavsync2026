"use client";

import type { EditorTemplate } from "@mi/types/editor";
import { ElementRenderer } from "@/app/publicidade/midia-indoor/templates/_components/editor/element-renderer";

/**
 * Renderiza um template criado no editor visual em modo player TV (fullscreen).
 * Escala automaticamente pro viewport mantendo proporção exata do design.
 */
export function EditorTemplateRenderer({ template }: { template: EditorTemplate }) {
  return (
    <div
      className="player-screen relative grid place-items-center overflow-hidden"
      style={{
        background:
          template.background.type === "image"
            ? `url(${template.background.value}) center/cover`
            : template.background.value,
      }}
    >
      <div
        className="relative"
        style={{
          width: template.width,
          height: template.height,
          transform: "scale(var(--scale, 1))",
          transformOrigin: "center",
        }}
        ref={(el) => {
          if (!el) return;
          const parent = el.parentElement;
          if (!parent) return;
          const update = () => {
            const sx = parent.clientWidth / template.width;
            const sy = parent.clientHeight / template.height;
            el.style.setProperty("--scale", String(Math.min(sx, sy)));
          };
          update();
          const ro = new ResizeObserver(update);
          ro.observe(parent);
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
              <ElementRenderer element={el} mode="preview" />
            </div>
          ))}
      </div>
    </div>
  );
}

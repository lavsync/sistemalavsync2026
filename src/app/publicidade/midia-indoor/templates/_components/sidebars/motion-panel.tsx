"use client";

import { useEditorStore } from "@mi/stores/editor-store";
import { MOTION_PRESETS } from "../motion-presets";
import { PanelHeader, SectionLabel } from "./shared";
import type { MotionPreset } from "@mi/types/editor";
import { cn } from "@mi/lib/utils";

export function MotionPanel() {
  const selectedId = useEditorStore((s) => s.selectedId);
  const elements = useEditorStore((s) => s.elements);
  const updateElement = useEditorStore((s) => s.updateElement);

  const el = elements.find((e) => e.id === selectedId);

  if (!el) {
    return (
      <div>
        <PanelHeader title="Motion" subtitle="Animações dos elementos" />
        <div className="px-3 py-8 text-center text-xs text-white/40">
          Selecione um elemento para aplicar uma animação.
        </div>
      </div>
    );
  }

  const setMotion = (preset: MotionPreset) => {
    updateElement(el.id, {
      motion: {
        preset,
        delay: el.motion?.delay ?? 0,
        duration: el.motion?.duration ?? 600,
      },
    });
  };

  return (
    <div>
      <PanelHeader title="Motion" subtitle="Animação de entrada" />

      <div className="px-3 pb-4">
        <SectionLabel>Selecionar animação</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {MOTION_PRESETS.map((m) => (
            <button
              key={m.slug}
              onClick={() => setMotion(m.slug)}
              className={cn(
                "rounded-lg border bg-white/[0.03] p-2 text-left transition-all hover:bg-white/10",
                el.motion?.preset === m.slug ? "border-primary bg-primary/15" : "border-white/10",
              )}
            >
              <p className="text-[11px] font-semibold text-white">{m.label}</p>
              <p className="mt-0.5 line-clamp-2 text-[10px] text-white/50">{m.description}</p>
            </button>
          ))}
        </div>

        <SectionLabel>Delay (ms)</SectionLabel>
        <input
          type="number"
          min={0}
          max={5000}
          step={100}
          value={el.motion?.delay ?? 0}
          onChange={(e) =>
            updateElement(el.id, {
              motion: { ...(el.motion ?? { preset: "fade-in", duration: 600 }), delay: Number(e.target.value), preset: el.motion?.preset ?? "fade-in", duration: el.motion?.duration ?? 600 },
            })
          }
          className="w-full rounded-md border-0 bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-primary"
        />

        <SectionLabel>Duração (ms)</SectionLabel>
        <input
          type="number"
          min={100}
          max={3000}
          step={100}
          value={el.motion?.duration ?? 600}
          onChange={(e) =>
            updateElement(el.id, {
              motion: { ...(el.motion ?? { preset: "fade-in", delay: 0 }), duration: Number(e.target.value), preset: el.motion?.preset ?? "fade-in", delay: el.motion?.delay ?? 0 },
            })
          }
          className="w-full rounded-md border-0 bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-primary"
        />
      </div>
    </div>
  );
}

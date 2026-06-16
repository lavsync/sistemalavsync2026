"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { useEditorStore } from "@mi/stores/editor-store";
import { ElementRenderer } from "./element-renderer";

export function PreviewMode({ onClose }: { onClose: () => void }) {
  const { width, height, background, elements } = useEditorStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sorted = [...elements].filter((e) => !e.hidden).sort((a, b) => a.zIndex - b.zIndex);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] grid place-items-center bg-black/95 backdrop-blur-xl"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white backdrop-blur hover:bg-white/20"
          title="Fechar (Esc)"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="absolute left-4 top-4 z-10 rounded-md bg-yellow-500/95 px-3 py-1 text-xs font-bold text-yellow-950 backdrop-blur">
          PREVIEW · com animações
        </div>

        <div
          style={{
            width: `min(95vw, ${width}px)`,
            aspectRatio: `${width}/${height}`,
            position: "relative",
            overflow: "hidden",
            background:
              background.type === "image" ? `url(${background.value}) center/cover` : background.value,
            borderRadius: 8,
            boxShadow: "0 30px 90px rgba(0,0,0,0.8)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `scale(var(--p, 1))`,
              transformOrigin: "top left",
              width, height,
            }}
            ref={(el) => {
              if (!el) return;
              const parent = el.parentElement;
              if (!parent) return;
              const scale = parent.clientWidth / width;
              el.style.setProperty("--p", String(scale));
            }}
          >
            {sorted.map((el) => (
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
      </motion.div>
    </AnimatePresence>
  );
}

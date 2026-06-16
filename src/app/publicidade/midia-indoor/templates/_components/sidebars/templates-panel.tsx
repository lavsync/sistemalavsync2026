"use client";

import { useState, useMemo } from "react";
import { Sparkles, Search, X } from "lucide-react";
import { useEditorStore } from "@mi/stores/editor-store";
import { TEMPLATE_PRESETS } from "../template-presets";
import { CATEGORY_LABELS, type CanvasFormat, type TemplateCategory } from "@mi/types/editor";
import { cn } from "@mi/lib/utils";
import { PanelHeader } from "./shared";
import { ElementRenderer } from "../editor/element-renderer";
import { adaptElementsToVertical } from "../adapt-vertical";

export function TemplatesPanel() {
  const loadPreset = useEditorStore((s) => s.loadPreset);
  const currentFormat = useEditorStore((s) => s.format);
  const [filterFormat, setFilterFormat] = useState<CanvasFormat | "all">("all");
  const [filterCategory, setFilterCategory] = useState<TemplateCategory | "all">("all");
  const [search, setSearch] = useState("");

  const availableCategories = useMemo(() => {
    const set = new Set<TemplateCategory>();
    for (const p of TEMPLATE_PRESETS) set.add(p.category);
    return Array.from(set);
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return TEMPLATE_PRESETS.filter((p) => {
      if (filterFormat !== "all" && !p.format.includes(filterFormat)) return false;
      if (filterCategory !== "all" && p.category !== filterCategory) return false;
      if (term && !p.name.toLowerCase().includes(term) && !p.description.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [filterFormat, filterCategory, search]);

  return (
    <div>
      <PanelHeader title="Templates" subtitle={`${TEMPLATE_PRESETS.length} designs prontos`} />

      <div className="px-3">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar template..."
            className="w-full rounded-md border-0 bg-white/5 py-1.5 pl-8 pr-7 text-xs text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-primary"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="mb-3 flex gap-1 rounded-lg bg-white/5 p-1">
          {(["all", "horizontal", "vertical"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterFormat(f)}
              className={cn(
                "flex-1 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wide transition-colors",
                filterFormat === f ? "bg-primary text-primary-foreground" : "text-white/60 hover:text-white",
              )}
            >
              {f === "all" ? "Todos" : f === "horizontal" ? "16:9" : "9:16"}
            </button>
          ))}
        </div>

        <div className="-mx-3 mb-3 overflow-x-auto px-3 scrollbar-thin">
          <div className="flex gap-1.5 pb-1">
            <button
              onClick={() => setFilterCategory("all")}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors",
                filterCategory === "all"
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
              )}
            >
              Tudo
            </button>
            {availableCategories.map((cat) => {
              const meta = CATEGORY_LABELS[cat];
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors",
                    filterCategory === cat
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {meta.emoji} {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
          {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
        </p>

        <div className="grid grid-cols-1 gap-3">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-xs text-white/40">
              Nenhum template combina com esses filtros.
            </p>
          )}

          {filtered.map((preset) => {
            const built = preset.buildHorizontal();
            const aspect = currentFormat === "horizontal" ? "16/9" : "9/16";
            const meta = CATEGORY_LABELS[preset.category];
            return (
              <button
                key={preset.slug}
                onClick={() =>
                  loadPreset({
                    name: preset.name,
                    format: currentFormat,
                    background: built.background,
                    elements: currentFormat === "vertical"
                      ? adaptElementsToVertical(built.elements)
                      : built.elements,
                    category: preset.category,
                  })
                }
                className="group overflow-hidden rounded-lg border border-white/10 bg-white/5 text-left transition-all hover:scale-[1.02] hover:border-primary"
              >
                <div
                  className="relative overflow-hidden bg-black"
                  style={{ aspectRatio: aspect }}
                >
                  <div
                    style={{
                      position: "absolute", inset: 0,
                      transform: "scale(0.13)",
                      transformOrigin: "top left",
                      width: 1920, height: 1080,
                      background:
                        built.background.type === "image"
                          ? `url(${built.background.value}) center/cover`
                          : built.background.value,
                    }}
                  >
                    {built.elements.map((el) => (
                      <div
                        key={el.id}
                        style={{
                          position: "absolute",
                          left: el.x, top: el.y,
                          width: el.width, height: el.height,
                          transform: `rotate(${el.rotation}deg)`,
                          opacity: el.opacity,
                        }}
                      >
                        <ElementRenderer element={el} mode="thumb" />
                      </div>
                    ))}
                  </div>
                  <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white/90 backdrop-blur">
                    {meta.emoji} {meta.label}
                  </span>
                </div>
                <div className="p-2">
                  <p className="text-xs font-semibold text-white">{preset.name}</p>
                  <p className="mt-0.5 line-clamp-1 text-[10px] text-white/50">
                    {preset.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg bg-primary/10 p-3 text-[11px] text-primary">
          <Sparkles className="mb-1 h-3 w-3" />
          <p className="font-semibold">Dica:</p>
          <p className="text-primary/80">
            Aplicar um template <strong>substitui</strong> os elementos atuais. Sempre salve antes.
          </p>
        </div>
      </div>
    </div>
  );
}

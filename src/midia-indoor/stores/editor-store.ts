"use client";

import { create } from "zustand";
import { temporal } from "zundo";
import type {
  CanvasFormat,
  EditorBackground,
  EditorElement,
  EditorTemplate,
} from "@mi/types/editor";
import { CANVAS_PRESETS } from "@mi/types/editor";

interface EditorState {
  // Identidade
  templateId: string | null;
  name: string;
  format: CanvasFormat;
  width: number;
  height: number;
  background: EditorBackground;
  elements: EditorElement[];
  durationSeconds: number;
  category: string;
  isPublished: boolean;

  // UI state
  selectedId: string | null;
  zoom: number;
  isDirty: boolean;
  snapEnabled: boolean;
  showGrid: boolean;

  // Hidratação
  load: (tpl: EditorTemplate) => void;
  loadPreset: (preset: { name?: string; format: CanvasFormat; background: EditorBackground; elements: EditorElement[]; category?: string }) => void;
  reset: () => void;

  // Mutações
  setName: (name: string) => void;
  setFormat: (format: CanvasFormat) => void;
  setBackground: (bg: EditorBackground) => void;
  setDurationSeconds: (s: number) => void;
  addElement: (el: EditorElement) => void;
  updateElement: (id: string, patch: Partial<EditorElement>) => void;
  removeElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  toggleLock: (id: string) => void;
  toggleHidden: (id: string) => void;
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;

  // Seleção / zoom
  select: (id: string | null) => void;
  setZoom: (z: number) => void;
  toggleSnap: () => void;
  toggleGrid: () => void;

  // Persistência
  markClean: () => void;
}

function maxZ(elements: EditorElement[]) {
  return elements.reduce((m, e) => Math.max(m, e.zIndex ?? 0), 0);
}

export const useEditorStore = create<EditorState>()(
  temporal(
    (set, get) => ({
      templateId: null,
      name: "Novo template",
      format: "horizontal",
      width: CANVAS_PRESETS.horizontal.width,
      height: CANVAS_PRESETS.horizontal.height,
      background: { type: "color", value: "#0f1720" },
      elements: [],
      durationSeconds: 15,
      category: "custom",
      isPublished: false,
      selectedId: null,
      zoom: 0.4,
      isDirty: false,
      snapEnabled: true,
      showGrid: false,

      load: (tpl) =>
        set({
          templateId: tpl.id,
          name: tpl.name,
          format: tpl.format,
          width: tpl.width,
          height: tpl.height,
          background: tpl.background,
          elements: tpl.elements,
          durationSeconds: tpl.durationSeconds,
          category: tpl.category,
          isPublished: tpl.isPublished,
          selectedId: null,
          isDirty: false,
        }),

      loadPreset: (preset) =>
        set({
          templateId: null,
          name: preset.name ?? "Novo template",
          format: preset.format,
          width: CANVAS_PRESETS[preset.format].width,
          height: CANVAS_PRESETS[preset.format].height,
          background: preset.background,
          elements: preset.elements,
          category: preset.category ?? "custom",
          isPublished: false,
          selectedId: null,
          isDirty: true,
        }),

      reset: () =>
        set({
          templateId: null,
          name: "Novo template",
          format: "horizontal",
          width: CANVAS_PRESETS.horizontal.width,
          height: CANVAS_PRESETS.horizontal.height,
          background: { type: "color", value: "#0f1720" },
          elements: [],
          selectedId: null,
          isDirty: false,
        }),

      setName: (name) => set({ name, isDirty: true }),

      setFormat: (format) =>
        set({
          format,
          width: CANVAS_PRESETS[format].width,
          height: CANVAS_PRESETS[format].height,
          isDirty: true,
        }),

      setBackground: (background) => set({ background, isDirty: true }),
      setDurationSeconds: (s) => set({ durationSeconds: s, isDirty: true }),

      addElement: (el) => {
        const z = maxZ(get().elements) + 1;
        const withZ = { ...el, zIndex: el.zIndex ?? z };
        set((state) => ({
          elements: [...state.elements, withZ],
          selectedId: withZ.id,
          isDirty: true,
        }));
      },

      updateElement: (id, patch) =>
        set((state) => ({
          elements: state.elements.map((e) =>
            e.id === id ? ({ ...e, ...patch } as EditorElement) : e,
          ),
          isDirty: true,
        })),

      removeElement: (id) =>
        set((state) => ({
          elements: state.elements.filter((e) => e.id !== id),
          selectedId: state.selectedId === id ? null : state.selectedId,
          isDirty: true,
        })),

      duplicateElement: (id) => {
        const el = get().elements.find((e) => e.id === id);
        if (!el) return;
        const z = maxZ(get().elements) + 1;
        const copy: EditorElement = {
          ...el,
          id: crypto.randomUUID(),
          x: el.x + 20,
          y: el.y + 20,
          zIndex: z,
        };
        set((state) => ({
          elements: [...state.elements, copy],
          selectedId: copy.id,
          isDirty: true,
        }));
      },

      toggleLock: (id) =>
        set((state) => ({
          elements: state.elements.map((e) =>
            e.id === id ? { ...e, locked: !e.locked } : e,
          ),
          isDirty: true,
        })),

      toggleHidden: (id) =>
        set((state) => ({
          elements: state.elements.map((e) =>
            e.id === id ? { ...e, hidden: !e.hidden } : e,
          ),
          isDirty: true,
        })),

      bringForward: (id) => {
        const z = maxZ(get().elements) + 1;
        set((state) => ({
          elements: state.elements.map((e) => (e.id === id ? { ...e, zIndex: z } : e)),
          isDirty: true,
        }));
      },

      sendBackward: (id) => {
        const minZ = Math.min(...get().elements.map((e) => e.zIndex)) - 1;
        set((state) => ({
          elements: state.elements.map((e) => (e.id === id ? { ...e, zIndex: minZ } : e)),
          isDirty: true,
        }));
      },

      select: (id) => set({ selectedId: id }),
      setZoom: (z) => set({ zoom: Math.max(0.1, Math.min(2, z)) }),
      toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
      toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
      markClean: () => set({ isDirty: false }),
    }),
    { limit: 50 },
  ),
);

export const useEditorTemporal = useEditorStore.temporal;

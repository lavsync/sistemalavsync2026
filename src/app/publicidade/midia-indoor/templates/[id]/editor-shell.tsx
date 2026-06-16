"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useEditorStore } from "@mi/stores/editor-store";
import type { EditorTemplate } from "@mi/types/editor";
import { Toaster } from "@mi/components/ui/toaster";
import { toast } from "sonner";
import { ArrowLeft, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@mi/components/ui/button";
import { saveTemplateAction } from "../actions";
import { EditorToolbar } from "../_components/editor/editor-toolbar";
import { LeftSidebar } from "../_components/sidebars/left-sidebar";
import { RightSidebar } from "../_components/sidebars/right-sidebar";
import { PreviewMode } from "../_components/editor/preview-mode";

const EditorCanvas = dynamic(
  () => import("../_components/editor/editor-canvas").then((m) => m.EditorCanvas),
  { ssr: false, loading: () => <div className="h-full w-full bg-[#0a0f14]" /> },
);

export function EditorShell({ initialTemplate }: { initialTemplate: EditorTemplate }) {
  const router = useRouter();
  const load = useEditorStore((s) => s.load);
  const markClean = useEditorStore((s) => s.markClean);
  const isDirty = useEditorStore((s) => s.isDirty);
  const [previewing, setPreviewing] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    load(initialTemplate);
  }, [initialTemplate, load]);

  // Atalhos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName);
      if (isInput) return;

      const meta = e.metaKey || e.ctrlKey;
      const store = useEditorStore.getState();

      if (meta && e.key === "s") {
        e.preventDefault();
        handleSave();
      } else if (meta && e.key === "d") {
        e.preventDefault();
        if (store.selectedId) store.duplicateElement(store.selectedId);
      } else if (meta && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        useEditorStore.temporal.getState().redo();
      } else if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        useEditorStore.temporal.getState().undo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (store.selectedId) store.removeElement(store.selectedId);
      } else if (e.key === "Escape") {
        store.select(null);
        setPreviewing(false);
      } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        if (!store.selectedId) return;
        const el = store.elements.find((x) => x.id === store.selectedId);
        if (!el || el.locked) return;
        e.preventDefault();
        const step = e.shiftKey ? 32 : 8;
        const patch: { x?: number; y?: number } = {};
        if (e.key === "ArrowLeft") patch.x = el.x - step;
        if (e.key === "ArrowRight") patch.x = el.x + step;
        if (e.key === "ArrowUp") patch.y = el.y - step;
        if (e.key === "ArrowDown") patch.y = el.y + step;
        store.updateElement(el.id, patch);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aviso ao sair com mudanças não salvas
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleSave = () => {
    const s = useEditorStore.getState();
    startTransition(async () => {
      const res = await saveTemplateAction({
        id: s.templateId ?? undefined,
        name: s.name,
        format: s.format,
        background: s.background,
        elements: s.elements,
        durationSeconds: s.durationSeconds,
        category: s.category,
      });
      if (res?.ok) {
        markClean();
        toast.success("Template salvo");
        if (res.id && !s.templateId) {
          router.replace(`/publicidade/midia-indoor/templates/${res.id}`);
        }
      } else if (res) {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0a0f14] text-white">
      {/* Header bar com voltar */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-[#0a0f14]/95 px-3 py-1.5 backdrop-blur-xl">
        <Button asChild variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
          <Link href="/publicidade/midia-indoor/templates">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <span className="text-xs text-white/40">Editor de Templates</span>
      </div>

      {/* Toolbar */}
      <EditorToolbar onSave={handleSave} onPreview={() => setPreviewing(true)} saving={pending} />

      {/* Workspace */}
      <div className="flex min-h-0 flex-1">
        <LeftSidebar />
        <div className="min-w-0 flex-1">
          <EditorCanvas />
        </div>
        <RightSidebar />
      </div>

      {/* Preview overlay */}
      {previewing && <PreviewMode onClose={() => setPreviewing(false)} />}

      <Toaster />
    </div>
  );
}

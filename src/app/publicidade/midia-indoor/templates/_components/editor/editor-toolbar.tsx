"use client";

import {
  Undo2, Redo2,
  ZoomIn, ZoomOut, Maximize, Grid3x3, Magnet,
  Save, Loader2, Eye,
  Trash2, Copy as CopyIcon, Lock, Unlock, EyeOff,
  ArrowUp, ArrowDown,
} from "lucide-react";
import { useEditorStore, useEditorTemporal } from "@mi/stores/editor-store";
import { Button } from "@mi/components/ui/button";
import { cn } from "@mi/lib/utils";
import { ExportMenu } from "./export-menu";
import { ShortcutsCheatSheet } from "./shortcuts-cheatsheet";

interface EditorToolbarProps {
  onSave: () => void;
  onPreview: () => void;
  saving: boolean;
}

export function EditorToolbar({ onSave, onPreview, saving }: EditorToolbarProps) {
  const {
    name, setName, zoom, setZoom,
    snapEnabled, toggleSnap,
    showGrid, toggleGrid,
    selectedId, removeElement, duplicateElement, toggleLock, toggleHidden,
    bringForward, sendBackward,
    elements, isDirty,
  } = useEditorStore();

  const temporalState = useEditorTemporal.getState();
  const { undo, redo, pastStates, futureStates } = temporalState;
  const canUndo = pastStates.length > 0;
  const canRedo = futureStates.length > 0;

  const selectedEl = elements.find((e) => e.id === selectedId);

  const fitZoom = () => {
    const target = window.innerWidth - 720;
    const w = useEditorStore.getState().width;
    setZoom(Math.min(0.8, (target / w) * 0.85));
  };

  return (
    <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#0a0f14]/80 px-4 py-2.5 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border-0 bg-white/5 px-3 py-1.5 text-sm font-medium text-white outline-none ring-1 ring-white/10 transition-all focus:ring-2 focus:ring-primary"
          placeholder="Nome do template"
        />
        {isDirty && <span className="text-[11px] text-amber-400">• não salvo</span>}
      </div>

      <div className="flex items-center gap-1">
        <ToolBtn onClick={undo} disabled={!canUndo} title="Desfazer (Ctrl+Z)">
          <Undo2 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={redo} disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)">
          <Redo2 className="h-4 w-4" />
        </ToolBtn>

        <span className="mx-1 h-5 w-px bg-white/10" />

        <ToolBtn onClick={() => setZoom(zoom - 0.1)} title="Diminuir zoom">
          <ZoomOut className="h-4 w-4" />
        </ToolBtn>
        <span className="rounded px-2 text-xs font-mono text-white/70 tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <ToolBtn onClick={() => setZoom(zoom + 0.1)} title="Aumentar zoom">
          <ZoomIn className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={fitZoom} title="Ajustar à tela">
          <Maximize className="h-4 w-4" />
        </ToolBtn>

        <span className="mx-1 h-5 w-px bg-white/10" />

        <ToolBtn onClick={toggleGrid} active={showGrid} title="Grid">
          <Grid3x3 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn onClick={toggleSnap} active={snapEnabled} title="Snap (alinhamento automático)">
          <Magnet className="h-4 w-4" />
        </ToolBtn>

        {selectedEl && (
          <>
            <span className="mx-1 h-5 w-px bg-white/10" />
            <ToolBtn onClick={() => duplicateElement(selectedEl.id)} title="Duplicar (Ctrl+D)">
              <CopyIcon className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn onClick={() => toggleLock(selectedEl.id)} title="Travar/Destravar">
              {selectedEl.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </ToolBtn>
            <ToolBtn onClick={() => toggleHidden(selectedEl.id)} title="Ocultar/Mostrar">
              <EyeOff className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn onClick={() => bringForward(selectedEl.id)} title="Trazer pra frente">
              <ArrowUp className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn onClick={() => sendBackward(selectedEl.id)} title="Enviar pra trás">
              <ArrowDown className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn
              onClick={() => removeElement(selectedEl.id)}
              title="Excluir (Del)"
              className="text-red-300 hover:bg-red-500/20"
            >
              <Trash2 className="h-4 w-4" />
            </ToolBtn>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ShortcutsCheatSheet />
        <ExportMenu />
        <Button variant="outline" size="sm" onClick={onPreview} className="border-white/10 bg-white/5 text-white hover:bg-white/10">
          <Eye className="mr-1 h-3 w-3" />
          Preview
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
          Salvar
        </Button>
      </div>
    </header>
  );
}

function ToolBtn({
  children, onClick, title, active, disabled, className,
}: React.PropsWithChildren<{
  onClick?: () => void;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-white/70 transition-colors",
        "hover:bg-white/10 hover:text-white",
        active && "bg-primary/20 text-primary",
        disabled && "opacity-30 hover:bg-transparent",
        className,
      )}
    >
      {children}
    </button>
  );
}

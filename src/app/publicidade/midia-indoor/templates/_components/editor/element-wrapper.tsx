"use client";

import { useRef, useState, useCallback } from "react";
import { useEditorStore } from "@mi/stores/editor-store";
import type { EditorElement } from "@mi/types/editor";
import { cn } from "@mi/lib/utils";

interface ElementWrapperProps {
  element: EditorElement;
  children: React.ReactNode;
}

type ResizeHandle = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

const HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  n: "ns-resize", s: "ns-resize",
  e: "ew-resize", w: "ew-resize",
  nw: "nwse-resize", se: "nwse-resize",
  ne: "nesw-resize", sw: "nesw-resize",
};

const HANDLE_STYLE: Record<ResizeHandle, React.CSSProperties> = {
  n: { top: -6, left: "50%", transform: "translateX(-50%)" },
  s: { bottom: -6, left: "50%", transform: "translateX(-50%)" },
  e: { right: -6, top: "50%", transform: "translateY(-50%)" },
  w: { left: -6, top: "50%", transform: "translateY(-50%)" },
  nw: { top: -6, left: -6 },
  ne: { top: -6, right: -6 },
  sw: { bottom: -6, left: -6 },
  se: { bottom: -6, right: -6 },
};

export function ElementWrapper({ element, children }: ElementWrapperProps) {
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);
  const updateElement = useEditorStore((s) => s.updateElement);
  const zoom = useEditorStore((s) => s.zoom);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);

  const isSelected = selectedId === element.id;
  const dragRef = useRef<{ startX: number; startY: number; elX: number; elY: number } | null>(null);
  const resizeRef = useRef<{
    startX: number; startY: number;
    elX: number; elY: number;
    elW: number; elH: number;
    handle: ResizeHandle;
  } | null>(null);
  const [rotating, setRotating] = useState(false);
  const rotateRef = useRef<{ centerX: number; centerY: number; startAngle: number; startRotation: number } | null>(null);

  const snap = useCallback(
    (v: number) => (snapEnabled ? Math.round(v / 8) * 8 : v),
    [snapEnabled],
  );

  const onMouseDown = (e: React.MouseEvent) => {
    if (element.locked) return;
    e.stopPropagation();
    select(element.id);

    if ((e.target as HTMLElement).dataset.handle) return;
    if ((e.target as HTMLElement).dataset.rotate) return;

    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      elX: element.x, elY: element.y,
    };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = (ev.clientX - dragRef.current.startX) / zoom;
      const dy = (ev.clientY - dragRef.current.startY) / zoom;
      updateElement(element.id, {
        x: snap(dragRef.current.elX + dx),
        y: snap(dragRef.current.elY + dy),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onResizeStart = (handle: ResizeHandle) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (element.locked) return;
    resizeRef.current = {
      startX: e.clientX, startY: e.clientY,
      elX: element.x, elY: element.y,
      elW: element.width, elH: element.height,
      handle,
    };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const r = resizeRef.current;
      const dx = (ev.clientX - r.startX) / zoom;
      const dy = (ev.clientY - r.startY) / zoom;
      const patch: Partial<EditorElement> = {};
      if (handle.includes("e")) patch.width = Math.max(40, snap(r.elW + dx));
      if (handle.includes("w")) {
        patch.width = Math.max(40, snap(r.elW - dx));
        patch.x = snap(r.elX + dx);
      }
      if (handle.includes("s")) patch.height = Math.max(20, snap(r.elH + dy));
      if (handle.includes("n")) {
        patch.height = Math.max(20, snap(r.elH - dy));
        patch.y = snap(r.elY + dy);
      }
      updateElement(element.id, patch);
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onRotateStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (element.locked) return;
    const rect = (e.currentTarget as HTMLElement).closest("[data-el-wrapper]")?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const startAngle = (Math.atan2(e.clientY - centerY, e.clientX - centerX) * 180) / Math.PI;

    rotateRef.current = { centerX, centerY, startAngle, startRotation: element.rotation };
    setRotating(true);

    const onMove = (ev: MouseEvent) => {
      if (!rotateRef.current) return;
      const r = rotateRef.current;
      const current = (Math.atan2(ev.clientY - r.centerY, ev.clientX - r.centerX) * 180) / Math.PI;
      const delta = current - r.startAngle;
      let next = r.startRotation + delta;
      if (snapEnabled) next = Math.round(next / 15) * 15;
      updateElement(element.id, { rotation: next });
    };
    const onUp = () => {
      rotateRef.current = null;
      setRotating(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      data-el-wrapper
      style={{
        position: "absolute",
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        transform: `rotate(${element.rotation}deg)`,
        transformOrigin: "center",
        opacity: element.opacity,
        cursor: element.locked ? "default" : isSelected ? "move" : "pointer",
        outline: isSelected ? "2px solid #14b8a6" : "none",
        outlineOffset: 2,
        zIndex: element.zIndex,
      }}
      onMouseDown={onMouseDown}
    >
      {children}

      {isSelected && !element.locked && (
        <>
          {HANDLES.map((h) => (
            <div
              key={h}
              data-handle={h}
              onMouseDown={onResizeStart(h)}
              className={cn(
                "absolute h-3 w-3 rounded-sm border-2 border-white bg-[#14b8a6] shadow",
              )}
              style={{ ...HANDLE_STYLE[h], cursor: HANDLE_CURSORS[h] }}
            />
          ))}
          <div
            data-rotate
            onMouseDown={onRotateStart}
            className={cn(
              "absolute h-4 w-4 rounded-full border-2 border-white bg-[#14b8a6] shadow",
              rotating && "ring-2 ring-white",
            )}
            style={{
              top: -30, left: "50%", transform: "translateX(-50%)",
              cursor: "grab",
            }}
            title="Rotacionar"
          />
        </>
      )}

      {isSelected && element.locked && (
        <div
          style={{
            position: "absolute", top: -28, right: 0,
            fontSize: 11, fontWeight: 600, padding: "2px 6px",
            background: "#facc15", color: "#854d0e",
            borderRadius: 4,
          }}
        >
          🔒 Travado
        </div>
      )}
    </div>
  );
}

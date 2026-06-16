"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@mi/stores/editor-store";
import { ElementRenderer } from "./element-renderer";
import { ElementWrapper } from "./element-wrapper";

const GRID_SIZE = 20;

export function EditorCanvas() {
  const { width, height, background, elements, zoom, select, showGrid } = useEditorStore();
  const stageRef = useRef<HTMLDivElement>(null);

  const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  const bgStyle: React.CSSProperties = {
    width, height, position: "relative",
    overflow: "hidden",
    background:
      background.type === "image" ? `url(${background.value}) center/cover` : background.value,
  };

  return (
    <div
      className="grid h-full w-full place-items-center overflow-auto bg-[#0a0f14] p-12"
      onClick={(e) => {
        if (e.target === e.currentTarget) select(null);
      }}
    >
      <div
        ref={stageRef}
        style={{
          width: width * zoom,
          height: height * zoom,
          boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 30px 90px rgba(0,0,0,0.6)",
          borderRadius: 8,
          background: "white",
          overflow: "hidden",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) select(null);
        }}
      >
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "0 0",
            width, height,
          }}
        >
          <div style={bgStyle}>
            {showGrid && (
              <div
                style={{
                  position: "absolute", inset: 0,
                  backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px),
                                    linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)`,
                  backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
                  pointerEvents: "none",
                }}
              />
            )}
            {sortedElements.filter((e) => !e.hidden).map((el) => (
              <ElementWrapper key={el.id} element={el}>
                <ElementRenderer element={el} mode="edit" />
              </ElementWrapper>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

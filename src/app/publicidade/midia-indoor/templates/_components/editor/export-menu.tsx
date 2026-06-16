"use client";

import { useState, useTransition } from "react";
import { Download, FileImage, Loader2 } from "lucide-react";
import { toPng, toJpeg } from "html-to-image";
import { Button } from "@mi/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@mi/components/ui/dropdown-menu";
import { useEditorStore } from "@mi/stores/editor-store";
import { ElementRenderer } from "./element-renderer";
import { toast } from "sonner";
import { createPortal } from "react-dom";

type ExportFormat = "png" | "webp" | "jpeg";

export function ExportMenu() {
  const [pending, startTransition] = useTransition();
  const [renderTarget, setRenderTarget] = useState<HTMLDivElement | null>(null);

  const exportAs = (format: ExportFormat) => {
    const state = useEditorStore.getState();
    startTransition(async () => {
      // Cria um div temporário renderizado em escala nativa (não escalado)
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-99999px";
      container.style.top = "0";
      container.style.width = `${state.width}px`;
      container.style.height = `${state.height}px`;
      container.style.background =
        state.background.type === "image"
          ? `url(${state.background.value}) center/cover`
          : state.background.value;
      document.body.appendChild(container);

      setRenderTarget(container);

      // Aguarda 1 tick pro React renderizar
      await new Promise((r) => setTimeout(r, 400));

      try {
        const opts = {
          width: state.width,
          height: state.height,
          pixelRatio: 1,
          cacheBust: true,
        };

        let dataUrl: string;
        let mime: string;
        let ext: string;

        if (format === "png") {
          dataUrl = await toPng(container, opts);
          mime = "image/png";
          ext = "png";
        } else if (format === "webp") {
          // toPng + canvas para webp
          dataUrl = await toPng(container, opts);
          dataUrl = await convertToWebp(dataUrl, state.width, state.height);
          mime = "image/webp";
          ext = "webp";
        } else {
          dataUrl = await toJpeg(container, { ...opts, quality: 0.95 });
          mime = "image/jpeg";
          ext = "jpg";
        }

        const link = document.createElement("a");
        const safeName = (state.name || "template").replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
        link.download = `${safeName}-${state.width}x${state.height}.${ext}`;
        link.href = dataUrl;
        link.click();

        toast.success(`${ext.toUpperCase()} exportado (${state.width}×${state.height})`);
      } catch (e) {
        toast.error(`Falha ao exportar: ${(e as Error).message}`);
      } finally {
        document.body.removeChild(container);
        setRenderTarget(null);
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={pending} className="border-white/10 bg-white/5 text-white hover:bg-white/10">
            {pending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Download className="mr-1 h-3 w-3" />}
            Exportar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Baixar como</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => exportAs("png")}>
            <FileImage className="h-4 w-4" />
            PNG (transparente)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportAs("jpeg")}>
            <FileImage className="h-4 w-4" />
            JPEG (menor tamanho)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportAs("webp")}>
            <FileImage className="h-4 w-4" />
            WebP (melhor compressão)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {renderTarget && createPortal(<ExportSnapshot />, renderTarget)}
    </>
  );
}

/** Renderiza o template em escala 1:1 num portal isolado pra capturar a imagem. */
function ExportSnapshot() {
  const elements = useEditorStore((s) => s.elements);
  const sorted = [...elements].filter((e) => !e.hidden).sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
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
          <ElementRenderer element={el} mode="thumb" />
        </div>
      ))}
    </div>
  );
}

async function convertToWebp(pngDataUrl: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas não disponível"));
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/webp", 0.92));
    };
    img.onerror = () => reject(new Error("Erro ao converter para WebP"));
    img.src = pngDataUrl;
  });
}

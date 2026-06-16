"use client";

import { useState, useTransition } from "react";
import { Upload, Loader2 } from "lucide-react";
import { useEditorStore } from "@mi/stores/editor-store";
import { createClient } from "@mi/lib/supabase/client";
import { PanelHeader, SectionLabel } from "./shared";
import { createElement } from "../element-factory";
import { toast } from "sonner";
import type { ImageElement, VideoElement } from "@mi/types/editor";

export function UploadsPanel() {
  const addElement = useEditorStore((s) => s.addElement);
  const canvasWidth = useEditorStore((s) => s.width);
  const canvasHeight = useEditorStore((s) => s.height);
  const [uploading, startTransition] = useTransition();
  const [history, setHistory] = useState<{ url: string; type: "image" | "video"; name: string }[]>([]);

  const upload = (file: File) => {
    startTransition(async () => {
      try {
        const isVideo = file.type.startsWith("video/");

        // O bucket `campaigns` aceita estes formatos (e tem teto de 200MB).
        const allowed = isVideo
          ? ["video/mp4", "video/webm"]
          : ["image/png", "image/jpeg", "image/webp"];
        if (!allowed.includes(file.type)) {
          throw new Error(
            isVideo
              ? "Formato de vídeo não suportado. Use MP4 ou WebM."
              : "Formato de imagem não suportado. Use PNG, JPG ou WebP (HEIC/GIF não são aceitos).",
          );
        }
        if (file.size > 200 * 1024 * 1024) {
          throw new Error("Arquivo acima de 200MB. Reduza o tamanho e tente novamente.");
        }

        const supabase = createClient();
        // Todas as mídias do editor vão para `campaigns`: único bucket com
        // teto de 200MB (logos=2MB e banners=8MB rejeitavam imagens grandes).
        const bucket = "campaigns";
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
        const path = `editor/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;

        const { error } = await supabase.storage.from(bucket).upload(path, file, {
          contentType: file.type,
          cacheControl: "31536000",
        });
        if (error) throw new Error(error.message);

        const { data } = supabase.storage.from(bucket).getPublicUrl(path);

        // Adiciona ao histórico
        const newItem: { url: string; type: "image" | "video"; name: string } = {
          url: data.publicUrl,
          type: isVideo ? "video" : "image",
          name: file.name,
        };
        setHistory((h) => [newItem, ...h].slice(0, 20));

        // Adiciona elemento no canvas
        const elementType = isVideo ? "video" : "image";
        const el = createElement(elementType, { canvasWidth, canvasHeight });
        if (isVideo) {
          (el as VideoElement).src = data.publicUrl;
        } else {
          (el as ImageElement).src = data.publicUrl;
        }
        addElement(el);
        toast.success("Arquivo adicionado ao canvas");
      } catch (e) {
        toast.error(`Falha no upload: ${(e as Error).message}`);
      }
    });
  };

  return (
    <div>
      <PanelHeader title="Uploads" subtitle="Suas imagens e vídeos" />

      <div className="px-3">
        <label
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-white/20 bg-white/[0.02] p-6 text-center transition-colors hover:border-primary hover:bg-primary/5 ${uploading ? "pointer-events-none opacity-50" : ""}`}
        >
          {uploading ? (
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          ) : (
            <Upload className="h-7 w-7 text-white/40" />
          )}
          <span className="text-xs font-semibold text-white">
            {uploading ? "Enviando..." : "Clique ou arraste"}
          </span>
          <span className="text-[10px] text-white/40">
            PNG, JPG, WebP · MP4, WebM (até 200MB)
          </span>
          <input
            type="file"
            accept="image/*,video/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>

        {history.length > 0 && (
          <>
            <SectionLabel>Recentes</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {history.map((item) => (
                <button
                  key={item.url}
                  onClick={() => {
                    const el = createElement(item.type, { canvasWidth, canvasHeight });
                    if (item.type === "video") (el as VideoElement).src = item.url;
                    else (el as ImageElement).src = item.url;
                    addElement(el);
                  }}
                  className="group overflow-hidden rounded-md border border-white/10 bg-black"
                >
                  {item.type === "video" ? (
                    <video src={item.url} muted className="h-20 w-full object-cover" />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.url} alt={item.name} className="h-20 w-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

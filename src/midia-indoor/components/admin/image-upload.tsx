"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Upload, X, Loader2, Film } from "lucide-react";
import { Button } from "@mi/components/ui/button";
import { toast } from "sonner";
import { createClient } from "@mi/lib/supabase/client";
import type { StorageBucket } from "@mi/lib/storage";

interface ImageUploadProps {
  bucket: StorageBucket;
  name: string;
  label?: string;
  defaultUrl?: string | null;
  aspect?: "square" | "wide";
  hint?: string;
}

// Limites por bucket (precisam bater com os limites do Supabase Storage)
const MAX_SIZE: Record<StorageBucket, number> = {
  logos: 2 * 1024 * 1024, // 2MB
  banners: 8 * 1024 * 1024, // 8MB
  campaigns: 200 * 1024 * 1024, // 200MB
};

const VALID_TYPES: Record<StorageBucket, string[]> = {
  logos: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  banners: ["image/png", "image/jpeg", "image/webp"],
  campaigns: ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"],
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ImageUpload({
  bucket,
  name,
  label,
  defaultUrl,
  aspect = "square",
  hint,
}: ImageUploadProps) {
  const [url, setUrl] = useState<string | null>(defaultUrl ?? null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const isVideo = (u?: string | null) =>
    !!u && (u.endsWith(".mp4") || u.endsWith(".webm") || u.includes(".mp4?") || u.includes(".webm?"));

  const validate = (file: File): string | null => {
    if (file.size > MAX_SIZE[bucket]) {
      return `Arquivo muito grande (${formatBytes(file.size)}). Limite: ${formatBytes(MAX_SIZE[bucket])}.`;
    }
    if (!VALID_TYPES[bucket].includes(file.type)) {
      return `Tipo não permitido (${file.type}). Aceitos: ${VALID_TYPES[bucket].join(", ")}.`;
    }
    return null;
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const error = validate(file);
    if (error) {
      toast.error(error);
      e.target.value = "";
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const id = crypto.randomUUID();
      const path = `${new Date().toISOString().slice(0, 7)}/${id}.${ext}`;

      try {
        setProgress(0);

        // Upload direto do browser → Supabase Storage
        const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
          contentType: file.type || "application/octet-stream",
          cacheControl: "31536000",
          upsert: false,
        });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        setUrl(data.publicUrl);
        setProgress(100);
        toast.success(`Arquivo enviado (${formatBytes(file.size)})`);
      } catch (err) {
        toast.error(`Falha no upload: ${(err as Error).message}`);
      } finally {
        setProgress(null);
        e.target.value = "";
      }
    });
  };

  const removeImage = () => {
    setUrl(null);
    toast.success("Removido — salve para confirmar");
  };

  const showAsVideo = isVideo(url);

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium">{label}</p>}

      <input type="hidden" name={name} value={url ?? ""} />

      <div
        className={
          aspect === "square"
            ? "relative aspect-square w-full max-w-[180px] overflow-hidden rounded-lg border bg-muted"
            : "relative aspect-video w-full max-w-2xl overflow-hidden rounded-lg border bg-muted"
        }
      >
        {url ? (
          <>
            {showAsVideo ? (
              <video
                src={url}
                muted
                loop
                playsInline
                autoPlay
                className="h-full w-full object-cover"
              />
            ) : (
              <Image
                src={url}
                alt={label ?? "Imagem"}
                fill
                className="object-cover"
                unoptimized
              />
            )}
            <button
              type="button"
              onClick={removeImage}
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Remover"
            >
              <X className="h-4 w-4" />
            </button>
            {showAsVideo && (
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs text-white">
                <Film className="h-3 w-3" /> Vídeo
              </span>
            )}
          </>
        ) : (
          <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-muted/70">
            {pending ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="text-xs">
                  {progress === null ? "Preparando..." : `Enviando${progress > 0 ? ` ${progress}%` : ""}...`}
                </span>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6" />
                <span className="text-xs">Selecionar arquivo</span>
              </>
            )}
            <input
              type="file"
              accept={VALID_TYPES[bucket].join(",")}
              className="hidden"
              onChange={onFileChange}
              disabled={pending}
            />
          </label>
        )}
      </div>

      {url && (
        <label>
          <Button asChild variant="outline" size="sm" disabled={pending} type="button">
            <span className="cursor-pointer">
              {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              Trocar arquivo
            </span>
          </Button>
          <input
            type="file"
            accept={VALID_TYPES[bucket].join(",")}
            className="hidden"
            onChange={onFileChange}
            disabled={pending}
          />
        </label>
      )}

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

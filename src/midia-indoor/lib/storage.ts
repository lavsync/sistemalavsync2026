import { createAdminClient } from "@mi/lib/supabase/admin";

export type StorageBucket = "logos" | "banners" | "campaigns";

interface UploadOptions {
  bucket: StorageBucket;
  file: File;
  path?: string;
}

/**
 * Faz upload de uma imagem/vídeo pro Supabase Storage e retorna a URL pública.
 * Usa service_role pra contornar RLS — chamar somente de Server Actions.
 */
export async function uploadFile({ bucket, file, path }: UploadOptions): Promise<string> {
  const supabase = createAdminClient();

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const id = crypto.randomUUID();
  const fullPath = path ?? `${new Date().toISOString().slice(0, 7)}/${id}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabase.storage.from(bucket).upload(fullPath, arrayBuffer, {
    contentType: file.type || "application/octet-stream",
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) {
    throw new Error(`Falha no upload: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(fullPath);
  return data.publicUrl;
}

export async function deleteFile(bucket: StorageBucket, publicUrl: string) {
  const supabase = createAdminClient();
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const path = publicUrl.slice(idx + marker.length);
  await supabase.storage.from(bucket).remove([path]);
}

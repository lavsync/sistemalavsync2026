import { NextResponse } from "next/server";
import { createClient } from "@mi/lib/supabase/server";
import { uploadFile, type StorageBucket } from "@mi/lib/storage";

const VALID_BUCKETS: StorageBucket[] = ["logos", "banners", "campaigns"];
const MAX_SIZES: Record<StorageBucket, number> = {
  logos: 2 * 1024 * 1024,
  banners: 8 * 1024 * 1024,
  campaigns: 200 * 1024 * 1024,
};
const VALID_TYPES: Record<StorageBucket, string[]> = {
  logos: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  banners: ["image/png", "image/jpeg", "image/webp"],
  campaigns: ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"],
};

export async function POST(request: Request) {
  // Auth required
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const bucket = formData.get("bucket") as StorageBucket | null;

  if (!file || !bucket) {
    return NextResponse.json({ error: "Arquivo ou bucket faltando" }, { status: 400 });
  }

  if (!VALID_BUCKETS.includes(bucket)) {
    return NextResponse.json({ error: "Bucket inválido" }, { status: 400 });
  }

  if (file.size > MAX_SIZES[bucket]) {
    const mb = Math.round(MAX_SIZES[bucket] / 1024 / 1024);
    return NextResponse.json({ error: `Arquivo maior que ${mb}MB` }, { status: 413 });
  }

  if (!VALID_TYPES[bucket].includes(file.type)) {
    return NextResponse.json(
      { error: `Tipo não permitido. Aceitos: ${VALID_TYPES[bucket].join(", ")}` },
      { status: 415 },
    );
  }

  try {
    const url = await uploadFile({ bucket, file });
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

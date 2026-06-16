/**
 * Fase B3 — cria os buckets de storage do Mídia Indoor no Supabase do LavSync.
 *
 * Uso:
 *   DEST_URL=https://yjesmmuoqrlteclwtfqn.supabase.co \
 *   DEST_SERVICE_KEY=<service_role do LavSync> \
 *   node scripts/mi-create-buckets.mjs
 *
 * Idempotente: se o bucket já existe, só atualiza limites/MIME.
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.DEST_URL;
const KEY = process.env.DEST_SERVICE_KEY;
if (!URL || !KEY) {
  console.error("Faltam env: DEST_URL e DEST_SERVICE_KEY");
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const BUCKETS = [
  { id: "logos",     public: true, fileSizeLimit: 2097152,   allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] },
  { id: "banners",   public: true, fileSizeLimit: 8388608,   allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"] },
  { id: "campaigns", public: true, fileSizeLimit: 209715200, allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm"] },
];

for (const b of BUCKETS) {
  const opts = { public: b.public, fileSizeLimit: b.fileSizeLimit, allowedMimeTypes: b.allowedMimeTypes };
  const { error: createErr } = await sb.storage.createBucket(b.id, opts);
  if (createErr && !/already exists/i.test(createErr.message)) {
    console.error(`✗ ${b.id}:`, createErr.message);
    continue;
  }
  if (createErr) {
    const { error: updErr } = await sb.storage.updateBucket(b.id, opts);
    console.log(updErr ? `✗ ${b.id} (update): ${updErr.message}` : `↻ ${b.id} atualizado`);
  } else {
    console.log(`✓ ${b.id} criado`);
  }
}
console.log("Buckets prontos.");

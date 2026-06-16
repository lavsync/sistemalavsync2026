/**
 * Fase C — migra os dados do Mídia Indoor (Xô Varal) para o Supabase do LavSync.
 *
 * Preserva os UUIDs originais (mantém FKs e short_code dos QR intactos).
 * Adiciona tenant_id (tenant único do LavSync) e mapeia unit_id -> unidade_id.
 *
 * Uso:
 *   SRC_URL=https://mnonhgeumgsksnppwyuo.supabase.co  SRC_SERVICE_KEY=<xovaral service_role> \
 *   DEST_URL=https://yjesmmuoqrlteclwtfqn.supabase.co DEST_SERVICE_KEY=<lavsync service_role> \
 *   [UNIT_MAP='{"xo-varal-buritis":"10000000-0000-0000-0000-000000000001"}'] \
 *   [DRY_RUN=1] \
 *   node scripts/mi-migrate-data.mjs
 *
 * Sem UNIT_MAP, tenta casar units.name/slug com unidades.nome do LavSync.
 */
import { createClient } from "@supabase/supabase-js";

const need = (k) => { const v = process.env[k]; if (!v) { console.error("Falta env:", k); process.exit(1); } return v; };
const SRC = createClient(need("SRC_URL"), need("SRC_SERVICE_KEY"), { auth: { persistSession: false } });
const DEST = createClient(need("DEST_URL"), need("DEST_SERVICE_KEY"), { auth: { persistSession: false } });
const DRY = process.env.DRY_RUN === "1";

// ── 1. tenant único do LavSync ──────────────────────────────────────────────
const { data: tenants, error: tErr } = await DEST.from("tenants").select("id").limit(2);
if (tErr) { console.error("Erro lendo tenants:", tErr.message); process.exit(1); }
if (!tenants?.length) { console.error("Nenhum tenant no LavSync."); process.exit(1); }
if (tenants.length > 1) console.warn("⚠ Mais de um tenant — usando o primeiro:", tenants[0].id);
const TENANT_ID = tenants[0].id;
console.log("tenant_id =", TENANT_ID);

// ── 2. mapa unit_id (origem) -> unidade_id (LavSync) ─────────────────────────
const { data: srcUnits } = await SRC.from("units").select("*");
const { data: destUnidades } = await DEST.from("unidades").select("id, nome");
const norm = (s) => (s || "").toLowerCase().replace(/x[oô]\s*varal/g, "").replace(/[^a-z]/g, "").trim();
const explicit = process.env.UNIT_MAP ? JSON.parse(process.env.UNIT_MAP) : null;

const unitMap = {}; // srcUnitId -> destUnidadeId
for (const u of srcUnits || []) {
  let destId = explicit?.[u.slug];
  if (!destId) {
    const match = (destUnidades || []).find((d) => norm(d.nome) === norm(u.name) || norm(d.nome) === norm(u.slug));
    destId = match?.id;
  }
  if (!destId) { console.error(`✗ Sem mapeamento p/ unidade "${u.name}" (${u.slug}). Use UNIT_MAP.`); process.exit(1); }
  unitMap[u.id] = destId;
  console.log(`  unit ${u.slug} -> unidade ${destId}`);
}

// ── 3. helpers de transform/insert ───────────────────────────────────────────
const withTenant = (row) => ({ ...row, tenant_id: TENANT_ID });
const renameUnit = (row) => { const { unit_id, ...rest } = row; return { ...rest, unidade_id: unitMap[unit_id] }; };

async function fetchAll(table) {
  const all = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await SRC.from(table).select("*").range(from, from + PAGE - 1);
    if (error) throw new Error(`ler ${table}: ${error.message}`);
    all.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return all;
}

async function copy(table, destTable, transform, conflict = "id") {
  let src;
  try { src = await fetchAll(table); } catch (e) { console.error("✗", e.message); return; }
  const rows = src.map(transform);
  if (!rows.length) { console.log(`· ${table}: 0 linhas`); return; }
  if (DRY) { console.log(`[dry] ${table} -> ${destTable}: ${rows.length} linhas`); return; }
  // grava em lotes de 500 (free tier)
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error: insErr } = await DEST.from(destTable).upsert(batch, { onConflict: conflict });
    if (insErr) { console.error(`✗ ${destTable}:`, insErr.message); return; }
  }
  console.log(`✓ ${destTable}: ${rows.length} linhas`);
}

// ── 4. ordem respeitando FKs ─────────────────────────────────────────────────
// globais (sem tenant/unidade)
await copy("partner_categories", "mi_partner_categories", (r) => r);
await copy("templates", "mi_templates", (r) => r);
// units -> mi_units (1:1 com unidade)
await copy("units", "mi_units", (r) => ({
  id: r.id, tenant_id: TENANT_ID, unidade_id: unitMap[r.id],
  slug: r.slug, name: r.name, address: r.address, neighborhood: r.neighborhood,
  city: r.city, state: r.state, phone: r.phone, whatsapp: r.whatsapp,
  instagram: r.instagram, opening_hours: r.opening_hours, is_active: r.is_active,
  public_url: r.public_url, player_url: r.player_url, player_token: r.player_token,
  created_at: r.created_at, updated_at: r.updated_at,
}));
// dependentes
await copy("partners", "mi_partners", (r) => {
  const { profile_id, ...rest } = r; // profile_id (XV) -> não portado (vira mi_partner_users)
  return withTenant(renameUnit(rest));
});
await copy("offers", "mi_offers", (r) => withTenant(r));
await copy("editor_templates", "mi_editor_templates", (r) =>
  // created_by aponta p/ auth.users de outro projeto -> anula
  withTenant(renameUnit({ ...r, created_by: null })),
);
await copy("campaigns", "mi_campaigns", (r) => withTenant(renameUnit(r)));
await copy("qr_codes", "mi_qr_codes", (r) => withTenant(renameUnit(r)));
await copy("player_sessions", "mi_player_sessions", (r) => withTenant(renameUnit(r)));
await copy("campaign_impressions", "mi_campaign_impressions", (r) => withTenant(renameUnit(r)));
await copy("qr_clicks", "mi_qr_clicks", (r) => withTenant(renameUnit(r)));
await copy("club_members", "mi_club_members", (r) => withTenant(renameUnit(r)));
await copy("partner_leads", "mi_partner_leads", (r) => withTenant(renameUnit(r)));
// settings (key/value global -> por tenant)
await copy("settings", "mi_settings", (r) => ({ tenant_id: TENANT_ID, key: r.key, value: r.value, updated_at: r.updated_at }), "tenant_id,key");

// ── 5. storage: copia objetos logos/banners/campaigns origem -> destino ───────
async function copyBucket(bucket) {
  const seen = [];
  async function walk(prefix) {
    const { data, error } = await SRC.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) { console.error(`✗ list ${bucket}/${prefix}:`, error.message); return; }
    for (const item of data || []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) { await walk(path); continue; } // pasta
      seen.push(path);
    }
  }
  await walk("");
  console.log(`· ${bucket}: ${seen.length} objetos`);
  if (DRY) return;
  for (const path of seen) {
    const { data: blob, error: dErr } = await SRC.storage.from(bucket).download(path);
    if (dErr) { console.error(`  ✗ download ${path}:`, dErr.message); continue; }
    const buf = Buffer.from(await blob.arrayBuffer());
    const { error: uErr } = await DEST.storage.from(bucket).upload(path, buf, {
      contentType: blob.type || "application/octet-stream", upsert: true, cacheControl: "31536000",
    });
    if (uErr) console.error(`  ✗ upload ${path}:`, uErr.message);
  }
  console.log(`✓ ${bucket}: copiado`);
}
for (const b of ["logos", "banners", "campaigns"]) await copyBucket(b);

console.log(DRY ? "DRY RUN concluído." : "Migração de dados concluída.");

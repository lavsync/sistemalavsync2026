"use server";
// LavSync · Clube · Gestão do banco de mensagens WhatsApp
//
// CRUD completo + upload de banner. Escrita via service_role (admin) com
// gate de sessão (usuário logado do tenant); leitura segue RLS normal.
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// Tipos de mensagem suportados pelos fluxos (livre = uso geral/campanha)
export const TIPOS_TEMPLATE = [
  "parabens_nivel", "abaixo_bronze", "faltam_ciclos",
  "pontos_disponiveis", "renovacao_mes", "xoclub_portal", "livre",
] as const;

export type TemplateInput = {
  tipo: string;
  nivel_alvo: string | null;
  titulo: string;
  mensagem: string;
  ativo: boolean;
  ordem: number;
  banner_url?: string | null;
};

async function gate(): Promise<{ tenantId: string } | { erro: string }> {
  const sb = await createClient();
  const { data: u } = await sb.auth.getUser();
  if (!u?.user) return { erro: "Não autenticado" };
  const { data: t } = await sb.from("tenants").select("id").limit(1).maybeSingle();
  const tenantId = (t as { id: string } | null)?.id;
  return tenantId ? { tenantId } : { erro: "Tenant não encontrado" };
}

function validar(input: TemplateInput): string | null {
  if (!input.titulo.trim()) return "Título é obrigatório";
  if (!input.mensagem.trim()) return "Mensagem é obrigatória";
  if (!TIPOS_TEMPLATE.includes(input.tipo as (typeof TIPOS_TEMPLATE)[number])) return "Tipo inválido";
  if (input.tipo === "parabens_nivel" && !input.nivel_alvo) return "Mensagem de nível precisa do nível alvo";
  return null;
}

export async function salvarTemplate(
  id: string | null,
  input: TemplateInput,
): Promise<{ ok: boolean; id?: string; erro?: string }> {
  const g = await gate();
  if ("erro" in g) return { ok: false, erro: g.erro };
  const erro = validar(input);
  if (erro) return { ok: false, erro };

  const sb = createAdminClient();
  const row = {
    tipo: input.tipo,
    nivel_alvo: input.tipo === "parabens_nivel" ? input.nivel_alvo : null,
    titulo: input.titulo.trim(),
    mensagem: input.mensagem,
    ativo: input.ativo,
    ordem: input.ordem,
    banner_url: input.banner_url ?? null,
  };

  if (id) {
    const { error } = await sb.from("clube_templates_mensagem")
      .update(row).eq("id", id).eq("tenant_id", g.tenantId);
    if (error) return { ok: false, erro: error.message };
    revalidatePath("/publicidade");
    return { ok: true, id };
  }

  const { data, error } = await sb.from("clube_templates_mensagem")
    .insert({ ...row, tenant_id: g.tenantId })
    .select("id").single();
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/publicidade");
  return { ok: true, id: (data as { id: string }).id };
}

export async function excluirTemplate(id: string): Promise<{ ok: boolean; erro?: string }> {
  const g = await gate();
  if ("erro" in g) return { ok: false, erro: g.erro };
  const sb = createAdminClient();
  const { error } = await sb.from("clube_templates_mensagem")
    .delete().eq("id", id).eq("tenant_id", g.tenantId);
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/publicidade");
  return { ok: true };
}

export async function alternarAtivoTemplate(id: string, ativo: boolean): Promise<{ ok: boolean; erro?: string }> {
  const g = await gate();
  if ("erro" in g) return { ok: false, erro: g.erro };
  const sb = createAdminClient();
  const { error } = await sb.from("clube_templates_mensagem")
    .update({ ativo }).eq("id", id).eq("tenant_id", g.tenantId);
  if (error) return { ok: false, erro: error.message };
  revalidatePath("/publicidade");
  return { ok: true };
}

/** Upload do banner (PNG/JPEG/WebP/GIF até 4MB) → URL pública. */
export async function uploadBannerTemplate(formData: FormData): Promise<{ ok: boolean; url?: string; erro?: string }> {
  const g = await gate();
  if ("erro" in g) return { ok: false, erro: g.erro };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, erro: "Nenhum arquivo enviado" };
  if (file.size > 4 * 1024 * 1024) return { ok: false, erro: "Máximo 4MB" };
  const okTipos = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  if (!okTipos.includes(file.type)) return { ok: false, erro: "Use PNG, JPEG, WebP ou GIF" };

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${g.tenantId}/${crypto.randomUUID()}.${ext}`;
  const sb = createAdminClient();
  const { error } = await sb.storage.from("msg-banners")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) return { ok: false, erro: error.message };

  const { data } = sb.storage.from("msg-banners").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

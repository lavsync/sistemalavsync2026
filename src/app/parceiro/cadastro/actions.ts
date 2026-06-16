"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@mi/lib/supabase/server";
import { createAdminClient } from "@mi/lib/supabase/admin";
import { slugify } from "@mi/lib/utils";

export type ActionState = { ok: true } | { ok: false; error: string } | undefined;

interface CadastroInput {
  // Etapa 1
  responsible_name: string;
  responsible_cpf?: string;
  responsible_phone: string;
  responsible_email?: string;
  responsible_role?: string;
  // Etapa 2
  legal_name?: string;
  fantasy_name: string;
  cnpj?: string;
  company_type?: string;
  category_id: string;
  segment_label?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  google_maps_url?: string;
  instagram?: string;
  website?: string;
  whatsapp_business?: string;
  // Etapa 3
  objectives: string[];
  // Etapa 4
  logo_url?: string;
  cover_url?: string;
  brand_colors?: string;
  notes?: string;
  // Etapa 5
  terms_accepted: boolean;
}

export async function submitCadastroAction(input: CadastroInput): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada — faça login novamente" };
  if (!input.terms_accepted) return { ok: false, error: "Você precisa aceitar os termos" };

  // Tenant único do LavSync (consolidação Mídia Indoor)
  const TENANT_ID = "00000000-0000-0000-0000-000000000001";

  // Resolve unidade default (primeira ativa do banco — em produção: lookup por bairro/cidade)
  const admin = createAdminClient();
  const { data: defaultUnit } = await admin
    .from("mi_units")
    .select("id")
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (!defaultUnit) {
    return {
      ok: false,
      error: "Sistema ainda não tem unidade ativa. Aguarde o admin criar uma unidade.",
    };
  }

  const h = await headers();
  const clientIp =
    h.get("x-forwarded-for")?.split(",")[0].trim() ??
    h.get("x-real-ip") ??
    null;

  // Garante slug único
  const baseSlug = slugify(input.fantasy_name);
  let slug = baseSlug;
  let i = 1;
  while (true) {
    const { data: existing } = await admin
      .from("mi_partners")
      .select("id")
      .eq("unidade_id", defaultUnit.id)
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${++i}`;
  }

  const payload = {
    tenant_id: TENANT_ID,
    unidade_id: defaultUnit.id,
    category_id: input.category_id,
    slug,
    name: input.fantasy_name,
    status: "pendente" as const,
    plan: "gratuito" as const,
    // Responsável
    responsible_name: input.responsible_name,
    responsible_cpf: input.responsible_cpf ?? null,
    responsible_phone: input.responsible_phone,
    responsible_email: input.responsible_email ?? user.email ?? null,
    responsible_role: input.responsible_role ?? null,
    // Empresa
    legal_name: input.legal_name ?? null,
    cnpj: input.cnpj ?? null,
    company_type: input.company_type ?? null,
    segment_label: input.segment_label ?? null,
    address: input.address ?? null,
    neighborhood: input.neighborhood ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    postal_code: input.postal_code ?? null,
    google_maps_url: input.google_maps_url ?? null,
    instagram: input.instagram ?? null,
    website: input.website ?? null,
    whatsapp_business: input.whatsapp_business ?? null,
    whatsapp: input.whatsapp_business ?? input.responsible_phone,
    // Objetivos
    objectives: input.objectives,
    // Materiais
    logo_url: input.logo_url ?? null,
    cover_url: input.cover_url ?? null,
    materials: {
      brand_colors: input.brand_colors ?? null,
      notes: input.notes ?? null,
    },
    // Aceite
    terms_accepted_at: new Date().toISOString(),
    terms_accepted_ip: clientIp,
  };

  const { data: createdPartner, error } = await admin
    .from("mi_partners")
    .insert(payload)
    .select("id")
    .single<{ id: string }>();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Já existe um cadastro com esse CNPJ ou slug" };
    }
    return { ok: false, error: error.message };
  }

  // Vínculo usuário -> parceiro (substitui o antigo profiles.profile_id)
  await admin.from("mi_partner_users").upsert(
    {
      user_id: user.id,
      tenant_id: TENANT_ID,
      partner_id: createdPartner.id,
      email: user.email ?? input.responsible_email ?? "",
      full_name: input.responsible_name,
    },
    { onConflict: "user_id" },
  );

  revalidatePath("/parceiro/dashboard");
  revalidatePath("/publicidade/midia-indoor/parceiros");
  redirect("/parceiro/dashboard?welcome=1");
}

import { redirect } from "next/navigation";
import { createClient } from "@mi/lib/supabase/server";
import { createAdminClient } from "@mi/lib/supabase/admin";
import { getUnidadeAtivaId } from "@/lib/unidade-ativa";

// Tenant único do LavSync (consolidação Mídia Indoor).
const TENANT_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Garante usuário autenticado e retorna o partner vinculado via mi_partner_users.
 * Auto-vincula um partner pré-cadastrado pelo admin quando o login usa o mesmo
 * e-mail do responsável (responsible_email).
 */
export async function requirePartnerUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // vínculo usuário -> parceiro
  let { data: link } = await supabase
    .from("mi_partner_users")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  // cria o registro de vínculo se não existir
  if (!link) {
    const { data: created } = await admin
      .from("mi_partner_users")
      .upsert(
        {
          user_id: user.id,
          tenant_id: TENANT_ID,
          email: user.email ?? "",
          full_name: user.user_metadata?.full_name ?? null,
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();
    link = created ?? {
      user_id: user.id,
      tenant_id: TENANT_ID,
      partner_id: null,
      email: user.email ?? "",
      full_name: user.user_metadata?.full_name ?? null,
    };
  }

  // partner já vinculado?
  let partner = null;
  if (link?.partner_id) {
    const { data: p } = await supabase
      .from("mi_partners")
      .select("*")
      .eq("id", link.partner_id)
      .maybeSingle();
    partner = p ?? null;
  }

  // tenta casar por e-mail do responsável (admin pré-cadastrou)
  if (!partner && user.email) {
    const email = user.email.toLowerCase();
    const { data: candidate } = await admin
      .from("mi_partners")
      .select("*")
      .ilike("responsible_email", email)
      .limit(1)
      .maybeSingle();
    if (candidate) {
      await admin
        .from("mi_partner_users")
        .update({ partner_id: candidate.id })
        .eq("user_id", user.id);
      partner = candidate;
    }
  }

  const profile = {
    id: user.id,
    email: link?.email ?? user.email ?? "",
    full_name: link?.full_name ?? null,
    role: "parceiro" as const,
    unidade_id: partner?.unidade_id ?? (await getUnidadeAtivaId()),
  };

  return { user, profile, partner };
}

/** Páginas que exigem cadastro completo do parceiro. */
export async function requireCompletedPartner() {
  const result = await requirePartnerUser();
  if (!result.partner) {
    redirect("/parceiro/cadastro");
  }
  return { ...result, partner: result.partner };
}

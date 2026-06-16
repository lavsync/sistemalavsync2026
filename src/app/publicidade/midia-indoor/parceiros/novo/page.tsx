import { PageHeader } from "@mi/components/admin/page-header";
import { PartnerForm } from "../partner-form";
import { createClient } from "@mi/lib/supabase/server";
import { requireUser } from "@mi/lib/auth";

export const metadata = { title: "Novo parceiro" };

export default async function NovoParceiroPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const [{ data: categories }, { data: units }] = await Promise.all([
    supabase.from("mi_partner_categories").select("*").order("label"),
    profile.role === "master"
      ? supabase.from("mi_units").select("*").eq("is_active", true).order("name")
      : supabase.from("mi_units").select("*").eq("id", profile.unidade_id ?? "").order("name"),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Novo parceiro"
        description="Cadastre um comerciante local. Status inicial: pendente — aprove depois de revisar."
      />
      <PartnerForm
        categories={categories ?? []}
        units={units ?? []}
        role={profile.role}
        defaultUnitId={profile.unidade_id}
      />
    </div>
  );
}

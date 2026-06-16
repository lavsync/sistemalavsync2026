import { notFound } from "next/navigation";
import { PageHeader } from "@mi/components/admin/page-header";
import { Badge } from "@mi/components/ui/badge";
import { PartnerForm } from "../partner-form";
import { createClient } from "@mi/lib/supabase/server";
import { requireUser } from "@mi/lib/auth";

export const metadata = { title: "Editar parceiro" };

export default async function EditarParceiroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await requireUser();
  const supabase = await createClient();

  const [{ data: partner }, { data: categories }, { data: units }] = await Promise.all([
    supabase.from("mi_partners").select("*").eq("id", id).single(),
    supabase.from("mi_partner_categories").select("*").order("label"),
    profile.role === "master"
      ? supabase.from("mi_units").select("*").order("name")
      : supabase.from("mi_units").select("*").eq("id", profile.unidade_id ?? "").order("name"),
  ]);

  if (!partner) notFound();

  // Gestor só vê parceiros da própria unidade
  if (profile.role !== "master" && partner.unidade_id !== profile.unidade_id) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={partner.name}
        description={`Status: ${partner.status} · Plano: ${partner.plan}`}
        actions={<Badge>{partner.status}</Badge>}
      />
      <PartnerForm
        partner={partner}
        categories={categories ?? []}
        units={units ?? []}
        role={profile.role}
        defaultUnitId={profile.unidade_id}
      />
    </div>
  );
}

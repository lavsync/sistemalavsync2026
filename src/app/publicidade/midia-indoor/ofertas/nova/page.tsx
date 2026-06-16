import { PageHeader } from "@mi/components/admin/page-header";
import { OfferForm } from "../offer-form";
import { createClient } from "@mi/lib/supabase/server";
import { requireUser } from "@mi/lib/auth";
import type { Tables } from "@mi/types/database";

export const metadata = { title: "Nova oferta" };

export default async function NovaOfertaPage({
  searchParams,
}: {
  searchParams: Promise<{ partner?: string }>;
}) {
  const { profile } = await requireUser();
  const { partner: defaultPartnerId } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("mi_partners")
    .select("*, units:mi_units(name)")
    .eq("status", "ativo")
    .order("name");

  if (profile.role !== "master" && profile.unidade_id) {
    query = query.eq("unidade_id", profile.unidade_id);
  }

  const { data: partners } = await query;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Nova oferta"
        description="O QR Code é criado automaticamente vinculado a esta oferta."
      />
      <OfferForm
        partners={(partners as Array<Tables<"partners"> & { units?: { name: string } | null }>) ?? []}
        defaultPartnerId={defaultPartnerId}
      />
    </div>
  );
}

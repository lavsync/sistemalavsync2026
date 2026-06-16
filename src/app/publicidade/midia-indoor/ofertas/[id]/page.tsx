import { notFound } from "next/navigation";
import { PageHeader } from "@mi/components/admin/page-header";
import { Badge } from "@mi/components/ui/badge";
import { OfferForm } from "../offer-form";
import { createClient } from "@mi/lib/supabase/server";
import { requireUser } from "@mi/lib/auth";
import type { Tables } from "@mi/types/database";

export const metadata = { title: "Editar oferta" };

export default async function EditarOfertaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await requireUser();
  const supabase = await createClient();

  const [{ data: offer }, partnersRes] = await Promise.all([
    supabase.from("mi_offers").select("*").eq("id", id).single(),
    (() => {
      let q = supabase.from("mi_partners").select("*, units:mi_units(name)").order("name");
      if (profile.role !== "master" && profile.unidade_id) q = q.eq("unidade_id", profile.unidade_id);
      return q;
    })(),
  ]);

  if (!offer) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={offer.title}
        description={`Status: ${offer.status}`}
        actions={<Badge>{offer.status}</Badge>}
      />
      <OfferForm
        offer={offer}
        partners={(partnersRes.data as Array<Tables<"partners"> & { units?: { name: string } | null }>) ?? []}
      />
    </div>
  );
}

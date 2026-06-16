import { PageHeader } from "@mi/components/admin/page-header";
import { CampaignForm } from "../campaign-form";
import { createClient } from "@mi/lib/supabase/server";
import { requireUser } from "@mi/lib/auth";
import type { Tables } from "@mi/types/database";

export const metadata = { title: "Nova campanha" };

export default async function NovaCampanhaPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const [templatesRes, editorTplRes, unitsRes, partnersRes, offersRes] = await Promise.all([
    supabase.from("mi_templates").select("*").order("name"),
    (() => {
      let q = supabase
        .from("mi_editor_templates")
        .select("id, name, format, category")
        .eq("is_published", true)
        .order("updated_at", { ascending: false });
      if (profile.role !== "master" && profile.unidade_id) {
        q = q.or(`unidade_id.eq.${profile.unidade_id},unidade_id.is.null`);
      }
      return q;
    })(),
    profile.role === "master"
      ? supabase.from("mi_units").select("*").eq("is_active", true).order("name")
      : supabase.from("mi_units").select("*").eq("id", profile.unidade_id ?? "").order("name"),
    (() => {
      let q = supabase.from("mi_partners").select("*, units:mi_units(name)").eq("status", "ativo").order("name");
      if (profile.role !== "master" && profile.unidade_id) q = q.eq("unidade_id", profile.unidade_id);
      return q;
    })(),
    supabase.from("mi_offers").select("*").eq("status", "ativa").order("title"),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Nova campanha"
        description="A campanha será adicionada à playlist da TV quando estiver ativa."
      />
      <CampaignForm
        templates={templatesRes.data ?? []}
        editorTemplates={(editorTplRes.data ?? []) as Array<Pick<Tables<"editor_templates">, "id" | "name" | "format" | "category">>}
        units={unitsRes.data ?? []}
        partners={(partnersRes.data as Array<Tables<"partners"> & { units?: { name: string } | null }>) ?? []}
        offers={offersRes.data ?? []}
        role={profile.role}
        defaultUnitId={profile.unidade_id}
      />
    </div>
  );
}

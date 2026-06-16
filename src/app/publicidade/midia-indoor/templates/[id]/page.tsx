import { notFound } from "next/navigation";
import { createClient } from "@mi/lib/supabase/server";
import { requireUser } from "@mi/lib/auth";
import { rowToTemplate } from "../_components/row-to-template";
import { EditorShell } from "./editor-shell";

export const metadata = { title: "Editor de template" };

export default async function EditarTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await requireUser();
  const supabase = await createClient();

  const { data: row } = await supabase.from("mi_editor_templates").select("*").eq("id", id).single();
  if (!row) notFound();

  const template = rowToTemplate(row as Record<string, unknown>);

  if (profile.role !== "master" && template.unitId !== profile.unidade_id) {
    notFound();
  }

  return <EditorShell initialTemplate={template} />;
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@mi/lib/supabase/server";
import { requireUser } from "@mi/lib/auth";
import type { CanvasFormat, EditorBackground, EditorElement } from "@mi/types/editor";
import { CANVAS_PRESETS } from "@mi/types/editor";

export type ActionState = { ok: true; id?: string } | { ok: false; error: string } | undefined;

interface SaveTemplateInput {
  id?: string;
  name: string;
  format: CanvasFormat;
  background: EditorBackground;
  elements: EditorElement[];
  durationSeconds: number;
  category: string;
}

export async function saveTemplateAction(input: SaveTemplateInput): Promise<ActionState> {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const dims = CANVAS_PRESETS[input.format];
  const payload = {
    name: input.name,
    format: input.format,
    width: dims.width,
    height: dims.height,
    background: input.background as unknown as Record<string, unknown>,
    elements: input.elements as unknown as Record<string, unknown>[],
    duration_seconds: input.durationSeconds,
    category: input.category,
    unidade_id: profile.unidade_id,
    motion: { enterDuration: 600, exitDuration: 400 } as Record<string, unknown>,
  };

  if (input.id) {
    const { error } = await supabase.from("mi_editor_templates").update(payload).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/publicidade/midia-indoor/templates");
    revalidatePath(`/publicidade/midia-indoor/templates/${input.id}`);
    return { ok: true, id: input.id };
  }

  const { data, error } = await supabase
    .from("mi_editor_templates")
    .insert({ ...payload, created_by: profile.id })
    .select("id")
    .single<{ id: string }>();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/publicidade/midia-indoor/templates");
  return { ok: true, id: data.id };
}

export async function duplicateTemplateAction(id: string): Promise<ActionState> {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const { data: src, error: fetchErr } = await supabase
    .from("mi_editor_templates")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr || !src) return { ok: false, error: fetchErr?.message ?? "Não encontrado" };

  const row = src as Record<string, unknown>;
  const insertPayload: Record<string, unknown> = {
    ...row,
    name: `${row.name as string} (cópia)`,
    is_published: false,
    created_by: profile.id,
  };
  delete insertPayload.id;
  delete insertPayload.created_at;
  delete insertPayload.updated_at;

  const { data: created, error } = await supabase
    .from("mi_editor_templates")
    .insert(insertPayload)
    .select("id")
    .single<{ id: string }>();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/publicidade/midia-indoor/templates");
  return { ok: true, id: created.id };
}

export async function publishTemplateAction(id: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("mi_editor_templates").update({ is_published: true }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/publicidade/midia-indoor/templates");
  revalidatePath(`/publicidade/midia-indoor/templates/${id}`);
  return { ok: true };
}

export async function unpublishTemplateAction(id: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("mi_editor_templates").update({ is_published: false }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/publicidade/midia-indoor/templates");
  return { ok: true };
}

export async function deleteTemplateAction(id: string): Promise<ActionState> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("mi_editor_templates").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/publicidade/midia-indoor/templates");
  redirect("/publicidade/midia-indoor/templates");
}


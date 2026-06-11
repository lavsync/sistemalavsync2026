"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Frequencia, Criticidade, ImpactoFin } from "./queries";

export type RoutineInput = {
  titulo: string;
  descricao?: string | null;
  codigo?: string | null;
  category_id?: string | null;
  org_unit_id?: string | null;
  unidade_id?: string | null;
  frequencia: Frequencia;
  criticidade: Criticidade;
  impacto_financeiro?: ImpactoFin;
  operational_weight?: number;
  estimated_minutes?: number | null;
  sla_ideal_minutes?: number | null;
  sla_max_minutes?: number | null;
  horario_alvo?: string | null;
  dias_semana?: number[] | null;
  responsavel_id?: string | null;
  backup_id?: string | null;
  escalation_id?: string | null;
  kpis?: string[];
  ativo?: boolean;
};

export async function criarRotina(input: RoutineInput): Promise<{ id: string }> {
  const sb = await createClient();
  const { data: tenant } = await sb.from("tenants").select("id").limit(1).maybeSingle();
  if (!tenant) throw new Error("Tenant não encontrado");
  const { data, error } = await sb.from("corp_routines").insert({
    ...input,
    tenant_id: (tenant as { id: string }).id,
    operational_weight: input.operational_weight ?? 5,
    impacto_financeiro: input.impacto_financeiro ?? "baixo",
    kpis: input.kpis ?? [],
  }).select("id").single();
  if (error) throw error;
  revalidatePath("/rotinas-corporativas");
  return { id: (data as { id: string }).id };
}

export async function atualizarRotina(id: string, patch: Partial<RoutineInput>): Promise<void> {
  const sb = await createClient();
  const { error } = await sb.from("corp_routines")
    .update({ ...patch, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/rotinas-corporativas");
}

export async function excluirRotina(id: string): Promise<void> {
  const sb = await createClient();
  const { error } = await sb.from("corp_routines").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/rotinas-corporativas");
}

// ─── TEMPLATES (biblioteca) ─────────────────────────────────────
export type TemplateInput = {
  pack: string;
  codigo: string;
  titulo: string;
  descricao?: string | null;
  category_code?: string | null;
  role_unit_code?: string | null;
  frequencia: Frequencia;
  criticidade: Criticidade;
  estimated_minutes?: number | null;
  sla_ideal_minutes?: number | null;
  sla_max_minutes?: number | null;
  impacto_financeiro?: ImpactoFin;
  horario_alvo?: string | null;
  dias_semana?: number[] | null;
  kpis?: string[];
  steps?: Array<{ ordem: number; titulo: string; descricao?: string; obrigatorio?: boolean }>;
  ordem?: number;
};

export async function salvarTemplate(id: string | null, input: TemplateInput): Promise<{ id: string }> {
  const sb = await createClient();
  if (id) {
    const { error } = await sb.from("corp_routine_templates").update(input).eq("id", id);
    if (error) throw error;
    revalidatePath("/rotinas-corporativas");
    return { id };
  }
  const { data: tenant } = await sb.from("tenants").select("id").limit(1).maybeSingle();
  if (!tenant) throw new Error("Tenant não encontrado");
  const { data, error } = await sb.from("corp_routine_templates").insert({
    ...input,
    tenant_id: (tenant as { id: string }).id,
    kpis: input.kpis ?? [],
    steps: input.steps ?? [],
  }).select("id").single();
  if (error) throw error;
  revalidatePath("/rotinas-corporativas");
  return { id: (data as { id: string }).id };
}

export async function excluirTemplate(id: string): Promise<void> {
  const sb = await createClient();
  const { error } = await sb.from("corp_routine_templates").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/rotinas-corporativas");
}

// ─── AÇÕES EM MASSA NAS ROTINAS ─────────────────────────────────
export async function atribuirResponsavelLote(rotinaIds: string[], usuarioId: string | null): Promise<{ atualizadas: number }> {
  if (rotinaIds.length === 0) return { atualizadas: 0 };
  const sb = await createClient();
  const { error, count } = await sb.from("corp_routines")
    .update({ responsavel_id: usuarioId, atualizado_em: new Date().toISOString() }, { count: "exact" })
    .in("id", rotinaIds);
  if (error) throw error;
  revalidatePath("/rotinas-corporativas");
  return { atualizadas: count ?? 0 };
}

export async function ativarDesativarLote(rotinaIds: string[], ativo: boolean): Promise<{ atualizadas: number }> {
  if (rotinaIds.length === 0) return { atualizadas: 0 };
  const sb = await createClient();
  const { error, count } = await sb.from("corp_routines")
    .update({ ativo, atualizado_em: new Date().toISOString() }, { count: "exact" })
    .in("id", rotinaIds);
  if (error) throw error;
  revalidatePath("/rotinas-corporativas");
  return { atualizadas: count ?? 0 };
}

export async function excluirRotinasLote(rotinaIds: string[]): Promise<{ excluidas: number }> {
  if (rotinaIds.length === 0) return { excluidas: 0 };
  const sb = await createClient();
  const { error, count } = await sb.from("corp_routines")
    .delete({ count: "exact" })
    .in("id", rotinaIds);
  if (error) throw error;
  revalidatePath("/rotinas-corporativas");
  return { excluidas: count ?? 0 };
}

/** Importa templates selecionados para corp_routines + steps */
export async function importarTemplates(templateIds: string[]): Promise<{ importadas: number }> {
  if (templateIds.length === 0) return { importadas: 0 };
  const sb = await createClient();
  const { data: tenant } = await sb.from("tenants").select("id").limit(1).maybeSingle();
  if (!tenant) throw new Error("Tenant não encontrado");
  const tenantId = (tenant as { id: string }).id;

  type Tpl = {
    id: string; pack: string; codigo: string; titulo: string; descricao: string | null;
    category_code: string | null; role_unit_code: string | null;
    frequencia: Frequencia; criticidade: Criticidade;
    estimated_minutes: number | null; sla_ideal_minutes: number | null; sla_max_minutes: number | null;
    impacto_financeiro: ImpactoFin; horario_alvo: string | null; dias_semana: number[] | null;
    kpis: string[] | null;
    steps: Array<{ ordem: number; titulo: string; descricao?: string; obrigatorio?: boolean }> | null;
  };
  const { data: tpls } = await sb.from("corp_routine_templates")
    .select("*")
    .in("id", templateIds);
  const templates = (tpls ?? []) as Tpl[];
  if (templates.length === 0) return { importadas: 0 };

  // Carrega mapas de category_code → id e org_unit_code → id
  const { data: cats } = await sb.from("corp_categories").select("id, codigo");
  const catMap = new Map(((cats ?? []) as Array<{ id: string; codigo: string }>).map((c) => [c.codigo, c.id]));

  const { data: orgs } = await sb.from("corp_org_units").select("id, codigo");
  const orgMap = new Map(((orgs ?? []) as Array<{ id: string; codigo: string }>).map((o) => [o.codigo, o.id]));

  // Carrega códigos já existentes pra deduplicar
  const codigosAlvo = templates.map((t) => t.codigo);
  const { data: existentes } = await sb.from("corp_routines")
    .select("codigo")
    .in("codigo", codigosAlvo);
  const existSet = new Set(((existentes ?? []) as Array<{ codigo: string | null }>).map((r) => r.codigo).filter(Boolean));

  const inseridas: Array<{ tplId: string; routineId: string; steps: Tpl["steps"] }> = [];
  for (const t of templates) {
    if (existSet.has(t.codigo)) continue;
    const { data: r, error } = await sb.from("corp_routines").insert({
      tenant_id: tenantId,
      org_unit_id: t.role_unit_code ? orgMap.get(t.role_unit_code) ?? null : null,
      category_id: t.category_code ? catMap.get(t.category_code) ?? null : null,
      codigo: t.codigo,
      titulo: t.titulo,
      descricao: t.descricao,
      frequencia: t.frequencia,
      criticidade: t.criticidade,
      impacto_financeiro: t.impacto_financeiro,
      operational_weight: 5,
      estimated_minutes: t.estimated_minutes,
      sla_ideal_minutes: t.sla_ideal_minutes,
      sla_max_minutes: t.sla_max_minutes,
      horario_alvo: t.horario_alvo,
      dias_semana: t.dias_semana,
      kpis: t.kpis ?? [],
      ativo: true,
    }).select("id").single();
    if (error) continue;
    inseridas.push({ tplId: t.id, routineId: (r as { id: string }).id, steps: t.steps });
  }

  // Insere steps em batch
  for (const ins of inseridas) {
    if (!ins.steps || ins.steps.length === 0) continue;
    const stepsRows = ins.steps.map((s) => ({
      routine_id: ins.routineId,
      ordem: s.ordem ?? 0,
      titulo: s.titulo,
      descricao: s.descricao ?? null,
      obrigatorio: s.obrigatorio ?? true,
    }));
    await sb.from("corp_routine_steps").insert(stepsRows);
  }

  revalidatePath("/rotinas-corporativas");
  return { importadas: inseridas.length };
}

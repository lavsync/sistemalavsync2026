import "server-only";
import { createClient } from "@/lib/supabase/server";
import { paginarTodos } from "@/lib/supabase/pagination";

export type Frequencia = "continua" | "diaria" | "semanal" | "quinzenal" | "mensal" | "trimestral" | "sazonal" | "evento" | "contingencia" | "automatica";
export type Criticidade = "baixa" | "media" | "alta" | "critica" | "estrategica" | "emergencial";
export type ImpactoFin = "nenhum" | "baixo" | "medio" | "alto" | "critico";
export type UnitType = "rede" | "diretoria" | "operacao" | "unidade" | "funcao";

export type OrgUnit = {
  id: string;
  parent_id: string | null;
  unit_type: UnitType;
  codigo: string;
  nome: string;
  descricao: string | null;
  color: string | null;
  ordem: number;
  lead_member_id: string | null;
  unidade_real_id: string | null;
  ativo: boolean;
  children?: OrgUnit[];
};

export type Categoria = {
  id: string;
  codigo: string;
  nome: string;
  color: string | null;
  icon: string | null;
  ordem: number;
};

export type RoutineTemplate = {
  id: string;
  pack: string;
  codigo: string;
  titulo: string;
  descricao: string | null;
  category_code: string | null;
  role_unit_code: string | null;
  frequencia: Frequencia;
  criticidade: Criticidade;
  estimated_minutes: number | null;
  sla_ideal_minutes: number | null;
  sla_max_minutes: number | null;
  impacto_financeiro: ImpactoFin;
  horario_alvo: string | null;
  dias_semana: number[] | null;
  kpis: string[];
  steps: Array<{ ordem: number; titulo: string; descricao?: string; obrigatorio?: boolean }>;
  ordem: number;
  already_imported?: boolean;
};

export type Routine = {
  id: string;
  unidade_id: string | null;
  unidade_nome: string | null;
  org_unit_id: string | null;
  org_unit_nome: string | null;
  category_id: string | null;
  category_nome: string | null;
  category_color: string | null;
  codigo: string | null;
  titulo: string;
  descricao: string | null;
  frequencia: Frequencia;
  criticidade: Criticidade;
  impacto_financeiro: ImpactoFin;
  operational_weight: number;
  estimated_minutes: number | null;
  sla_ideal_minutes: number | null;
  sla_max_minutes: number | null;
  horario_alvo: string | null;
  dias_semana: number[] | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  kpis: string[];
  ativo: boolean;
  criado_em: string;
};

export async function getOrgTree(): Promise<OrgUnit[]> {
  const sb = await createClient();
  const { data } = await sb.from("corp_org_units")
    .select("*")
    .eq("ativo", true)
    .order("ordem");
  const items = (data ?? []) as OrgUnit[];
  const map = new Map<string, OrgUnit>();
  for (const u of items) map.set(u.id, { ...u, children: [] });
  const roots: OrgUnit[] = [];
  for (const u of items) {
    const node = map.get(u.id)!;
    if (u.parent_id && map.has(u.parent_id)) {
      map.get(u.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function listarCategorias(): Promise<Categoria[]> {
  const sb = await createClient();
  const { data } = await sb.from("corp_categories").select("*").order("ordem");
  return (data ?? []) as Categoria[];
}

export async function listarTemplates(): Promise<RoutineTemplate[]> {
  const sb = await createClient();
  const { data: tpls } = await sb.from("corp_routine_templates").select("*").order("ordem");
  const templates = (tpls ?? []) as RoutineTemplate[];
  // Marca já importadas (por código)
  const { data: imported } = await sb.from("corp_routines").select("codigo");
  const importedSet = new Set(((imported ?? []) as Array<{ codigo: string | null }>).map((r) => r.codigo).filter(Boolean));
  return templates.map((t) => ({ ...t, already_imported: importedSet.has(t.codigo) }));
}

export async function listarRotinas(unidadeIds?: string[]): Promise<Routine[]> {
  const sb = await createClient();
  type Raw = {
    id: string; unidade_id: string | null; org_unit_id: string | null; category_id: string | null;
    codigo: string | null; titulo: string; descricao: string | null;
    frequencia: Frequencia; criticidade: Criticidade; impacto_financeiro: ImpactoFin;
    operational_weight: number; estimated_minutes: number | null;
    sla_ideal_minutes: number | null; sla_max_minutes: number | null;
    horario_alvo: string | null; dias_semana: number[] | null;
    responsavel_id: string | null; kpis: string[] | null; ativo: boolean; criado_em: string;
    unidade: { nome: string } | Array<{ nome: string }> | null;
    org: { nome: string } | Array<{ nome: string }> | null;
    cat: { nome: string; color: string | null } | Array<{ nome: string; color: string | null }> | null;
    resp: { nome: string } | Array<{ nome: string }> | null;
  };
  const rows = await paginarTodos<Raw>((r) => {
    let q = sb.from("corp_routines")
      .select(`
        id, unidade_id, org_unit_id, category_id, codigo, titulo, descricao,
        frequencia, criticidade, impacto_financeiro, operational_weight,
        estimated_minutes, sla_ideal_minutes, sla_max_minutes,
        horario_alvo, dias_semana, responsavel_id, kpis, ativo, criado_em,
        unidade:unidades(nome),
        org:corp_org_units(nome),
        cat:corp_categories(nome, color),
        resp:usuarios!corp_routines_responsavel_id_fkey(nome)
      `)
      .order("criado_em", { ascending: false })
      .range(r.from, r.to);
    if (unidadeIds && unidadeIds.length > 0) q = q.in("unidade_id", unidadeIds);
    return q;
  });

  return rows.map((r) => {
    const und = Array.isArray(r.unidade) ? r.unidade[0] : r.unidade;
    const org = Array.isArray(r.org) ? r.org[0] : r.org;
    const cat = Array.isArray(r.cat) ? r.cat[0] : r.cat;
    const resp = Array.isArray(r.resp) ? r.resp[0] : r.resp;
    return {
      ...r,
      kpis: r.kpis ?? [],
      unidade_nome: und?.nome ?? null,
      org_unit_nome: org?.nome ?? null,
      category_nome: cat?.nome ?? null,
      category_color: cat?.color ?? null,
      responsavel_nome: resp?.nome ?? null,
    };
  });
}

export type DashboardRotinas = {
  total_rotinas: number;
  ativas: number;
  por_categoria: Array<{ nome: string; color: string | null; qtd: number }>;
  por_frequencia: Record<Frequencia, number>;
  por_criticidade: Record<Criticidade, number>;
  sem_responsavel: number;
  criticas_sem_backup: number;
};

export async function getDashboardRotinas(): Promise<DashboardRotinas> {
  const rotinas = await listarRotinas();
  const porCategoria = new Map<string, { color: string | null; qtd: number }>();
  const porFreq: Record<Frequencia, number> = {
    continua: 0, diaria: 0, semanal: 0, quinzenal: 0, mensal: 0,
    trimestral: 0, sazonal: 0, evento: 0, contingencia: 0, automatica: 0,
  };
  const porCrit: Record<Criticidade, number> = {
    baixa: 0, media: 0, alta: 0, critica: 0, estrategica: 0, emergencial: 0,
  };
  let semResp = 0;
  for (const r of rotinas) {
    porFreq[r.frequencia] = (porFreq[r.frequencia] ?? 0) + 1;
    porCrit[r.criticidade] = (porCrit[r.criticidade] ?? 0) + 1;
    const nomeCat = r.category_nome ?? "Sem categoria";
    const cur = porCategoria.get(nomeCat) ?? { color: r.category_color, qtd: 0 };
    cur.qtd += 1;
    porCategoria.set(nomeCat, cur);
    if (!r.responsavel_id) semResp += 1;
  }
  return {
    total_rotinas: rotinas.length,
    ativas: rotinas.filter((r) => r.ativo).length,
    por_categoria: Array.from(porCategoria.entries())
      .map(([nome, v]) => ({ nome, color: v.color, qtd: v.qtd }))
      .sort((a, b) => b.qtd - a.qtd),
    por_frequencia: porFreq,
    por_criticidade: porCrit,
    sem_responsavel: semResp,
    criticas_sem_backup: 0,
  };
}

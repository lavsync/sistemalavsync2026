import type { Tables, UserRole } from "@mi/types/database";

/**
 * Sistema de permissões granular por módulo.
 *
 * Como funciona:
 * - Cada profile tem `role` (master/gestor/parceiro) + `permissions` (jsonb array).
 * - Se `permissions` está vazio, aplica o default da role.
 * - Se `permissions` está populado, é a lista exclusiva de módulos visíveis.
 * - Master sempre tem acesso total (não é filtrado por permissions).
 */

export const MODULES = [
  "dashboard",
  "unidades",
  "parceiros",
  "ofertas",
  "campanhas",
  "leads",
  "qr-codes",
  "metricas",
  "templates",
  "clube",
  "configuracoes",
] as const;

export type ModuleSlug = (typeof MODULES)[number];

export const MODULE_LABELS: Record<ModuleSlug, string> = {
  dashboard: "Dashboard",
  unidades: "Unidades",
  parceiros: "Parceiros",
  ofertas: "Ofertas",
  campanhas: "Campanhas",
  leads: "Leads",
  "qr-codes": "QR Codes",
  metricas: "Métricas",
  templates: "Templates",
  clube: "Clube de Benefícios",
  configuracoes: "Configurações",
};

export const MODULE_DESCRIPTIONS: Record<ModuleSlug, string> = {
  dashboard: "Visão geral, KPIs principais",
  unidades: "Cadastro de lavanderias",
  parceiros: "Cadastro e aprovação de parceiros",
  ofertas: "Ofertas e cupons do clube",
  campanhas: "Mídia indoor — campanhas nas TVs",
  leads: "Captura de leads via QR",
  "qr-codes": "Geração e rastreio de QR Codes",
  metricas: "Relatórios analíticos avançados",
  templates: "Edição de templates de banner",
  clube: "Clube de Benefícios (admin)",
  configuracoes: "Usuários, permissões, integrações",
};

const ROLE_DEFAULTS: Record<UserRole, ModuleSlug[]> = {
  master: [...MODULES],
  gestor: [
    "dashboard",
    "unidades",
    "parceiros",
    "ofertas",
    "campanhas",
    "leads",
    "qr-codes",
    "metricas",
  ],
  parceiro: [],
};

type ProfileLike = Pick<Tables<"profiles">, "role" | "permissions">;

function permissionsList(profile: ProfileLike): ModuleSlug[] {
  const raw = profile.permissions;
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is ModuleSlug =>
    (MODULES as readonly string[]).includes(p as string),
  );
}

/**
 * Lista efetiva de módulos que o profile pode acessar.
 */
export function effectivePermissions(profile: ProfileLike): ModuleSlug[] {
  if (profile.role === "master") return [...MODULES];
  const custom = permissionsList(profile);
  if (custom.length > 0) return custom;
  return ROLE_DEFAULTS[profile.role] ?? [];
}

/**
 * O profile pode acessar este módulo?
 */
export function canAccess(profile: ProfileLike, module: ModuleSlug): boolean {
  if (profile.role === "master") return true;
  const list = effectivePermissions(profile);
  return list.includes(module);
}

/**
 * Default de permissões (sugestão da role) — usado pra pré-marcar UI.
 */
export function roleDefaultPermissions(role: UserRole): ModuleSlug[] {
  return [...(ROLE_DEFAULTS[role] ?? [])];
}

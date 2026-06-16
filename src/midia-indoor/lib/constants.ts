export const APP_NAME = "Conexão Local Xô Varal";
export const APP_TAGLINE = "Benefícios do bairro para quem lava com a gente.";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://sistema.lavsync.com.br";

export const PUBLIC_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://sistema.lavsync.com.br";

export const PARTNER_CATEGORIES = [
  { slug: "alimentacao", label: "Alimentação" },
  { slug: "estetica", label: "Estética" },
  { slug: "academia", label: "Academia" },
  { slug: "pet-shop", label: "Pet Shop" },
  { slug: "farmacia", label: "Farmácia" },
  { slug: "mercado", label: "Mercado" },
  { slug: "moda", label: "Moda" },
  { slug: "servicos", label: "Serviços" },
  { slug: "saude", label: "Saúde" },
  { slug: "educacao", label: "Educação" },
  { slug: "automotivo", label: "Automotivo" },
  { slug: "outros", label: "Outros" },
] as const;

export const PARTNER_PLANS = [
  { slug: "gratuito", label: "Gratuito", priorityWeight: 1 },
  { slug: "destaque", label: "Destaque", priorityWeight: 2 },
  { slug: "premium", label: "Premium", priorityWeight: 3 },
] as const;

export const CAMPAIGN_PRIORITIES = ["normal", "destaque", "premium"] as const;
export type CampaignPriority = (typeof CAMPAIGN_PRIORITIES)[number];

export const PRIORITY_WEIGHTS: Record<CampaignPriority, number> = {
  normal: 1,
  destaque: 2,
  premium: 3,
};

export const TEMPLATE_TYPES = [
  { slug: "oferta-parceiro", label: "Oferta Parceiro" },
  { slug: "clube-beneficios", label: "Clube de Benefícios" },
  { slug: "institucional", label: "Institucional Xô Varal" },
  { slug: "ranking-cliente", label: "Ranking Cliente" },
  { slug: "parceiros-bairro", label: "Parceiros do Bairro" },
  { slug: "campanha-sazonal", label: "Campanha Sazonal" },
] as const;

export const USER_ROLES = ["master", "gestor", "parceiro"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PLAYER_SLIDE_DURATION_MS = 15_000;
export const CLUB_INTERVAL_SLIDES = 5;

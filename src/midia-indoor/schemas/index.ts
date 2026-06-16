import { z } from "zod";

const slugSchema = z
  .string()
  .min(2, "Slug muito curto")
  .max(64, "Slug muito longo")
  .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens");

const phoneSchema = z
  .string()
  .min(10, "Telefone inválido")
  .max(20, "Telefone inválido");

export const unitSchema = z.object({
  slug: slugSchema,
  name: z.string().min(2).max(120),
  address: z.string().max(255).optional().nullable(),
  neighborhood: z.string().max(120).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(2).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  whatsapp: phoneSchema.optional().nullable(),
  instagram: z.string().max(120).optional().nullable(),
  opening_hours: z.string().max(255).optional().nullable(),
  is_active: z.boolean().default(true),
});
export type UnitInput = z.infer<typeof unitSchema>;

export const partnerSchema = z.object({
  unidade_id: z.string().uuid(),
  category_id: z.string().uuid(),
  slug: slugSchema,
  name: z.string().min(2).max(120),
  logo_url: z.string().url().optional().nullable(),
  cover_url: z.string().url().optional().nullable(),
  short_description: z.string().max(280).optional().nullable(),
  full_description: z.string().max(2000).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  neighborhood: z.string().max(120).optional().nullable(),
  whatsapp: phoneSchema.optional().nullable(),
  instagram: z.string().max(120).optional().nullable(),
  website: z.string().url().optional().nullable(),
  external_link: z.string().url().optional().nullable(),
  plan: z.enum(["gratuito", "destaque", "premium"]).default("gratuito"),
  status: z
    .enum(["pendente", "ativo", "pausado", "removido"])
    .default("pendente"),
});
export type PartnerInput = z.infer<typeof partnerSchema>;

export const offerSchema = z.object({
  partner_id: z.string().uuid(),
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional().nullable(),
  banner_url: z.string().url().optional().nullable(),
  coupon: z.string().max(40).optional().nullable(),
  terms: z.string().max(2000).optional().nullable(),
  main_call: z.string().max(120).optional().nullable(),
  cta_label: z.string().max(40).optional().nullable(),
  cta_url: z.string().url().optional().nullable(),
  whatsapp_url: z.string().url().optional().nullable(),
  starts_at: z.string().datetime().optional().nullable(),
  expires_at: z.string().datetime().optional().nullable(),
  is_featured: z.boolean().default(false),
  status: z.enum(["ativa", "inativa", "expirada"]).default("ativa"),
});
export type OfferInput = z.infer<typeof offerSchema>;

export const campaignSchema = z.object({
  unidade_id: z.string().uuid(),
  partner_id: z.string().uuid().optional().nullable(),
  offer_id: z.string().uuid().optional().nullable(),
  template_id: z.string().uuid().optional().nullable(),
  editor_template_id: z.string().uuid().optional().nullable(),
  name: z.string().min(2).max(120),
  type: z.string().max(40).default("padrao"),
  priority: z.enum(["normal", "destaque", "premium"]).default("normal"),
  duration_seconds: z.number().int().min(5).max(60).default(15),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
  status: z
    .enum(["rascunho", "ativa", "pausada", "expirada"])
    .default("rascunho"),
  headline: z.string().max(120).optional().nullable(),
  subheadline: z.string().max(200).optional().nullable(),
  cta_label: z.string().max(40).optional().nullable(),
  cta_url: z.string().url().optional().nullable(),
  media_url: z.string().url().optional().nullable(),
  media_type: z.enum(["image", "video"]).optional().nullable(),
});
export type CampaignInput = z.infer<typeof campaignSchema>;

export const clubMemberSchema = z.object({
  unidade_id: z.string().uuid(),
  full_name: z.string().min(2).max(120),
  phone: phoneSchema,
  email: z.string().email().optional().nullable(),
  birthdate: z.string().optional().nullable(),
  neighborhood: z.string().max(120).optional().nullable(),
  accepted_terms: z.literal(true, {
    message: "É necessário aceitar os termos",
  }),
});
export type ClubMemberInput = z.infer<typeof clubMemberSchema>;

export const partnerLeadSchema = z.object({
  unidade_id: z.string().uuid(),
  responsible_name: z.string().min(2).max(120),
  business_name: z.string().min(2).max(120),
  segment: z.string().max(60).optional().nullable(),
  whatsapp: phoneSchema,
  instagram: z.string().max(120).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  benefit_proposal: z.string().max(500).optional().nullable(),
  message: z.string().max(1000).optional().nullable(),
});
export type PartnerLeadInput = z.infer<typeof partnerLeadSchema>;

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});
export type LoginInput = z.infer<typeof loginSchema>;

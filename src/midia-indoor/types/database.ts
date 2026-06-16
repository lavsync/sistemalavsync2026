/**
 * Tipagem do banco (compatível com supabase-js 2.x).
 * Cada tabela precisa de `Relationships: []` para o type-checker reconhecer.
 *
 * Regenerar via CLI:
 *   npx supabase gen types typescript --project-id mnonhgeumgsksnppwyuo > src/types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "master" | "gestor" | "parceiro";
export type CampaignPriority = "normal" | "destaque" | "premium";
export type CampaignStatus = "rascunho" | "ativa" | "pausada" | "expirada";
export type PartnerStatus = "pendente" | "ativo" | "pausado" | "removido";
export type PartnerPlan = "gratuito" | "destaque" | "premium";
export type OfferStatus = "ativa" | "inativa" | "expirada";
export type LeadStatus = "novo" | "em_analise" | "aprovado" | "rejeitado";
export type TemplateSlug =
  | "oferta-parceiro"
  | "clube-beneficios"
  | "institucional"
  | "ranking-cliente"
  | "parceiros-bairro"
  | "campanha-sazonal";

// ─── Rows ────────────────────────────────────────────────────────────────────

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  unidade_id: string | null;
  partner_id: string | null;
  avatar_url: string | null;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

interface UnitRow {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  opening_hours: string | null;
  is_active: boolean;
  public_url: string | null;
  player_url: string | null;
  player_token: string;
  created_at: string;
  updated_at: string;
}

interface PartnerCategoryRow {
  id: string;
  slug: string;
  label: string;
  icon: string | null;
  created_at: string;
}

interface PartnerRow {
  id: string;
  unidade_id: string;
  category_id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  cover_url: string | null;
  short_description: string | null;
  full_description: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  google_maps_url: string | null;
  whatsapp: string | null;
  whatsapp_business: string | null;
  instagram: string | null;
  website: string | null;
  external_link: string | null;
  plan: PartnerPlan;
  status: PartnerStatus;
  responsible_name: string | null;
  responsible_cpf: string | null;
  responsible_phone: string | null;
  responsible_email: string | null;
  responsible_role: string | null;
  legal_name: string | null;
  cnpj: string | null;
  company_type: string | null;
  segment_label: string | null;
  objectives: Json;
  materials: Json;
  terms_accepted_at: string | null;
  terms_accepted_ip: string | null;
  profile_id: string | null;
  created_at: string;
  updated_at: string;
}

interface OfferRow {
  id: string;
  partner_id: string;
  title: string;
  description: string | null;
  banner_url: string | null;
  coupon: string | null;
  terms: string | null;
  main_call: string | null;
  cta_label: string | null;
  cta_url: string | null;
  whatsapp_url: string | null;
  starts_at: string | null;
  expires_at: string | null;
  is_featured: boolean;
  status: OfferStatus;
  created_at: string;
  updated_at: string;
}

interface TemplateRow {
  id: string;
  slug: TemplateSlug;
  name: string;
  description: string | null;
  config: Json;
  is_system: boolean;
  created_at: string;
}

interface CampaignRow {
  id: string;
  unidade_id: string;
  partner_id: string | null;
  offer_id: string | null;
  template_id: string;
  editor_template_id: string | null;
  name: string;
  type: string;
  priority: CampaignPriority;
  duration_seconds: number;
  starts_at: string | null;
  ends_at: string | null;
  status: CampaignStatus;
  headline: string | null;
  subheadline: string | null;
  cta_label: string | null;
  cta_url: string | null;
  media_url: string | null;
  media_type: "image" | "video" | null;
  qr_code_id: string | null;
  extra: Json;
  created_at: string;
  updated_at: string;
}

interface ClubMemberRow {
  id: string;
  unidade_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  birthdate: string | null;
  neighborhood: string | null;
  accepted_terms: boolean;
  created_at: string;
}

interface PartnerLeadRow {
  id: string;
  unidade_id: string;
  responsible_name: string;
  business_name: string;
  segment: string | null;
  whatsapp: string;
  instagram: string | null;
  address: string | null;
  benefit_proposal: string | null;
  message: string | null;
  status: LeadStatus;
  created_at: string;
  updated_at: string;
}

interface QrCodeRow {
  id: string;
  unidade_id: string;
  target_url: string;
  short_code: string;
  purpose: string;
  partner_id: string | null;
  offer_id: string | null;
  campaign_id: string | null;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string | null;
  utm_content: string | null;
  created_at: string;
}

interface PlayerSessionRow {
  id: string;
  unidade_id: string;
  last_heartbeat: string;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
}

interface CampaignImpressionRow {
  id: string;
  campaign_id: string;
  unidade_id: string;
  session_id: string | null;
  shown_at: string;
}

interface QrClickRow {
  id: string;
  qr_code_id: string;
  unidade_id: string;
  user_agent: string | null;
  referer: string | null;
  ip_hash: string | null;
  clicked_at: string;
}

interface SettingRow {
  key: string;
  value: Json;
  updated_at: string;
}

interface EditorTemplateRow {
  id: string;
  unidade_id: string | null;
  partner_id: string | null;
  linked_offer_id: string | null;
  name: string;
  format: "horizontal" | "vertical";
  width: number;
  height: number;
  background: Json;
  elements: Json;
  motion: Json;
  duration_seconds: number;
  is_published: boolean;
  thumbnail_url: string | null;
  category: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Database (compatível com supabase-js 2.x) ───────────────────────────────

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: { id: string; email: string } & Partial<Omit<ProfileRow, "id" | "email">>;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      units: {
        Row: UnitRow;
        Insert: { slug: string; name: string } & Partial<Omit<UnitRow, "slug" | "name">>;
        Update: Partial<UnitRow>;
        Relationships: [];
      };
      partner_categories: {
        Row: PartnerCategoryRow;
        Insert: { slug: string; label: string } & Partial<
          Omit<PartnerCategoryRow, "slug" | "label">
        >;
        Update: Partial<PartnerCategoryRow>;
        Relationships: [];
      };
      partners: {
        Row: PartnerRow;
        Insert: {
          unidade_id: string;
          category_id: string;
          slug: string;
          name: string;
        } & Partial<Omit<PartnerRow, "unidade_id" | "category_id" | "slug" | "name">>;
        Update: Partial<PartnerRow>;
        Relationships: [];
      };
      offers: {
        Row: OfferRow;
        Insert: { partner_id: string; title: string } & Partial<
          Omit<OfferRow, "partner_id" | "title">
        >;
        Update: Partial<OfferRow>;
        Relationships: [];
      };
      templates: {
        Row: TemplateRow;
        Insert: { slug: TemplateSlug; name: string } & Partial<
          Omit<TemplateRow, "slug" | "name">
        >;
        Update: Partial<TemplateRow>;
        Relationships: [];
      };
      campaigns: {
        Row: CampaignRow;
        Insert: {
          unidade_id: string;
          template_id: string;
          name: string;
        } & Partial<Omit<CampaignRow, "unidade_id" | "template_id" | "name">>;
        Update: Partial<CampaignRow>;
        Relationships: [];
      };
      club_members: {
        Row: ClubMemberRow;
        Insert: {
          unidade_id: string;
          full_name: string;
          phone: string;
        } & Partial<Omit<ClubMemberRow, "unidade_id" | "full_name" | "phone">>;
        Update: Partial<ClubMemberRow>;
        Relationships: [];
      };
      partner_leads: {
        Row: PartnerLeadRow;
        Insert: {
          unidade_id: string;
          responsible_name: string;
          business_name: string;
          whatsapp: string;
        } & Partial<
          Omit<PartnerLeadRow, "unidade_id" | "responsible_name" | "business_name" | "whatsapp">
        >;
        Update: Partial<PartnerLeadRow>;
        Relationships: [];
      };
      qr_codes: {
        Row: QrCodeRow;
        Insert: {
          unidade_id: string;
          target_url: string;
          purpose: string;
        } & Partial<Omit<QrCodeRow, "unidade_id" | "target_url" | "purpose">>;
        Update: Partial<QrCodeRow>;
        Relationships: [];
      };
      player_sessions: {
        Row: PlayerSessionRow;
        Insert: { unidade_id: string } & Partial<Omit<PlayerSessionRow, "unidade_id">>;
        Update: Partial<PlayerSessionRow>;
        Relationships: [];
      };
      campaign_impressions: {
        Row: CampaignImpressionRow;
        Insert: { campaign_id: string; unidade_id: string } & Partial<
          Omit<CampaignImpressionRow, "campaign_id" | "unidade_id">
        >;
        Update: Partial<CampaignImpressionRow>;
        Relationships: [];
      };
      qr_clicks: {
        Row: QrClickRow;
        Insert: { qr_code_id: string; unidade_id: string } & Partial<
          Omit<QrClickRow, "qr_code_id" | "unidade_id">
        >;
        Update: Partial<QrClickRow>;
        Relationships: [];
      };
      settings: {
        Row: SettingRow;
        Insert: SettingRow;
        Update: Partial<SettingRow>;
        Relationships: [];
      };
      editor_templates: {
        Row: EditorTemplateRow;
        Insert: { name: string; format: "horizontal" | "vertical"; width: number; height: number } & Partial<
          Omit<EditorTemplateRow, "name" | "format" | "width" | "height">
        >;
        Update: Partial<EditorTemplateRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      xv_current_role: { Args: Record<string, never>; Returns: UserRole };
      xv_current_unidade_id: { Args: Record<string, never>; Returns: string };
      xv_is_master: { Args: Record<string, never>; Returns: boolean };
      xv_can_manage_unit: { Args: { target_unidade_id: string }; Returns: boolean };
    };
    Enums: {
      user_role: UserRole;
      campaign_priority: CampaignPriority;
      campaign_status: CampaignStatus;
      partner_status: PartnerStatus;
      partner_plan: PartnerPlan;
      offer_status: OfferStatus;
      lead_status: LeadStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

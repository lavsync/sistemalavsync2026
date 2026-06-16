-- ============================================================================
-- 0032 — Mídia Indoor: colunas extras de cadastro do parceiro (origem 0008 XV)
-- Preserva 100% dos dados do cadastro multi-etapa do portal do parceiro.
-- profile_id (XV) NÃO é portado: o vínculo usuário<->parceiro vira mi_partner_users.
-- ============================================================================
alter table public.mi_partners
  add column if not exists responsible_name   text,
  add column if not exists responsible_cpf    text,
  add column if not exists responsible_phone  text,
  add column if not exists responsible_email  text,
  add column if not exists responsible_role   text,
  add column if not exists legal_name         text,
  add column if not exists cnpj               text,
  add column if not exists company_type       text,
  add column if not exists segment_label      text,
  add column if not exists city               text,
  add column if not exists state              text,
  add column if not exists postal_code        text,
  add column if not exists google_maps_url    text,
  add column if not exists whatsapp_business  text,
  add column if not exists objectives         jsonb,
  add column if not exists materials          jsonb,
  add column if not exists terms_accepted_at  timestamptz,
  add column if not exists terms_accepted_ip  text;

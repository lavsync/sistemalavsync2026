-- ============================================================================
-- 0031 — MÓDULO MÍDIA INDOOR (migrado do Xô Varal / Conexão Local)
--
-- Consolida as 16 tabelas do sistema Xô Varal no Supabase do LavSync, com:
--   - prefixo `mi_` em tudo (evita colisão de nomes/enums)
--   - tenant_id (padrão multi-tenant LavSync) + unidade_id (FK -> unidades)
--   - RLS no padrão LavSync: current_tenant_id() / is_master()
--   - policies públicas (anon) para Player TV, sites de clube e redirect de QR
--
-- Aditiva: só cria objetos `mi_*`. Não altera tabelas existentes do LavSync.
-- Rollback: drop das tabelas/enums/funcs `mi_*` + remoção dos buckets.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ─── Trigger helper próprio (não depende de helper do core) ────────────────
create or replace function public.mi_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- ENUMs (prefixados mi_)
-- ============================================================================
do $$ begin create type public.mi_campaign_priority as enum ('normal','destaque','premium'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mi_campaign_status   as enum ('rascunho','ativa','pausada','expirada'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mi_partner_status    as enum ('pendente','ativo','pausado','removido'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mi_partner_plan      as enum ('gratuito','destaque','premium'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mi_offer_status      as enum ('ativa','inativa','expirada'); exception when duplicate_object then null; end $$;
do $$ begin create type public.mi_lead_status       as enum ('novo','em_analise','aprovado','rejeitado'); exception when duplicate_object then null; end $$;

-- ============================================================================
-- mi_units  (1:1 com unidades do LavSync — guarda atributos do Mídia Indoor)
-- ============================================================================
create table if not exists public.mi_units (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  unidade_id   uuid not null references public.unidades(id) on delete cascade,
  slug         text not null unique,
  name         text not null,
  address text, neighborhood text, city text, state text,
  phone text, whatsapp text, instagram text, opening_hours text,
  is_active    boolean not null default true,
  public_url   text,
  player_url   text,
  player_token text not null default encode(gen_random_bytes(24), 'hex'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (unidade_id)
);
create index if not exists mi_units_tenant_idx on public.mi_units(tenant_id);
create index if not exists mi_units_slug_idx   on public.mi_units(slug);
create trigger mi_units_touch before update on public.mi_units for each row execute function public.mi_touch_updated_at();

-- ============================================================================
-- mi_partner_categories  (global — sem tenant)
-- ============================================================================
create table if not exists public.mi_partner_categories (
  id    uuid primary key default gen_random_uuid(),
  slug  text not null unique,
  label text not null,
  icon  text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- mi_partners
-- ============================================================================
create table if not exists public.mi_partners (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  unidade_id   uuid not null references public.unidades(id) on delete cascade,
  category_id  uuid not null references public.mi_partner_categories(id) on delete restrict,
  slug         text not null,
  name         text not null,
  logo_url text, cover_url text,
  short_description text, full_description text,
  address text, neighborhood text, whatsapp text, instagram text, website text, external_link text,
  plan   public.mi_partner_plan   not null default 'gratuito',
  status public.mi_partner_status not null default 'pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (unidade_id, slug)
);
create index if not exists mi_partners_tenant_idx   on public.mi_partners(tenant_id);
create index if not exists mi_partners_unidade_idx  on public.mi_partners(unidade_id);
create index if not exists mi_partners_category_idx on public.mi_partners(category_id);
create index if not exists mi_partners_status_idx   on public.mi_partners(status);
create trigger mi_partners_touch before update on public.mi_partners for each row execute function public.mi_touch_updated_at();

-- ============================================================================
-- mi_offers
-- ============================================================================
create table if not exists public.mi_offers (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  partner_id uuid not null references public.mi_partners(id) on delete cascade,
  title text not null, description text, banner_url text, coupon text, terms text,
  main_call text, cta_label text, cta_url text, whatsapp_url text,
  starts_at timestamptz, expires_at timestamptz,
  is_featured boolean not null default false,
  status public.mi_offer_status not null default 'ativa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mi_offers_tenant_idx  on public.mi_offers(tenant_id);
create index if not exists mi_offers_partner_idx on public.mi_offers(partner_id);
create index if not exists mi_offers_status_idx  on public.mi_offers(status);
create trigger mi_offers_touch before update on public.mi_offers for each row execute function public.mi_touch_updated_at();

-- ============================================================================
-- mi_templates  (templates de sistema — global)
-- ============================================================================
create table if not exists public.mi_templates (
  id   uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  config jsonb not null default '{}'::jsonb,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- mi_editor_templates  (templates do editor Canva-style)
-- ============================================================================
create table if not exists public.mi_editor_templates (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  unidade_id  uuid references public.unidades(id) on delete cascade,
  partner_id  uuid references public.mi_partners(id) on delete cascade,
  linked_offer_id uuid references public.mi_offers(id) on delete set null,
  name   text not null,
  format text not null check (format in ('horizontal','vertical')),
  width  int not null,
  height int not null,
  background jsonb not null default '{"type":"color","value":"#0f1720"}'::jsonb,
  elements   jsonb not null default '[]'::jsonb,
  motion     jsonb not null default '{"enterDuration":600,"exitDuration":400}'::jsonb,
  duration_seconds int not null default 15 check (duration_seconds between 5 and 60),
  is_published boolean not null default false,
  thumbnail_url text,
  category text default 'custom',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mi_editor_templates_tenant_idx    on public.mi_editor_templates(tenant_id);
create index if not exists mi_editor_templates_unidade_idx   on public.mi_editor_templates(unidade_id);
create index if not exists mi_editor_templates_partner_idx   on public.mi_editor_templates(partner_id);
create index if not exists mi_editor_templates_published_idx on public.mi_editor_templates(is_published);
create trigger mi_editor_templates_touch before update on public.mi_editor_templates for each row execute function public.mi_touch_updated_at();

-- ============================================================================
-- mi_campaigns
-- ============================================================================
create table if not exists public.mi_campaigns (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  unidade_id  uuid not null references public.unidades(id) on delete cascade,
  partner_id  uuid references public.mi_partners(id) on delete set null,
  offer_id    uuid references public.mi_offers(id) on delete set null,
  template_id uuid not null references public.mi_templates(id) on delete restrict,
  editor_template_id uuid references public.mi_editor_templates(id) on delete set null,
  name text not null,
  type text not null default 'padrao',
  priority public.mi_campaign_priority not null default 'normal',
  duration_seconds int not null default 15 check (duration_seconds between 5 and 60),
  starts_at timestamptz, ends_at timestamptz,
  status public.mi_campaign_status not null default 'rascunho',
  headline text, subheadline text, cta_label text, cta_url text,
  media_url text, media_type text check (media_type in ('image','video')),
  qr_code_id uuid,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mi_campaigns_tenant_idx  on public.mi_campaigns(tenant_id);
create index if not exists mi_campaigns_unidade_idx on public.mi_campaigns(unidade_id);
create index if not exists mi_campaigns_status_idx  on public.mi_campaigns(unidade_id, status);
create trigger mi_campaigns_touch before update on public.mi_campaigns for each row execute function public.mi_touch_updated_at();

-- ============================================================================
-- mi_club_members
-- ============================================================================
create table if not exists public.mi_club_members (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text, birthdate date, neighborhood text,
  accepted_terms boolean not null default false,
  created_at timestamptz not null default now(),
  unique (unidade_id, phone)
);
create index if not exists mi_club_members_tenant_idx  on public.mi_club_members(tenant_id);
create index if not exists mi_club_members_unidade_idx on public.mi_club_members(unidade_id);

-- ============================================================================
-- mi_partner_leads
-- ============================================================================
create table if not exists public.mi_partner_leads (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  responsible_name text not null,
  business_name text not null,
  segment text, whatsapp text not null, instagram text, address text,
  benefit_proposal text, message text,
  status public.mi_lead_status not null default 'novo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mi_partner_leads_tenant_idx  on public.mi_partner_leads(tenant_id);
create index if not exists mi_partner_leads_unidade_idx on public.mi_partner_leads(unidade_id);
create trigger mi_partner_leads_touch before update on public.mi_partner_leads for each row execute function public.mi_touch_updated_at();

-- ============================================================================
-- mi_qr_codes
-- ============================================================================
create table if not exists public.mi_qr_codes (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  target_url text not null,
  short_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  purpose    text not null,
  partner_id  uuid references public.mi_partners(id) on delete set null,
  offer_id    uuid references public.mi_offers(id) on delete set null,
  campaign_id uuid references public.mi_campaigns(id) on delete set null,
  utm_source text not null default 'totem',
  utm_medium text not null default 'tv',
  utm_campaign text, utm_content text,
  created_at timestamptz not null default now()
);
create index if not exists mi_qr_codes_tenant_idx on public.mi_qr_codes(tenant_id);
create index if not exists mi_qr_codes_short_idx  on public.mi_qr_codes(short_code);

-- FK tardia campaigns.qr_code_id -> qr_codes
alter table public.mi_campaigns drop constraint if exists mi_campaigns_qr_code_id_fkey;
alter table public.mi_campaigns add constraint mi_campaigns_qr_code_id_fkey
  foreign key (qr_code_id) references public.mi_qr_codes(id) on delete set null;

-- ============================================================================
-- mi_player_sessions
-- ============================================================================
create table if not exists public.mi_player_sessions (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  last_heartbeat timestamptz not null default now(),
  user_agent text, ip text,
  created_at timestamptz not null default now()
);
create index if not exists mi_player_sessions_unidade_idx on public.mi_player_sessions(unidade_id);
create index if not exists mi_player_sessions_hb_idx on public.mi_player_sessions(last_heartbeat desc);

-- ============================================================================
-- mi_campaign_impressions  (append-only)
-- ============================================================================
create table if not exists public.mi_campaign_impressions (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  unidade_id  uuid not null references public.unidades(id) on delete cascade,
  campaign_id uuid not null references public.mi_campaigns(id) on delete cascade,
  session_id  uuid references public.mi_player_sessions(id) on delete set null,
  shown_at    timestamptz not null default now()
);
create index if not exists mi_impr_campaign_idx on public.mi_campaign_impressions(campaign_id);
create index if not exists mi_impr_shown_idx on public.mi_campaign_impressions(shown_at desc);

-- ============================================================================
-- mi_qr_clicks  (append-only)
-- ============================================================================
create table if not exists public.mi_qr_clicks (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  qr_code_id uuid not null references public.mi_qr_codes(id) on delete cascade,
  user_agent text, referer text, ip_hash text,
  clicked_at timestamptz not null default now()
);
create index if not exists mi_qr_clicks_qr_idx on public.mi_qr_clicks(qr_code_id);
create index if not exists mi_qr_clicks_at_idx on public.mi_qr_clicks(clicked_at desc);

-- ============================================================================
-- mi_settings  (key/value por tenant)
-- ============================================================================
create table if not exists public.mi_settings (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key       text not null,
  value     jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

-- ============================================================================
-- mi_partner_users  (vínculo auth.users <-> partner — portal do parceiro)
-- ============================================================================
create table if not exists public.mi_partner_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  partner_id uuid references public.mi_partners(id) on delete set null,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);
create index if not exists mi_partner_users_partner_idx on public.mi_partner_users(partner_id);

-- ============================================================================
-- RLS — padrão LavSync (current_tenant_id() / is_master()) + público (anon)
-- ============================================================================

-- helper: o usuário logado é dono deste partner? (portal do parceiro)
create or replace function public.mi_is_partner_user(p_partner_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.mi_partner_users u
    where u.user_id = auth.uid() and u.partner_id = p_partner_id
  );
$$;
grant execute on function public.mi_is_partner_user to authenticated, anon;

-- ─── mi_units ──────────────────────────────────────────────────────────────
alter table public.mi_units enable row level security;
drop policy if exists mi_units_public_read on public.mi_units;
create policy mi_units_public_read on public.mi_units for select to anon, authenticated
  using (is_active = true or tenant_id = public.current_tenant_id() or public.is_master());
drop policy if exists mi_units_tenant_write on public.mi_units;
create policy mi_units_tenant_write on public.mi_units for all to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

-- ─── mi_partner_categories (global) ──────────────────────────────────────────
alter table public.mi_partner_categories enable row level security;
drop policy if exists mi_pcat_read on public.mi_partner_categories;
create policy mi_pcat_read on public.mi_partner_categories for select to anon, authenticated using (true);
drop policy if exists mi_pcat_write on public.mi_partner_categories;
create policy mi_pcat_write on public.mi_partner_categories for all to authenticated
  using (public.is_master()) with check (public.is_master());

-- ─── mi_partners ─────────────────────────────────────────────────────────────
alter table public.mi_partners enable row level security;
drop policy if exists mi_partners_public_read on public.mi_partners;
create policy mi_partners_public_read on public.mi_partners for select to anon, authenticated
  using (status = 'ativo' or tenant_id = public.current_tenant_id() or public.is_master()
         or public.mi_is_partner_user(id));
drop policy if exists mi_partners_manage on public.mi_partners;
create policy mi_partners_manage on public.mi_partners for all to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

-- ─── mi_offers ───────────────────────────────────────────────────────────────
alter table public.mi_offers enable row level security;
drop policy if exists mi_offers_public_read on public.mi_offers;
create policy mi_offers_public_read on public.mi_offers for select to anon, authenticated
  using (status = 'ativa' or tenant_id = public.current_tenant_id() or public.is_master()
         or public.mi_is_partner_user(partner_id));
drop policy if exists mi_offers_manage on public.mi_offers;
create policy mi_offers_manage on public.mi_offers for all to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_master() or public.mi_is_partner_user(partner_id))
  with check (tenant_id = public.current_tenant_id() or public.is_master() or public.mi_is_partner_user(partner_id));

-- ─── mi_templates (global) ───────────────────────────────────────────────────
alter table public.mi_templates enable row level security;
drop policy if exists mi_templates_read on public.mi_templates;
create policy mi_templates_read on public.mi_templates for select to anon, authenticated using (true);
drop policy if exists mi_templates_write on public.mi_templates;
create policy mi_templates_write on public.mi_templates for all to authenticated
  using (public.is_master()) with check (public.is_master());

-- ─── mi_editor_templates ─────────────────────────────────────────────────────
alter table public.mi_editor_templates enable row level security;
drop policy if exists mi_editor_templates_public_read on public.mi_editor_templates;
create policy mi_editor_templates_public_read on public.mi_editor_templates for select to anon, authenticated
  using (is_published = true or tenant_id = public.current_tenant_id() or public.is_master()
         or (partner_id is not null and public.mi_is_partner_user(partner_id)));
drop policy if exists mi_editor_templates_manage on public.mi_editor_templates;
create policy mi_editor_templates_manage on public.mi_editor_templates for all to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_master()
         or (partner_id is not null and public.mi_is_partner_user(partner_id)))
  with check (tenant_id = public.current_tenant_id() or public.is_master()
         or (partner_id is not null and public.mi_is_partner_user(partner_id)));

-- ─── mi_campaigns ────────────────────────────────────────────────────────────
alter table public.mi_campaigns enable row level security;
drop policy if exists mi_campaigns_public_read on public.mi_campaigns;
create policy mi_campaigns_public_read on public.mi_campaigns for select to anon, authenticated
  using (status = 'ativa' or tenant_id = public.current_tenant_id() or public.is_master());
drop policy if exists mi_campaigns_manage on public.mi_campaigns;
create policy mi_campaigns_manage on public.mi_campaigns for all to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

-- ─── mi_club_members (insert público; leitura interna) ───────────────────────
alter table public.mi_club_members enable row level security;
drop policy if exists mi_club_public_insert on public.mi_club_members;
create policy mi_club_public_insert on public.mi_club_members for insert to anon, authenticated
  with check (accepted_terms = true);
drop policy if exists mi_club_manage on public.mi_club_members;
create policy mi_club_manage on public.mi_club_members for select to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_master());
drop policy if exists mi_club_update on public.mi_club_members;
create policy mi_club_update on public.mi_club_members for update to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());
drop policy if exists mi_club_delete on public.mi_club_members;
create policy mi_club_delete on public.mi_club_members for delete to authenticated
  using (public.is_master());

-- ─── mi_partner_leads (insert público; gestão interna) ───────────────────────
alter table public.mi_partner_leads enable row level security;
drop policy if exists mi_leads_public_insert on public.mi_partner_leads;
create policy mi_leads_public_insert on public.mi_partner_leads for insert to anon, authenticated with check (true);
drop policy if exists mi_leads_manage on public.mi_partner_leads;
create policy mi_leads_manage on public.mi_partner_leads for all to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

-- ─── mi_qr_codes (leitura pública p/ redirect; gestão interna) ───────────────
alter table public.mi_qr_codes enable row level security;
drop policy if exists mi_qr_public_read on public.mi_qr_codes;
create policy mi_qr_public_read on public.mi_qr_codes for select to anon, authenticated using (true);
drop policy if exists mi_qr_manage on public.mi_qr_codes;
create policy mi_qr_manage on public.mi_qr_codes for all to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

-- ─── mi_player_sessions (telemetria anon) ────────────────────────────────────
alter table public.mi_player_sessions enable row level security;
drop policy if exists mi_psess_anon_ins on public.mi_player_sessions;
create policy mi_psess_anon_ins on public.mi_player_sessions for insert to anon, authenticated with check (true);
drop policy if exists mi_psess_anon_upd on public.mi_player_sessions;
create policy mi_psess_anon_upd on public.mi_player_sessions for update to anon, authenticated using (true) with check (true);
drop policy if exists mi_psess_read on public.mi_player_sessions;
create policy mi_psess_read on public.mi_player_sessions for select to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_master());

-- ─── mi_campaign_impressions (telemetria anon) ───────────────────────────────
alter table public.mi_campaign_impressions enable row level security;
drop policy if exists mi_impr_anon_ins on public.mi_campaign_impressions;
create policy mi_impr_anon_ins on public.mi_campaign_impressions for insert to anon, authenticated with check (true);
drop policy if exists mi_impr_read on public.mi_campaign_impressions;
create policy mi_impr_read on public.mi_campaign_impressions for select to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_master());

-- ─── mi_qr_clicks (telemetria anon) ──────────────────────────────────────────
alter table public.mi_qr_clicks enable row level security;
drop policy if exists mi_qrclick_anon_ins on public.mi_qr_clicks;
create policy mi_qrclick_anon_ins on public.mi_qr_clicks for insert to anon, authenticated with check (true);
drop policy if exists mi_qrclick_read on public.mi_qr_clicks;
create policy mi_qrclick_read on public.mi_qr_clicks for select to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_master());

-- ─── mi_settings (apenas tenant/master) ──────────────────────────────────────
alter table public.mi_settings enable row level security;
drop policy if exists mi_settings_all on public.mi_settings;
create policy mi_settings_all on public.mi_settings for all to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

-- ─── mi_partner_users (o próprio parceiro lê a si; master gerencia) ──────────
alter table public.mi_partner_users enable row level security;
drop policy if exists mi_puser_self on public.mi_partner_users;
create policy mi_puser_self on public.mi_partner_users for select to authenticated
  using (user_id = auth.uid() or tenant_id = public.current_tenant_id() or public.is_master());
drop policy if exists mi_puser_manage on public.mi_partner_users;
create policy mi_puser_manage on public.mi_partner_users for all to authenticated
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

-- FIM 0031

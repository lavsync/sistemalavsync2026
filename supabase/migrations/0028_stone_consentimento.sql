-- =====================================================================
-- LavSync · 0028 · Stone Open Banking · Fluxo de Consentimento (Sprint 2)
-- Cada unidade Xô Varal precisa dar consentimento à aplicação parceira LavSync.
-- =====================================================================

do $$ begin
  create type stone_consent_status as enum (
    'sem_consentimento',     -- nunca foi solicitado
    'pendente',              -- link gerado, aguardando aprovação
    'aprovado',              -- usuário aprovou — pode chamar API
    'rejeitado',             -- usuário negou
    'expirado',              -- 2h sem aprovar
    'revogado'               -- usuário revogou depois
  );
exception when duplicate_object then null; end $$;

-- ─── Campos de consentimento em integracoes_stone ──────────────────
alter table public.integracoes_stone
  add column if not exists consent_status stone_consent_status not null default 'sem_consentimento',
  add column if not exists consent_id text null,
  add column if not exists resource_id text null,                   -- ID da conta retornado após aprovação
  add column if not exists consent_solicitado_em timestamptz null,
  add column if not exists consent_aprovado_em timestamptz null,
  add column if not exists consent_expira_em timestamptz null,
  add column if not exists consent_session_metadata text null,      -- token interno pra correlacionar callback
  add column if not exists consent_redirect_uri text null,
  add column if not exists consent_jwt text null;                   -- audit trail do JWT gerado

create index if not exists ix_stone_consent_status on public.integracoes_stone(consent_status);
create index if not exists ix_stone_consent_session on public.integracoes_stone(consent_session_metadata)
  where consent_session_metadata is not null;

-- ─── Log de consentimentos ─────────────────────────────────────────
create table if not exists public.stone_consent_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  integracao_id uuid references public.integracoes_stone(id) on delete cascade,
  evento text not null,                                              -- 'link_gerado' | 'callback_recebido' | 'aprovado' | 'rejeitado' | 'expirado'
  consent_result text null,                                          -- 'approved' | 'ignored' | 'already_granted'
  resource_id text null,
  session_metadata text null,
  raw_data jsonb null,
  usuario_id uuid references public.usuarios(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index if not exists ix_stone_consent_log_unid on public.stone_consent_logs(unidade_id, criado_em desc);

-- RLS
alter table public.stone_consent_logs enable row level security;
drop policy if exists "stone_clog_tenant" on public.stone_consent_logs;
create policy "stone_clog_tenant" on public.stone_consent_logs for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

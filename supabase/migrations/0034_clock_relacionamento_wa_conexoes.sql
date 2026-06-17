-- =====================================================================
-- LavSync · 0034 · CLOCK Relacionamento — Conexões WhatsApp (Sprint 2)
--
-- ARQUITETURA POR UNIDADE: cada unidade (Cabral/Castelo/Buritis) tem o
-- SEU número, WABA, app e token próprios. Credenciais NÃO vão para env
-- var global — ficam aqui, uma linha por unidade.
--
-- Provider: Meta WhatsApp Cloud API (oficial). RLS master-only por
-- conter segredos; o processor lê via service_role (bypassa RLS).
-- Doc: docs/CLOCK-RELACIONAMENTO.md §3, §9.
-- =====================================================================

create table if not exists public.wa_conexoes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,

  provider text not null default 'meta_cloud',
  numero_comercial text,                      -- E.164 sem máscara, ex: 5531991658210
  verified_name text,                          -- nome verificado na Meta

  -- Identificadores Meta (não-secretos, mas específicos da unidade)
  waba_id text,                                -- WhatsApp Business Account ID
  phone_number_id text,                        -- Phone Number ID
  app_id text,                                 -- Meta App ID

  -- Segredos (somente service_role lê na prática)
  app_secret text,
  access_token text,                           -- token permanente (System User)
  verify_token text,                           -- nosso, p/ verificar o webhook inbound

  -- Estado
  status text not null default 'desconectado', -- desconectado | conectado | erro
  ultimo_check_em timestamptz,
  ultimo_erro text,
  ativo boolean not null default true,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
-- Uma conexão ativa por unidade.
create unique index if not exists ux_wa_conexoes_unidade
  on public.wa_conexoes(tenant_id, unidade_id);

do $$
begin
  drop trigger if exists trg_wa_conexoes_upd on public.wa_conexoes;
  create trigger trg_wa_conexoes_upd before update on public.wa_conexoes
    for each row execute function public.set_atualizado_em();
end $$;

-- RLS: master-only (segredos). Gestão pela UI passa por server action
-- com service_role; o processor idem.
alter table public.wa_conexoes enable row level security;
drop policy if exists "wa_conexoes_master" on public.wa_conexoes;
create policy "wa_conexoes_master" on public.wa_conexoes for all
  using (public.is_master())
  with check (public.is_master());

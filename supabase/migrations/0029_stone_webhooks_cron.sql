-- =====================================================================
-- LavSync · 0029 · Stone Open Banking · Webhooks + Cron (Sprint 3+4)
-- =====================================================================

-- ─── Eventos de webhook recebidos ──────────────────────────────────
create table if not exists public.stone_webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,
  -- Identificador único Stone (header x-stone-webhook-event-id) — usado pra idempotência
  stone_event_id text not null,
  event_type text not null,                          -- header x-stone-webhook-event-type
  -- Payload original (JWE encriptado se vier criptografado)
  raw_body text not null,
  -- Após decriptar/validar
  decoded_payload jsonb null,
  signature_validated boolean not null default false,
  -- Status de processamento
  status text not null default 'recebido',           -- recebido | processado | erro | ignorado
  erro text null,
  vendas_geradas integer not null default 0,
  -- Conciliação com tabela bruta
  transacao_id uuid references public.stone_transacoes_brutas(id) on delete set null,
  -- Metadata
  http_headers jsonb null,
  ip_origem text null,
  recebido_em timestamptz not null default now(),
  processado_em timestamptz null
);

create unique index if not exists ux_stone_webhook_event_id
  on public.stone_webhook_events(stone_event_id);
create index if not exists ix_stone_webhook_status
  on public.stone_webhook_events(status, recebido_em desc);
create index if not exists ix_stone_webhook_type
  on public.stone_webhook_events(event_type);
create index if not exists ix_stone_webhook_unidade
  on public.stone_webhook_events(unidade_id, recebido_em desc) where unidade_id is not null;

-- ─── RLS ─────────────────────────────────────────────────────────
alter table public.stone_webhook_events enable row level security;
drop policy if exists "stone_wh_tenant" on public.stone_webhook_events;
create policy "stone_wh_tenant" on public.stone_webhook_events for all
  using (
    tenant_id is null                                 -- webhooks sem tenant_id ainda (em processamento) — leitura só pra master
    or tenant_id = public.current_tenant_id()
    or public.is_master()
  )
  with check (true);                                  -- inserção via service_role no endpoint

-- ─── Tabela de status do Cron (saúde por unidade) ──────────────────
create table if not exists public.stone_cron_status (
  id uuid primary key default gen_random_uuid(),
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz null,
  -- Resumo da execução
  unidades_processadas integer not null default 0,
  unidades_com_sucesso integer not null default 0,
  unidades_com_erro integer not null default 0,
  vendas_inseridas_total integer not null default 0,
  duracao_segundos integer null,
  -- Detalhes por unidade
  detalhes jsonb null,
  erro_global text null
);

create index if not exists ix_stone_cron_iniciado
  on public.stone_cron_status(iniciado_em desc);

alter table public.stone_cron_status enable row level security;
drop policy if exists "stone_cron_master" on public.stone_cron_status;
create policy "stone_cron_master" on public.stone_cron_status for all
  using (public.is_master())
  with check (public.is_master());

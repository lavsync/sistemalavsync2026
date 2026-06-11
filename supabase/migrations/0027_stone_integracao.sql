-- =====================================================================
-- LavSync · 0027 · Integração Stone Open Banking
-- Cada unidade Xô Varal é PJ separada com credenciais Stone próprias.
-- =====================================================================

-- ─── ENUMS ──────────────────────────────────────────────────────────
do $$ begin
  create type stone_sync_status as enum ('em_andamento','sucesso','erro','parcial');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stone_transacao_tipo as enum (
    'credit_card', 'debit_card', 'pix', 'boleto', 'transfer', 'fee', 'other'
  );
exception when duplicate_object then null; end $$;

-- ─── Credenciais Stone por unidade ──────────────────────────────────
create table if not exists public.integracoes_stone (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid unique not null references public.unidades(id) on delete cascade,
  cnpj text not null,
  razao_social text null,
  account_id text not null,                           -- ID da conta Stone (UUID)
  client_id text not null,                            -- client_id da aplicação parceira
  private_key_pem text not null,                      -- chave privada RSA PEM (multi-linha)
  ambiente text not null default 'production',        -- 'production' | 'sandbox'
  -- Status
  ativo boolean not null default true,
  ultimo_sync_em timestamptz null,
  ultimo_sync_ok boolean null,
  ultimo_sync_erro text null,
  ultimo_token_em timestamptz null,                   -- last access_token obtido
  -- Configs
  sync_automatico boolean not null default false,
  sync_intervalo_minutos integer not null default 60,
  observacoes text null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists ix_stone_tenant on public.integracoes_stone(tenant_id, ativo);

-- ─── Log de sincronizações ──────────────────────────────────────────
create table if not exists public.stone_sync_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  integracao_id uuid references public.integracoes_stone(id) on delete set null,
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz null,
  status stone_sync_status not null default 'em_andamento',
  janela_from timestamptz null,
  janela_to timestamptz null,
  transacoes_recebidas integer not null default 0,
  vendas_inseridas integer not null default 0,
  vendas_atualizadas integer not null default 0,
  vendas_duplicadas integer not null default 0,
  erro text null,
  http_status integer null,
  disparado_por text null,                            -- 'manual' | 'cron' | 'api'
  usuario_id uuid references public.usuarios(id) on delete set null
);

create index if not exists ix_stone_log_unid on public.stone_sync_logs(unidade_id, iniciado_em desc);
create index if not exists ix_stone_log_status on public.stone_sync_logs(status);

-- ─── Transações brutas (raw payload) ────────────────────────────────
-- Guarda payload original antes de virar venda. Permite reconciliação/auditoria.
create table if not exists public.stone_transacoes_brutas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  stone_id text not null,                             -- ID da movimentação na Stone (unique)
  tipo stone_transacao_tipo not null default 'other',
  valor numeric(12,2) not null,
  taxa numeric(12,2) null,                            -- taxa cobrada pela Stone
  liquido numeric(12,2) null,
  bandeira text null,
  parcelas integer null,
  cpf_cliente text null,
  nome_cliente text null,
  data_evento timestamptz not null,
  data_liquidacao timestamptz null,
  descricao text null,
  raw_payload jsonb not null,
  -- Conciliação
  conciliado boolean not null default false,
  venda_id uuid references public.vendas(id) on delete set null,
  sync_log_id uuid references public.stone_sync_logs(id) on delete set null,
  criado_em timestamptz not null default now()
);

create unique index if not exists ux_stone_trans_id on public.stone_transacoes_brutas(unidade_id, stone_id);
create index if not exists ix_stone_trans_data on public.stone_transacoes_brutas(data_evento desc);
create index if not exists ix_stone_trans_conc on public.stone_transacoes_brutas(conciliado, data_evento);

-- ─── Campo em vendas pra rastrear origem Stone ──────────────────────
alter table public.vendas
  add column if not exists stone_transacao_id uuid references public.stone_transacoes_brutas(id) on delete set null;

create index if not exists ix_vendas_stone on public.vendas(stone_transacao_id) where stone_transacao_id is not null;

-- ─── RLS ────────────────────────────────────────────────────────────
alter table public.integracoes_stone enable row level security;
drop policy if exists "stone_int_tenant" on public.integracoes_stone;
create policy "stone_int_tenant" on public.integracoes_stone for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

-- Restringe leitura da private_key — só master/admin
drop policy if exists "stone_int_master_read" on public.integracoes_stone;
-- (a policy "stone_int_tenant" já cobre tenant + master; private_key fica
-- acessível só via service_role em server actions)

alter table public.stone_sync_logs enable row level security;
drop policy if exists "stone_log_tenant" on public.stone_sync_logs;
create policy "stone_log_tenant" on public.stone_sync_logs for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

alter table public.stone_transacoes_brutas enable row level security;
drop policy if exists "stone_trans_tenant" on public.stone_transacoes_brutas;
create policy "stone_trans_tenant" on public.stone_transacoes_brutas for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

-- ─── Helper: dedupe transação Stone → venda ─────────────────────────
create or replace function public.stone_dedupe_venda_existente(
  p_unidade_id uuid, p_stone_id text
) returns uuid as $$
declare
  v_id uuid;
begin
  select t.venda_id into v_id
  from public.stone_transacoes_brutas t
  where t.unidade_id = p_unidade_id and t.stone_id = p_stone_id
  limit 1;
  return v_id;
end;
$$ language plpgsql stable;

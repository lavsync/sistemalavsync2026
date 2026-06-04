-- =====================================================================
-- LavSync · Clientes (multi-tenant, isolado por unidade)
-- Depende de 0001_init.sql (tenants, unidades, current_tenant_id, is_master)
-- =====================================================================

-- ============ EXTENSIONS ============
create extension if not exists pg_trgm;     -- busca por similaridade no nome
create extension if not exists "uuid-ossp"; -- garantia (já existe no 0001)

-- ============ CLIENTES ============
-- Mesmo CPF em unidades diferentes = registros distintos (decisão do Daniel).
-- Quando integrarmos MAXLAV API podemos evoluir pra modelo multi-unidade.
create table if not exists public.clientes (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,

  -- identificação
  nome text not null,
  cpf text not null,                          -- formato livre na entrada, normalizado p/ dígitos no índice
  email text,
  telefone text,
  data_nascimento date,
  genero text,                                -- 'Masculino' | 'Feminino' | 'Outro' | 'Nao informado'

  -- jornada
  cadastrado_em timestamptz,                  -- "Data de Cadastro" no totem/sistema original
  ultima_compra_em timestamptz,

  -- snapshot de métricas (vindo da planilha; substituído por cálculo real quando MAXLAV API chegar)
  snapshot_em timestamptz,                    -- quando a planilha foi emitida
  compras_total_qtd integer not null default 0,
  compras_total_valor numeric(12,2) not null default 0,
  compras_90d_qtd integer not null default 0,
  compras_90d_valor numeric(12,2) not null default 0,
  compras_30d_qtd integer not null default 0,
  compras_30d_valor numeric(12,2) not null default 0,
  compras_7d_qtd integer not null default 0,
  compras_7d_valor numeric(12,2) not null default 0,

  -- origem
  origem_sistema text not null default 'manual',   -- 'manual' | 'maxlav' | 'vm_tecnologia' | 'api'
  importacao_id uuid,                              -- referência à clientes_importacoes
  observacoes text,

  -- meta
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Unique por (unidade, CPF apenas dígitos)
create unique index if not exists ux_clientes_unidade_cpf
  on public.clientes (unidade_id, regexp_replace(cpf, '\D', '', 'g'))
  where cpf is not null and cpf <> '';

create index if not exists idx_clientes_tenant on public.clientes(tenant_id);
create index if not exists idx_clientes_unidade on public.clientes(unidade_id);
create index if not exists idx_clientes_ultima_compra on public.clientes(unidade_id, ultima_compra_em desc nulls last);
create index if not exists idx_clientes_valor_total on public.clientes(unidade_id, compras_total_valor desc);
create index if not exists idx_clientes_nome_trgm on public.clientes using gin (lower(nome) gin_trgm_ops);
create index if not exists idx_clientes_telefone on public.clientes(telefone);
create index if not exists idx_clientes_email on public.clientes(email);
create index if not exists idx_clientes_importacao on public.clientes(importacao_id);

-- ============ IMPORTAÇÕES ============
-- Auditoria de cada upload (planilha XLSX/CSV) — quem fez, quando, totais.
create table if not exists public.clientes_importacoes (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  usuario_id uuid references public.usuarios(id) on delete set null,

  arquivo_nome text not null,
  arquivo_tamanho integer,
  origem_sistema text not null default 'maxlav',
  modo text not null default 'upsert',          -- 'append' | 'upsert' | 'replace'

  total_linhas integer not null default 0,
  total_inseridos integer not null default 0,
  total_atualizados integer not null default 0,
  total_ignorados integer not null default 0,
  total_erros integer not null default 0,
  erros jsonb,                                  -- [{linha, motivo, dados}]

  status text not null default 'pendente',      -- 'pendente' | 'processando' | 'concluido' | 'falhou'
  snapshot_em timestamptz,                      -- "Emitido em" da planilha

  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);

create index if not exists idx_clientes_importacoes_unidade on public.clientes_importacoes(unidade_id, criado_em desc);

-- ============ TRIGGERS ============
drop trigger if exists trg_clientes_upd on public.clientes;
create trigger trg_clientes_upd before update on public.clientes
  for each row execute function public.set_atualizado_em();

-- ============ RLS ============
alter table public.clientes enable row level security;
alter table public.clientes_importacoes enable row level security;

drop policy if exists "clientes_tenant" on public.clientes;
create policy "clientes_tenant" on public.clientes
  for all using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

drop policy if exists "clientes_importacoes_tenant" on public.clientes_importacoes;
create policy "clientes_importacoes_tenant" on public.clientes_importacoes
  for all using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

-- =====================================================================
-- LavSync · Schema inicial (multi-tenant SaaS)
-- Rodar em Supabase → SQL Editor → New query → cole tudo → Run
-- =====================================================================

-- ============ EXTENSIONS ============
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============ ENUMS ============
do $$ begin
  create type lavsync_role as enum ('master', 'admin', 'operador', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type maquina_tipo as enum ('lavadora', 'secadora', 'dobradora', 'totem');
exception when duplicate_object then null; end $$;

do $$ begin
  create type maquina_status as enum ('ativa', 'manutencao', 'inativa');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ciclo_status as enum ('em_execucao', 'concluido', 'cancelado', 'falhou');
exception when duplicate_object then null; end $$;

-- ============ TENANTS ============
create table if not exists public.tenants (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  slug text not null unique,
  cnpj text,
  plano text not null default 'starter',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ============ USUARIOS (perfil ligado ao auth.users) ============
create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  email text not null,
  papel lavsync_role not null default 'operador',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_usuarios_tenant on public.usuarios(tenant_id);
create index if not exists idx_usuarios_email on public.usuarios(email);

-- ============ UNIDADES ============
create table if not exists public.unidades (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  cidade text,
  bairro text,
  endereco text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_unidades_tenant on public.unidades(tenant_id);

-- ============ MAQUINAS ============
create table if not exists public.maquinas (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  codigo text not null,
  tipo maquina_tipo not null,
  capacidade_kg numeric(5,2),
  status maquina_status not null default 'ativa',
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tenant_id, codigo)
);
create index if not exists idx_maquinas_unidade on public.maquinas(unidade_id);
create index if not exists idx_maquinas_tenant on public.maquinas(tenant_id);

-- ============ CICLOS (eventos de uso) ============
create table if not exists public.ciclos (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  maquina_id uuid not null references public.maquinas(id) on delete cascade,
  iniciado_em timestamptz not null,
  finalizado_em timestamptz,
  duracao_segundos integer,
  valor numeric(10,2) not null default 0,
  status ciclo_status not null default 'concluido',
  cliente_id uuid,
  criado_em timestamptz not null default now()
);
create index if not exists idx_ciclos_tenant on public.ciclos(tenant_id);
create index if not exists idx_ciclos_unidade_data on public.ciclos(unidade_id, iniciado_em desc);
create index if not exists idx_ciclos_maquina_data on public.ciclos(maquina_id, iniciado_em desc);

-- ============ TRIGGER: updated_at ============
create or replace function public.set_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_tenants_upd on public.tenants;
create trigger trg_tenants_upd before update on public.tenants
  for each row execute function public.set_atualizado_em();

drop trigger if exists trg_usuarios_upd on public.usuarios;
create trigger trg_usuarios_upd before update on public.usuarios
  for each row execute function public.set_atualizado_em();

drop trigger if exists trg_unidades_upd on public.unidades;
create trigger trg_unidades_upd before update on public.unidades
  for each row execute function public.set_atualizado_em();

drop trigger if exists trg_maquinas_upd on public.maquinas;
create trigger trg_maquinas_upd before update on public.maquinas
  for each row execute function public.set_atualizado_em();

-- ============ HELPER: tenant_id do usuário logado ============
create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path = public, auth as $$
  select tenant_id from public.usuarios where id = auth.uid();
$$;

create or replace function public.is_master()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select papel = 'master' from public.usuarios where id = auth.uid();
$$;

-- ============ RLS ============
alter table public.tenants enable row level security;
alter table public.usuarios enable row level security;
alter table public.unidades enable row level security;
alter table public.maquinas enable row level security;
alter table public.ciclos enable row level security;

-- Tenants: master vê tudo, demais só o próprio
drop policy if exists "tenants_select" on public.tenants;
create policy "tenants_select" on public.tenants
  for select using (
    public.is_master() or id = public.current_tenant_id()
  );

drop policy if exists "tenants_master_write" on public.tenants;
create policy "tenants_master_write" on public.tenants
  for all using (public.is_master()) with check (public.is_master());

-- Usuarios: master vê todos; demais só o próprio tenant
drop policy if exists "usuarios_select" on public.usuarios;
create policy "usuarios_select" on public.usuarios
  for select using (
    public.is_master() or tenant_id = public.current_tenant_id()
  );

drop policy if exists "usuarios_self_update" on public.usuarios;
create policy "usuarios_self_update" on public.usuarios
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Unidades, Máquinas, Ciclos: filtro por tenant
drop policy if exists "unidades_tenant" on public.unidades;
create policy "unidades_tenant" on public.unidades
  for all using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

drop policy if exists "maquinas_tenant" on public.maquinas;
create policy "maquinas_tenant" on public.maquinas
  for all using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

drop policy if exists "ciclos_tenant" on public.ciclos;
create policy "ciclos_tenant" on public.ciclos
  for all using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

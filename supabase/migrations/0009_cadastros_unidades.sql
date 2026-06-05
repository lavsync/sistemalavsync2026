-- =====================================================================
-- LavSync · Módulo Unidades — Cadastros operacionais (8 tabelas novas)
-- Categorias financeiras · Fornecedores · Despesas · Serviços · Planos
-- Campanhas · Parceiros · Unidade (campos extras)
-- =====================================================================

-- ============ ENUMS ============
do $$ begin
  create type tipo_categoria_financeira as enum ('receita', 'despesa', 'ambos');
exception when duplicate_object then null; end $$;

do $$ begin
  create type periodicidade_despesa as enum (
    'unica', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_despesa as enum (
    'aberta', 'paga', 'vencida', 'cancelada'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_servico_cadastro as enum (
    'lavagem', 'secagem', 'dobra', 'passadoria', 'higienizacao', 'extra', 'outro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_campanha as enum (
    'rascunho', 'ativa', 'pausada', 'encerrada'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_desconto as enum (
    'percentual', 'valor_fixo', 'cortesia'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_parceiro as enum (
    'condominio', 'hotel', 'pousada', 'oficina', 'empresa', 'influencer', 'outro'
  );
exception when duplicate_object then null; end $$;

-- ============ CATEGORIAS FINANCEIRAS ============
create table if not exists public.categorias_financeiras (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  tipo tipo_categoria_financeira not null default 'despesa',
  cor text default '#19C7CB',
  icone text,
  descricao text,
  ativa boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tenant_id, nome, tipo)
);
create index if not exists idx_cat_fin_tenant on public.categorias_financeiras(tenant_id, tipo);

-- ============ FORNECEDORES ============
create table if not exists public.fornecedores (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  razao_social text,
  cnpj_cpf text,
  email text,
  telefone text,
  whatsapp text,
  endereco text,
  contato_nome text,
  servico_fornecido text,
  observacoes text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_fornec_tenant on public.fornecedores(tenant_id, ativo);
create index if not exists idx_fornec_nome on public.fornecedores(tenant_id, lower(nome));

-- ============ DESPESAS ============
create table if not exists public.despesas (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete cascade,
  categoria_id uuid references public.categorias_financeiras(id) on delete set null,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,

  descricao text not null,
  valor numeric(12, 2) not null,
  vencimento date not null,
  pago_em date,
  data_competencia date,

  periodicidade periodicidade_despesa not null default 'unica',
  status status_despesa not null default 'aberta',

  numero_documento text,
  anexo_url text,
  observacoes text,

  criado_por uuid references public.usuarios(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_despesas_unidade on public.despesas(unidade_id, vencimento desc);
create index if not exists idx_despesas_status on public.despesas(tenant_id, status, vencimento);
create index if not exists idx_despesas_categoria on public.despesas(categoria_id);

-- ============ SERVIÇOS ============
create table if not exists public.servicos (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  tipo tipo_servico_cadastro not null default 'outro',
  preco numeric(10, 2) not null default 0,
  duracao_minutos integer,
  descricao text,
  cor text default '#19C7CB',
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tenant_id, nome)
);
create index if not exists idx_servicos_tenant on public.servicos(tenant_id, ativo);

-- ============ PLANOS (combos de serviços) ============
create table if not exists public.planos (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  descricao text,
  preco numeric(10, 2) not null default 0,
  preco_avulso_referencia numeric(10, 2),
  desconto_percentual numeric(5, 2),
  servicos_inclusos uuid[] default '{}',
  cor text default '#0F859A',
  ativo boolean not null default true,
  destaque boolean not null default false,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tenant_id, nome)
);
create index if not exists idx_planos_tenant on public.planos(tenant_id, ativo);

-- ============ CAMPANHAS (cupons + promoções) ============
create table if not exists public.campanhas (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  codigo_cupom text,
  descricao text,
  tipo_desconto tipo_desconto not null default 'percentual',
  valor_desconto numeric(10, 2) not null default 0,
  servico_alvo uuid references public.servicos(id) on delete set null,
  unidades_alvo uuid[],
  inicio_em date not null,
  fim_em date,
  max_usos integer,
  max_usos_por_cliente integer,
  total_usos integer not null default 0,
  status status_campanha not null default 'rascunho',
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists ux_campanhas_codigo
  on public.campanhas(tenant_id, lower(codigo_cupom))
  where codigo_cupom is not null and codigo_cupom <> '';
create index if not exists idx_campanhas_status on public.campanhas(tenant_id, status, inicio_em desc);

-- ============ PARCEIROS (B2B, condomínios, hotéis) ============
create table if not exists public.parceiros (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  tipo tipo_parceiro not null default 'empresa',
  cnpj_cpf text,
  responsavel_nome text,
  email text,
  telefone text,
  whatsapp text,
  endereco text,

  comissao_percentual numeric(5, 2),
  acordo_descricao text,
  inicio_parceria date,
  fim_parceria date,

  observacoes text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_parc_tenant on public.parceiros(tenant_id, ativo);

-- ============ UNIDADE — campos extras ============
alter table public.unidades
  add column if not exists razao_social text,
  add column if not exists cnpj text,
  add column if not exists inscricao_estadual text,
  add column if not exists codigo_interno text,
  add column if not exists endereco_cep text,
  add column if not exists endereco_logradouro text,
  add column if not exists endereco_numero text,
  add column if not exists endereco_complemento text,
  add column if not exists endereco_bairro text,
  add column if not exists endereco_cidade text,
  add column if not exists endereco_uf text,
  add column if not exists telefone text,
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists gestor_nome text,
  add column if not exists gestor_telefone text,
  add column if not exists horario_funcionamento jsonb default '{"seg":"24h","ter":"24h","qua":"24h","qui":"24h","sex":"24h","sab":"24h","dom":"24h"}'::jsonb,
  add column if not exists ativa boolean not null default true,
  add column if not exists status text default 'ativa',
  add column if not exists data_inauguracao date,
  add column if not exists foto_url text,
  add column if not exists meta_faturamento_mensal numeric(12, 2),
  add column if not exists observacoes text,
  add column if not exists atualizado_em timestamptz not null default now();

-- ============ TRIGGERS updated_at ============
drop trigger if exists trg_catfin_upd on public.categorias_financeiras;
create trigger trg_catfin_upd before update on public.categorias_financeiras
  for each row execute function public.set_atualizado_em();

drop trigger if exists trg_fornec_upd on public.fornecedores;
create trigger trg_fornec_upd before update on public.fornecedores
  for each row execute function public.set_atualizado_em();

drop trigger if exists trg_desp_upd on public.despesas;
create trigger trg_desp_upd before update on public.despesas
  for each row execute function public.set_atualizado_em();

drop trigger if exists trg_serv_upd on public.servicos;
create trigger trg_serv_upd before update on public.servicos
  for each row execute function public.set_atualizado_em();

drop trigger if exists trg_planos_upd on public.planos;
create trigger trg_planos_upd before update on public.planos
  for each row execute function public.set_atualizado_em();

drop trigger if exists trg_camp_upd on public.campanhas;
create trigger trg_camp_upd before update on public.campanhas
  for each row execute function public.set_atualizado_em();

drop trigger if exists trg_parc_upd on public.parceiros;
create trigger trg_parc_upd before update on public.parceiros
  for each row execute function public.set_atualizado_em();

drop trigger if exists trg_unid_upd on public.unidades;
create trigger trg_unid_upd before update on public.unidades
  for each row execute function public.set_atualizado_em();

-- ============ RLS ============
alter table public.categorias_financeiras enable row level security;
alter table public.fornecedores enable row level security;
alter table public.despesas enable row level security;
alter table public.servicos enable row level security;
alter table public.planos enable row level security;
alter table public.campanhas enable row level security;
alter table public.parceiros enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'categorias_financeiras','fornecedores','despesas',
    'servicos','planos','campanhas','parceiros'
  ] loop
    execute format($f$
      drop policy if exists "%I_tenant" on public.%I;
      create policy "%I_tenant" on public.%I
        for all using (tenant_id = public.current_tenant_id() or public.is_master())
        with check (tenant_id = public.current_tenant_id() or public.is_master());
    $f$, t, t, t, t);
  end loop;
end $$;

-- ============ Seed mínimo de categorias e serviços ============
insert into public.categorias_financeiras (tenant_id, nome, tipo, cor, ordem)
select t.id, x.nome, x.tipo::tipo_categoria_financeira, x.cor, x.ordem
from public.tenants t
cross join (values
  ('Aluguel',          'despesa', '#EF4444', 1),
  ('Energia elétrica', 'despesa', '#F59E0B', 2),
  ('Água e esgoto',    'despesa', '#3B82F6', 3),
  ('Internet',         'despesa', '#8B5CF6', 4),
  ('Produtos químicos','despesa', '#0FABB7', 5),
  ('Manutenção',       'despesa', '#F59E0B', 6),
  ('Marketing',        'despesa', '#EC4899', 7),
  ('Folha de pagamento','despesa', '#64748B', 8),
  ('Impostos',         'despesa', '#DC2626', 9),
  ('Outras receitas',  'receita', '#22C55E', 10),
  ('Vendas',           'receita', '#0F859A', 11)
) as x(nome, tipo, cor, ordem)
on conflict (tenant_id, nome, tipo) do nothing;

insert into public.servicos (tenant_id, nome, tipo, preco, duracao_minutos, descricao, cor, ordem)
select t.id, x.nome, x.tipo::tipo_servico_cadastro, x.preco, x.duracao, x.desc, x.cor, x.ordem
from public.tenants t
cross join (values
  ('Lavagem · 10kg',  'lavagem', 17.00, 35, 'Ciclo padrão de lavagem (10kg)', '#19C7CB', 1),
  ('Secagem · 10kg',  'secagem', 16.99, 30, 'Ciclo padrão de secagem (10kg)', '#0F859A', 2),
  ('Lavagem · 18kg',  'lavagem', 34.00, 40, 'Lavagem para volume maior',     '#19C7CB', 3),
  ('Secagem · 18kg',  'secagem', 33.98, 35, 'Secagem para volume maior',     '#0F859A', 4)
) as x(nome, tipo, preco, duracao, "desc", cor, ordem)
on conflict (tenant_id, nome) do nothing;

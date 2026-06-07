-- =====================================================================
-- LavSync · Financeiro — 5 abas (Painel/Investimento/DRE/Projeção/Config)
-- Modelo de viabilidade pra franquias Xô Varal (Simples Anexo III)
-- =====================================================================

-- ============ Configuração financeira por unidade ============
create table if not exists public.financeiro_unidades_config (
  unidade_id uuid primary key references public.unidades(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  responsavel_nome text,
  tipo_unidade text not null default 'franquia',
  mes_inauguracao integer,
  ano_inauguracao integer,
  potencial_faturamento numeric(12, 2),
  aluguel_iptu numeric(12, 2),
  meta_payback_meses integer default 21,
  atualizado_em timestamptz not null default now()
);

-- ============ Categorias e itens de investimento ============
create table if not exists public.financeiro_investimento_categorias (
  id uuid primary key default uuid_generate_v4(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  icone text,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

create table if not exists public.financeiro_investimento_itens (
  id uuid primary key default uuid_generate_v4(),
  categoria_id uuid not null references public.financeiro_investimento_categorias(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  descricao text not null,
  valor_projetado numeric(12, 2) not null default 0,
  valor_real numeric(12, 2),
  ordem integer not null default 0,
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_inv_cat_unidade on public.financeiro_investimento_categorias(unidade_id, ordem);
create index if not exists idx_inv_item_cat on public.financeiro_investimento_itens(categoria_id, ordem);

-- ============ Modelo de custos (por unidade) ============
create table if not exists public.financeiro_custos_fixos (
  id uuid primary key default uuid_generate_v4(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  descricao text not null,
  valor_mensal numeric(10, 2) not null default 0,
  valor_inaugural numeric(10, 2),
  meses_inaugural integer,
  ativo boolean not null default true,
  ordem integer not null default 0
);

create table if not exists public.financeiro_custos_variaveis (
  id uuid primary key default uuid_generate_v4(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  descricao text not null,
  tipo text not null default 'variavel',  -- 'simples' | 'csp' | 'royalties' | 'variavel'
  percentual_faturamento numeric(5, 2),    -- ex: 5.00 = 5%
  valor_minimo numeric(10, 2),
  a_partir_do_mes integer,
  ativo boolean not null default true,
  ordem integer not null default 0
);

create index if not exists idx_cfix_unidade on public.financeiro_custos_fixos(unidade_id, ordem);
create index if not exists idx_cvar_unidade on public.financeiro_custos_variaveis(unidade_id, ordem);

-- ============ Lançamentos mensais ============
create table if not exists public.financeiro_lancamentos (
  id uuid primary key default uuid_generate_v4(),
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  mes_index integer not null,           -- 1..60 a partir da inauguração
  ano integer not null,
  mes integer not null,                 -- 1..12
  faturamento_real numeric(12, 2),
  faturamento_projetado numeric(12, 2),
  observacoes text,
  atualizado_em timestamptz not null default now(),
  unique (unidade_id, mes_index)
);
create index if not exists idx_lanc_unidade on public.financeiro_lancamentos(unidade_id, mes_index);

-- ============ Triggers updated_at ============
do $$
declare t text;
begin
  foreach t in array array[
    'financeiro_unidades_config','financeiro_investimento_itens','financeiro_lancamentos'
  ] loop
    execute format($f$
      drop trigger if exists trg_%I_upd on public.%I;
      create trigger trg_%I_upd before update on public.%I
      for each row execute function public.set_atualizado_em();
    $f$, t, t, t, t);
  end loop;
end $$;

-- ============ RLS ============
do $$
declare t text;
begin
  foreach t in array array[
    'financeiro_unidades_config','financeiro_investimento_categorias',
    'financeiro_investimento_itens','financeiro_custos_fixos',
    'financeiro_custos_variaveis','financeiro_lancamentos'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format($f$
      drop policy if exists "%I_tenant" on public.%I;
      create policy "%I_tenant" on public.%I
        for all using (tenant_id = public.current_tenant_id() or public.is_master())
        with check (tenant_id = public.current_tenant_id() or public.is_master());
    $f$, t, t, t, t);
  end loop;
end $$;

-- ============ Criar unidade Xô Varal Anchieta ============
insert into public.unidades (id, tenant_id, nome, ativa, status)
select '10000000-0000-0000-0000-000000000004'::uuid, t.id, 'Anchieta', true, 'ativa'
from public.tenants t
where not exists (
  select 1 from public.unidades where id = '10000000-0000-0000-0000-000000000004'::uuid
);

-- ============ Seed do modelo base por unidade ============
-- Por padrão TODAS as unidades existentes recebem o mesmo template inicial.
-- Pode ser editado depois nas configurações.

-- Config base
insert into public.financeiro_unidades_config (unidade_id, tenant_id, tipo_unidade, potencial_faturamento, aluguel_iptu, meta_payback_meses)
select u.id, u.tenant_id, 'franquia', 42000, 4000, 21
from public.unidades u
on conflict (unidade_id) do nothing;

-- Investimento — categorias + itens (template padrão Xô Varal)
do $$
declare
  u record;
  cat_id uuid;
begin
  for u in select id, tenant_id from public.unidades loop
    -- Pular se já tem categorias
    if exists (select 1 from public.financeiro_investimento_categorias where unidade_id = u.id) then
      continue;
    end if;

    -- 1. Taxa de Franquia
    insert into public.financeiro_investimento_categorias (unidade_id, tenant_id, nome, ordem) values (u.id, u.tenant_id, 'Taxa de Franquia', 1) returning id into cat_id;
    insert into public.financeiro_investimento_itens (categoria_id, unidade_id, tenant_id, descricao, valor_projetado, ordem)
      values (cat_id, u.id, u.tenant_id, 'Taxa de Franquia', 30000, 1);

    -- 2. Abertura de Empresa
    insert into public.financeiro_investimento_categorias (unidade_id, tenant_id, nome, ordem) values (u.id, u.tenant_id, 'Abertura de Empresa', 2) returning id into cat_id;
    insert into public.financeiro_investimento_itens (categoria_id, unidade_id, tenant_id, descricao, valor_projetado, ordem) values
      (cat_id, u.id, u.tenant_id, 'Abertura de CNPJ', 800, 1),
      (cat_id, u.id, u.tenant_id, 'Inteligência Mercadológica / Busca do Ponto', 4000, 2),
      (cat_id, u.id, u.tenant_id, 'Software Financeiro (Conta Azul)', 250, 3),
      (cat_id, u.id, u.tenant_id, 'Software de Pagamento (VM)', 6500, 4),
      (cat_id, u.id, u.tenant_id, 'Software de Gestão (Sults)', 50, 5);

    -- 3. Projeto Arquitetônico
    insert into public.financeiro_investimento_categorias (unidade_id, tenant_id, nome, ordem) values (u.id, u.tenant_id, 'Projeto Arquitetônico', 3) returning id into cat_id;
    insert into public.financeiro_investimento_itens (categoria_id, unidade_id, tenant_id, descricao, valor_projetado, ordem)
      values (cat_id, u.id, u.tenant_id, 'Projeto Arquitetônico', 2000, 1);

    -- 4. Estrutura Física / Obra
    insert into public.financeiro_investimento_categorias (unidade_id, tenant_id, nome, ordem) values (u.id, u.tenant_id, 'Estrutura Física / Obra', 4) returning id into cat_id;
    insert into public.financeiro_investimento_itens (categoria_id, unidade_id, tenant_id, descricao, valor_projetado, ordem) values
      (cat_id, u.id, u.tenant_id, 'Adequações — Teto, Paredes, Elétrica e Hidráulica', 15000, 1),
      (cat_id, u.id, u.tenant_id, 'Mão de Obra — Instalação de Ar Condicionado', 1500, 2),
      (cat_id, u.id, u.tenant_id, 'Mão de Obra — Instalação das Máquinas', 2100, 3);

    -- 5. Identidade Visual
    insert into public.financeiro_investimento_categorias (unidade_id, tenant_id, nome, ordem) values (u.id, u.tenant_id, 'Identidade Visual', 5) returning id into cat_id;
    insert into public.financeiro_investimento_itens (categoria_id, unidade_id, tenant_id, descricao, valor_projetado, ordem)
      values (cat_id, u.id, u.tenant_id, 'Comunicação Visual', 15000, 1);

    -- 6. Mobiliário e Equipamentos
    insert into public.financeiro_investimento_categorias (unidade_id, tenant_id, nome, ordem) values (u.id, u.tenant_id, 'Mobiliário e Equipamentos', 6) returning id into cat_id;
    insert into public.financeiro_investimento_itens (categoria_id, unidade_id, tenant_id, descricao, valor_projetado, ordem) values
      (cat_id, u.id, u.tenant_id, 'Lavadora industrial', 45000, 1),
      (cat_id, u.id, u.tenant_id, 'Secadora industrial', 35000, 2),
      (cat_id, u.id, u.tenant_id, 'Lavadora doméstica', 15000, 3),
      (cat_id, u.id, u.tenant_id, 'Secadora doméstica', 12000, 4),
      (cat_id, u.id, u.tenant_id, 'Mesas de dobra', 4500, 5),
      (cat_id, u.id, u.tenant_id, 'Cadeiras e bancos', 3000, 6),
      (cat_id, u.id, u.tenant_id, 'Totem de pagamento', 8500, 7),
      (cat_id, u.id, u.tenant_id, 'Ar condicionado', 5000, 8),
      (cat_id, u.id, u.tenant_id, 'Outros mobiliários', 1607.55, 9);

    -- 7. Infraestrutura TI e Segurança
    insert into public.financeiro_investimento_categorias (unidade_id, tenant_id, nome, ordem) values (u.id, u.tenant_id, 'Infraestrutura TI e Segurança', 7) returning id into cat_id;
    insert into public.financeiro_investimento_itens (categoria_id, unidade_id, tenant_id, descricao, valor_projetado, ordem)
      values (cat_id, u.id, u.tenant_id, 'Câmeras, internet, alarme', 5100, 1);

    -- 8. Marketing Inaugural
    insert into public.financeiro_investimento_categorias (unidade_id, tenant_id, nome, ordem) values (u.id, u.tenant_id, 'Marketing Inaugural', 8) returning id into cat_id;
    insert into public.financeiro_investimento_itens (categoria_id, unidade_id, tenant_id, descricao, valor_projetado, ordem)
      values (cat_id, u.id, u.tenant_id, 'Campanha de lançamento', 3000, 1);

    -- 9. Estoque Inicial
    insert into public.financeiro_investimento_categorias (unidade_id, tenant_id, nome, ordem) values (u.id, u.tenant_id, 'Estoque Inicial', 9) returning id into cat_id;
    insert into public.financeiro_investimento_itens (categoria_id, unidade_id, tenant_id, descricao, valor_projetado, ordem)
      values (cat_id, u.id, u.tenant_id, 'Sabão, amaciante e suprimentos', 4910, 1);

    -- 10. Capital de Giro
    insert into public.financeiro_investimento_categorias (unidade_id, tenant_id, nome, ordem) values (u.id, u.tenant_id, 'Capital de Giro', 10) returning id into cat_id;
    insert into public.financeiro_investimento_itens (categoria_id, unidade_id, tenant_id, descricao, valor_projetado, ordem)
      values (cat_id, u.id, u.tenant_id, 'Reserva inicial', 10000, 1);

    -- Custos fixos
    insert into public.financeiro_custos_fixos (unidade_id, tenant_id, descricao, valor_mensal, valor_inaugural, meses_inaugural, ordem) values
      (u.id, u.tenant_id, 'Aluguel e IPTU', 4000, null, null, 1),
      (u.id, u.tenant_id, 'Fundo de Propaganda (Franchising)', 300, null, null, 2),
      (u.id, u.tenant_id, 'Telefone e Internet', 150, null, null, 3),
      (u.id, u.tenant_id, 'Contador', 300, null, null, 4),
      (u.id, u.tenant_id, 'Software', 350, null, null, 5),
      (u.id, u.tenant_id, 'Seguro', 200, null, null, 6),
      (u.id, u.tenant_id, 'Publicidade Local', 600, 1000, 3, 7),
      (u.id, u.tenant_id, 'Materiais', 100, null, null, 8);

    -- Custos variáveis
    insert into public.financeiro_custos_variaveis (unidade_id, tenant_id, descricao, tipo, percentual_faturamento, valor_minimo, a_partir_do_mes, ordem) values
      (u.id, u.tenant_id, 'Simples Nacional (Anexo III)', 'simples',   null, null, null, 1),
      (u.id, u.tenant_id, 'Sabão e Amaciante (CSP)',     'csp',       5.00, null, null, 2),
      (u.id, u.tenant_id, 'Royalties (Franchising)',     'royalties', 5.00, 1000, 3,    3),
      (u.id, u.tenant_id, 'Energia',                     'variavel', 10.00, null, null, 4),
      (u.id, u.tenant_id, 'Água',                        'variavel',  2.00, null, null, 5),
      (u.id, u.tenant_id, 'Taxa Cartão',                 'variavel',  5.00, null, null, 6);
  end loop;
end $$;

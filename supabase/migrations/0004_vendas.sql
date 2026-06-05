-- =====================================================================
-- LavSync · Vendas (Performance) — fonte de receita
-- Depende de 0001 (tenants, unidades) + 0003 (clientes)
-- Cada linha = 1 transação no totem (MAXPAN ou VM).
-- =====================================================================

-- ============ ENUMS ============
do $$ begin
  create type venda_tipo_pagamento as enum ('tef', 'qrcode', 'voucher', 'dinheiro', 'outro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type venda_tipo_cartao as enum ('credito', 'debito', 'nao_se_aplica');
exception when duplicate_object then null; end $$;

do $$ begin
  create type venda_situacao as enum ('sucesso', 'falha', 'pendente', 'cancelada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type venda_tipo_servico as enum ('lavagem', 'secagem', 'combo', 'indefinido');
exception when duplicate_object then null; end $$;

-- ============ VENDAS ============
create table if not exists public.vendas (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,

  -- Identificador externo da transação (chave de dedupe entre uploads)
  requisicao text,                              -- "39553504915063" (TEF) ou hash gerado
  importacao_id uuid,

  -- Tempo
  data_venda timestamptz not null,

  -- Equipamento / PDV
  equipamento text,                             -- "TOT10L-00/176246 (B827EBDEC0AC)"
  pdv text,                                     -- "Xô Varal Buritis"

  -- Status
  situacao venda_situacao not null default 'sucesso',
  erro text,
  detalhes_erro text,

  -- Pagamento
  tipo_pagamento venda_tipo_pagamento not null,
  valor numeric(12,2) not null default 0,       -- valor pago (com desconto aplicado)
  valor_sem_desconto numeric(12,2),
  desconto numeric(12,2) generated always as (
    coalesce(valor_sem_desconto, valor) - valor
  ) stored,

  -- Cartão (apenas quando tipo_pagamento = 'tef')
  bandeira_cartao text,                         -- "Visa", "Mastercard", "Elo"
  tipo_cartao venda_tipo_cartao,
  numero_cartao text,                           -- "4783********4766" (mascarado)
  autorizador text,                             -- "PIX (Pagar.me)" pra QRCode, banco pra TEF
  cod_autorizacao text,

  -- Voucher (cortesia, fidelidade, etc)
  voucher_codigo text,
  voucher_categoria text,                       -- "Cortesia"

  -- Cupom (desconto promocional)
  cupom_codigo text,                            -- "INAUGURA20", "LAVAR123", "SECAR123"
  cupom_requisicao text,

  -- Tipo de serviço (heurística por valor — atualiza quando MAXPAN API liberar ciclos reais)
  tipo_servico venda_tipo_servico not null default 'indefinido',

  -- Cliente embutido (cache pra quando não tem FK)
  cpf text,
  nome_cliente text,
  telefone_cliente text,

  -- Provedor pagamento
  provedor text,                                -- "Vertipay"
  adquirente text,                              -- "Stone"

  -- Origem
  origem_sistema text not null default 'maxpan',

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Dedupe por (unidade, requisicao) quando a requisição existe
create unique index if not exists ux_vendas_unidade_requisicao
  on public.vendas (unidade_id, requisicao)
  where requisicao is not null and requisicao <> '';

-- Pra casos sem requisicao (raros), evitar duplicação por (unidade, data, valor, cpf)
create unique index if not exists ux_vendas_unidade_assinatura
  on public.vendas (unidade_id, data_venda, valor, coalesce(cpf, ''))
  where requisicao is null or requisicao = '';

create index if not exists idx_vendas_tenant on public.vendas(tenant_id);
create index if not exists idx_vendas_unidade_data on public.vendas(unidade_id, data_venda desc);
create index if not exists idx_vendas_cliente on public.vendas(cliente_id) where cliente_id is not null;
create index if not exists idx_vendas_cpf on public.vendas(unidade_id, cpf) where cpf is not null;
create index if not exists idx_vendas_pagamento on public.vendas(unidade_id, tipo_pagamento);
create index if not exists idx_vendas_cupom on public.vendas(unidade_id, cupom_codigo) where cupom_codigo is not null;
create index if not exists idx_vendas_voucher on public.vendas(unidade_id, voucher_codigo) where voucher_codigo is not null;
create index if not exists idx_vendas_servico on public.vendas(unidade_id, tipo_servico, data_venda desc);

-- ============ IMPORTAÇÕES ============
create table if not exists public.vendas_importacoes (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  usuario_id uuid references public.usuarios(id) on delete set null,

  arquivo_nome text not null,
  arquivo_tamanho integer,
  origem_sistema text not null default 'maxpan',
  modo text not null default 'append',

  total_linhas integer not null default 0,
  total_inseridos integer not null default 0,
  total_ignorados integer not null default 0,
  total_erros integer not null default 0,
  total_clientes_linkados integer not null default 0,
  erros jsonb,

  status text not null default 'pendente',
  snapshot_em timestamptz,

  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);

create index if not exists idx_vendas_importacoes_unidade
  on public.vendas_importacoes(unidade_id, criado_em desc);

-- ============ TRIGGERS ============
drop trigger if exists trg_vendas_upd on public.vendas;
create trigger trg_vendas_upd before update on public.vendas
  for each row execute function public.set_atualizado_em();

-- ============ RLS ============
alter table public.vendas enable row level security;
alter table public.vendas_importacoes enable row level security;

drop policy if exists "vendas_tenant" on public.vendas;
create policy "vendas_tenant" on public.vendas
  for all using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

drop policy if exists "vendas_importacoes_tenant" on public.vendas_importacoes;
create policy "vendas_importacoes_tenant" on public.vendas_importacoes
  for all using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

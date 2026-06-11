-- =====================================================================
-- LavSync · 0023 · Engenharia de Custos por unidade
-- Permite calcular margem de contribuição por ciclo (lavagem/secagem):
-- - Sabão, amaciante, energia elétrica, água por ciclo
-- - Overhead elétrico de equipamentos sempre ligados (ar, lâmpadas, etc)
-- =====================================================================

create table if not exists public.financeiro_engenharia_custos (
  unidade_id uuid primary key references public.unidades(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  -- ─── INSUMOS POR CICLO DE LAVAGEM ────────────────────────────────
  preco_galao_sabao_litros          numeric(10,3) not null default 20,       -- L
  preco_galao_sabao_valor           numeric(12,2) not null default 887.29,   -- R$
  ml_sabao_por_ciclo                numeric(10,2) not null default 40,       -- mL

  preco_galao_amaciante_litros      numeric(10,3) not null default 20,
  preco_galao_amaciante_valor       numeric(12,2) not null default 674.00,
  ml_amaciante_por_ciclo            numeric(10,2) not null default 40,

  -- ─── ENERGIA ────────────────────────────────────────────────────
  tarifa_kwh                        numeric(10,4) not null default 1.0000,   -- R$/kWh
  kwh_por_ciclo_lavagem             numeric(10,4) not null default 0.2300,
  kwh_por_ciclo_secagem             numeric(10,4) not null default 4.0000,

  -- ─── ÁGUA ───────────────────────────────────────────────────────
  conta_agua_mensal                 numeric(12,2) not null default 0,        -- R$/mês

  -- ─── OVERHEAD ELÉTRICO (equipamentos sempre ligados) ────────────
  ar_condicionado_btus              integer       not null default 18000,
  ar_condicionado_kwh_hora          numeric(10,4) not null default 1.8000,   -- estimado p/ 18kBTU
  lampadas_qtd                      integer       not null default 5,
  lampada_kwh_hora                  numeric(10,4) not null default 0.0150,   -- LED 15W
  cameras_qtd                       integer       not null default 4,
  camera_kwh_hora                   numeric(10,4) not null default 0.0050,
  tv_kwh_hora                       numeric(10,4) not null default 0.0600,
  totem_kwh_hora                    numeric(10,4) not null default 0.1000,
  internet_kwh_hora                 numeric(10,4) not null default 0.0200,
  horas_operacao_dia                numeric(5,2)  not null default 17,       -- 6h às 23h
  dias_operacao_mes                 integer       not null default 30,

  -- ─── PREÇOS DE VENDA ────────────────────────────────────────────
  preco_lavagem                     numeric(10,2) not null default 17.00,
  preco_secagem                     numeric(10,2) not null default 16.99,

  criado_em                         timestamptz   not null default now(),
  atualizado_em                     timestamptz   not null default now()
);

create index if not exists ix_eng_custos_tenant on public.financeiro_engenharia_custos(tenant_id);

-- ─── RLS ────────────────────────────────────────────────────────
alter table public.financeiro_engenharia_custos enable row level security;
drop policy if exists "ec_tenant" on public.financeiro_engenharia_custos;
create policy "ec_tenant" on public.financeiro_engenharia_custos
  for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

-- ─── Seed: cria 1 linha por unidade existente com defaults ─────────
insert into public.financeiro_engenharia_custos (unidade_id, tenant_id)
select u.id, u.tenant_id
from public.unidades u
where not exists (
  select 1 from public.financeiro_engenharia_custos ec where ec.unidade_id = u.id
);

-- ─── Trigger pra manter atualizado_em ──────────────────────────────
create or replace function public.tg_eng_custos_atualizado_em()
returns trigger as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tg_eng_custos_atualizado on public.financeiro_engenharia_custos;
create trigger tg_eng_custos_atualizado
  before update on public.financeiro_engenharia_custos
  for each row execute function public.tg_eng_custos_atualizado_em();

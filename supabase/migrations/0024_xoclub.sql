-- =====================================================================
-- LavSync · 0024 · XÔ CLUB - Sistema de Recompensas Xô Varal
-- Ganhe Xô Coins e troque por benefícios.
-- 1 BRL = 1 XC (round)
-- =====================================================================

-- ─── ENUMS ──────────────────────────────────────────────────────────
do $$ begin
  create type xoclub_nivel as enum ('bronze','prata','ouro','diamante');
exception when duplicate_object then null; end $$;

do $$ begin
  create type xoclub_movimento_tipo as enum (
    'venda',            -- venda concluída (lavagem/secagem/combo)
    'compra_store',     -- compra na store (configurável)
    'bonus_primeira_lavagem',
    'bonus_cadastro',
    'bonus_aniversario',
    'bonus_avaliacao_google',
    'bonus_indicador',
    'bonus_indicado',
    'campanha_aceleracao',
    'ajuste_manual',
    'resgate',
    'expiracao',
    'estorno'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type xoclub_resgate_status as enum (
    'solicitado', 'aprovado', 'entregue', 'cancelado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type xoclub_produto_categoria as enum (
    'fisico',            -- adesivo, chaveiro, caneca etc
    'operacional'        -- desconto, lavagem grátis etc
  );
exception when duplicate_object then null; end $$;

-- ─── CONFIG GLOBAL (por tenant) ─────────────────────────────────────
create table if not exists public.xoclub_config (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  -- Conversão BRL → XC (default 1.0 = 1:1)
  conversao_brl_xc numeric(8,4) not null default 1.0,
  -- Vencimento dos pontos: null = sem vencimento, ou meses (6/12/24)
  vencimento_meses integer null default 12,
  -- Multiplicadores de XC em campanhas especiais por nível
  multiplicador_bronze_campanha numeric(5,2) not null default 1.00,
  multiplicador_prata_campanha numeric(5,2) not null default 1.05,
  multiplicador_ouro_campanha numeric(5,2) not null default 1.10,
  multiplicador_diamante_campanha numeric(5,2) not null default 1.20,
  -- Bônus de engajamento (XC)
  bonus_primeira_lavagem integer not null default 30,
  bonus_cadastro_completo integer not null default 20,
  bonus_aniversario integer not null default 100,
  bonus_avaliacao_google integer not null default 50,
  bonus_indicador integer not null default 100,
  bonus_indicado integer not null default 50,
  -- Faixas de nível
  nivel_prata_min integer not null default 300,
  nivel_ouro_min integer not null default 800,
  nivel_diamante_min integer not null default 2000,
  -- Compra na Store gera XC?
  store_gera_xc boolean not null default false,
  -- Notificações
  alerta_proximo_resgate_xc integer not null default 50,
  alerta_proximo_nivel_xc integer not null default 80,
  alerta_inativo_dias integer not null default 45,
  alerta_expiracao_dias integer not null default 30,

  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ─── SALDOS por cliente ─────────────────────────────────────────────
-- Tabela materializada — atualizada via triggers ou função recalcular_saldo.
create table if not exists public.xoclub_saldos (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,  -- unidade principal
  saldo_atual integer not null default 0,
  total_ganho_lifetime integer not null default 0,
  total_resgatado_lifetime integer not null default 0,
  total_expirado_lifetime integer not null default 0,
  nivel xoclub_nivel not null default 'bronze',
  ultima_movimentacao timestamptz null,
  ultima_atividade_em timestamptz null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists ix_xoclub_saldos_tenant on public.xoclub_saldos(tenant_id);
create index if not exists ix_xoclub_saldos_nivel on public.xoclub_saldos(nivel);
create index if not exists ix_xoclub_saldos_saldo on public.xoclub_saldos(saldo_atual desc);

-- ─── MOVIMENTOS (histórico, auditoria) ──────────────────────────────
create table if not exists public.xoclub_movimentos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,
  venda_id uuid references public.vendas(id) on delete set null,
  tipo xoclub_movimento_tipo not null,
  valor integer not null,                  -- positivo = ganho, negativo = saída
  saldo_resultante integer null,           -- snapshot após movimento (audit)
  multiplicador numeric(5,2) null,
  observacoes text null,
  expira_em timestamptz null,              -- quando esse crédito vai expirar
  data_movimento timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

create index if not exists ix_xoclub_mov_cliente on public.xoclub_movimentos(cliente_id, data_movimento desc);
create index if not exists ix_xoclub_mov_tenant on public.xoclub_movimentos(tenant_id);
create index if not exists ix_xoclub_mov_tipo on public.xoclub_movimentos(tipo);
create index if not exists ix_xoclub_mov_expira on public.xoclub_movimentos(expira_em) where expira_em is not null;
create index if not exists ix_xoclub_mov_venda on public.xoclub_movimentos(venda_id) where venda_id is not null;

-- ─── PRODUTOS / Store ──────────────────────────────────────────────
create table if not exists public.xoclub_produtos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  descricao text null,
  categoria xoclub_produto_categoria not null default 'fisico',
  custo_xc integer not null,
  valor_percebido_brl numeric(10,2) null,
  custo_operacional_brl numeric(10,2) null,  -- custo real pra empresa
  estoque integer null,                       -- null = ilimitado (operacional)
  estoque_alerta integer null default 5,
  imagem_url text null,
  -- Recompensas operacionais (configuram efeito ao resgatar)
  efeito_tipo text null,                      -- 'desconto_brl', 'lavagem_gratis', 'secagem_gratis', 'ciclo_completo'
  efeito_valor_brl numeric(10,2) null,        -- 5, 10 ... pro desconto
  validade_dias integer null default 30,      -- validade do voucher gerado
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists ix_xoclub_produtos_tenant on public.xoclub_produtos(tenant_id, ativo, ordem);

-- ─── RESGATES ───────────────────────────────────────────────────────
create table if not exists public.xoclub_resgates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  produto_id uuid not null references public.xoclub_produtos(id) on delete restrict,
  unidade_id uuid references public.unidades(id) on delete set null,
  custo_xc integer not null,
  status xoclub_resgate_status not null default 'solicitado',
  voucher_codigo text null,                   -- gerado quando aprovado
  voucher_expira_em timestamptz null,
  observacoes text null,
  solicitado_em timestamptz not null default now(),
  aprovado_em timestamptz null,
  aprovado_por uuid references public.usuarios(id) on delete set null,
  entregue_em timestamptz null,
  cancelado_em timestamptz null,
  cancelado_motivo text null,
  movimento_id uuid references public.xoclub_movimentos(id) on delete set null
);

create index if not exists ix_xoclub_resg_cliente on public.xoclub_resgates(cliente_id, solicitado_em desc);
create index if not exists ix_xoclub_resg_status on public.xoclub_resgates(status, solicitado_em desc);
create index if not exists ix_xoclub_resg_voucher on public.xoclub_resgates(voucher_codigo) where voucher_codigo is not null;

-- ─── CAMPANHAS DE ACELERAÇÃO ────────────────────────────────────────
create table if not exists public.xoclub_campanhas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  descricao text null,
  multiplicador numeric(5,2) not null,        -- 2.0, 3.0, 5.0 etc
  inicio timestamptz not null,
  fim timestamptz not null,
  -- Restrições opcionais
  dia_semana_bitmap integer null,             -- bitmask 0-127 (dom=1..sab=64). Null = todos
  hora_inicio time null,
  hora_fim time null,
  unidades_alvo uuid[] null,                  -- null = todas
  niveis_alvo xoclub_nivel[] null,            -- null = todos
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

create index if not exists ix_xoclub_camp_periodo on public.xoclub_campanhas(inicio, fim) where ativa;

-- ─── BÔNUS de engajamento (controle de unicidade) ───────────────────
-- Garante que bônus "uma única vez" só é creditado uma vez por cliente.
create table if not exists public.xoclub_bonus_eventos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  tipo xoclub_movimento_tipo not null,         -- só os bonus_*
  valor_creditado integer not null,
  movimento_id uuid references public.xoclub_movimentos(id) on delete set null,
  data_evento timestamptz not null default now(),
  -- Bonus únicos: 1 linha por (cliente, tipo) exceto aniversário (1 por ano)
  unique (cliente_id, tipo)
);

create index if not exists ix_xoclub_bonus_cliente on public.xoclub_bonus_eventos(cliente_id);

-- ─── INDICAÇÕES ─────────────────────────────────────────────────────
create table if not exists public.xoclub_indicacoes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  indicador_cliente_id uuid not null references public.clientes(id) on delete cascade,
  indicado_cliente_id uuid references public.clientes(id) on delete set null,
  codigo text not null unique,                 -- código gerado pra compartilhar
  telefone_indicado text null,
  nome_indicado text null,
  status text not null default 'pendente',     -- pendente, convertida, expirada
  convertida_em timestamptz null,
  venda_primeira_id uuid references public.vendas(id) on delete set null,
  xc_indicador integer null,
  xc_indicado integer null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz null
);

create index if not exists ix_xoclub_ind_indicador on public.xoclub_indicacoes(indicador_cliente_id);
create index if not exists ix_xoclub_ind_status on public.xoclub_indicacoes(status);

-- ─── HELPER: Nível a partir de saldo lifetime ──────────────────────
create or replace function public.xoclub_nivel_para_saldo(
  total_ganho integer, t_id uuid
) returns xoclub_nivel as $$
declare
  cfg record;
begin
  select * into cfg from public.xoclub_config where tenant_id = t_id;
  if not found then
    -- defaults
    if total_ganho >= 2000 then return 'diamante';
    elsif total_ganho >= 800 then return 'ouro';
    elsif total_ganho >= 300 then return 'prata';
    else return 'bronze';
    end if;
  end if;
  if total_ganho >= cfg.nivel_diamante_min then return 'diamante';
  elsif total_ganho >= cfg.nivel_ouro_min then return 'ouro';
  elsif total_ganho >= cfg.nivel_prata_min then return 'prata';
  else return 'bronze';
  end if;
end;
$$ language plpgsql stable;

-- ─── HELPER: Recalcula saldo do cliente a partir dos movimentos ─────
create or replace function public.xoclub_recalcular_saldo(p_cliente uuid)
returns void as $$
declare
  v_tenant uuid;
  v_unidade uuid;
  v_saldo integer;
  v_total_ganho integer;
  v_total_resgatado integer;
  v_total_expirado integer;
  v_ultima_mov timestamptz;
  v_nivel xoclub_nivel;
begin
  select tenant_id, unidade_id into v_tenant, v_unidade
    from public.clientes where id = p_cliente;
  if v_tenant is null then return; end if;

  select
    coalesce(sum(valor), 0),
    coalesce(sum(case when valor > 0 then valor else 0 end), 0),
    coalesce(sum(case when valor < 0 and tipo = 'resgate' then -valor else 0 end), 0),
    coalesce(sum(case when valor < 0 and tipo = 'expiracao' then -valor else 0 end), 0),
    max(data_movimento)
  into v_saldo, v_total_ganho, v_total_resgatado, v_total_expirado, v_ultima_mov
  from public.xoclub_movimentos
  where cliente_id = p_cliente;

  v_nivel := public.xoclub_nivel_para_saldo(v_total_ganho, v_tenant);

  insert into public.xoclub_saldos (
    cliente_id, tenant_id, unidade_id, saldo_atual,
    total_ganho_lifetime, total_resgatado_lifetime, total_expirado_lifetime,
    nivel, ultima_movimentacao, atualizado_em
  ) values (
    p_cliente, v_tenant, v_unidade, v_saldo,
    v_total_ganho, v_total_resgatado, v_total_expirado,
    v_nivel, v_ultima_mov, now()
  )
  on conflict (cliente_id) do update set
    saldo_atual = excluded.saldo_atual,
    total_ganho_lifetime = excluded.total_ganho_lifetime,
    total_resgatado_lifetime = excluded.total_resgatado_lifetime,
    total_expirado_lifetime = excluded.total_expirado_lifetime,
    nivel = excluded.nivel,
    ultima_movimentacao = excluded.ultima_movimentacao,
    unidade_id = excluded.unidade_id,
    atualizado_em = now();
end;
$$ language plpgsql security definer;

-- ─── TRIGGER: cada vez que movimentos muda, recalcula saldo ────────
create or replace function public.xoclub_trg_mov_saldo()
returns trigger as $$
begin
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') then
    perform public.xoclub_recalcular_saldo(new.cliente_id);
  end if;
  if (tg_op = 'DELETE') then
    perform public.xoclub_recalcular_saldo(old.cliente_id);
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists xoclub_trg_mov_saldo on public.xoclub_movimentos;
create trigger xoclub_trg_mov_saldo
  after insert or update or delete on public.xoclub_movimentos
  for each row execute function public.xoclub_trg_mov_saldo();

-- ─── TRIGGER: ao concluir venda com cliente_id, credita XC ──────────
create or replace function public.xoclub_creditar_venda()
returns trigger as $$
declare
  v_cfg record;
  v_xc integer;
  v_expira timestamptz;
begin
  if new.cliente_id is null then return new; end if;
  if new.situacao <> 'sucesso' then return new; end if;
  if coalesce(new.valor, 0) <= 0 then return new; end if;

  -- Dedupe: se já creditou pra essa venda, sai
  if exists (select 1 from public.xoclub_movimentos where venda_id = new.id and tipo = 'venda') then
    return new;
  end if;

  select * into v_cfg from public.xoclub_config where tenant_id = new.tenant_id;
  if not found or v_cfg.ativo = false then return new; end if;

  v_xc := round(new.valor * v_cfg.conversao_brl_xc);
  if v_xc <= 0 then return new; end if;

  if v_cfg.vencimento_meses is not null then
    v_expira := new.data_venda + (v_cfg.vencimento_meses || ' months')::interval;
  end if;

  insert into public.xoclub_movimentos (
    tenant_id, cliente_id, unidade_id, venda_id, tipo, valor,
    observacoes, expira_em, data_movimento
  ) values (
    new.tenant_id, new.cliente_id, new.unidade_id, new.id, 'venda', v_xc,
    'Crédito de venda · R$ ' || new.valor || ' → ' || v_xc || ' XC',
    v_expira, new.data_venda
  );

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists xoclub_trg_creditar_venda on public.vendas;
create trigger xoclub_trg_creditar_venda
  after insert or update of situacao on public.vendas
  for each row execute function public.xoclub_creditar_venda();

-- ─── RLS ────────────────────────────────────────────────────────────
alter table public.xoclub_config enable row level security;
drop policy if exists "xc_cfg" on public.xoclub_config;
create policy "xc_cfg" on public.xoclub_config for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

alter table public.xoclub_saldos enable row level security;
drop policy if exists "xc_sal" on public.xoclub_saldos;
create policy "xc_sal" on public.xoclub_saldos for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

alter table public.xoclub_movimentos enable row level security;
drop policy if exists "xc_mov" on public.xoclub_movimentos;
create policy "xc_mov" on public.xoclub_movimentos for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

alter table public.xoclub_produtos enable row level security;
drop policy if exists "xc_prod" on public.xoclub_produtos;
create policy "xc_prod" on public.xoclub_produtos for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

alter table public.xoclub_resgates enable row level security;
drop policy if exists "xc_resg" on public.xoclub_resgates;
create policy "xc_resg" on public.xoclub_resgates for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

alter table public.xoclub_campanhas enable row level security;
drop policy if exists "xc_camp" on public.xoclub_campanhas;
create policy "xc_camp" on public.xoclub_campanhas for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

alter table public.xoclub_bonus_eventos enable row level security;
drop policy if exists "xc_bon" on public.xoclub_bonus_eventos;
create policy "xc_bon" on public.xoclub_bonus_eventos for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

alter table public.xoclub_indicacoes enable row level security;
drop policy if exists "xc_ind" on public.xoclub_indicacoes;
create policy "xc_ind" on public.xoclub_indicacoes for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

-- ─── SEED: config inicial por tenant ────────────────────────────────
insert into public.xoclub_config (tenant_id)
select id from public.tenants
where not exists (select 1 from public.xoclub_config c where c.tenant_id = tenants.id);

-- ─── SEED: produtos iniciais (Tabela de Resgate) ────────────────────
insert into public.xoclub_produtos
  (tenant_id, nome, descricao, categoria, custo_xc, valor_percebido_brl, ordem)
select t.id, p.nome, p.descricao, p.categoria, p.custo_xc, p.valor_brl, p.ordem
from public.tenants t,
  (values
    -- Físicos
    ('Adesivo Xô Varal',  'Adesivo da marca · brindes',                 'fisico'::xoclub_produto_categoria,  80,   5.00,  10),
    ('Chaveiro Xô Varal', 'Chaveiro oficial',                            'fisico'::xoclub_produto_categoria, 180,  12.00,  20),
    ('Caneca Xô Varal',   'Caneca cerâmica 300ml',                       'fisico'::xoclub_produto_categoria, 300,  20.00,  30),
    ('Agenda Xô Varal',   'Agenda anual com brindes da marca',           'fisico'::xoclub_produto_categoria, 450,  30.00,  40),
    ('Ecobag Xô Varal',   'Ecobag sustentável de algodão',                'fisico'::xoclub_produto_categoria, 500,  35.00,  50),
    ('Camiseta Xô Varal', 'Camiseta oficial · vários tamanhos',          'fisico'::xoclub_produto_categoria, 850,  59.00,  60),
    ('Kit Premium',       'Camiseta + Caneca + Ecobag',                  'fisico'::xoclub_produto_categoria,1500, 110.00,  70)
  ) as p(nome, descricao, categoria, custo_xc, valor_brl, ordem)
where not exists (
  select 1 from public.xoclub_produtos x where x.tenant_id = t.id and x.nome = p.nome
);

-- Operacionais (efeito ao resgatar) — alta margem pra operação
insert into public.xoclub_produtos
  (tenant_id, nome, descricao, categoria, custo_xc, valor_percebido_brl, custo_operacional_brl,
   efeito_tipo, efeito_valor_brl, validade_dias, ordem)
select t.id, p.nome, p.descricao, p.categoria::xoclub_produto_categoria,
       p.custo_xc, p.valor_brl, p.custo_brl, p.efeito, p.efeito_valor, 30, p.ordem
from public.tenants t,
  (values
    ('Desconto R$ 5',     'Vale R$ 5 de desconto em qualquer serviço',   'operacional',150,   5.00, 5.00, 'desconto_brl',     5.00, 110),
    ('Desconto R$ 10',    'Vale R$ 10 de desconto em qualquer serviço',  'operacional',300,  10.00,10.00, 'desconto_brl',    10.00, 120),
    ('Lavagem Grátis',    '1 ciclo de lavagem grátis',                   'operacional',450,  17.00, 3.35, 'lavagem_gratis',  17.00, 130),
    ('Secagem Grátis',    '1 ciclo de secagem grátis',                   'operacional',450,  16.99, 4.00, 'secagem_gratis',  16.99, 140),
    ('Ciclo Completo',    'Lavagem + Secagem grátis',                    'operacional',800,  34.00, 7.35, 'ciclo_completo',  34.00, 150)
  ) as p(nome, descricao, categoria, custo_xc, valor_brl, custo_brl, efeito, efeito_valor, ordem)
where not exists (
  select 1 from public.xoclub_produtos x where x.tenant_id = t.id and x.nome = p.nome
);

-- ─── BACKFILL: credita XC pra vendas históricas concluídas ──────────
-- Isso pode ser pesado em base grande — mas pra ~10k vendas é OK.
-- Limita a vendas dos últimos 12 meses pra não inflar saldo retroativo absurdo.
do $$
declare
  v_count integer := 0;
begin
  with rows_inseridas as (
    insert into public.xoclub_movimentos
      (tenant_id, cliente_id, unidade_id, venda_id, tipo, valor,
       observacoes, expira_em, data_movimento)
    select
      v.tenant_id, v.cliente_id, v.unidade_id, v.id, 'venda',
      round(v.valor * coalesce(c.conversao_brl_xc, 1.0))::integer,
      'Backfill venda · R$ ' || v.valor,
      case when c.vencimento_meses is not null
        then v.data_venda + (c.vencimento_meses || ' months')::interval
      end,
      v.data_venda
    from public.vendas v
    left join public.xoclub_config c on c.tenant_id = v.tenant_id
    where v.cliente_id is not null
      and v.situacao = 'sucesso'
      and v.valor > 0
      and v.data_venda >= now() - interval '12 months'
      and not exists (
        select 1 from public.xoclub_movimentos m where m.venda_id = v.id and m.tipo = 'venda'
      )
    returning 1
  )
  select count(*) into v_count from rows_inseridas;
  raise notice 'Backfill XÔ Club: % movimentos inseridos', v_count;
end $$;

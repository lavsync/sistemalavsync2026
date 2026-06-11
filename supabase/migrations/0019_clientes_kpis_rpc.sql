-- =====================================================================
-- LavSync · 0019 · RPC clientes_kpis agregada em SQL
-- Fix: cliente count via SELECT * estava limitado a 1000 linhas (default Supabase)
-- =====================================================================

create or replace function public.get_clientes_kpis(unidade_ids uuid[])
returns table (
  total bigint,
  ativos_90d bigint,
  em_risco bigint,
  dormentes bigint,
  novos_30d bigint,
  ltv_medio numeric,
  ticket_medio numeric
)
language sql
stable
security definer
as $$
  with base as (
    select
      ultima_compra_em,
      cadastrado_em,
      coalesce(compras_total_valor, 0)::numeric as ltv,
      coalesce(compras_total_qtd, 0)::numeric   as qtd,
      coalesce(compras_90d_qtd, 0)::numeric     as qtd_90d,
      now() - ultima_compra_em                  as desde_ult,
      now() - cadastrado_em                     as desde_cad
    from public.clientes
    where unidade_id = any(unidade_ids)
  ),
  agg as (
    select
      count(*) as total,
      count(*) filter (
        where (ultima_compra_em is not null and desde_ult <= interval '90 days')
           or qtd_90d > 0
      ) as ativos_90d,
      count(*) filter (
        where ultima_compra_em is not null
          and desde_ult > interval '25 days'
          and desde_ult <= interval '60 days'
      ) as em_risco,
      count(*) filter (
        where (ultima_compra_em is not null and desde_ult > interval '60 days')
           or (ultima_compra_em is null and qtd = 0)
      ) as dormentes,
      count(*) filter (
        where cadastrado_em is not null and desde_cad <= interval '30 days'
      ) as novos_30d,
      coalesce(avg(ltv), 0) as ltv_medio,
      coalesce(avg(ltv / nullif(qtd, 0)) filter (where qtd > 0), 0) as ticket_medio
    from base
  )
  select
    total,
    ativos_90d,
    em_risco,
    dormentes,
    novos_30d,
    round(ltv_medio::numeric, 2)    as ltv_medio,
    round(ticket_medio::numeric, 2) as ticket_medio
  from agg;
$$;

grant execute on function public.get_clientes_kpis(uuid[]) to authenticated, anon;

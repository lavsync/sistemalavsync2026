-- =====================================================================
-- LavSync · 0020 · RPCs RFM + Gênero agregados em SQL
-- Fix: SELECT * em clientes/vendas estava limitado a 1000 (default Supabase)
-- =====================================================================

-- ─── Segmentação RFM ─────────────────────────────────────────────
create or replace function public.get_segmentacao_rfm(unidade_ids uuid[])
returns table (
  segmento text,
  qtd bigint
)
language sql
stable
security definer
as $$
  with base as (
    select
      coalesce(compras_total_valor, 0)::numeric as ltv,
      coalesce(compras_total_qtd, 0)::numeric   as qtd,
      coalesce(compras_90d_qtd, 0)::numeric     as qtd_90d,
      extract(epoch from (now() - ultima_compra_em)) / 86400 as dias_ult,
      extract(epoch from (now() - cadastrado_em))   / 86400 as dias_cad
    from public.clientes
    where unidade_id = any(unidade_ids)
  ),
  /* Top 20% por LTV → mesmo critério usado no JS antigo */
  corte as (
    select coalesce(
      percentile_cont(0.8) within group (order by ltv),
      0
    )::numeric as top20
    from base
  ),
  classificado as (
    select
      case
        when qtd = 0 and dias_cad <= 60 then 'Novos'
        when ltv >= (select top20 from corte) and dias_ult <= 60 and qtd >= 3 then 'Campeões'
        when qtd >= 3 and dias_ult <= 90 then 'Leais'
        when qtd between 1 and 2 and dias_ult <= 60 then 'Promissores'
        when dias_ult > 25 and dias_ult <= 60 then 'Em risco'
        else 'Dormentes'
      end as segmento
    from base
  )
  select segmento, count(*) as qtd
  from classificado
  group by segmento
  order by qtd desc;
$$;
grant execute on function public.get_segmentacao_rfm(uuid[]) to authenticated, anon;

-- ─── Distribuição de gênero ─────────────────────────────────────
create or replace function public.get_distribuicao_genero(unidade_ids uuid[])
returns table (
  genero_key text,
  qtd bigint
)
language sql
stable
security definer
as $$
  with base as (
    select
      case
        when trim(coalesce(genero, '')) in ('Masculino','Feminino','Outro') then trim(genero)
        else 'Nao informado'
      end as genero_key
    from public.clientes
    where unidade_id = any(unidade_ids)
  )
  select genero_key, count(*) as qtd
  from base
  group by genero_key;
$$;
grant execute on function public.get_distribuicao_genero(uuid[]) to authenticated, anon;

-- =====================================================================
-- LavSync · 0022 · RPC contagem agregada por importacao_id
-- Substitui SELECT * + count em JS (limitado a 1000) por SQL agregado
-- =====================================================================

create or replace function public.get_vendas_por_importacao(imp_ids uuid[])
returns table (importacao_id uuid, total bigint)
language sql stable security definer
as $$
  select importacao_id, count(*)::bigint
  from public.vendas
  where importacao_id = any(imp_ids)
    and importacao_id is not null
  group by importacao_id;
$$;
grant execute on function public.get_vendas_por_importacao(uuid[]) to authenticated, anon;

create or replace function public.get_clientes_por_importacao(imp_ids uuid[])
returns table (
  importacao_id uuid,
  total bigint,
  com_venda bigint
)
language sql stable security definer
as $$
  select
    importacao_id,
    count(*)::bigint as total,
    count(*) filter (where coalesce(compras_total_qtd, 0) > 0)::bigint as com_venda
  from public.clientes
  where importacao_id = any(imp_ids)
    and importacao_id is not null
  group by importacao_id;
$$;
grant execute on function public.get_clientes_por_importacao(uuid[]) to authenticated, anon;

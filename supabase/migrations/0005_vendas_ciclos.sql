-- =====================================================================
-- LavSync · Vendas — quantidade de ciclos por venda
-- Regra (definida pelo Daniel 2026-06-05):
--   LAVAGEM: R$ 17,00 (1 ciclo) · também 15,00 (preço promocional/antigo)
--   SECAGEM: R$ 16,99 (1 ciclo) · também 14,99 (preço promocional/antigo)
--   Múltiplos exatos = N ciclos (R$ 34,00 = 2 lavagens, R$ 50,97 = 3 secagens)
--   Cupom LAVAR* força lavagem, SECAR* força secagem, INAUGURA20 = lavagem
-- =====================================================================

alter table public.vendas
  add column if not exists quantidade_ciclos integer not null default 1;

-- ─── Funções escalares ───────────────────────────────────────────────────
-- Detecta múltiplos exatos de um preço base (até max_n ciclos).
-- Tolerância 1 centavo. Retorna 0 se não bater.
create or replace function public.detectar_multiplo(
  p_valor numeric,
  p_preco numeric,
  p_max integer default 10
) returns integer
language sql immutable as $$
  select coalesce(
    (select n
       from generate_series(1, p_max) n
      where abs(p_valor - (n * p_preco)) < 0.005
      limit 1),
    0
  );
$$;

create or replace function public.inferir_tipo_servico(
  p_valor numeric,
  p_cupom text default null
) returns public.venda_tipo_servico
language sql immutable as $$
  select case
    when upper(coalesce(p_cupom, '')) like 'LAVAR%' then 'lavagem'::public.venda_tipo_servico
    when upper(coalesce(p_cupom, '')) = 'INAUGURA20' then 'lavagem'::public.venda_tipo_servico
    when upper(coalesce(p_cupom, '')) like 'SECAR%' then 'secagem'::public.venda_tipo_servico
    when public.detectar_multiplo(p_valor, 17.00) > 0 then 'lavagem'::public.venda_tipo_servico
    when public.detectar_multiplo(p_valor, 16.99) > 0 then 'secagem'::public.venda_tipo_servico
    when public.detectar_multiplo(p_valor, 15.00) > 0 then 'lavagem'::public.venda_tipo_servico
    when public.detectar_multiplo(p_valor, 14.99) > 0 then 'secagem'::public.venda_tipo_servico
    else 'indefinido'::public.venda_tipo_servico
  end;
$$;

create or replace function public.inferir_ciclos(
  p_valor numeric,
  p_cupom text default null
) returns integer
language sql immutable as $$
  select greatest(
    1,
    case
      when upper(coalesce(p_cupom, '')) like 'LAVAR%' then 1
      when upper(coalesce(p_cupom, '')) = 'INAUGURA20' then 1
      when upper(coalesce(p_cupom, '')) like 'SECAR%' then 1
      when public.detectar_multiplo(p_valor, 17.00) > 0 then public.detectar_multiplo(p_valor, 17.00)
      when public.detectar_multiplo(p_valor, 16.99) > 0 then public.detectar_multiplo(p_valor, 16.99)
      when public.detectar_multiplo(p_valor, 15.00) > 0 then public.detectar_multiplo(p_valor, 15.00)
      when public.detectar_multiplo(p_valor, 14.99) > 0 then public.detectar_multiplo(p_valor, 14.99)
      else 1
    end
  );
$$;

-- ─── Backfill em TODAS as vendas existentes ──────────────────────────────
update public.vendas
set tipo_servico = public.inferir_tipo_servico(coalesce(valor_sem_desconto, valor), cupom_codigo),
    quantidade_ciclos = public.inferir_ciclos(coalesce(valor_sem_desconto, valor), cupom_codigo);

create index if not exists idx_vendas_ciclos
  on public.vendas(unidade_id, tipo_servico, data_venda desc);

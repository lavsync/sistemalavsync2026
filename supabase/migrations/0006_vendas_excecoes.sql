-- =====================================================================
-- LavSync · Vendas — exceções de preço (faixas promocionais/combos)
-- Mapeamento dos valores que sobraram como indefinido (Daniel 2026-06-05):
--   R$ 8,49  → secagem 1 ciclo (50% off de R$ 16,99)
--   R$ 16,98 → secagem 1 ciclo (centavo a menos por arredondamento)
--   R$ 25,47 → secagem 2 ciclos (combo R$ 16,99 + meia R$ 8,49 ≈ 25,48)
-- =====================================================================

-- Sobrescreve a função pra incluir as exceções ANTES das regras gerais
create or replace function public.inferir_tipo_servico(
  p_valor numeric,
  p_cupom text default null
) returns public.venda_tipo_servico
language sql immutable as $$
  select case
    when upper(coalesce(p_cupom, '')) like 'LAVAR%' then 'lavagem'::public.venda_tipo_servico
    when upper(coalesce(p_cupom, '')) = 'INAUGURA20' then 'lavagem'::public.venda_tipo_servico
    when upper(coalesce(p_cupom, '')) like 'SECAR%' then 'secagem'::public.venda_tipo_servico
    -- Exceções específicas (faixas promocionais e centavos quebrados)
    when abs(p_valor - 8.49) < 0.005 then 'secagem'::public.venda_tipo_servico
    when abs(p_valor - 16.98) < 0.005 then 'secagem'::public.venda_tipo_servico
    when abs(p_valor - 25.47) < 0.005 then 'secagem'::public.venda_tipo_servico
    -- Regras gerais
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
      -- Exceções: R$ 25,47 = 2 ciclos, R$ 8,49 e 16,98 = 1
      when abs(p_valor - 25.47) < 0.005 then 2
      when abs(p_valor - 8.49) < 0.005 then 1
      when abs(p_valor - 16.98) < 0.005 then 1
      when public.detectar_multiplo(p_valor, 17.00) > 0 then public.detectar_multiplo(p_valor, 17.00)
      when public.detectar_multiplo(p_valor, 16.99) > 0 then public.detectar_multiplo(p_valor, 16.99)
      when public.detectar_multiplo(p_valor, 15.00) > 0 then public.detectar_multiplo(p_valor, 15.00)
      when public.detectar_multiplo(p_valor, 14.99) > 0 then public.detectar_multiplo(p_valor, 14.99)
      else 1
    end
  );
$$;

-- Backfill nos 21 indefinidos
update public.vendas
set tipo_servico = public.inferir_tipo_servico(coalesce(valor_sem_desconto, valor), cupom_codigo),
    quantidade_ciclos = public.inferir_ciclos(coalesce(valor_sem_desconto, valor), cupom_codigo)
where tipo_servico = 'indefinido';

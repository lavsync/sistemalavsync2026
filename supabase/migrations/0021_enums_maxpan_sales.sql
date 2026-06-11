-- =====================================================================
-- LavSync · 0021 · Novos valores de enum pro MAXPAN salesReport
-- "Saldo da carteira" → pagamento "carteira"
-- "Recarga" (recarga de saldo) → tipo_servico "recarga"
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on e.enumtypid = t.oid
    where t.typname = 'venda_tipo_pagamento' and e.enumlabel = 'carteira'
  ) then
    alter type venda_tipo_pagamento add value 'carteira';
  end if;
end$$;

do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on e.enumtypid = t.oid
    where t.typname = 'venda_tipo_servico' and e.enumlabel = 'recarga'
  ) then
    alter type venda_tipo_servico add value 'recarga';
  end if;
end$$;

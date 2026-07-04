-- =====================================================================
-- LavSync · 0048 · LavCoin vale R$ 0,05 + provisão no Financeiro
--
-- Regra (Daniel): cada LavCoin = R$ 0,05 no resgate. Como cada R$1 gasto
-- emite 1 LavCoin, a reserva a provisionar é 5% do faturamento — entra
-- no DRE como custo variável automático (editável na tela Financeiro).
-- =====================================================================

alter table public.xoclub_config
  add column if not exists valor_lavcoin_brl numeric(8,4) not null default 0.05;

-- Provisão LavCoin como custo variável do DRE, por unidade (5% s/ fat.)
insert into public.financeiro_custos_variaveis
  (unidade_id, tenant_id, descricao, tipo, percentual_faturamento, ativo, ordem)
select u.id, u.tenant_id, 'Provisão LavCoin (XÔ Club · R$0,05/coin)', 'variavel', 5, true, 90
from public.unidades u
where not exists (
  select 1 from public.financeiro_custos_variaveis cv
  where cv.unidade_id = u.id and cv.descricao like 'Provisão LavCoin%'
);

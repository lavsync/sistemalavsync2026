-- =====================================================================
-- LavSync · 0012 · Drop constraint ux_vendas_unidade_assinatura
--
-- Motivo: a constraint UNIQUE(unidade_id, data_venda, valor, COALESCE(cpf,''))
-- pra vendas sem requisicao matava entradas legítimas. Um mesmo cliente pode
-- comprar várias lavagens de R$17 em sequência no mesmo dia — não é
-- duplicação, é ciclos consecutivos reais.
--
-- Dedupe agora é APENAS por requisicao (presente em MAXPAN e VM modernas).
-- Vendas sem requisicao são aceitas como entradas legítimas e contabilizadas
-- normalmente.
-- =====================================================================

drop index if exists public.ux_vendas_unidade_assinatura;

-- Caso a constraint tenha sido criada via ALTER TABLE ADD CONSTRAINT
alter table public.vendas drop constraint if exists ux_vendas_unidade_assinatura;

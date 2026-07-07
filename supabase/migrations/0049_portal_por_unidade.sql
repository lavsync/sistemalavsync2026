-- =====================================================================
-- LavSync · 0049 · Portal do clube POR UNIDADE
--
-- Cada cliente acompanha os pontos no portal da SUA loja (ex.: Roberta,
-- do Buritis → buritis.xovaral.com/loja). A variável {link_portal} das
-- mensagens passa a resolver pela unidade do cliente.
-- =====================================================================

alter table public.unidades
  add column if not exists portal_url text;

update public.unidades set portal_url = 'https://buritis.xovaral.com/loja'
  where nome = 'Buritis' and portal_url is null;
update public.unidades set portal_url = 'https://castelo.xovaral.com/loja'
  where nome = 'Castelo' and portal_url is null;
update public.unidades set portal_url = 'https://cabral.xovaral.com/loja'
  where nome = 'Cabral' and portal_url is null;

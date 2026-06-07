-- =====================================================================
-- LavSync · 0011 · CASCADE em importacoes (vendas e clientes)
-- Ao apagar uma importação, todos os dados criados por ela são apagados
-- automaticamente no nível do banco (não depende mais da action UI).
-- =====================================================================

-- 1. LIMPAR ÓRFÃOS EXISTENTES antes de adicionar as FKs
--    (FK não aceita criação se houver registros violando-a)

delete from public.vendas v
where v.importacao_id is not null
  and not exists (select 1 from public.vendas_importacoes vi where vi.id = v.importacao_id);

delete from public.clientes c
where c.importacao_id is not null
  and not exists (select 1 from public.clientes_importacoes ci where ci.id = c.importacao_id);

-- 2. ADICIONAR FKs com CASCADE

alter table public.vendas
  drop constraint if exists vendas_importacao_id_fkey;
alter table public.vendas
  add constraint vendas_importacao_id_fkey
  foreign key (importacao_id) references public.vendas_importacoes(id)
  on delete cascade;

alter table public.clientes
  drop constraint if exists clientes_importacao_id_fkey;
alter table public.clientes
  add constraint clientes_importacao_id_fkey
  foreign key (importacao_id) references public.clientes_importacoes(id)
  on delete cascade;

-- 3. Documentação inline
comment on constraint vendas_importacao_id_fkey on public.vendas is
  'CASCADE: apagar vendas_importacoes apaga as vendas criadas por ela. Sincroniza UI ↔ banco.';
comment on constraint clientes_importacao_id_fkey on public.clientes is
  'CASCADE: apagar clientes_importacoes apaga os clientes criados por ela. Vendas vinculadas a esses clientes ficam com cliente_id = NULL (FK vendas_cliente_id_fkey já tem ON DELETE SET NULL).';

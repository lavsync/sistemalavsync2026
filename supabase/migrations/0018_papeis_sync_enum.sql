-- =====================================================================
-- LavSync · 0018 · Sincronizar enum lavsync_role com papéis do RBAC
-- =====================================================================

-- Adiciona 'gerente' ao enum se ainda não existe
do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on e.enumtypid = t.oid
    where t.typname = 'lavsync_role' and e.enumlabel = 'gerente'
  ) then
    alter type lavsync_role add value 'gerente';
  end if;
end$$;

-- O enum tem 'viewer' (não 'visualizador'). Renomear no seed.
update public.papeis_permissoes set papel = 'viewer' where papel = 'visualizador';
delete from public.papeis_permissoes where papel = 'visualizador';

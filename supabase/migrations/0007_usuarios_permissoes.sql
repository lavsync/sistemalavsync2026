-- =====================================================================
-- LavSync · Permissões granulares de usuário
-- - unidades_permitidas: NULL = todas (master/admin), array = restrito
-- - ultimo_acesso_em pra auditoria
-- - telefone opcional pra contato
-- =====================================================================

alter table public.usuarios
  add column if not exists unidades_permitidas uuid[] default null,
  add column if not exists ultimo_acesso_em timestamptz,
  add column if not exists telefone text,
  add column if not exists observacoes text;

-- Índice para queries rápidas por papel
create index if not exists idx_usuarios_papel on public.usuarios(papel, ativo);

-- Helper: usuário pode ver determinada unidade?
create or replace function public.usuario_pode_ver_unidade(p_unidade_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select case
    -- Master ou admin veem tudo
    when public.is_master() then true
    when exists (
      select 1 from public.usuarios
      where id = auth.uid() and papel in ('admin')
    ) then true
    -- Operador/viewer: precisa ter na lista (ou lista NULL = todas)
    when exists (
      select 1 from public.usuarios
      where id = auth.uid()
        and ativo = true
        and (unidades_permitidas is null or p_unidade_id = any(unidades_permitidas))
    ) then true
    else false
  end;
$$;

grant execute on function public.usuario_pode_ver_unidade(uuid) to authenticated;

-- Trigger pra atualizar ultimo_acesso_em quando o usuário acessa qualquer query
-- (será chamado via server action no login)

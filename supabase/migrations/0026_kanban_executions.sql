-- =====================================================================
-- LavSync · 0026 · Kanban customizável + execuções diárias
-- =====================================================================

-- ─── Colunas customizáveis do Kanban ────────────────────────────────
create table if not exists public.tarefas_kanban_colunas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  codigo text not null,
  label text not null,
  color text not null default '#0F859A',
  ordem integer not null default 0,
  status_alvo tarefa_status not null default 'em_andamento',  -- pra qual status mapeia ao mover pra cá
  is_final boolean not null default false,                     -- coluna final marca como concluida
  is_inicial boolean not null default false,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create unique index if not exists ux_kanban_codigo on public.tarefas_kanban_colunas(tenant_id, codigo);

-- Adiciona coluna na tarefa pra Kanban
alter table public.tarefas
  add column if not exists kanban_coluna_id uuid references public.tarefas_kanban_colunas(id) on delete set null;

-- RLS
alter table public.tarefas_kanban_colunas enable row level security;
drop policy if exists "kanban_col_tenant" on public.tarefas_kanban_colunas;
create policy "kanban_col_tenant" on public.tarefas_kanban_colunas for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

-- Seed: 5 colunas default por tenant
insert into public.tarefas_kanban_colunas (tenant_id, codigo, label, color, ordem, status_alvo, is_inicial, is_final)
select t.id, k.codigo, k.label, k.color, k.ordem, k.status::tarefa_status, k.ini, k.fin
from public.tenants t,
  (values
    ('backlog',    'A fazer',      '#94A3B8', 10, 'pendente',     true,  false),
    ('em_progresso','Em progresso', '#0F859A', 20, 'em_andamento', false, false),
    ('revisao',    'Em revisão',   '#F59E0B', 30, 'em_andamento', false, false),
    ('bloqueada',  'Bloqueada',    '#EF4444', 40, 'bloqueada',    false, false),
    ('concluida',  'Concluída',    '#10B981', 50, 'concluida',    false, true)
  ) as k(codigo, label, color, ordem, status, ini, fin)
where not exists (
  select 1 from public.tarefas_kanban_colunas x where x.tenant_id = t.id and x.codigo = k.codigo
);

-- ─── Atribuir tarefas existentes à coluna baseada no status ─────────
update public.tarefas t
set kanban_coluna_id = (
  select id from public.tarefas_kanban_colunas k
  where k.tenant_id = t.tenant_id
    and (case t.status::text
      when 'pendente' then 'backlog'
      when 'em_andamento' then 'em_progresso'
      when 'bloqueada' then 'bloqueada'
      when 'concluida' then 'concluida'
      when 'cancelada' then 'concluida'
      else 'backlog'
    end) = k.codigo
  limit 1
)
where t.kanban_coluna_id is null;

-- ─── Adicionar campos úteis em corp_routines pra "Minhas Rotinas Hoje" ──
alter table public.corp_routines
  add column if not exists ultima_execucao_em timestamptz,
  add column if not exists total_execucoes integer not null default 0;

-- Trigger: ao criar corp_executions concluida, atualiza ultima_execucao_em
create or replace function public.corp_update_ultima_exec()
returns trigger as $$
begin
  if new.status = 'concluida' then
    update public.corp_routines
      set ultima_execucao_em = coalesce(new.completed_at, now()),
          total_execucoes = total_execucoes + 1,
          atualizado_em = now()
      where id = new.routine_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_corp_ultima_exec on public.corp_executions;
create trigger trg_corp_ultima_exec
  after insert or update on public.corp_executions
  for each row execute function public.corp_update_ultima_exec();

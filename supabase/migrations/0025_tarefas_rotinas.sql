-- =====================================================================
-- LavSync · 0025 · TAREFAS + ROTINAS CORPORATIVAS (Fase 1)
-- Espelho da arquitetura Ecommseller adaptada pra rede de lavanderias
-- self-service Xô Varal.
--   Hierarquia: Rede → Diretoria → Operação → Unidade → Função
-- =====================================================================

-- ─── ENUMS ──────────────────────────────────────────────────────────
do $$ begin
  create type tarefa_prioridade as enum ('baixa','media','alta','critica');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tarefa_status as enum ('pendente','em_andamento','concluida','cancelada','bloqueada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type corp_unit_type as enum ('rede','diretoria','operacao','unidade','funcao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type corp_frequencia as enum (
    'continua','diaria','semanal','quinzenal','mensal','trimestral',
    'sazonal','evento','contingencia','automatica'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type corp_criticidade as enum ('baixa','media','alta','critica','estrategica','emergencial');
exception when duplicate_object then null; end $$;

do $$ begin
  create type corp_impacto_financeiro as enum ('nenhum','baixo','medio','alto','critico');
exception when duplicate_object then null; end $$;

do $$ begin
  create type corp_execution_status as enum ('em_andamento','concluida','pulada','falha','cancelada');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- TAREFAS — módulo TODO clássico
-- =====================================================================

create table if not exists public.tarefas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,
  criada_por uuid references public.usuarios(id) on delete set null,
  atribuida_para uuid references public.usuarios(id) on delete set null,
  routine_id uuid null,  -- FK frouxa, definida abaixo após corp_routines
  titulo text not null,
  descricao text null,
  prioridade tarefa_prioridade not null default 'media',
  status tarefa_status not null default 'pendente',
  prazo timestamptz null,
  iniciada_em timestamptz null,
  concluida_em timestamptz null,
  tempo_estimado_minutes integer null,
  tempo_real_minutes integer null,
  tags text[] not null default '{}',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists ix_tarefas_tenant on public.tarefas(tenant_id);
create index if not exists ix_tarefas_unid on public.tarefas(unidade_id);
create index if not exists ix_tarefas_atribuida on public.tarefas(atribuida_para, status);
create index if not exists ix_tarefas_status on public.tarefas(status, prazo);
create index if not exists ix_tarefas_prazo on public.tarefas(prazo);

create table if not exists public.tarefas_comentarios (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.tarefas(id) on delete cascade,
  autor_id uuid references public.usuarios(id) on delete set null,
  comentario text not null,
  criado_em timestamptz not null default now()
);
create index if not exists ix_tarefas_com on public.tarefas_comentarios(tarefa_id, criado_em);

-- =====================================================================
-- ROTINAS CORPORATIVAS
-- =====================================================================

-- ─── Organograma (árvore hierárquica) ──────────────────────────────
create table if not exists public.corp_org_units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_id uuid references public.corp_org_units(id) on delete cascade,
  unit_type corp_unit_type not null,
  codigo text not null,                         -- ex: "REDE", "DIR_OPS", "UNIT_CASTELO", "FN_ATEND"
  nome text not null,
  descricao text null,
  color text null default '#0F859A',
  ordem integer not null default 0,
  lead_member_id uuid references public.usuarios(id) on delete set null,
  unidade_real_id uuid references public.unidades(id) on delete set null,  -- pra unit_type=unidade, aponta pra unidade real
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create unique index if not exists ux_corp_org_codigo on public.corp_org_units(tenant_id, codigo);
create index if not exists ix_corp_org_parent on public.corp_org_units(parent_id);
create index if not exists ix_corp_org_tenant on public.corp_org_units(tenant_id);

-- ─── Categorias ────────────────────────────────────────────────────
create table if not exists public.corp_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  codigo text not null,
  nome text not null,
  descricao text null,
  icon text null,                               -- nome lucide
  color text null default '#0F859A',
  ordem integer not null default 0
);
create unique index if not exists ux_corp_cat_codigo on public.corp_categories(tenant_id, codigo);

-- ─── Rotinas ───────────────────────────────────────────────────────
create table if not exists public.corp_routines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,  -- null = rotina global
  org_unit_id uuid references public.corp_org_units(id) on delete set null,
  category_id uuid references public.corp_categories(id) on delete set null,
  codigo text null,                              -- "ABERT_DIA", "MANUT_MAQ_SQ", etc
  titulo text not null,
  descricao text null,
  frequencia corp_frequencia not null default 'diaria',
  criticidade corp_criticidade not null default 'media',
  impacto_financeiro corp_impacto_financeiro not null default 'baixo',
  operational_weight integer not null default 5,   -- 1..10
  -- SLA
  estimated_minutes integer null,
  sla_ideal_minutes integer null,
  sla_max_minutes integer null,
  delay_impact text null,
  -- Agenda
  horario_alvo time null,                        -- ex: 08:00:00 pra abertura
  dias_semana integer[] null,                    -- [1,2,3,4,5] = seg-sex
  -- Responsabilidades
  responsavel_id uuid references public.usuarios(id) on delete set null,
  backup_id uuid references public.usuarios(id) on delete set null,
  escalation_id uuid references public.usuarios(id) on delete set null,
  -- KPIs
  kpis text[] not null default '{}',
  -- Conteúdo
  playbook_url text null,
  video_url text null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists ix_corp_rout_tenant on public.corp_routines(tenant_id, ativo);
create index if not exists ix_corp_rout_org on public.corp_routines(org_unit_id);
create index if not exists ix_corp_rout_cat on public.corp_routines(category_id);
create index if not exists ix_corp_rout_unid on public.corp_routines(unidade_id);

-- Agora podemos amarrar tarefas.routine_id
alter table public.tarefas
  drop constraint if exists fk_tarefas_routine;
alter table public.tarefas
  add constraint fk_tarefas_routine foreign key (routine_id) references public.corp_routines(id) on delete set null;

-- ─── Steps (checklist da rotina) ────────────────────────────────────
create table if not exists public.corp_routine_steps (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.corp_routines(id) on delete cascade,
  ordem integer not null default 0,
  titulo text not null,
  descricao text null,
  obrigatorio boolean not null default true,
  estimated_minutes integer null,
  criado_em timestamptz not null default now()
);
create index if not exists ix_corp_steps_routine on public.corp_routine_steps(routine_id, ordem);

-- ─── Banco Master de templates ──────────────────────────────────────
create table if not exists public.corp_routine_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  pack text not null,                           -- 'lavanderia_core', 'lavanderia_contingencia', 'lavanderia_manutencao' etc
  codigo text not null,
  titulo text not null,
  descricao text null,
  category_code text null,                      -- referencia código de corp_categories
  role_unit_code text null,                     -- referencia código de corp_org_units (cargo/função)
  frequencia corp_frequencia not null default 'diaria',
  criticidade corp_criticidade not null default 'media',
  estimated_minutes integer null,
  sla_ideal_minutes integer null,
  sla_max_minutes integer null,
  impacto_financeiro corp_impacto_financeiro not null default 'baixo',
  horario_alvo time null,
  dias_semana integer[] null,
  kpis text[] not null default '{}',
  steps jsonb not null default '[]'::jsonb,     -- [{ordem, titulo, descricao, obrigatorio}]
  ordem integer not null default 0
);

create unique index if not exists ux_corp_tpl_codigo on public.corp_routine_templates(tenant_id, codigo);
create index if not exists ix_corp_tpl_pack on public.corp_routine_templates(pack);

-- ─── Execuções (cada vez que alguém roda a rotina) ─────────────────
create table if not exists public.corp_executions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  routine_id uuid not null references public.corp_routines(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,
  executor_id uuid references public.usuarios(id) on delete set null,
  data_alvo date not null default current_date,
  started_at timestamptz null,
  completed_at timestamptz null,
  total_seconds integer null,
  status corp_execution_status not null default 'em_andamento',
  observacoes text null,
  evidencia_url text null,
  criado_em timestamptz not null default now()
);

create index if not exists ix_corp_exec_routine on public.corp_executions(routine_id, data_alvo);
create index if not exists ix_corp_exec_executor on public.corp_executions(executor_id, status);
create index if not exists ix_corp_exec_tenant on public.corp_executions(tenant_id);

create table if not exists public.corp_execution_steps (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.corp_executions(id) on delete cascade,
  step_id uuid references public.corp_routine_steps(id) on delete set null,
  ordem integer not null default 0,
  titulo text not null,
  done boolean not null default false,
  done_at timestamptz null,
  observacoes text null
);
create index if not exists ix_corp_execstep on public.corp_execution_steps(execution_id, ordem);

-- =====================================================================
-- RLS
-- =====================================================================

alter table public.tarefas enable row level security;
drop policy if exists "tar_tenant" on public.tarefas;
create policy "tar_tenant" on public.tarefas for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

alter table public.tarefas_comentarios enable row level security;
drop policy if exists "tar_com_tenant" on public.tarefas_comentarios;
create policy "tar_com_tenant" on public.tarefas_comentarios for all
  using (
    exists (select 1 from public.tarefas t where t.id = tarefa_id
      and (t.tenant_id = public.current_tenant_id() or public.is_master()))
  ) with check (
    exists (select 1 from public.tarefas t where t.id = tarefa_id
      and (t.tenant_id = public.current_tenant_id() or public.is_master()))
  );

alter table public.corp_org_units enable row level security;
drop policy if exists "corp_org_tenant" on public.corp_org_units;
create policy "corp_org_tenant" on public.corp_org_units for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

alter table public.corp_categories enable row level security;
drop policy if exists "corp_cat_tenant" on public.corp_categories;
create policy "corp_cat_tenant" on public.corp_categories for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

alter table public.corp_routines enable row level security;
drop policy if exists "corp_rout_tenant" on public.corp_routines;
create policy "corp_rout_tenant" on public.corp_routines for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

alter table public.corp_routine_steps enable row level security;
drop policy if exists "corp_step_tenant" on public.corp_routine_steps;
create policy "corp_step_tenant" on public.corp_routine_steps for all
  using (exists (select 1 from public.corp_routines r where r.id = routine_id
    and (r.tenant_id = public.current_tenant_id() or public.is_master())))
  with check (exists (select 1 from public.corp_routines r where r.id = routine_id
    and (r.tenant_id = public.current_tenant_id() or public.is_master())));

alter table public.corp_routine_templates enable row level security;
drop policy if exists "corp_tpl_tenant" on public.corp_routine_templates;
create policy "corp_tpl_tenant" on public.corp_routine_templates for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

alter table public.corp_executions enable row level security;
drop policy if exists "corp_exec_tenant" on public.corp_executions;
create policy "corp_exec_tenant" on public.corp_executions for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

alter table public.corp_execution_steps enable row level security;
drop policy if exists "corp_xs_tenant" on public.corp_execution_steps;
create policy "corp_xs_tenant" on public.corp_execution_steps for all
  using (exists (select 1 from public.corp_executions e where e.id = execution_id
    and (e.tenant_id = public.current_tenant_id() or public.is_master())))
  with check (exists (select 1 from public.corp_executions e where e.id = execution_id
    and (e.tenant_id = public.current_tenant_id() or public.is_master())));

-- =====================================================================
-- SEEDS
-- =====================================================================

-- ─── 1. Categorias ──────────────────────────────────────────────────
insert into public.corp_categories (tenant_id, codigo, nome, color, icon, ordem)
select t.id, c.codigo, c.nome, c.color, c.icon, c.ordem
from public.tenants t,
  (values
    ('operacao_diaria',    'Operação diária',     '#0F859A', 'PlayCircle',     10),
    ('manutencao',         'Manutenção',          '#F59E0B', 'Wrench',         20),
    ('estoque',            'Estoque & Compras',   '#8B5CF6', 'Package',        30),
    ('financeiro',         'Financeiro',          '#10B981', 'DollarSign',     40),
    ('marketing',          'Marketing',           '#EC4899', 'Megaphone',      50),
    ('atendimento',        'Atendimento',         '#3B82F6', 'MessageCircle',  60),
    ('contingencia',       'Contingência',        '#EF4444', 'AlertTriangle',  70),
    ('gestao',             'Gestão',              '#06B6D4', 'BarChart3',      80)
  ) as c(codigo, nome, color, icon, ordem)
where not exists (
  select 1 from public.corp_categories x where x.tenant_id = t.id and x.codigo = c.codigo
);

-- ─── 2. Organograma seed ────────────────────────────────────────────
-- Rede → 4 diretorias → unidades (link p/ unidades reais) → 6 funções
with rede as (
  insert into public.corp_org_units (tenant_id, codigo, nome, unit_type, color, ordem)
  select id, 'REDE_XO_VARAL', 'Rede Xô Varal', 'rede', '#01385B', 0
  from public.tenants
  on conflict (tenant_id, codigo) do update set nome=excluded.nome
  returning id, tenant_id
),
dirs as (
  insert into public.corp_org_units (tenant_id, parent_id, codigo, nome, unit_type, color, ordem)
  select rede.tenant_id, rede.id, d.codigo, d.nome, 'diretoria'::corp_unit_type, d.color, d.ordem
  from rede,
    (values
      ('DIR_OPERACIONAL', 'Diretoria Operacional', '#0F859A', 10),
      ('DIR_COMERCIAL',   'Diretoria Comercial',   '#3B82F6', 20),
      ('DIR_FINANCEIRA',  'Diretoria Financeira',  '#10B981', 30),
      ('DIR_MARKETING',   'Diretoria Marketing',   '#EC4899', 40)
    ) as d(codigo, nome, color, ordem)
  on conflict (tenant_id, codigo) do update set nome=excluded.nome
  returning id, tenant_id, codigo
),
operacao as (
  insert into public.corp_org_units (tenant_id, parent_id, codigo, nome, unit_type, color, ordem)
  select dirs.tenant_id, dirs.id, 'OP_REDE', 'Operação Rede', 'operacao'::corp_unit_type, '#19C7CB', 10
  from dirs where dirs.codigo = 'DIR_OPERACIONAL'
  on conflict (tenant_id, codigo) do update set nome=excluded.nome
  returning id, tenant_id
),
funcs as (
  insert into public.corp_org_units (tenant_id, parent_id, codigo, nome, unit_type, color, ordem)
  select operacao.tenant_id, operacao.id, f.codigo, f.nome, 'funcao'::corp_unit_type, f.color, f.ordem
  from operacao,
    (values
      ('FN_ATENDENTE',    'Atendente',         '#19C7CB', 10),
      ('FN_DIARISTA',     'Diarista/Limpeza',  '#8B5CF6', 20),
      ('FN_MANUTENCAO',   'Manutenção',        '#F59E0B', 30),
      ('FN_GERENTE',      'Gerente de Rede',   '#0F859A', 40),
      ('FN_MARKETING',    'Marketing',         '#EC4899', 50),
      ('FN_DIRETORIA',    'Diretoria',         '#01385B', 60)
    ) as f(codigo, nome, color, ordem)
  on conflict (tenant_id, codigo) do update set nome=excluded.nome
  returning id, tenant_id
)
select count(*) from funcs;

-- Unidades reais como unit_type='unidade' linkadas ao parent rede
insert into public.corp_org_units (tenant_id, parent_id, codigo, nome, unit_type, color, ordem, unidade_real_id)
select u.tenant_id,
  (select id from public.corp_org_units p where p.tenant_id = u.tenant_id and p.codigo = 'REDE_XO_VARAL'),
  'UNIT_' || upper(regexp_replace(u.nome, '\s+', '_', 'g')),
  u.nome,
  'unidade'::corp_unit_type,
  '#1E40AF',
  100,
  u.id
from public.unidades u
where not exists (
  select 1 from public.corp_org_units x
  where x.tenant_id = u.tenant_id and x.unidade_real_id = u.id
);

-- ─── 3. Templates de rotinas (40 rotinas profissionais de lavanderia) ─
insert into public.corp_routine_templates
  (tenant_id, pack, codigo, titulo, descricao, category_code, role_unit_code,
   frequencia, criticidade, estimated_minutes, sla_ideal_minutes, sla_max_minutes,
   impacto_financeiro, horario_alvo, dias_semana, kpis, steps, ordem)
select t.id, r.pack, r.codigo, r.titulo, r.descricao, r.category_code, r.role_unit_code,
  r.frequencia::corp_frequencia, r.criticidade::corp_criticidade,
  r.est, r.sla_i, r.sla_m,
  r.impf::corp_impacto_financeiro,
  r.hora::time, r.dias, r.kpis, r.steps::jsonb, r.ordem
from public.tenants t,
  (values
    -- ═══ OPERAÇÃO DIÁRIA ═══
    ('lavanderia_core', 'ABERT_UNIDADE', 'Abertura da unidade',
     'Conferir energia, água, iluminação, ar-condicionado. Ligar máquinas. Abrir caixa. Habilitar painel de pagamento.',
     'operacao_diaria', 'FN_ATENDENTE', 'diaria', 'critica', 15, 20, 30, 'alto', '08:00', ARRAY[1,2,3,4,5,6,0], ARRAY['horario_abertura','machine_uptime'],
     '[{"ordem":1,"titulo":"Conferir energia e iluminação","obrigatorio":true},{"ordem":2,"titulo":"Verificar fluxo de água","obrigatorio":true},{"ordem":3,"titulo":"Ligar ar-condicionado","obrigatorio":false},{"ordem":4,"titulo":"Ligar painel de pagamento e testar","obrigatorio":true},{"ordem":5,"titulo":"Abrir caixa de pagamento","obrigatorio":true}]', 10),

    ('lavanderia_core', 'CHECK_MAQUINAS_AM', 'Checklist matinal das 6 máquinas',
     'Verificar lavadoras 1-3 e secadoras 1-3 manualmente. Identificar avarias.',
     'operacao_diaria', 'FN_ATENDENTE', 'diaria', 'critica', 20, 30, 45, 'alto', '08:15', ARRAY[1,2,3,4,5,6,0], ARRAY['machine_uptime','quebras_evitadas'],
     '[{"ordem":1,"titulo":"Inspecionar Lavadora 1 visualmente","obrigatorio":true},{"ordem":2,"titulo":"Inspecionar Lavadora 2","obrigatorio":true},{"ordem":3,"titulo":"Inspecionar Lavadora 3","obrigatorio":true},{"ordem":4,"titulo":"Inspecionar Secadora 1","obrigatorio":true},{"ordem":5,"titulo":"Inspecionar Secadora 2","obrigatorio":true},{"ordem":6,"titulo":"Inspecionar Secadora 3","obrigatorio":true},{"ordem":7,"titulo":"Registrar qualquer anomalia em manutenção","obrigatorio":false}]', 20),

    ('lavanderia_core', 'REABAS_SABAO', 'Reabastecer sabão Omo (40mL/ciclo)',
     'Conferir nível do reservatório de sabão profissional. Reabastecer quando abaixo de 30% do galão de 20L.',
     'operacao_diaria', 'FN_ATENDENTE', 'diaria', 'alta', 10, 15, 25, 'medio', '08:30', ARRAY[1,2,3,4,5,6,0], ARRAY['nivel_estoque','custo_sabao_ciclo'],
     '[{"ordem":1,"titulo":"Medir nível do reservatório","obrigatorio":true},{"ordem":2,"titulo":"Reabastecer se < 30%","obrigatorio":true},{"ordem":3,"titulo":"Registrar mL adicionados","obrigatorio":true}]', 30),

    ('lavanderia_core', 'REABAS_AMACIANTE', 'Reabastecer amaciante Confort',
     'Conferir reservatório de amaciante profissional (40mL/ciclo).',
     'operacao_diaria', 'FN_ATENDENTE', 'diaria', 'alta', 8, 12, 20, 'medio', '08:35', ARRAY[1,2,3,4,5,6,0], ARRAY['nivel_estoque','custo_amaciante_ciclo'],
     '[{"ordem":1,"titulo":"Medir nível do reservatório de amaciante","obrigatorio":true},{"ordem":2,"titulo":"Reabastecer se < 30%","obrigatorio":true},{"ordem":3,"titulo":"Registrar mL adicionados","obrigatorio":true}]', 40),

    ('lavanderia_core', 'LIMP_PAINEL', 'Limpeza painel de pagamento',
     'Limpar tela e teclado do totem de pagamento. Verificar leitor de cartão.',
     'operacao_diaria', 'FN_ATENDENTE', 'diaria', 'media', 5, 8, 15, 'baixo', '09:00', ARRAY[1,2,3,4,5,6,0], ARRAY['nps_clientes'],
     '[{"ordem":1,"titulo":"Limpar tela com pano úmido","obrigatorio":true},{"ordem":2,"titulo":"Testar leitor de cartão","obrigatorio":true}]', 50),

    ('lavanderia_core', 'ATEND_CLIENTES', 'Atendimento e suporte aos clientes',
     'Estar disponível para tirar dúvidas, auxiliar no totem, resolver problemas.',
     'operacao_diaria', 'FN_ATENDENTE', 'continua', 'critica', 480, 480, 540, 'alto', null, ARRAY[1,2,3,4,5,6,0], ARRAY['nps_clientes','tempo_resolucao'],
     '[{"ordem":1,"titulo":"Receber e acolher cliente","obrigatorio":true},{"ordem":2,"titulo":"Orientar uso das máquinas","obrigatorio":false},{"ordem":3,"titulo":"Auxiliar no pagamento","obrigatorio":false},{"ordem":4,"titulo":"Resolver dúvidas","obrigatorio":true}]', 60),

    ('lavanderia_core', 'INSP_CABOS', 'Inspeção visual de cabos e tomadas',
     'Verificar se há cabos expostos, tomadas sobrecarregadas ou queimadas.',
     'operacao_diaria', 'FN_ATENDENTE', 'diaria', 'alta', 8, 10, 20, 'alto', '09:30', ARRAY[1,2,3,4,5,6,0], ARRAY['quebras_evitadas','seguranca'],
     '[{"ordem":1,"titulo":"Inspecionar tomadas e cabos das lavadoras","obrigatorio":true},{"ordem":2,"titulo":"Inspecionar tomadas das secadoras","obrigatorio":true},{"ordem":3,"titulo":"Reportar avarias imediatamente","obrigatorio":false}]', 70),

    ('lavanderia_core', 'LIMP_FILTROS', 'Limpeza dos filtros de fiapos das secadoras',
     'A cada 30 ciclos de secagem, limpar os filtros internos. Risco de incêndio se acumular.',
     'operacao_diaria', 'FN_ATENDENTE', 'diaria', 'critica', 12, 15, 25, 'critico', '14:00', ARRAY[1,2,3,4,5,6,0], ARRAY['ciclos_entre_limpeza','seguranca'],
     '[{"ordem":1,"titulo":"Desligar secadora a limpar","obrigatorio":true},{"ordem":2,"titulo":"Remover filtro de fiapos","obrigatorio":true},{"ordem":3,"titulo":"Limpar com pincel ou aspirador","obrigatorio":true},{"ordem":4,"titulo":"Reinstalar e testar","obrigatorio":true}]', 80),

    ('lavanderia_core', 'LIMP_BANHEIRO', 'Limpeza banheiro 2x ao dia',
     'Manhã e tarde — limpar vaso, pia, espelho, repor papel.',
     'operacao_diaria', 'FN_DIARISTA', 'diaria', 'alta', 15, 20, 30, 'medio', '11:00', ARRAY[1,2,3,4,5,6,0], ARRAY['nps_clientes'],
     '[{"ordem":1,"titulo":"Limpar vaso sanitário","obrigatorio":true},{"ordem":2,"titulo":"Limpar pia e espelho","obrigatorio":true},{"ordem":3,"titulo":"Repor papel higiênico e sabonete","obrigatorio":true},{"ordem":4,"titulo":"Esvaziar lixeira","obrigatorio":true}]', 90),

    ('lavanderia_core', 'FECHA_CAIXA', 'Fechamento de caixa diário',
     'Conferir vendas do dia, fechar caixa, registrar no sistema.',
     'operacao_diaria', 'FN_ATENDENTE', 'diaria', 'critica', 20, 30, 45, 'critico', '23:00', ARRAY[1,2,3,4,5,6,0], ARRAY['precisao_caixa','horario_fechamento'],
     '[{"ordem":1,"titulo":"Conferir total de vendas no painel","obrigatorio":true},{"ordem":2,"titulo":"Comparar com extrato MAXPAN","obrigatorio":true},{"ordem":3,"titulo":"Registrar diferenças (se houver)","obrigatorio":true},{"ordem":4,"titulo":"Desligar máquinas conforme protocolo","obrigatorio":true}]', 100),

    ('lavanderia_core', 'CONF_CARTEIRAS', 'Conferência saldo de carteiras dos clientes',
     'Verificar saldos da carteira virtual dos clientes (MAXPAN).',
     'operacao_diaria', 'FN_ATENDENTE', 'diaria', 'media', 10, 15, 20, 'baixo', '22:00', ARRAY[1,2,3,4,5,6,0], ARRAY['precisao_caixa'],
     '[{"ordem":1,"titulo":"Acessar relatório de carteiras MAXPAN","obrigatorio":true},{"ordem":2,"titulo":"Identificar saldos inconsistentes","obrigatorio":true}]', 110),

    -- ═══ MANUTENÇÃO ═══
    ('lavanderia_manutencao', 'MANUT_SEM_SQ', 'Manutenção preventiva Speed Queen semanal',
     'Inspecionar motor, mangueiras, tambor, juntas. Documentar.',
     'manutencao', 'FN_MANUTENCAO', 'semanal', 'alta', 60, 75, 120, 'alto', '07:00', ARRAY[1], ARRAY['mtbf','custo_manutencao'],
     '[{"ordem":1,"titulo":"Inspeção visual do motor","obrigatorio":true},{"ordem":2,"titulo":"Verificar mangueiras de água","obrigatorio":true},{"ordem":3,"titulo":"Conferir vedação do tambor","obrigatorio":true},{"ordem":4,"titulo":"Documentar relatório fotográfico","obrigatorio":true}]', 120),

    ('lavanderia_manutencao', 'INSP_MANGUEIRAS', 'Verificação de mangueiras de água',
     'Conferir vazamentos, ressecamento, entupimentos.',
     'manutencao', 'FN_MANUTENCAO', 'semanal', 'alta', 20, 25, 40, 'alto', null, ARRAY[1], ARRAY['vazamentos','consumo_agua'],
     '[{"ordem":1,"titulo":"Inspecionar entrada de água principal","obrigatorio":true},{"ordem":2,"titulo":"Inspecionar mangueiras das 3 lavadoras","obrigatorio":true},{"ordem":3,"titulo":"Reportar trocas necessárias","obrigatorio":false}]', 130),

    ('lavanderia_manutencao', 'LIMP_PROFUNDA_MES', 'Limpeza profunda mensal das máquinas',
     'Limpeza completa do tambor com produto descalcificante.',
     'manutencao', 'FN_MANUTENCAO', 'mensal', 'alta', 120, 150, 200, 'medio', null, null, ARRAY['mtbf','qualidade_lavagem'],
     '[{"ordem":1,"titulo":"Desligar e isolar máquina","obrigatorio":true},{"ordem":2,"titulo":"Aplicar produto descalcificante","obrigatorio":true},{"ordem":3,"titulo":"Ciclo de limpeza vazio","obrigatorio":true},{"ordem":4,"titulo":"Inspecionar e secar","obrigatorio":true}]', 140),

    ('lavanderia_manutencao', 'CALIBR_BALANCA', 'Calibração balança (quinzenal)',
     'Verificar precisão da balança de pesagem de roupa em cargas conhecidas.',
     'manutencao', 'FN_MANUTENCAO', 'quinzenal', 'media', 15, 20, 30, 'baixo', null, null, ARRAY['precisao_pesagem'],
     '[{"ordem":1,"titulo":"Carregar peso conhecido (1kg)","obrigatorio":true},{"ordem":2,"titulo":"Verificar leitura","obrigatorio":true},{"ordem":3,"titulo":"Ajustar se desvio > 50g","obrigatorio":false}]', 150),

    ('lavanderia_manutencao', 'LUBRIF_MOVEIS', 'Lubrificação peças móveis',
     'Lubrificar engrenagens e rolamentos com graxa apropriada.',
     'manutencao', 'FN_MANUTENCAO', 'mensal', 'media', 45, 60, 90, 'medio', null, null, ARRAY['mtbf'],
     '[{"ordem":1,"titulo":"Identificar pontos de lubrificação","obrigatorio":true},{"ordem":2,"titulo":"Aplicar graxa","obrigatorio":true},{"ordem":3,"titulo":"Testar movimentação","obrigatorio":true}]', 160),

    -- ═══ ESTOQUE & COMPRAS ═══
    ('lavanderia_estoque', 'CONF_EST_SEM', 'Conferência estoque sabão/amaciante (semanal)',
     'Conferir quantos galões de 20L disponíveis. Compra se < 2 unidades.',
     'estoque', 'FN_GERENTE', 'semanal', 'alta', 20, 30, 45, 'alto', null, ARRAY[1], ARRAY['ruptura_estoque','custo_quimicos'],
     '[{"ordem":1,"titulo":"Contar galões fechados de sabão Omo","obrigatorio":true},{"ordem":2,"titulo":"Contar galões fechados de amaciante","obrigatorio":true},{"ordem":3,"titulo":"Solicitar compra se < 2","obrigatorio":false}]', 170),

    ('lavanderia_estoque', 'REPOR_GALOES', 'Reposição de galões',
     'Receber e armazenar galões de produtos químicos.',
     'estoque', 'FN_GERENTE', 'evento', 'media', 30, 45, 60, 'baixo', null, null, ARRAY['acuracidade_estoque'],
     '[{"ordem":1,"titulo":"Receber pedido","obrigatorio":true},{"ordem":2,"titulo":"Conferir nota fiscal","obrigatorio":true},{"ordem":3,"titulo":"Armazenar em local seco","obrigatorio":true}]', 180),

    ('lavanderia_estoque', 'CONF_LIMPEZA', 'Conferência produtos de limpeza',
     'Verificar estoque de detergentes, desinfetantes, panos.',
     'estoque', 'FN_GERENTE', 'quinzenal', 'media', 15, 20, 30, 'baixo', null, null, ARRAY['ruptura_estoque'],
     '[{"ordem":1,"titulo":"Listar produtos de limpeza","obrigatorio":true},{"ordem":2,"titulo":"Solicitar reposição","obrigatorio":false}]', 190),

    -- ═══ OPERAÇÃO SEMANAL ═══
    ('lavanderia_core', 'BACKUP_SISTEMA', 'Backup do sistema LavSync',
     'Backup semanal de configurações + extração CSV de vendas/clientes.',
     'gestao', 'FN_GERENTE', 'semanal', 'media', 10, 15, 30, 'medio', null, ARRAY[0], ARRAY['integridade_dados'],
     '[{"ordem":1,"titulo":"Exportar vendas em CSV","obrigatorio":true},{"ordem":2,"titulo":"Exportar clientes em CSV","obrigatorio":true},{"ordem":3,"titulo":"Salvar em pasta backup","obrigatorio":true}]', 200),

    ('lavanderia_core', 'IMPORT_MAXPAN', 'Importação MAXPAN diária',
     'Baixar relatório diário e importar no LavSync para alimentar Performance.',
     'gestao', 'FN_GERENTE', 'diaria', 'alta', 15, 20, 30, 'alto', '23:30', ARRAY[1,2,3,4,5,6,0], ARRAY['dados_atualizados'],
     '[{"ordem":1,"titulo":"Acessar painel MAXPAN","obrigatorio":true},{"ordem":2,"titulo":"Baixar relatório do dia","obrigatorio":true},{"ordem":3,"titulo":"Subir no LavSync","obrigatorio":true},{"ordem":4,"titulo":"Conferir vendas inseridas vs duplicadas","obrigatorio":true}]', 210),

    ('lavanderia_core', 'CONF_CUPONS', 'Conferência de cupons aplicados',
     'Validar cupons usados, identificar fraudes ou erros.',
     'gestao', 'FN_GERENTE', 'semanal', 'media', 25, 35, 60, 'medio', null, ARRAY[5], ARRAY['fraudes_evitadas','margem_cupom'],
     '[{"ordem":1,"titulo":"Listar cupons da semana","obrigatorio":true},{"ordem":2,"titulo":"Validar regras","obrigatorio":true},{"ordem":3,"titulo":"Reportar inconsistências","obrigatorio":false}]', 220),

    -- ═══ FINANCEIRO ═══
    ('lavanderia_financeiro', 'LEITURA_AGUA', 'Leitura medidor de água mensal',
     'Anotar medidor e calcular consumo do mês.',
     'financeiro', 'FN_GERENTE', 'mensal', 'media', 10, 15, 20, 'medio', null, null, ARRAY['consumo_agua_mes','custo_agua_ciclo'],
     '[{"ordem":1,"titulo":"Fotografar medidor","obrigatorio":true},{"ordem":2,"titulo":"Registrar leitura no LavSync","obrigatorio":true},{"ordem":3,"titulo":"Calcular consumo vs mês anterior","obrigatorio":false}]', 230),

    ('lavanderia_financeiro', 'LEITURA_LUZ', 'Leitura medidor energia mensal',
     'Anotar medidor de energia e calcular consumo do mês.',
     'financeiro', 'FN_GERENTE', 'mensal', 'media', 10, 15, 20, 'medio', null, null, ARRAY['consumo_kwh_mes','custo_energia_ciclo'],
     '[{"ordem":1,"titulo":"Fotografar medidor","obrigatorio":true},{"ordem":2,"titulo":"Registrar leitura","obrigatorio":true}]', 240),

    ('lavanderia_financeiro', 'CONCIL_CAIXA', 'Conciliação caixa diária',
     'Bater caixa fechado com extratos de cartão/PIX.',
     'financeiro', 'FN_GERENTE', 'diaria', 'critica', 30, 45, 60, 'critico', '08:00', ARRAY[1,2,3,4,5,6,0], ARRAY['precisao_caixa','divergencias'],
     '[{"ordem":1,"titulo":"Pegar extrato MAXPAN do dia anterior","obrigatorio":true},{"ordem":2,"titulo":"Bater com extratos de cartão","obrigatorio":true},{"ordem":3,"titulo":"Bater com extrato PIX","obrigatorio":true},{"ordem":4,"titulo":"Investigar divergências","obrigatorio":false}]', 250),

    ('lavanderia_financeiro', 'DRE_MES', 'Fechamento DRE mensal',
     'Lançar despesas reais, conferir faturamento, gerar DRE.',
     'financeiro', 'FN_DIRETORIA', 'mensal', 'critica', 120, 180, 300, 'critico', null, null, ARRAY['margem_liquida','resultado_mes'],
     '[{"ordem":1,"titulo":"Lançar todas despesas do mês","obrigatorio":true},{"ordem":2,"titulo":"Conferir faturamento real","obrigatorio":true},{"ordem":3,"titulo":"Gerar DRE no LavSync","obrigatorio":true},{"ordem":4,"titulo":"Compartilhar com sócios","obrigatorio":true}]', 260),

    ('lavanderia_financeiro', 'REV_PRECOS', 'Revisão de preços de serviços',
     'Análise trimestral de precificação considerando custo, concorrência e margem.',
     'financeiro', 'FN_DIRETORIA', 'trimestral', 'alta', 90, 120, 180, 'alto', null, null, ARRAY['margem_servico','competitividade'],
     '[{"ordem":1,"titulo":"Calcular custo real por ciclo","obrigatorio":true},{"ordem":2,"titulo":"Pesquisar concorrência regional","obrigatorio":true},{"ordem":3,"titulo":"Definir novos preços","obrigatorio":true},{"ordem":4,"titulo":"Atualizar no MAXPAN e LavSync","obrigatorio":true}]', 270),

    -- ═══ MARKETING ═══
    ('lavanderia_marketing', 'CLI_EM_RISCO', 'Análise de clientes em risco (semanal)',
     'Identificar clientes sem comprar há 25-60 dias e disparar mensagem.',
     'marketing', 'FN_MARKETING', 'semanal', 'alta', 30, 45, 60, 'alto', null, ARRAY[1], ARRAY['retencao','clientes_recuperados'],
     '[{"ordem":1,"titulo":"Acessar painel Clientes em risco","obrigatorio":true},{"ordem":2,"titulo":"Filtrar lista relevante","obrigatorio":true},{"ordem":3,"titulo":"Disparar campanha","obrigatorio":true}]', 280),

    ('lavanderia_marketing', 'DISP_XO_CLUB', 'Disparo XÔ Club mensal',
     'Comunicar saldo, próximos níveis, ofertas exclusivas.',
     'marketing', 'FN_MARKETING', 'mensal', 'media', 45, 60, 90, 'medio', null, null, ARRAY['engajamento','resgates_mes'],
     '[{"ordem":1,"titulo":"Segmentar por nível","obrigatorio":true},{"ordem":2,"titulo":"Redigir mensagem","obrigatorio":true},{"ordem":3,"titulo":"Disparar via WhatsApp","obrigatorio":true}]', 290),

    ('lavanderia_marketing', 'NPS_MES', 'Análise NPS mensal',
     'Coletar e analisar Net Promoter Score do mês.',
     'marketing', 'FN_DIRETORIA', 'mensal', 'alta', 30, 45, 60, 'alto', null, null, ARRAY['nps','satisfacao'],
     '[{"ordem":1,"titulo":"Coletar NPS via QR code/WhatsApp","obrigatorio":true},{"ordem":2,"titulo":"Analisar comentários","obrigatorio":true},{"ordem":3,"titulo":"Planejar ações","obrigatorio":true}]', 300),

    ('lavanderia_marketing', 'RESP_GOOGLE', 'Resposta a avaliações Google',
     'Responder TODAS as avaliações novas do Google em até 24h.',
     'atendimento', 'FN_ATENDENTE', 'diaria', 'alta', 10, 15, 30, 'alto', null, ARRAY[1,2,3,4,5,6,0], ARRAY['nota_google','responsividade'],
     '[{"ordem":1,"titulo":"Verificar avaliações novas","obrigatorio":true},{"ordem":2,"titulo":"Responder cada uma","obrigatorio":true},{"ordem":3,"titulo":"Encaminhar reclamações graves","obrigatorio":false}]', 310),

    -- ═══ CONTINGÊNCIA ═══
    ('lavanderia_contingencia', 'CONT_ENERGIA', 'Queda de energia - Protocolo emergencial',
     'Procedimento ao detectar queda de energia. Avisar clientes, garantir refunds, fechar.',
     'contingencia', 'FN_ATENDENTE', 'contingencia', 'emergencial', 30, null, null, 'critico', null, null, ARRAY['perda_evitada','seguranca'],
     '[{"ordem":1,"titulo":"Avisar clientes em atendimento","obrigatorio":true},{"ordem":2,"titulo":"Anotar máquinas em uso para refund","obrigatorio":true},{"ordem":3,"titulo":"Avisar gerência via WhatsApp","obrigatorio":true},{"ordem":4,"titulo":"Comunicar concessionária","obrigatorio":true},{"ordem":5,"titulo":"Fechar unidade temporariamente","obrigatorio":true}]', 400),

    ('lavanderia_contingencia', 'CONT_AGUA', 'Falta de água - Protocolo emergencial',
     'Procedimento quando água é interrompida.',
     'contingencia', 'FN_ATENDENTE', 'contingencia', 'emergencial', 30, null, null, 'critico', null, null, ARRAY['perda_evitada'],
     '[{"ordem":1,"titulo":"Avisar clientes em lavagem ativa","obrigatorio":true},{"ordem":2,"titulo":"Pausar máquinas","obrigatorio":true},{"ordem":3,"titulo":"Verificar caixa d''água","obrigatorio":true},{"ordem":4,"titulo":"Avisar gerência","obrigatorio":true}]', 410),

    ('lavanderia_contingencia', 'CONT_MAQ_QUEBR', 'Máquina quebrada - Procedimento',
     'Sinalizar máquina, refund cliente, abrir OS de manutenção.',
     'contingencia', 'FN_ATENDENTE', 'contingencia', 'critica', 20, null, null, 'alto', null, null, ARRAY['tempo_resolucao'],
     '[{"ordem":1,"titulo":"Identificar máquina e sintoma","obrigatorio":true},{"ordem":2,"titulo":"Colocar placa Fora de uso","obrigatorio":true},{"ordem":3,"titulo":"Refund cliente afetado","obrigatorio":true},{"ordem":4,"titulo":"Abrir OS de manutenção","obrigatorio":true}]', 420),

    ('lavanderia_contingencia', 'CONT_SIST_OFF', 'Sistema offline (LavSync indisponível)',
     'Procedimento quando LavSync ou MAXPAN ficam offline.',
     'contingencia', 'FN_ATENDENTE', 'contingencia', 'critica', 15, null, null, 'alto', null, null, ARRAY['operacao_manual'],
     '[{"ordem":1,"titulo":"Confirmar problema via Internet","obrigatorio":true},{"ordem":2,"titulo":"Avisar gerente","obrigatorio":true},{"ordem":3,"titulo":"Continuar operação manual","obrigatorio":true},{"ordem":4,"titulo":"Anotar vendas manualmente","obrigatorio":true}]', 430),

    ('lavanderia_contingencia', 'CONT_CLI_FERIDO', 'Cliente machucado - Primeiros socorros',
     'Procedimento de primeiros socorros e comunicação.',
     'contingencia', 'FN_ATENDENTE', 'contingencia', 'emergencial', 15, null, null, 'critico', null, null, ARRAY['seguranca'],
     '[{"ordem":1,"titulo":"Avaliar gravidade","obrigatorio":true},{"ordem":2,"titulo":"Chamar SAMU se necessário (192)","obrigatorio":true},{"ordem":3,"titulo":"Manter cliente calmo","obrigatorio":true},{"ordem":4,"titulo":"Avisar gerência imediatamente","obrigatorio":true},{"ordem":5,"titulo":"Documentar ocorrência","obrigatorio":true}]', 440),

    ('lavanderia_contingencia', 'CONT_FALTA_PROD', 'Falta de produto químico - Reabastecimento emergencial',
     'Procedimento quando sabão/amaciante acabam.',
     'contingencia', 'FN_GERENTE', 'contingencia', 'critica', 60, null, null, 'alto', null, null, ARRAY['ruptura_estoque'],
     '[{"ordem":1,"titulo":"Avisar gerência","obrigatorio":true},{"ordem":2,"titulo":"Verificar outras unidades","obrigatorio":true},{"ordem":3,"titulo":"Comprar emergencial","obrigatorio":true},{"ordem":4,"titulo":"Reposicionar entre unidades","obrigatorio":false}]', 450),

    -- ═══ ATENDIMENTO ═══
    ('lavanderia_core', 'RESP_WPP', 'Resposta a clientes WhatsApp',
     'Responder mensagens recebidas em até 30min.',
     'atendimento', 'FN_ATENDENTE', 'continua', 'alta', 240, 30, 60, 'medio', null, ARRAY[1,2,3,4,5,6,0], ARRAY['responsividade','nps'],
     '[{"ordem":1,"titulo":"Verificar caixa de entrada WhatsApp","obrigatorio":true},{"ordem":2,"titulo":"Responder cada mensagem","obrigatorio":true},{"ordem":3,"titulo":"Encaminhar reclamações","obrigatorio":false}]', 500),

    ('lavanderia_marketing', 'POST_INSTA', 'Postagem semanal Instagram',
     'Criar e publicar conteúdo semanal nas redes sociais.',
     'marketing', 'FN_MARKETING', 'semanal', 'media', 60, 90, 120, 'medio', null, ARRAY[5], ARRAY['engajamento_redes','seguidores'],
     '[{"ordem":1,"titulo":"Criar arte/foto","obrigatorio":true},{"ordem":2,"titulo":"Redigir legenda","obrigatorio":true},{"ordem":3,"titulo":"Publicar e compartilhar","obrigatorio":true}]', 510),

    ('lavanderia_core', 'REUNIAO_SEM', 'Reunião semanal da equipe',
     'Alinhamento semanal com indicadores, problemas e planejamento.',
     'gestao', 'FN_GERENTE', 'semanal', 'alta', 60, 75, 90, 'alto', '09:00', ARRAY[1], ARRAY['engajamento_equipe','metas_atingidas'],
     '[{"ordem":1,"titulo":"Apresentar KPIs da semana","obrigatorio":true},{"ordem":2,"titulo":"Reportar problemas","obrigatorio":true},{"ordem":3,"titulo":"Planejar ações","obrigatorio":true},{"ordem":4,"titulo":"Documentar ata","obrigatorio":true}]', 520)
  ) as r(pack, codigo, titulo, descricao, category_code, role_unit_code,
         frequencia, criticidade, est, sla_i, sla_m, impf, hora, dias, kpis, steps, ordem)
where not exists (
  select 1 from public.corp_routine_templates x where x.tenant_id = t.id and x.codigo = r.codigo
);

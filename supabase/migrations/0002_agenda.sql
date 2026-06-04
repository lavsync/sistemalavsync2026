-- =====================================================================
-- LavSync · Agenda (eventos + tarefas + feriados + alertas + Google sync)
-- Depende de 0001_init.sql (tenants, usuarios, unidades, current_tenant_id, is_master)
-- =====================================================================

-- ============ ENUMS ============
do $$ begin
  create type evento_tipo as enum ('particular', 'negocio');
exception when duplicate_object then null; end $$;

do $$ begin
  create type evento_status as enum ('agendado', 'em_andamento', 'concluido', 'cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type evento_prioridade as enum ('baixa', 'normal', 'alta', 'critica');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tarefa_status as enum ('pendente', 'em_andamento', 'concluida', 'bloqueada');
exception when duplicate_object then null; end $$;

do $$ begin
  create type alerta_canal as enum ('whatsapp', 'email', 'push', 'in_app');
exception when duplicate_object then null; end $$;

do $$ begin
  create type alerta_status as enum ('pendente', 'enviado', 'falhou', 'cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sync_origem as enum ('lavsync', 'google');
exception when duplicate_object then null; end $$;

-- ============ EVENTOS ============
create table if not exists public.eventos (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,
  responsavel_id uuid references public.usuarios(id) on delete set null,
  criado_por uuid references public.usuarios(id) on delete set null,

  titulo text not null,
  descricao text,
  local text,
  tipo evento_tipo not null default 'negocio',
  status evento_status not null default 'agendado',
  prioridade evento_prioridade not null default 'normal',
  cor text,                                    -- hex (#22d3ee, etc.) p/ UI
  tags text[] not null default '{}',

  inicio_em timestamptz not null,
  fim_em timestamptz not null,
  dia_inteiro boolean not null default false,
  timezone text not null default 'America/Sao_Paulo',

  -- recorrência (RRULE iCal-like, opcional)
  rrule text,
  recorrencia_fim timestamptz,

  -- Google Calendar
  google_event_id text,
  google_calendar_id text,
  origem sync_origem not null default 'lavsync',
  ultimo_sync_em timestamptz,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint eventos_periodo_valido check (fim_em >= inicio_em)
);

create index if not exists idx_eventos_tenant on public.eventos(tenant_id);
create index if not exists idx_eventos_tenant_inicio on public.eventos(tenant_id, inicio_em desc);
create index if not exists idx_eventos_responsavel on public.eventos(responsavel_id);
create index if not exists idx_eventos_unidade on public.eventos(unidade_id);
create index if not exists idx_eventos_google on public.eventos(google_event_id) where google_event_id is not null;
create index if not exists idx_eventos_status on public.eventos(tenant_id, status) where status in ('agendado', 'em_andamento');

-- ============ TAREFAS DENTRO DO EVENTO ============
create table if not exists public.eventos_tarefas (
  id uuid primary key default uuid_generate_v4(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  responsavel_id uuid references public.usuarios(id) on delete set null,

  titulo text not null,
  descricao text,
  status tarefa_status not null default 'pendente',
  ordem integer not null default 0,
  prazo_em timestamptz,
  concluida_em timestamptz,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_tarefas_evento on public.eventos_tarefas(evento_id, ordem);
create index if not exists idx_tarefas_tenant on public.eventos_tarefas(tenant_id);
create index if not exists idx_tarefas_responsavel on public.eventos_tarefas(responsavel_id);

-- ============ ALERTAS / LEMBRETES (WhatsApp, e-mail, push) ============
create table if not exists public.eventos_alertas (
  id uuid primary key default uuid_generate_v4(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  canal alerta_canal not null default 'whatsapp',
  destino text not null,                        -- telefone E.164, e-mail, etc.
  minutos_antes integer not null default 30,    -- quanto antes do evento disparar
  disparar_em timestamptz not null,             -- pré-calculado (inicio_em - minutos_antes)
  status alerta_status not null default 'pendente',
  tentativas integer not null default 0,
  ultimo_erro text,
  enviado_em timestamptz,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_alertas_evento on public.eventos_alertas(evento_id);
create index if not exists idx_alertas_tenant on public.eventos_alertas(tenant_id);
create index if not exists idx_alertas_pendentes on public.eventos_alertas(disparar_em)
  where status = 'pendente';

-- ============ FERIADOS NACIONAIS BR (compartilhado entre tenants) ============
create table if not exists public.feriados_br (
  id uuid primary key default uuid_generate_v4(),
  data date not null unique,
  nome text not null,
  tipo text not null default 'nacional',        -- nacional | estadual | municipal | facultativo
  uf text,                                      -- p/ feriados estaduais
  municipio text,                               -- p/ feriados municipais
  observacoes text,
  criado_em timestamptz not null default now()
);
create index if not exists idx_feriados_data on public.feriados_br(data);
create index if not exists idx_feriados_uf on public.feriados_br(uf);

-- ============ INTEGRAÇÃO GOOGLE CALENDAR (tokens por usuário) ============
create table if not exists public.google_calendar_tokens (
  usuario_id uuid primary key references public.usuarios(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  access_token text not null,
  refresh_token text not null,
  token_type text not null default 'Bearer',
  expira_em timestamptz not null,
  escopo text,
  calendar_id_principal text default 'primary',
  ativo boolean not null default true,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_google_tokens_tenant on public.google_calendar_tokens(tenant_id);

-- ============ TRIGGERS updated_at ============
drop trigger if exists trg_eventos_upd on public.eventos;
create trigger trg_eventos_upd before update on public.eventos
  for each row execute function public.set_atualizado_em();

drop trigger if exists trg_tarefas_upd on public.eventos_tarefas;
create trigger trg_tarefas_upd before update on public.eventos_tarefas
  for each row execute function public.set_atualizado_em();

drop trigger if exists trg_alertas_upd on public.eventos_alertas;
create trigger trg_alertas_upd before update on public.eventos_alertas
  for each row execute function public.set_atualizado_em();

drop trigger if exists trg_google_tokens_upd on public.google_calendar_tokens;
create trigger trg_google_tokens_upd before update on public.google_calendar_tokens
  for each row execute function public.set_atualizado_em();

-- ============ TRIGGER: recalcular disparar_em quando minutos_antes/inicio mudam ============
create or replace function public.recalcular_disparar_em()
returns trigger language plpgsql as $$
declare v_inicio timestamptz;
begin
  select inicio_em into v_inicio from public.eventos where id = new.evento_id;
  if v_inicio is not null then
    new.disparar_em := v_inicio - make_interval(mins => new.minutos_antes);
  end if;
  return new;
end $$;

drop trigger if exists trg_alertas_disparar on public.eventos_alertas;
create trigger trg_alertas_disparar before insert or update of minutos_antes, evento_id
  on public.eventos_alertas
  for each row execute function public.recalcular_disparar_em();

-- Quando o evento muda de horário, recalcular alertas pendentes:
create or replace function public.eventos_propagar_inicio()
returns trigger language plpgsql as $$
begin
  if new.inicio_em is distinct from old.inicio_em then
    update public.eventos_alertas
       set disparar_em = new.inicio_em - make_interval(mins => minutos_antes)
     where evento_id = new.id and status = 'pendente';
  end if;
  return new;
end $$;

drop trigger if exists trg_eventos_propagar on public.eventos;
create trigger trg_eventos_propagar after update of inicio_em on public.eventos
  for each row execute function public.eventos_propagar_inicio();

-- ============ RLS ============
alter table public.eventos enable row level security;
alter table public.eventos_tarefas enable row level security;
alter table public.eventos_alertas enable row level security;
alter table public.feriados_br enable row level security;
alter table public.google_calendar_tokens enable row level security;

drop policy if exists "eventos_tenant" on public.eventos;
create policy "eventos_tenant" on public.eventos
  for all using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

drop policy if exists "tarefas_tenant" on public.eventos_tarefas;
create policy "tarefas_tenant" on public.eventos_tarefas
  for all using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

drop policy if exists "alertas_tenant" on public.eventos_alertas;
create policy "alertas_tenant" on public.eventos_alertas
  for all using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

-- Feriados: leitura pública para todos os usuários autenticados, escrita apenas master
drop policy if exists "feriados_select_all" on public.feriados_br;
create policy "feriados_select_all" on public.feriados_br
  for select using (auth.role() = 'authenticated');

drop policy if exists "feriados_master_write" on public.feriados_br;
create policy "feriados_master_write" on public.feriados_br
  for all using (public.is_master()) with check (public.is_master());

-- Google tokens: usuário só vê os próprios; master vê todos
drop policy if exists "google_tokens_self" on public.google_calendar_tokens;
create policy "google_tokens_self" on public.google_calendar_tokens
  for all using (usuario_id = auth.uid() or public.is_master())
  with check (usuario_id = auth.uid() or public.is_master());

-- ============ SEED: Feriados nacionais BR 2026 ============
insert into public.feriados_br (data, nome, tipo) values
  ('2026-01-01', 'Confraternização Universal', 'nacional'),
  ('2026-02-16', 'Carnaval (segunda)', 'facultativo'),
  ('2026-02-17', 'Carnaval (terça)', 'facultativo'),
  ('2026-02-18', 'Quarta-feira de Cinzas (até 12h)', 'facultativo'),
  ('2026-04-03', 'Sexta-feira Santa', 'nacional'),
  ('2026-04-05', 'Páscoa', 'nacional'),
  ('2026-04-21', 'Tiradentes', 'nacional'),
  ('2026-05-01', 'Dia do Trabalho', 'nacional'),
  ('2026-06-04', 'Corpus Christi', 'facultativo'),
  ('2026-09-07', 'Independência do Brasil', 'nacional'),
  ('2026-10-12', 'Nossa Senhora Aparecida', 'nacional'),
  ('2026-11-02', 'Finados', 'nacional'),
  ('2026-11-15', 'Proclamação da República', 'nacional'),
  ('2026-11-20', 'Dia da Consciência Negra', 'nacional'),
  ('2026-12-25', 'Natal', 'nacional')
on conflict (data) do nothing;

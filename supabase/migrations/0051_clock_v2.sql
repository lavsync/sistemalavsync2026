-- =====================================================================
-- LavSync · 0051 · CLOCK v2 — sessões, auditoria de ações, insights e voz
--
-- O CLOCK passa a guardar a conversa no servidor (append-only: o modelo
-- exige que o histórico nunca seja editado), a registrar TUDO o que propõe
-- ou executa (clock_acoes = trilha de auditoria) e a publicar briefing e
-- alertas próprios (clock_insights) que cada usuário marca como vistos.
--
-- Segurança:
--   · tenant via current_tenant_id() / is_master() (padrão das vizinhas)
--   · sessões, mensagens e ações são do DONO (usuario_id = auth.uid());
--     master enxerga tudo para auditoria
--   · clock_mensagens não aceita UPDATE/DELETE (append-only)
--   · clock_acoes: o usuário só LÊ. Quem grava é o gateway do CLOCK com
--     service role, depois do gate de permissão (proporAcao/executar).
--     Sem DELETE; um trigger trava as colunas de identidade, só permite as
--     transições de status do protocolo e congela o resultado gravado
--   · clock_insights é escrito pelo cron (service role); o usuário só lê
--     o que a permissão e as unidades dele permitem (clock_pode_ver_insight)
--   · clock_config (voz) só é alterado por admin/master do tenant
--
-- Também completa o catálogo RBAC (0017) com as chaves que o CLOCK usa
-- para módulos que ainda não tinham permissão própria.
-- =====================================================================

-- ─── Sessões de conversa ─────────────────────────────────────────────
create table if not exists public.clock_sessoes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  titulo text,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);
create index if not exists ix_clock_sessoes_usuario
  on public.clock_sessoes(usuario_id, atualizada_em desc);
create index if not exists ix_clock_sessoes_tenant
  on public.clock_sessoes(tenant_id, atualizada_em desc);

-- set_atualizado_em (0001) escreve "atualizado_em"; a sessão usa o feminino
create or replace function public.set_atualizada_em()
returns trigger language plpgsql as $$
begin
  new.atualizada_em = now();
  return new;
end $$;

drop trigger if exists trg_clock_sessoes_upd on public.clock_sessoes;
create trigger trg_clock_sessoes_upd before update on public.clock_sessoes
  for each row execute function public.set_atualizada_em();

-- ─── Mensagens (blocos Anthropic, append-only) ───────────────────────
-- content é TEXT com o JSON serializado, e não jsonb: o jsonb reordena as
-- chaves dos objetos, e o histórico reenviado ao modelo precisa ser
-- byte-idêntico ao que ele produziu (cache de prompt e thinking preservado).
create table if not exists public.clock_mensagens (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references public.clock_sessoes(id) on delete cascade,
  seq integer not null check (seq >= 1),
  role text not null check (role in ('user', 'assistant')),
  content text not null check (left(content, 1) = '['),
  criado_em timestamptz not null default now(),
  unique (sessao_id, seq)
);
-- unique(sessao_id, seq) já indexa a leitura ordenada da sessão

-- Cada mensagem nova "toca" a sessão (ordena a lista de conversas)
create or replace function public.clock_tocar_sessao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.clock_sessoes set atualizada_em = now() where id = new.sessao_id;
  return new;
end $$;

drop trigger if exists trg_clock_mensagens_toca on public.clock_mensagens;
create trigger trg_clock_mensagens_toca after insert on public.clock_mensagens
  for each row execute function public.clock_tocar_sessao();

-- ─── Ações propostas/executadas (auditoria) ──────────────────────────
create table if not exists public.clock_acoes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  sessao_id uuid references public.clock_sessoes(id) on delete set null,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  acao text not null,                       -- id da ação no registro do gateway
  params jsonb not null default '{}'::jsonb,
  resumo text not null,                     -- frase de confirmação com impacto
  risco text not null check (risco in ('baixo', 'medio', 'alto')),
  permissao text not null,                  -- chave RBAC exigida (re-checada ao executar)
  status text not null default 'pendente'
    check (status in ('pendente', 'executada', 'cancelada', 'expirada', 'erro')),
  resultado jsonb,
  criado_em timestamptz not null default now(),
  decidido_em timestamptz
);
create index if not exists ix_clock_acoes_sessao_pend
  on public.clock_acoes(sessao_id, criado_em desc) where status = 'pendente';
create index if not exists ix_clock_acoes_usuario
  on public.clock_acoes(usuario_id, criado_em desc);
create index if not exists ix_clock_acoes_tenant
  on public.clock_acoes(tenant_id, criado_em desc);

-- Guarda da auditoria: identidade da ação é imutável, o status só anda
-- pendente → (executada|cancelada|expirada|erro) e executada → erro, e o
-- resultado só é gravado uma vez (de null para valor).
create or replace function public.clock_acoes_guarda()
returns trigger language plpgsql as $$
begin
  if new.tenant_id is distinct from old.tenant_id
     or new.usuario_id is distinct from old.usuario_id
     or new.sessao_id is distinct from old.sessao_id and new.sessao_id is not null
     or new.acao is distinct from old.acao
     or new.params is distinct from old.params
     or new.resumo is distinct from old.resumo
     or new.risco is distinct from old.risco
     or new.permissao is distinct from old.permissao
     or new.criado_em is distinct from old.criado_em then
    raise exception 'clock_acoes: campos de auditoria são imutáveis';
  end if;

  -- Sem mudança de decisão (ex.: sessão apagada → sessao_id vira null)
  if new.status = old.status
     and new.resultado is not distinct from old.resultado
     and new.decidido_em is not distinct from old.decidido_em then
    return new;
  end if;

  if old.status = 'pendente' then
    if new.status = 'pendente' then
      raise exception 'clock_acoes: ação pendente só pode ser decidida';
    end if;
    new.decidido_em := coalesce(new.decidido_em, now());
  elsif old.status = 'executada' then
    if new.status not in ('executada', 'erro') then
      raise exception 'clock_acoes: transição inválida de executada para %', new.status;
    end if;
    if old.resultado is not null and new.resultado is distinct from old.resultado then
      raise exception 'clock_acoes: resultado já gravado é imutável';
    end if;
    if new.decidido_em is distinct from old.decidido_em then
      raise exception 'clock_acoes: decidido_em é imutável depois da decisão';
    end if;
  else
    raise exception 'clock_acoes: ação já encerrada (%)', old.status;
  end if;
  return new;
end $$;

drop trigger if exists trg_clock_acoes_guarda on public.clock_acoes;
create trigger trg_clock_acoes_guarda before update on public.clock_acoes
  for each row execute function public.clock_acoes_guarda();

-- ─── Insights (briefing diário e alertas) ────────────────────────────
create table if not exists public.clock_insights (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete cascade,  -- null = rede
  tipo text not null check (tipo in ('briefing', 'alerta')),
  titulo text not null,
  texto_fala text not null,
  fatos jsonb not null default '{}'::jsonb,   -- números de origem (sem PII)
  severidade text not null default 'info',     -- definida pelo motor de briefing
  permissao text,                              -- quem pode ouvir (null = todos do tenant)
  href text,
  ref_data date not null,                      -- dia a que os fatos se referem
  criado_em timestamptz not null default now()
);
create index if not exists ix_clock_insights_tenant
  on public.clock_insights(tenant_id, criado_em desc);
create index if not exists ix_clock_insights_ref
  on public.clock_insights(tenant_id, tipo, ref_data desc);

create table if not exists public.clock_insights_vistos (
  insight_id uuid not null references public.clock_insights(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  visto_em timestamptz not null default now(),
  primary key (insight_id, usuario_id)
);
create index if not exists ix_clock_insights_vistos_usuario
  on public.clock_insights_vistos(usuario_id, visto_em desc);

-- ─── Configuração do CLOCK por tenant (voz) ──────────────────────────
create table if not exists public.clock_config (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  voice_id text,
  atualizado_em timestamptz not null default now()
);

drop trigger if exists trg_clock_config_upd on public.clock_config;
create trigger trg_clock_config_upd before update on public.clock_config
  for each row execute function public.set_atualizado_em();

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.clock_sessoes enable row level security;
drop policy if exists "clock_sessoes_dono" on public.clock_sessoes;
create policy "clock_sessoes_dono" on public.clock_sessoes
  for all using (
    (tenant_id = public.current_tenant_id() and usuario_id = auth.uid())
    or public.is_master()
  )
  with check (
    (tenant_id = public.current_tenant_id() and usuario_id = auth.uid())
    or public.is_master()
  );

-- Mensagens: só SELECT e INSERT (append-only). Sem policy de UPDATE/DELETE;
-- a exclusão acontece em cascata quando o dono apaga a sessão.
alter table public.clock_mensagens enable row level security;
drop policy if exists "clock_mensagens_select" on public.clock_mensagens;
create policy "clock_mensagens_select" on public.clock_mensagens
  for select using (
    exists (
      select 1 from public.clock_sessoes s
      where s.id = clock_mensagens.sessao_id
        and ((s.tenant_id = public.current_tenant_id() and s.usuario_id = auth.uid())
             or public.is_master())
    )
  );
drop policy if exists "clock_mensagens_insert" on public.clock_mensagens;
create policy "clock_mensagens_insert" on public.clock_mensagens
  for insert with check (
    exists (
      select 1 from public.clock_sessoes s
      where s.id = clock_mensagens.sessao_id
        and s.tenant_id = public.current_tenant_id()
        and s.usuario_id = auth.uid()
    )
  );

-- Ações: dono e master só LEEM. Sem INSERT/UPDATE/DELETE para authenticated:
-- uma linha forjada pelo PostgREST (risco, resumo ou status falsos) furaria
-- a confirmação humana. O gateway grava com service role após o gate.
alter table public.clock_acoes enable row level security;
drop policy if exists "clock_acoes_select" on public.clock_acoes;
create policy "clock_acoes_select" on public.clock_acoes
  for select using (
    (tenant_id = public.current_tenant_id() and usuario_id = auth.uid())
    or public.is_master()
  );
drop policy if exists "clock_acoes_insert" on public.clock_acoes;
drop policy if exists "clock_acoes_update" on public.clock_acoes;

-- Quem pode ouvir um insight: mesma regra de briefing/novidades.ts.
--   · master e admin ativos: tudo do tenant;
--   · insight de rede (unidade_id null): só quem vê TODAS as unidades ativas;
--   · insight de unidade: a unidade precisa estar em unidades_permitidas
--     (null ou vazio = todas, igual a unidade-ativa.ts:listarUnidades);
--   · permissao preenchida: precisa da chave RBAC (verificar_permissao, 0017).
create or replace function public.clock_pode_ver_insight(p_unidade_id uuid, p_permissao text)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_papel text;
  v_ativo boolean;
  v_unids uuid[];
  v_tenant uuid;
begin
  if public.is_master() then return true; end if;
  select papel, ativo, unidades_permitidas, tenant_id
    into v_papel, v_ativo, v_unids, v_tenant
    from public.usuarios where id = auth.uid();
  if v_papel is null or v_ativo is not true then return false; end if;
  if v_papel = 'admin' then return true; end if;

  if v_unids is not null and cardinality(v_unids) > 0 then
    if p_unidade_id is null then
      if exists (
        select 1 from public.unidades u
        where u.tenant_id = v_tenant and u.ativo = true and not (u.id = any(v_unids))
      ) then
        return false;
      end if;
    elsif not (p_unidade_id = any(v_unids)) then
      return false;
    end if;
  end if;

  if p_permissao is not null and not public.verificar_permissao(auth.uid(), p_permissao) then
    return false;
  end if;
  return true;
end $$;

grant execute on function public.clock_pode_ver_insight(uuid, text) to authenticated;

-- Insights: leitura pelo tenant com as travas de unidade e permissão;
-- escrita só master (o cron usa service role)
alter table public.clock_insights enable row level security;
drop policy if exists "clock_insights_select" on public.clock_insights;
create policy "clock_insights_select" on public.clock_insights
  for select using (
    public.is_master()
    or (tenant_id = public.current_tenant_id()
        and public.clock_pode_ver_insight(unidade_id, permissao))
  );
drop policy if exists "clock_insights_master" on public.clock_insights;
create policy "clock_insights_master" on public.clock_insights
  for all using (public.is_master()) with check (public.is_master());

alter table public.clock_insights_vistos enable row level security;
drop policy if exists "clock_insights_vistos_dono" on public.clock_insights_vistos;
create policy "clock_insights_vistos_dono" on public.clock_insights_vistos
  for all using (usuario_id = auth.uid() or public.is_master())
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1 from public.clock_insights i
      where i.id = clock_insights_vistos.insight_id
        and i.tenant_id = public.current_tenant_id()
    )
  );

-- Config de voz: leitura pelo tenant; escrita por admin/master do tenant
alter table public.clock_config enable row level security;
drop policy if exists "clock_config_select" on public.clock_config;
create policy "clock_config_select" on public.clock_config
  for select using (tenant_id = public.current_tenant_id() or public.is_master());
drop policy if exists "clock_config_admin" on public.clock_config;
create policy "clock_config_admin" on public.clock_config
  for all using (
    public.is_master()
    or (tenant_id = public.current_tenant_id() and exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.papel in ('admin', 'master') and u.ativo = true
    ))
  )
  with check (
    public.is_master()
    or (tenant_id = public.current_tenant_id() and exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.papel in ('admin', 'master') and u.ativo = true
    ))
  );

-- ─── Catálogo RBAC: chaves que o CLOCK usa e ainda não existiam ──────
insert into public.permissoes_catalogo (chave, modulo, acao, label, ordem) values
  ('clock.usar',             'clock',        'view',    'Conversar com o CLOCK',                 120),
  ('metas.view',             'metas',        'view',    'Visualizar Metas',                      125),
  ('tarefas.view',           'tarefas',      'view',    'Visualizar Tarefas',                    130),
  ('tarefas.create',         'tarefas',      'create',  'Criar tarefa e comentar',               131),
  ('tarefas.update',         'tarefas',      'update',  'Atualizar e mover tarefas',             132),
  ('tarefas.delete',         'tarefas',      'delete',  'Excluir tarefas',                       133),
  ('agenda.view',            'agenda',       'view',    'Visualizar Agenda',                     140),
  ('agenda.create',          'agenda',       'create',  'Agendar compromissos',                  141),
  ('rotinas.view',           'rotinas',      'view',    'Visualizar Rotinas Corporativas',       150),
  ('rotinas.execute',        'rotinas',      'execute', 'Executar rotinas do dia',               151),
  ('midia_indoor.view',      'midia_indoor', 'view',    'Visualizar Mídia Indoor',               160),
  ('midia_indoor.update',    'midia_indoor', 'update',  'Pausar/ativar campanhas de TV',         161)
on conflict (chave) do update set
  modulo = excluded.modulo,
  acao = excluded.acao,
  label = excluded.label,
  ordem = excluded.ordem;

-- Mesmas regras de 0017/0018 para as chaves novas
insert into public.papeis_permissoes (papel, permissao_chave)
select 'admin', chave from public.permissoes_catalogo
where chave in ('clock.usar','metas.view','tarefas.view','tarefas.create','tarefas.update','tarefas.delete',
                'agenda.view','agenda.create','rotinas.view','rotinas.execute',
                'midia_indoor.view','midia_indoor.update')
on conflict do nothing;

insert into public.papeis_permissoes (papel, permissao_chave)
select 'gerente', chave from public.permissoes_catalogo
where chave in ('clock.usar','metas.view','tarefas.view','tarefas.create','tarefas.update',
                'agenda.view','agenda.create','rotinas.view','rotinas.execute',
                'midia_indoor.view','midia_indoor.update')
on conflict do nothing;

insert into public.papeis_permissoes (papel, permissao_chave)
select 'operador', chave from public.permissoes_catalogo
where chave in ('clock.usar','tarefas.view','tarefas.create','tarefas.update',
                'agenda.view','agenda.create','rotinas.view','rotinas.execute',
                'midia_indoor.view')
on conflict do nothing;

insert into public.papeis_permissoes (papel, permissao_chave)
select 'viewer', chave from public.permissoes_catalogo
where chave in ('clock.usar','metas.view','tarefas.view','agenda.view','rotinas.view','midia_indoor.view')
on conflict do nothing;

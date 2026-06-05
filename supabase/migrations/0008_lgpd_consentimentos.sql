-- =====================================================================
-- LavSync · LGPD · Consentimentos e solicitações do titular
-- Conformidade com Lei 13.709/2018 (LGPD)
-- =====================================================================

-- ============ Versão atual dos documentos legais ============
-- Sempre que atualizar política/termos, incrementar essa versão.
-- Usuários com versão_aceita < versão_atual veem dialog de aceite no login.

-- ============ ENUMS ============
do $$ begin
  create type tipo_consentimento as enum (
    'cookies_essenciais',
    'cookies_analytics',
    'cookies_marketing',
    'termos_uso',
    'politica_privacidade',
    'newsletter',
    'whatsapp'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_solicitacao_lgpd as enum (
    'acesso',         -- Art. 18, II — confirmação + acesso
    'correcao',       -- Art. 18, III
    'anonimizacao',   -- Art. 18, IV
    'portabilidade',  -- Art. 18, V
    'exclusao',       -- Art. 18, VI
    'revogacao',      -- Art. 8, §5
    'oposicao',       -- Art. 18, §2
    'informacao'      -- Art. 18, I
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_solicitacao_lgpd as enum (
    'aberta', 'em_analise', 'atendida', 'recusada', 'cancelada'
  );
exception when duplicate_object then null; end $$;

-- ============ Consentimentos ============
-- Registra cada consentimento individual + auditoria (IP, user-agent)
create table if not exists public.consentimentos_lgpd (
  id uuid primary key default uuid_generate_v4(),
  usuario_id uuid references public.usuarios(id) on delete set null,
  email text,                              -- pra consentimentos pré-cadastro
  cpf text,                                -- titular ainda não cadastrado
  tipo tipo_consentimento not null,
  concedido boolean not null,
  versao_documento text not null,          -- "v1.0", "v1.1"
  ip_origem inet,
  user_agent text,
  origem text,                             -- 'site' | 'sistema' | 'totem'
  metadata jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists idx_consent_usuario on public.consentimentos_lgpd(usuario_id);
create index if not exists idx_consent_email on public.consentimentos_lgpd(email);
create index if not exists idx_consent_cpf on public.consentimentos_lgpd(cpf);
create index if not exists idx_consent_tipo on public.consentimentos_lgpd(tipo, criado_em desc);

-- ============ Solicitações do titular (direitos LGPD) ============
create table if not exists public.solicitacoes_lgpd (
  id uuid primary key default uuid_generate_v4(),
  tipo tipo_solicitacao_lgpd not null,
  status status_solicitacao_lgpd not null default 'aberta',

  -- Titular (pode estar logado ou ser anônimo via formulário público)
  titular_nome text not null,
  titular_email text not null,
  titular_cpf text,
  titular_telefone text,
  usuario_id uuid references public.usuarios(id) on delete set null,

  -- Conteúdo
  descricao text not null,                 -- o que o titular pede
  resposta text,                           -- o que foi feito
  evidencia_documento_url text,            -- ex: doc de identidade pra validar

  -- Tratamento
  responsavel_id uuid references public.usuarios(id) on delete set null,
  prazo_atendimento_em timestamptz default now() + interval '15 days',  -- LGPD Art. 19
  atendida_em timestamptz,

  ip_origem inet,
  user_agent text,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_solic_status on public.solicitacoes_lgpd(status, criado_em desc);
create index if not exists idx_solic_email on public.solicitacoes_lgpd(titular_email);

-- ============ Versão de documentos aceita pelo usuário ============
alter table public.usuarios
  add column if not exists termos_aceitos_em timestamptz,
  add column if not exists termos_versao text,
  add column if not exists politica_aceita_em timestamptz,
  add column if not exists politica_versao text;

-- ============ TRIGGERS ============
drop trigger if exists trg_solic_upd on public.solicitacoes_lgpd;
create trigger trg_solic_upd before update on public.solicitacoes_lgpd
  for each row execute function public.set_atualizado_em();

-- ============ RLS ============
alter table public.consentimentos_lgpd enable row level security;
alter table public.solicitacoes_lgpd enable row level security;

-- Consentimentos: usuário vê os próprios; master/admin vê todos.
-- Insert público permitido (banner de cookies funciona antes do login)
drop policy if exists "consent_select" on public.consentimentos_lgpd;
create policy "consent_select" on public.consentimentos_lgpd
  for select using (
    public.is_master() or usuario_id = auth.uid()
    or exists (select 1 from public.usuarios where id = auth.uid() and papel in ('admin'))
  );

drop policy if exists "consent_insert" on public.consentimentos_lgpd;
create policy "consent_insert" on public.consentimentos_lgpd
  for insert with check (true);   -- escrita liberada (server action controla)

-- Solicitações: titular vê as próprias por email; equipe vê tudo
drop policy if exists "solic_select" on public.solicitacoes_lgpd;
create policy "solic_select" on public.solicitacoes_lgpd
  for select using (
    public.is_master() or usuario_id = auth.uid()
    or exists (select 1 from public.usuarios where id = auth.uid() and papel in ('admin'))
  );

drop policy if exists "solic_insert" on public.solicitacoes_lgpd;
create policy "solic_insert" on public.solicitacoes_lgpd
  for insert with check (true);

drop policy if exists "solic_update" on public.solicitacoes_lgpd;
create policy "solic_update" on public.solicitacoes_lgpd
  for update using (
    public.is_master() or exists (select 1 from public.usuarios where id = auth.uid() and papel in ('admin'))
  );

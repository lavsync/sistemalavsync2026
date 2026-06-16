-- =====================================================================
-- LavSync · 0032 · CLOCK Relacionamento — Engine de mensageria (Sprint 1)
--
-- Núcleo do Conversational CRM (doc: docs/CLOCK-RELACIONAMENTO.md).
-- Fila unificada + templates + config de rate-limit. Generaliza o
-- marketing_envios (0014) e herda o padrão da castelo_webhook_outbox (0030).
--
-- Sprint 1 = fundação. Disparo ainda em dry-run (sem provider). O provider
-- WhatsApp (Meta Cloud API) entra no Sprint 2.
-- =====================================================================

-- ─── msg_templates ─────────────────────────────────────────────────
-- Mensagens reutilizáveis. unidade_id NULL = vale para todas as unidades.
create table if not exists public.msg_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete cascade,

  chave text not null,                       -- 'resumo_diario' | 'primeira_compra' | 'win_back' | ...
  nome text not null,
  categoria text not null default 'campanha', -- autoatendimento | maxcontrole | campanha
  tipo_gatilho text,                          -- venda_confirmada | fim_ciclo | recarga | inatividade | manual
  canal_padrao text not null default 'whatsapp',
  escopo text not null default 'promo',       -- promo | operacional  (governa opt-out SAIRPROMO)

  ativo boolean not null default true,
  opcoes jsonb not null default '{}'::jsonb,  -- { cupom, diferenciar_ciclo, horario, min_antes_lavagem, min_antes_secagem }
  corpo text not null default '',
  gerado_por_ia boolean not null default false,

  criado_por uuid references public.usuarios(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
-- Uma chave por unidade (NULL tratado como "global" via uuid zero).
create unique index if not exists ux_msg_templates_chave
  on public.msg_templates(tenant_id, chave, coalesce(unidade_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists ix_msg_templates_cat
  on public.msg_templates(tenant_id, categoria, ativo);

-- ─── msg_rate_config ───────────────────────────────────────────────
-- Limites anti-bloqueio por unidade. Limites /hora e /dia são derivados em app.
create table if not exists public.msg_rate_config (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete cascade,

  limite_min integer not null default 6,           -- mensagens/min (geral, operacional consome primeiro)
  limite_campanha_min integer not null default 1,  -- mensagens de campanha/min (só sem operacional na fila)
  jitter_seg_min integer not null default 3,        -- jitter aleatório entre envios (s)
  jitter_seg_max integer not null default 20,
  janela_inicio time not null default '09:00',      -- janela de disparo de campanhas
  janela_fim time not null default '21:00',
  dedupe_cross_loja boolean not null default true,  -- não reenviar a quem comprou em outra loja do mesmo dono

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists ux_msg_rate_unidade
  on public.msg_rate_config(tenant_id, coalesce(unidade_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ─── msg_fila ──────────────────────────────────────────────────────
-- Fila unificada de envios. Prioridade: 0 = operacional ... 9 = campanha.
create table if not exists public.msg_fila (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,

  tipo text not null default 'campanha',     -- transacional | campanha | automacao | inbound_resp
  prioridade smallint not null default 5,     -- 0=operacional ... 9=campanha
  escopo text not null default 'promo',       -- promo | operacional (para opt-out)

  cliente_id uuid references public.clientes(id) on delete set null,
  campanha_id uuid references public.marketing_campanhas(id) on delete cascade,
  template_chave text,

  canal text not null default 'whatsapp',     -- whatsapp | email | sms
  destinatario_nome text,
  destinatario_telefone text,
  destinatario_cpf text,
  corpo_renderizado text not null,

  agendado_para timestamptz not null default now(),
  status text not null default 'pendente',    -- pendente | enviando | enviado | entregue | lido | falhou | cancelado | morto | suprimido
  tentativas integer not null default 0,
  proximo_retry_em timestamptz not null default now(),

  provider text,                              -- meta_cloud | manual | ...
  provider_message_id text,
  last_status_code integer,
  erro text,
  dedupe_key text,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  enviado_em timestamptz,
  entregue_em timestamptz
);
-- Fila de saída: pendentes vencidos, por prioridade.
create index if not exists ix_msg_fila_saida
  on public.msg_fila(tenant_id, prioridade, proximo_retry_em)
  where status = 'pendente';
-- Dedupe: nunca enfileira a mesma dedupe_key 2x.
create unique index if not exists ux_msg_fila_dedupe
  on public.msg_fila(tenant_id, dedupe_key) where dedupe_key is not null;
create index if not exists ix_msg_fila_cliente on public.msg_fila(cliente_id) where cliente_id is not null;
create index if not exists ix_msg_fila_campanha on public.msg_fila(campanha_id) where campanha_id is not null;

-- ─── Triggers de atualizado_em ─────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['msg_templates','msg_rate_config','msg_fila'] loop
    execute format('drop trigger if exists trg_%s_upd on public.%I;', t, t);
    execute format('create trigger trg_%s_upd before update on public.%I
      for each row execute function public.set_atualizado_em();', t, t);
  end loop;
end $$;

-- ─── RLS (tenant) ──────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['msg_templates','msg_rate_config','msg_fila'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format($f$
      drop policy if exists "%s_tenant" on public.%I;
      create policy "%s_tenant" on public.%I
        for all using (tenant_id = public.current_tenant_id() or public.is_master())
        with check (tenant_id = public.current_tenant_id() or public.is_master());
    $f$, t, t, t, t);
  end loop;
end $$;

-- =====================================================================
-- LavSync · 0014 · Marketing (campanhas + envios)
-- V1 sem integração WhatsApp real — apenas estrutura + log.
-- =====================================================================

create table if not exists public.marketing_campanhas (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete cascade,

  nome text not null,
  descricao text,
  canal text not null default 'whatsapp',           -- whatsapp | email | sms
  template_mensagem text not null,                  -- com placeholders {nome}, {ultima_compra}, etc

  segmento text not null default 'todos',           -- campeoes | fieis | em_risco | dormentes | novos | todos
  filtro_dias_sem_compra integer,                   -- ex: 30 (só clientes inativos 30+ dias)
  filtro_ltv_minimo numeric(10, 2),

  status text not null default 'rascunho',          -- rascunho | agendada | enviando | concluida | cancelada
  agendada_para timestamptz,

  total_destinatarios integer not null default 0,
  total_enviados integer not null default 0,
  total_entregues integer not null default 0,
  total_erros integer not null default 0,

  criado_por uuid references public.usuarios(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  concluida_em timestamptz
);
create index if not exists idx_camp_unidade on public.marketing_campanhas(unidade_id, criado_em desc);
create index if not exists idx_camp_status on public.marketing_campanhas(tenant_id, status, criado_em desc);

create table if not exists public.marketing_envios (
  id uuid primary key default uuid_generate_v4(),
  campanha_id uuid not null references public.marketing_campanhas(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete set null,

  destinatario_nome text,
  destinatario_telefone text,
  destinatario_cpf text,
  mensagem_renderizada text not null,

  status text not null default 'pendente',          -- pendente | enviado | entregue | lido | falhou
  erro text,
  provider text,                                    -- z-api | twilio | manual
  provider_message_id text,

  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  entregue_em timestamptz
);
create index if not exists idx_envios_camp on public.marketing_envios(campanha_id);
create index if not exists idx_envios_cliente on public.marketing_envios(cliente_id);

-- Triggers
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_camp_upd') then
    create trigger trg_camp_upd before update on public.marketing_campanhas
      for each row execute function public.set_atualizado_em();
  end if;
end $$;

-- RLS
do $$
declare t text;
begin
  foreach t in array array['marketing_campanhas','marketing_envios'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format($f$
      drop policy if exists "%I_tenant" on public.%I;
      create policy "%I_tenant" on public.%I
        for all using (tenant_id = public.current_tenant_id() or public.is_master())
        with check (tenant_id = public.current_tenant_id() or public.is_master());
    $f$, t, t, t, t);
  end loop;
end $$;

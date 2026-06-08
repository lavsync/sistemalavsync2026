-- =====================================================================
-- LavSync · 0015 · Suporte / chamados internos
-- =====================================================================

create table if not exists public.tickets_suporte (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete cascade,
  numero serial,                                       -- número sequencial para humanos

  titulo text not null,
  descricao text not null,

  categoria text not null default 'outro',             -- bug | sugestao | maquina | atendimento | duvida | outro
  prioridade text not null default 'media',            -- baixa | media | alta | critica
  status text not null default 'aberto',               -- aberto | em_andamento | resolvido | fechado

  criado_por uuid references public.usuarios(id) on delete set null,
  atribuido_para uuid references public.usuarios(id) on delete set null,

  resposta text,
  resolvido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_tickets_unidade on public.tickets_suporte(unidade_id, status, criado_em desc);
create index if not exists idx_tickets_status on public.tickets_suporte(tenant_id, status, prioridade);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_tickets_upd') then
    create trigger trg_tickets_upd before update on public.tickets_suporte
      for each row execute function public.set_atualizado_em();
  end if;
end $$;

alter table public.tickets_suporte enable row level security;
drop policy if exists "tickets_suporte_tenant" on public.tickets_suporte;
create policy "tickets_suporte_tenant" on public.tickets_suporte
  for all using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

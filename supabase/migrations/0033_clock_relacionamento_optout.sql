-- =====================================================================
-- LavSync · 0033 · CLOCK Relacionamento — Opt-out (Sprint 1)
--
-- Palavras-chave de descadastro recebidas pelo cliente via WhatsApp:
--   SAIR      → opt-out total (todas as mensagens)
--   SAIRPROMO → opt-out só de promoções (mantém operacional: fim de ciclo, etc)
--
-- Liga em lgpd_consentimentos (0008). Todo envio de campanha checa opt-out
-- antes de enfileirar. Mensagens 'operacional' ignoram SAIRPROMO.
-- =====================================================================

create table if not exists public.msg_optout (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete cascade,
  telefone text,                              -- fallback quando o cliente ainda não está mapeado

  escopo text not null default 'todas',       -- todas | promo
  origem text not null default 'manual',      -- SAIR | SAIRPROMO | manual | lgpd
  ativo boolean not null default true,        -- false = cliente reativou o contato

  em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
-- Um opt-out por (cliente, escopo). Reativar = ativo=false.
create unique index if not exists ux_msg_optout_cliente
  on public.msg_optout(tenant_id, cliente_id, escopo) where cliente_id is not null;
create index if not exists ix_msg_optout_tel
  on public.msg_optout(tenant_id, telefone) where telefone is not null;

do $$
begin
  drop trigger if exists trg_msg_optout_upd on public.msg_optout;
  create trigger trg_msg_optout_upd before update on public.msg_optout
    for each row execute function public.set_atualizado_em();
end $$;

alter table public.msg_optout enable row level security;
drop policy if exists "msg_optout_tenant" on public.msg_optout;
create policy "msg_optout_tenant" on public.msg_optout
  for all using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

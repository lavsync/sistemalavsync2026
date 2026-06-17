-- =====================================================================
-- LavSync · 0035 · CLOCK Relacionamento — Log de eventos WhatsApp (Sprint 2)
--
-- Captura TUDO que o webhook do WhatsApp Cloud API manda:
--   - status de mensagens enviadas (sent/delivered/read/failed + erro)
--   - mensagens recebidas (inbound) do cliente
-- Serve de telemetria de entrega e base do inbound (opt-out/chatbot).
-- Doc: docs/CLOCK-RELACIONAMENTO.md §3.
-- =====================================================================

create table if not exists public.wa_eventos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,

  tipo text not null,                          -- status | inbound
  phone_number_id text,                        -- número da empresa que recebeu/enviou
  wamid text,                                  -- ID da mensagem (wamid.*)
  status text,                                 -- sent | delivered | read | failed
  recipient text,                              -- destinatário (status)
  from_number text,                            -- remetente (inbound)
  texto text,                                  -- corpo (inbound)
  erro_code integer,
  erro_msg text,
  raw jsonb,                                   -- payload bruto p/ auditoria

  criado_em timestamptz not null default now()
);
create index if not exists ix_wa_eventos_wamid on public.wa_eventos(wamid) where wamid is not null;
create index if not exists ix_wa_eventos_tipo on public.wa_eventos(tipo, criado_em desc);

alter table public.wa_eventos enable row level security;
drop policy if exists "wa_eventos_master" on public.wa_eventos;
create policy "wa_eventos_master" on public.wa_eventos for all
  using (public.is_master())
  with check (public.is_master());

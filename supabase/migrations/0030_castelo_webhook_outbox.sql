-- =====================================================================
-- LavSync · 0030 · Webhook outbox → Xô Varal Castelo (Clube de Vantagens)
--
-- O LavSync é a fonte da verdade do pagamento. A cada venda confirmada
-- na unidade CASTELO com CPF válido, enfileiramos um evento na outbox.
-- Um processador (server action no fim do import + cron diário de retry)
-- envia POST https://castelo.xovaral.com/api/lavsync/webhook.
--
-- Idempotente por event_id (= venda.id). Reenviar nunca duplica pontos.
-- Spec: ~/Desktop/INTEGRACAO-LAVSYNC-WEBHOOK.md
-- =====================================================================

-- ─── Outbox ────────────────────────────────────────────────────────
create table if not exists public.castelo_webhook_outbox (
  id uuid primary key default gen_random_uuid(),
  -- Idempotência: ID estável do evento no LavSync (= venda.id)
  event_id text not null,
  venda_id uuid references public.vendas(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,
  -- Conteúdo do payload (espelha o body enviado)
  cpf text not null,
  cycles integer not null default 0,
  points integer not null default 0,
  amount_cents integer null,
  occurred_at timestamptz null,
  -- Estado de entrega
  status text not null default 'pending',     -- pending | sent | failed
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_status_code integer null,
  last_error text null,
  response_body text null,
  sent_at timestamptz null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- event_id único garante idempotência local (não enfileira o mesmo 2x)
create unique index if not exists ux_castelo_outbox_event
  on public.castelo_webhook_outbox(event_id);
-- Fila de envio: pega pending com next_attempt_at vencido
create index if not exists ix_castelo_outbox_fila
  on public.castelo_webhook_outbox(status, next_attempt_at)
  where status = 'pending';
create index if not exists ix_castelo_outbox_venda
  on public.castelo_webhook_outbox(venda_id) where venda_id is not null;

-- ─── RLS ───────────────────────────────────────────────────────────
-- Leitura/gestão só pra master. Inserção real vem do trigger (SECURITY
-- DEFINER) e do processador via service_role (ambos ignoram RLS).
alter table public.castelo_webhook_outbox enable row level security;
drop policy if exists "castelo_outbox_master" on public.castelo_webhook_outbox;
create policy "castelo_outbox_master" on public.castelo_webhook_outbox for all
  using (public.is_master())
  with check (public.is_master());

-- ─── Trigger: enfileira venda confirmada da Castelo ────────────────
-- Castelo = 10000000-0000-0000-0000-000000000002 (unidades.id fixo).
-- Regra de pontos do XÔ Club: 1 BRL = 1 XC (round). cycles = quantidade_ciclos.
-- À prova de falha: qualquer erro é engolido pra NUNCA quebrar o insert da venda.
create or replace function public.castelo_enfileirar_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cpf_dig text;
  v_points integer;
  v_cycles integer;
begin
  -- Só a unidade Castelo tem o site integrado
  if new.unidade_id is distinct from '10000000-0000-0000-0000-000000000002'::uuid then
    return new;
  end if;
  -- Só pagamento confirmado
  if coalesce(new.situacao::text, '') <> 'sucesso' then
    return new;
  end if;
  -- Precisa de CPF com 11 dígitos
  v_cpf_dig := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');
  if length(v_cpf_dig) <> 11 then
    return new;
  end if;

  v_cycles := coalesce(new.quantidade_ciclos, 0);
  v_points := round(coalesce(new.valor, 0))::int;
  -- Pelo menos um entre cycles e points > 0
  if v_cycles <= 0 and v_points <= 0 then
    return new;
  end if;

  begin
    insert into public.castelo_webhook_outbox
      (event_id, venda_id, tenant_id, unidade_id, cpf, cycles, points, amount_cents, occurred_at)
    values
      (new.id::text, new.id, new.tenant_id, new.unidade_id, new.cpf,
       v_cycles, v_points, round(coalesce(new.valor, 0) * 100)::int, new.data_venda)
    on conflict (event_id) do nothing;
  exception when others then
    -- nunca propaga: o registro da venda é prioridade absoluta
    null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_castelo_webhook on public.vendas;
create trigger trg_castelo_webhook
  after insert on public.vendas
  for each row execute function public.castelo_enfileirar_webhook();

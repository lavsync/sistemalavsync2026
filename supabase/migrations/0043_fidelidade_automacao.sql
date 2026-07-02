-- =====================================================================
-- LavSync · 0043 · Fidelidade — automação de ponta a ponta (LavCoin)
--
-- Fecha o ciclo do programa de fidelidade Xô Varal:
--   · Moeda oficial exibida = LavCoin (motor = xoclub, 1 BRL = 1 LavCoin)
--   · Fechamento mensal AUTOMÁTICO da classificação (Clube 0016) no dia 1
--     + mensagem de nível/desconto enfileirada em msg_fila
--   · Cadência de relacionamento: pós-uso, inatividade (7/21/45 dias),
--     sprint de ciclos (reta final do mês) — anti-massante por caps
-- =====================================================================

-- Nome da moeda exibido ao cliente (motor continua sendo o xoclub)
alter table public.xoclub_config
  add column if not exists nome_moeda text not null default 'LavCoin';

-- ─── Automações de relacionamento ────────────────────────────────────
-- Uma linha por gatilho. corpo usa as mesmas {vars} do Clube + LavCoins.
create table if not exists public.fidelidade_automacoes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  chave text not null,             -- pos_uso | inatividade_7 | inatividade_21 | inatividade_45 | faltam_ciclos | fechamento_nivel
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  corpo text not null default '',  -- mensagem ({primeiro_nome} {ciclos} {faltam} {proximo_nivel} {desconto_proximo} {lavcoins_saldo} {lavcoins_hoje} {mes_nome} ...)
  params jsonb not null default '{}'::jsonb,  -- ex.: {"dias":7} {"dia_inicio":20,"faltam_max":3}

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tenant_id, chave)
);

do $$
begin
  drop trigger if exists trg_fidelidade_auto_upd on public.fidelidade_automacoes;
  create trigger trg_fidelidade_auto_upd before update on public.fidelidade_automacoes
    for each row execute function public.set_atualizado_em();
end $$;

alter table public.fidelidade_automacoes enable row level security;
drop policy if exists "fidelidade_automacoes_tenant" on public.fidelidade_automacoes;
create policy "fidelidade_automacoes_tenant" on public.fidelidade_automacoes
  for all using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

-- ─── Log de fechamentos mensais (idempotência do cron do dia 1) ─────
create table if not exists public.fidelidade_fechamentos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  mes_ref date not null,                 -- 1º dia do mês fechado
  executado_em timestamptz not null default now(),
  clientes_classificados integer not null default 0,
  por_nivel jsonb not null default '{}'::jsonb,
  msgs_enfileiradas integer not null default 0,
  msgs_suprimidas integer not null default 0,
  unique (tenant_id, mes_ref)
);

alter table public.fidelidade_fechamentos enable row level security;
drop policy if exists "fidelidade_fechamentos_tenant" on public.fidelidade_fechamentos;
create policy "fidelidade_fechamentos_tenant" on public.fidelidade_fechamentos
  for all using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

-- ─── Seeds das automações (tenant Xô Varal) ──────────────────────────
insert into public.fidelidade_automacoes (tenant_id, chave, nome, descricao, ativo, corpo, params)
select '00000000-0000-0000-0000-000000000001', chave, nome, descricao, ativo, corpo, params::jsonb
from (values
  ('pos_uso', 'Agradecimento pós-uso',
   'Enviada 1x/dia no máximo, no dia seguinte ao uso. Informa LavCoins ganhos e progresso de ciclos.',
   true,
   'Obrigado por escolher a Xô Varal, {primeiro_nome}! 💙 Você ganhou {lavcoins_hoje} LavCoins (saldo: {lavcoins_saldo}) e já soma {ciclos} ciclos em {mes_nome}. Faltam {faltam} ciclos para o nível {proximo_nivel} — quem chega lá ganha {desconto_proximo}% OFF o mês inteiro seguinte. Até a próxima lavagem!',
   '{}'),
  ('inatividade_7', 'Sentimos sua falta (7 dias)',
   'Cliente sem usar há 7 dias. Toque leve, sem pressão.',
   true,
   'Oi {primeiro_nome}! Sentimos sua falta na Xô Varal 🧺 Seus {lavcoins_saldo} LavCoins continuam guardados e seus ciclos do mês contam para o desconto do mês que vem. Passa aqui essa semana?',
   '{"dias":7}'),
  ('inatividade_21', 'Reengajamento (21 dias)',
   'Cliente sem usar há 21 dias. Lembra o benefício concreto.',
   true,
   '{primeiro_nome}, já faz 3 semanas! 💧 Lembra: cada real vira LavCoin e cada ciclo te aproxima de descontos de até 20% no mês seguinte. Seu saldo atual: {lavcoins_saldo} LavCoins. A Xô Varal está de portas abertas pra você.',
   '{"dias":21}'),
  ('inatividade_45', 'Win-back (45 dias)',
   'Cliente sem usar há 45 dias. Última cadência antes de descanso.',
   true,
   '{primeiro_nome}, faz um tempinho que você não aparece na Xô Varal. Sua conta continua ativa com {lavcoins_saldo} LavCoins esperando por você. Se algo não foi bem, responde essa mensagem que a gente resolve. Queremos você de volta! 💙',
   '{"dias":45}'),
  ('faltam_ciclos', 'Sprint final do mês',
   'A partir do dia 20, para quem está a até 3 ciclos do próximo nível. Máx. 1x por mês.',
   true,
   '🔥 {primeiro_nome}, reta final de {mes_nome}! Você tem {ciclos} ciclos — faltam só {faltam} para o nível {proximo_nivel} e {desconto_proximo}% OFF em TODAS as lavagens e secagens do mês que vem. Dá tempo!',
   '{"dia_inicio":20,"faltam_max":3}'),
  ('fechamento_nivel', 'Comunicado de nível (dia 1)',
   'Disparo automático do dia 1 com o nível alcançado e o desconto do mês. Usa os templates do Clube por nível.',
   true,
   '',
   '{}')
) as t(chave, nome, descricao, ativo, corpo, params)
where exists (select 1 from public.tenants where id = '00000000-0000-0000-0000-000000000001')
on conflict (tenant_id, chave) do nothing;

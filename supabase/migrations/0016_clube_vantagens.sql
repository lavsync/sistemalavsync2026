-- =====================================================================
-- LavSync · 0016 · Clube de Vantagens (gamificação Xô Varal)
--
-- Regras:
-- 8-11 ciclos/mês  → Bronze   → 5% desconto mês seguinte
-- 12-19 ciclos/mês → Prata    → 10% desconto mês seguinte
-- 20-29 ciclos/mês → Ouro     → 15% desconto mês seguinte
-- 30+ ciclos/mês   → Diamante → 20% desconto mês seguinte
-- Lavar e secar contam como 1 ciclo cada (mesmo valor)
-- 1 ciclo = 1 ponto (acumula, troca por brindes na store)
-- =====================================================================

-- Classificação mensal por cliente
create table if not exists public.clube_classificacoes (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,

  mes_ref date not null,                    -- 1º dia do mês de REFERÊNCIA (ex: 2026-05-01 = maio)
  mes_aplicacao date not null,              -- 1º dia do mês que vai USUFRUIR (mes_ref + 1)

  ciclos_mes integer not null default 0,
  ciclos_lavagem integer not null default 0,
  ciclos_secagem integer not null default 0,
  faturamento_mes numeric(12, 2) not null default 0,

  nivel text not null,                      -- bronze | prata | ouro | diamante | nao_classificado
  desconto_pct numeric(5, 2) not null default 0,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (cliente_id, mes_ref)
);
create index if not exists idx_clube_class_mes      on public.clube_classificacoes(unidade_id, mes_ref);
create index if not exists idx_clube_class_aplic    on public.clube_classificacoes(unidade_id, mes_aplicacao);
create index if not exists idx_clube_class_nivel    on public.clube_classificacoes(tenant_id, nivel, mes_aplicacao);
create index if not exists idx_clube_class_cliente  on public.clube_classificacoes(cliente_id, mes_ref desc);

-- Pontos acumulados (1 ciclo = 1 ponto)
create table if not exists public.clube_pontos (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  saldo_pontos integer not null default 0,        -- disponível pra troca
  total_acumulado integer not null default 0,     -- histórico (nunca diminui)
  total_resgatado integer not null default 0,
  atualizado_em timestamptz not null default now()
);

-- Banco de templates de mensagem
create table if not exists public.clube_templates_mensagem (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  tipo text not null,                       -- parabens_nivel | faltam_ciclos | pontos_disponiveis | renovacao_mes
  nivel_alvo text,                          -- bronze | prata | ouro | diamante | null (qualquer)

  titulo text not null,                     -- nome interno
  mensagem text not null,                   -- com {primeiro_nome} {nivel} {ciclos} {faltam} {pontos} {desconto}
  ativo boolean not null default true,
  ordem integer not null default 0,

  criado_em timestamptz not null default now()
);
create index if not exists idx_clube_tpl_tipo on public.clube_templates_mensagem(tenant_id, tipo, ativo);

-- Trigger updated_at
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_clube_class_upd') then
    create trigger trg_clube_class_upd before update on public.clube_classificacoes
      for each row execute function public.set_atualizado_em();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_clube_pontos_upd') then
    create trigger trg_clube_pontos_upd before update on public.clube_pontos
      for each row execute function public.set_atualizado_em();
  end if;
end $$;

-- RLS
do $$
declare t text;
begin
  foreach t in array array['clube_classificacoes','clube_pontos','clube_templates_mensagem'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format($f$
      drop policy if exists "%I_tenant" on public.%I;
      create policy "%I_tenant" on public.%I
        for all using (tenant_id = public.current_tenant_id() or public.is_master())
        with check (tenant_id = public.current_tenant_id() or public.is_master());
    $f$, t, t, t, t);
  end loop;
end $$;

-- Seed: 8 templates default (2 por nível + variações)
insert into public.clube_templates_mensagem (tenant_id, tipo, nivel_alvo, titulo, mensagem, ordem)
select '00000000-0000-0000-0000-000000000001', tipo, nivel_alvo, titulo, mensagem, ordem
from (values
  -- Parabéns ao atingir nível (já classificado)
  ('parabens_nivel', 'bronze',   'Bronze conquistado',
    '🥉 Parabéns {primeiro_nome}! Você atingiu o nível BRONZE no Clube Xô Varal com {ciclos} ciclos em {mes_ref_nome}. No mês de {mes_aplic_nome} você ganha 5% OFF em todas as lavagens e secagens! Acumulou {pontos} pontos pra trocar por brindes em xovaral.com.br/store',
    1),
  ('parabens_nivel', 'prata',    'Prata conquistado',
    '🥈 Parabéns {primeiro_nome}! Você atingiu o nível PRATA com {ciclos} ciclos em {mes_ref_nome}! No mês de {mes_aplic_nome} você ganha 10% OFF em todas as lavagens e secagens. Já são {pontos} pontos acumulados pra trocar por brindes em xovaral.com.br/store ⭐',
    2),
  ('parabens_nivel', 'ouro',     'Ouro conquistado',
    '🥇 IMPRESSIONANTE, {primeiro_nome}! Você atingiu o nível OURO com {ciclos} ciclos em {mes_ref_nome}! No mês de {mes_aplic_nome} você ganha 15% OFF em todas as lavagens e secagens. Acumulou {pontos} pontos e tem acesso a brindes exclusivos em xovaral.com.br/store 🏆',
    3),
  ('parabens_nivel', 'diamante', 'Diamante conquistado',
    '💎 LENDÁRIO, {primeiro_nome}! Você atingiu o nível DIAMANTE com {ciclos} ciclos em {mes_ref_nome}! No mês de {mes_aplic_nome} você ganha 20% OFF em TODAS as lavagens e secagens. Acumulou {pontos} pontos pra trocar por brindes premium exclusivos do nível Diamante em xovaral.com.br/store. Você é nosso cliente VIP! 👑',
    4),
  -- Faltam ciclos pro próximo nível
  ('faltam_ciclos', null,        'Faltam X pro próximo nível',
    'Oi {primeiro_nome}! 💧 Você já tem {ciclos} ciclos esse mês na Xô Varal. Faltam só {faltam} ciclos pra subir pro nível {proximo_nivel} e ganhar {desconto_proximo}% OFF no próximo mês! Sua conta já tem {pontos} pontos pra trocar por brindes em xovaral.com.br/store',
    5),
  ('faltam_ciclos', null,        'Sprint final do mês',
    '🔥 {primeiro_nome}, sprint final! Você tem {ciclos} ciclos esse mês — faltam {faltam} pra alcançar o nível {proximo_nivel}. Quem chega no {proximo_nivel} ganha {desconto_proximo}% OFF o mês inteiro. Bora completar?',
    6),
  -- Pontos disponíveis pra troca
  ('pontos_disponiveis', null,   'Pontos disponíveis',
    '🎁 {primeiro_nome}, você tem {pontos} pontos no Clube Xô Varal! Cada ciclo de lavagem ou secagem vira 1 ponto. Use pra trocar por brindes exclusivos em xovaral.com.br/store. Quanto mais pontos, melhores os brindes!',
    7),
  -- Renovação automática mês seguinte (lembrete benefício)
  ('renovacao_mes', null,        'Benefício renovado',
    '✨ {primeiro_nome}, seu nível {nivel} continua ativo em {mes_aplic_nome}! Aproveite {desconto}% OFF em todas as lavagens e secagens. Lembre-se: acumule {faltam_proximo} ciclos esse mês pra subir pro {proximo_nivel} e ganhar mais descontos no próximo mês!',
    8)
) as t(tipo, nivel_alvo, titulo, mensagem, ordem)
where exists (select 1 from public.tenants where id = '00000000-0000-0000-0000-000000000001')
on conflict do nothing;

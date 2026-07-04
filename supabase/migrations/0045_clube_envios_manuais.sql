-- =====================================================================
-- LavSync · 0045 · Envio manual assistido via WhatsApp Web (ponte tática)
--
-- Enquanto a Cloud API não conecta: cada unidade loga o SEU WhatsApp Web
-- no navegador; a UI abre wa.me com a mensagem de qualificação pronta e
-- marca aqui que o cliente já recebeu a mensagem do mês (por tipo).
-- =====================================================================

create table if not exists public.clube_envios_manuais (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete set null,

  mes_ref date not null,             -- competência (1º dia do mês de referência)
  tipo text not null,                -- 'qualificacao' (Clube, inclui abaixo de bronze) | 'xoclub' (pontos+portal)

  enviado_em timestamptz not null default now(),
  enviado_por uuid references public.usuarios(id) on delete set null,

  unique (cliente_id, mes_ref, tipo)
);
create index if not exists ix_clube_envios_mes on public.clube_envios_manuais(tenant_id, mes_ref, tipo);

alter table public.clube_envios_manuais enable row level security;
drop policy if exists "clube_envios_manuais_tenant" on public.clube_envios_manuais;
create policy "clube_envios_manuais_tenant" on public.clube_envios_manuais
  for all using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

-- ─── Templates novos (editáveis na aba Clube) ────────────────────────
insert into public.clube_templates_mensagem (tenant_id, tipo, nivel_alvo, titulo, mensagem, ordem)
select '00000000-0000-0000-0000-000000000001', tipo, null, titulo, mensagem, ordem
from (values
  ('abaixo_bronze', 'Incentivo — abaixo de Bronze',
   'Oi {primeiro_nome}! 💙 Em {mes_ref_nome} você fez {ciclos} {ciclos_palavra} na Xô Varal. Faltaram só {faltam} para o nível {proximo_nivel}, que garante {desconto_proximo}% OFF o mês inteiro seguinte! Esse mês a corrida recomeça: a partir de 8 ciclos você já é Bronze com 5% OFF. Bora? Consulte seu saldo em {link_portal}',
   20),
  ('xoclub_portal', 'LavCoins + portal do cliente',
   'Oi {primeiro_nome}! 🎁 Você tem {lavcoins} LavCoins acumulados no Clube Xô Varal — cada R$1 gasto vira 1 LavCoin pra trocar por recompensas. Acompanhe seu saldo, nível e benefícios a qualquer momento no seu portal: {link_portal}',
   21)
) as t(tipo, titulo, mensagem, ordem)
where exists (select 1 from public.tenants where id = '00000000-0000-0000-0000-000000000001')
  and not exists (
    select 1 from public.clube_templates_mensagem
    where tenant_id = '00000000-0000-0000-0000-000000000001' and tipo = t.tipo
  );

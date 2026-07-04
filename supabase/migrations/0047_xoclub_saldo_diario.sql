-- =====================================================================
-- LavSync · 0047 · Mensagem diária de atualização de saldo LavCoin
--
-- Fluxo: todo dia, quem usou a lavanderia ONTEM recebe a atualização do
-- saldo (1 LavCoin por R$1 gasto, lavar ou secar). Envio manual assistido
-- (WhatsApp Web) pela aba XÔ Club → Saldo do dia; marca em
-- clube_envios_manuais tipo 'xoclub_saldo' com mes_ref = DIA do uso.
-- =====================================================================

insert into public.clube_templates_mensagem (tenant_id, tipo, nivel_alvo, titulo, mensagem, ordem)
select '00000000-0000-0000-0000-000000000001', 'xoclub_saldo_diario', null,
  'Atualização diária de saldo LavCoin',
  'Oi {primeiro_nome}! 🧺 Obrigado por usar a Xô Varal ontem: você somou {lavcoins_dia} LavCoins ({lavcoins_dia_reais} em ciclos). Seu saldo total agora é {lavcoins} LavCoins — cada R$1 gasto lavando ou secando vira 1 LavCoin pra trocar por recompensas. Consulte quando quiser: {link_portal}',
  22
where exists (select 1 from public.tenants where id = '00000000-0000-0000-0000-000000000001')
  and not exists (
    select 1 from public.clube_templates_mensagem
    where tenant_id = '00000000-0000-0000-0000-000000000001' and tipo = 'xoclub_saldo_diario'
  );

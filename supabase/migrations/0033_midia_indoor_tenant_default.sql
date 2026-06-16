-- ============================================================================
-- 0033 — Mídia Indoor: default de tenant_id (LavSync é single-tenant hoje)
-- Permite que os inserts portados do Xô Varal (que não setam tenant_id) e os
-- inserts públicos/anon (player, clube, leads, telemetria) funcionem sem que
-- cada action precise informar tenant_id. RLS continua exigindo
-- tenant_id = current_tenant_id() para usuários logados; o default cobre o anon.
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'mi_units','mi_partners','mi_offers','mi_editor_templates','mi_campaigns',
    'mi_club_members','mi_partner_leads','mi_qr_codes','mi_player_sessions',
    'mi_campaign_impressions','mi_qr_clicks','mi_settings','mi_partner_users'
  ]
  loop
    execute format(
      'alter table public.%I alter column tenant_id set default %L',
      t, '00000000-0000-0000-0000-000000000001'
    );
  end loop;
end $$;

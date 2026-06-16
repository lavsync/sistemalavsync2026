-- ============================================================================
-- 0042 — Mídia Indoor: FKs unidade_id -> mi_units(unidade_id)
-- Permite que o PostgREST faça embed de mi_units a partir das tabelas filhas
-- (queries usam `units:mi_units(...)`). mi_units.unidade_id é UNIQUE (1:1).
-- A FK já existente para `unidades` permanece (alvos distintos = sem ambiguidade).
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'mi_partners','mi_campaigns','mi_partner_leads','mi_qr_codes',
    'mi_editor_templates','mi_club_members','mi_player_sessions',
    'mi_campaign_impressions','mi_qr_clicks'
  ]
  loop
    execute format(
      'alter table public.%I drop constraint if exists %I',
      t, t || '_unidade_miunit_fkey'
    );
    execute format(
      'alter table public.%I add constraint %I foreign key (unidade_id) references public.mi_units(unidade_id) on delete cascade',
      t, t || '_unidade_miunit_fkey'
    );
  end loop;
end $$;

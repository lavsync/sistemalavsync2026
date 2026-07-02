-- =====================================================================
-- LavSync · 0044 · FIX: dedupe da msg_fila nunca funcionou
--
-- O índice ux_msg_fila_dedupe era PARCIAL (where dedupe_key is not null)
-- e o upsert do PostgREST (ON CONFLICT (tenant_id, dedupe_key)) não casa
-- com índice parcial → 42P10 → enfileirar() falhava silenciosamente e
-- NADA entrava na fila. Índice total resolve: NULLs são distintos por
-- padrão, então linhas sem dedupe_key nunca conflitam entre si.
-- =====================================================================

drop index if exists public.ux_msg_fila_dedupe;
create unique index if not exists ux_msg_fila_dedupe
  on public.msg_fila(tenant_id, dedupe_key);

-- =====================================================================
-- LavSync · 0050 · Arquivo de relatórios DRE em PDF (para sócios)
-- Bucket PRIVADO: acesso só via server action (sessão) + URL assinada.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dre-relatorios', 'dre-relatorios', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

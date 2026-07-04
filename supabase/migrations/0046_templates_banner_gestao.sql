-- =====================================================================
-- LavSync · 0046 · Gestão completa do banco de mensagens WhatsApp
--
-- Banner por mensagem: wa.me só pré-preenche TEXTO, então o banner é
-- copiado pro clipboard e colado no WhatsApp Web pelo operador; quando a
-- Cloud API conectar, vira header de template oficial.
-- =====================================================================

alter table public.clube_templates_mensagem
  add column if not exists banner_url text,
  add column if not exists atualizado_em timestamptz not null default now();

do $$
begin
  drop trigger if exists trg_clube_tpl_upd on public.clube_templates_mensagem;
  create trigger trg_clube_tpl_upd before update on public.clube_templates_mensagem
    for each row execute function public.set_atualizado_em();
end $$;

-- Bucket público para banners das mensagens (4MB por arquivo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('msg-banners', 'msg-banners', true, 4194304,
        array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;

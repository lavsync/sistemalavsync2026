-- =====================================================================
-- LavSync · Seed inicial
-- Cria o tenant Xô Varal + 3 unidades + master user link.
--
-- IMPORTANTE: o usuário master deve ser criado ANTES via Supabase
-- Auth → Users → Add user (email/password) → confirme o email.
-- Depois rode este seed.
-- =====================================================================

-- Tenant Xô Varal
insert into public.tenants (id, nome, slug, cnpj, plano)
values (
  '00000000-0000-0000-0000-000000000001',
  'Xô Varal',
  'xo-varal',
  '62.050.978/0001-15',
  'master'
)
on conflict (slug) do update set nome = excluded.nome, plano = excluded.plano;

-- Liga o auth.user "danielqueirozrd@gmail.com" como master do tenant Xô Varal
insert into public.usuarios (id, tenant_id, nome, email, papel)
select
  u.id,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Daniel Queiroz',
  u.email,
  'master'::lavsync_role
from auth.users u
where u.email = 'danielqueirozrd@gmail.com'
on conflict (id) do update set
  papel = 'master',
  tenant_id = excluded.tenant_id,
  nome = excluded.nome;

-- 3 unidades de Belo Horizonte
insert into public.unidades (id, tenant_id, nome, cidade, bairro)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Buritis', 'Belo Horizonte', 'Buritis'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Castelo', 'Belo Horizonte', 'Castelo'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Cabral', 'Belo Horizonte', 'Cabral')
on conflict (id) do nothing;

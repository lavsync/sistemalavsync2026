-- =====================================================================
-- LavSync · 0017 · RBAC granular
-- Catálogo de permissões + override por usuário + helper SQL
-- =====================================================================

-- ─── Catálogo de permissões (chaves disponíveis no sistema) ─────────
create table if not exists public.permissoes_catalogo (
  chave text primary key,                  -- ex: "clientes.delete"
  modulo text not null,                    -- ex: "clientes"
  acao text not null,                      -- view | create | update | delete | execute | importar | exportar
  label text not null,
  descricao text,
  ordem integer not null default 0
);

-- ─── Mapeia papel → permissões padrão ─────────────────────────────
-- Quando criamos um usuário com determinado papel, ele herda essas
-- permissões automaticamente. Pode ser sobrescrito em usuarios_permissoes.
create table if not exists public.papeis_permissoes (
  papel text not null,                     -- master | admin | gerente | operador | visualizador
  permissao_chave text not null references public.permissoes_catalogo(chave) on delete cascade,
  primary key (papel, permissao_chave)
);

-- ─── Override granular por usuário ────────────────────────────────
-- concedida = true → tem a permissão (mesmo que o papel não tenha)
-- concedida = false → NÃO tem (mesmo que o papel tenha)
-- Linha ausente → usa o que vem do papel
create table if not exists public.usuarios_permissoes (
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  permissao_chave text not null references public.permissoes_catalogo(chave) on delete cascade,
  concedida boolean not null default true,
  concedido_por uuid references public.usuarios(id) on delete set null,
  concedido_em timestamptz not null default now(),
  primary key (usuario_id, permissao_chave)
);

-- ─── Helper SQL: verificar se um usuário tem uma permissão ─────────
create or replace function public.verificar_permissao(p_user uuid, p_chave text)
returns boolean as $$
declare
  v_papel text;
  v_papel_tem boolean;
  v_override boolean;
begin
  -- Master sempre tem tudo
  select papel into v_papel from public.usuarios where id = p_user;
  if v_papel = 'master' then return true; end if;

  -- 1. Verifica override individual
  select concedida into v_override from public.usuarios_permissoes
   where usuario_id = p_user and permissao_chave = p_chave;
  if found then return v_override; end if;

  -- 2. Verifica permissão do papel
  select true into v_papel_tem from public.papeis_permissoes
   where papel = v_papel and permissao_chave = p_chave limit 1;
  return coalesce(v_papel_tem, false);
end;
$$ language plpgsql stable security definer;

-- ─── RLS ─────────────────────────────────────────────────────────
alter table public.permissoes_catalogo enable row level security;
drop policy if exists "perm_cat_read" on public.permissoes_catalogo;
create policy "perm_cat_read" on public.permissoes_catalogo
  for select using (true);
drop policy if exists "perm_cat_master" on public.permissoes_catalogo;
create policy "perm_cat_master" on public.permissoes_catalogo
  for all using (public.is_master()) with check (public.is_master());

alter table public.papeis_permissoes enable row level security;
drop policy if exists "pp_master" on public.papeis_permissoes;
create policy "pp_master" on public.papeis_permissoes
  for all using (public.is_master()) with check (public.is_master());
drop policy if exists "pp_read_all" on public.papeis_permissoes;
create policy "pp_read_all" on public.papeis_permissoes
  for select using (true);

alter table public.usuarios_permissoes enable row level security;
drop policy if exists "up_master" on public.usuarios_permissoes;
create policy "up_master" on public.usuarios_permissoes
  for all using (public.is_master()) with check (public.is_master());
drop policy if exists "up_self_read" on public.usuarios_permissoes;
create policy "up_self_read" on public.usuarios_permissoes
  for select using (usuario_id = auth.uid() or public.is_master());

-- ─── SEED CATÁLOGO ───────────────────────────────────────────────
insert into public.permissoes_catalogo (chave, modulo, acao, label, ordem) values
  -- Dashboard
  ('dashboard.view',                 'dashboard',    'view',     'Visualizar Visão Geral',                10),
  -- Cadastros gerais
  ('cadastros.view',                 'cadastros',    'view',     'Acessar módulo Cadastros',              20),
  ('cadastros.fornecedores.crud',    'cadastros',    'execute',  'Gerenciar Fornecedores',                21),
  ('cadastros.categorias.crud',      'cadastros',    'execute',  'Gerenciar Categorias Financeiras',      22),
  ('cadastros.planos.crud',          'cadastros',    'execute',  'Gerenciar Planos',                      23),
  ('cadastros.servicos.crud',        'cadastros',    'execute',  'Gerenciar Serviços',                    24),
  ('cadastros.parceiros.crud',       'cadastros',    'execute',  'Gerenciar Parceiros',                   25),
  ('cadastros.unidades.crud',        'cadastros',    'execute',  'Gerenciar Unidades (Master/Admin)',     26),
  ('cadastros.importacoes.view',     'cadastros',    'view',     'Ver histórico de importações',          27),
  ('cadastros.importacoes.delete',   'cadastros',    'delete',   'Excluir importações (cascade)',         28),
  ('cadastros.importacoes.zerar',    'cadastros',    'delete',   'Zerar dados de unidade (perigoso)',     29),
  -- Clientes
  ('clientes.view',                  'clientes',     'view',     'Visualizar lista de clientes',          30),
  ('clientes.create',                'clientes',     'create',   'Cadastrar cliente',                     31),
  ('clientes.update',                'clientes',     'update',   'Editar cliente',                        32),
  ('clientes.delete',                'clientes',     'delete',   'Excluir cliente',                       33),
  ('clientes.importar',              'clientes',     'importar', 'Importar planilha de clientes',         34),
  ('clientes.exportar',              'clientes',     'exportar', 'Exportar base de clientes',             35),
  -- Performance / Vendas
  ('performance.view',               'performance',  'view',     'Visualizar Performance',                40),
  ('performance.importar',           'performance',  'importar', 'Importar planilha de vendas',           41),
  ('performance.exportar',           'performance',  'exportar', 'Exportar vendas',                       42),
  -- Financeiro
  ('financeiro.view',                'financeiro',   'view',     'Visualizar Financeiro',                 50),
  ('financeiro.config.update',       'financeiro',   'update',   'Editar config/projeção da unidade',     51),
  ('financeiro.dre.lancar',          'financeiro',   'execute',  'Lançar DRE mensal',                     52),
  ('financeiro.investimento.update', 'financeiro',   'update',   'Editar investimento',                   53),
  ('financeiro.despesas.lancar',     'financeiro',   'execute',  'Lançar despesas reais',                 54),
  -- Marketing + Clube
  ('marketing.view',                 'marketing',    'view',     'Visualizar Marketing',                  60),
  ('marketing.campanhas.create',     'marketing',    'create',   'Criar campanha',                        61),
  ('marketing.campanhas.update',     'marketing',    'update',   'Editar campanha',                       62),
  ('marketing.campanhas.delete',     'marketing',    'delete',   'Excluir campanha',                      63),
  ('marketing.disparar',             'marketing',    'execute',  'Disparar campanha (gerar envios)',      64),
  ('marketing.clube.view',           'marketing',    'view',     'Visualizar Clube de Vantagens',         65),
  ('marketing.clube.classificar',    'marketing',    'execute',  'Reclassificar membros do Clube',        66),
  ('marketing.clube.disparar',       'marketing',    'execute',  'Disparar mensagens do Clube',           67),
  ('marketing.templates.update',     'marketing',    'update',   'Editar templates de mensagem',          68),
  -- Manutenção
  ('manutencao.view',                'manutencao',   'view',     'Visualizar Manutenção',                 70),
  ('manutencao.maquinas.crud',       'manutencao',   'execute',  'Gerenciar Máquinas',                    71),
  ('manutencao.os.crud',             'manutencao',   'execute',  'Gerenciar Ordens de Serviço',           72),
  -- Comparativo
  ('comparativo.view',               'comparativo',  'view',     'Visualizar Comparativo',                80),
  -- Painel ao Vivo
  ('painel_vivo.view',               'painel_vivo',  'view',     'Visualizar Painel ao Vivo',             90),
  -- Dados / Exports
  ('dados.exportar',                 'dados',        'exportar', 'Exportar CSVs do sistema',             100),
  -- Suporte
  ('suporte.view',                   'suporte',      'view',     'Ver tickets de suporte',               110),
  ('suporte.create',                 'suporte',      'create',   'Abrir tickets',                        111),
  ('suporte.update',                 'suporte',      'update',   'Atualizar tickets',                    112),
  ('suporte.delete',                 'suporte',      'delete',   'Excluir tickets',                      113),
  -- Sistema (Configurações + Usuários)
  ('configuracoes.view',             'sistema',      'view',     'Acessar Configurações',                200),
  ('configuracoes.update',           'sistema',      'update',   'Editar configurações gerais',          201),
  ('usuarios.view',                  'sistema',      'view',     'Ver lista de usuários',                210),
  ('usuarios.create',                'sistema',      'create',   'Criar usuário',                        211),
  ('usuarios.update',                'sistema',      'update',   'Editar usuário (papel, unidades)',     212),
  ('usuarios.delete',                'sistema',      'delete',   'Excluir usuário',                      213),
  ('usuarios.alterar_senha',         'sistema',      'execute',  'Resetar senha de outros usuários',     214),
  ('usuarios.permissoes',            'sistema',      'execute',  'Conceder/revogar permissões granulares', 215),
  ('integracoes.view',               'sistema',      'view',     'Ver integrações',                      220),
  ('integracoes.update',             'sistema',      'update',   'Configurar integrações (Z-API, etc)',  221),
  ('lgpd.view',                      'sistema',      'view',     'Ver registros LGPD',                   230),
  ('lgpd.execute',                   'sistema',      'execute',  'Atender solicitações LGPD',            231)
on conflict (chave) do update set
  modulo = excluded.modulo,
  acao = excluded.acao,
  label = excluded.label,
  ordem = excluded.ordem;

-- ─── SEED PAPÉIS ─────────────────────────────────────────────────
-- MASTER: tudo (não precisa seedar; verificar_permissao retorna true direto)

-- ADMIN: tudo EXCETO operações destrutivas perigosas
insert into public.papeis_permissoes (papel, permissao_chave)
select 'admin', chave from public.permissoes_catalogo
where chave not in ('cadastros.importacoes.zerar')
on conflict do nothing;

-- GERENTE: opera tudo EXCETO excluir/zerar, criar usuários, integrações
insert into public.papeis_permissoes (papel, permissao_chave)
select 'gerente', chave from public.permissoes_catalogo
where acao in ('view', 'create', 'update', 'execute', 'importar', 'exportar')
  and chave not in (
    'usuarios.create','usuarios.update','usuarios.delete','usuarios.alterar_senha',
    'usuarios.permissoes','integracoes.update','cadastros.unidades.crud',
    'cadastros.importacoes.delete','cadastros.importacoes.zerar','clientes.delete'
  )
on conflict do nothing;

-- OPERADOR: operação básica do dia-a-dia (sem delete, sem financeiro detalhado)
insert into public.papeis_permissoes (papel, permissao_chave)
select 'operador', chave from public.permissoes_catalogo
where chave in (
  'dashboard.view','cadastros.view','cadastros.importacoes.view',
  'clientes.view','clientes.create','clientes.update','clientes.importar',
  'performance.view','performance.importar',
  'marketing.view','marketing.clube.view',
  'manutencao.view','manutencao.os.crud',
  'comparativo.view','painel_vivo.view',
  'dados.exportar',
  'suporte.view','suporte.create','suporte.update',
  'configuracoes.view'
)
on conflict do nothing;

-- VISUALIZADOR: apenas leitura
insert into public.papeis_permissoes (papel, permissao_chave)
select 'visualizador', chave from public.permissoes_catalogo
where acao = 'view'
on conflict do nothing;

-- =====================================================================
-- LavSync · 0052 · Projetado da franqueadora × Real
-- DRE projetado de 60 meses que a franqueadora apresenta na venda da
-- franquia (importado de planilha/PDF/imagem pelo CLOCK ou digitado),
-- comparado mês a mês com o real do motor do DRE.
--
-- · financeiro_projecoes: 1 por versão; só UMA ativa por unidade
--   (índice único parcial). Premissas e investimento em jsonb.
-- · financeiro_projecao_linhas: 1 linha canônica por projeção
--   (faturamento, simples, csp, royalties… ou outros:<slug>), 60 valores.
-- · Bucket PRIVADO projecoes-franqueadora: arquivo original, acesso só via
--   server action (sessão) + service role depois do gate.
-- RLS por tenant, igual às tabelas financeiro_* (0010), com a unidade e a
-- projeção amarradas ao tenant no WITH CHECK. Gravação pela função
-- financeiro_projecao_salvar (uma transação).
-- =====================================================================

create table if not exists public.financeiro_projecoes (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  nome text not null,
  origem text not null default 'importacao' check (origem in ('importacao', 'manual')),
  arquivo_path text,
  arquivo_nome text,
  mes1_ano integer not null check (mes1_ano between 2000 and 2100),
  mes1_mes integer not null check (mes1_mes between 1 and 12),
  premissas jsonb,
  investimento jsonb,
  observacoes_ia jsonb not null default '[]'::jsonb,   -- avisos da leitura/validação
  ativa boolean not null default false,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_fin_proj_unidade on public.financeiro_projecoes(unidade_id, atualizado_em desc);
create index if not exists idx_fin_proj_tenant on public.financeiro_projecoes(tenant_id);
-- Uma projeção ATIVA por unidade
create unique index if not exists uq_fin_proj_ativa_unidade
  on public.financeiro_projecoes(unidade_id) where ativa;

create table if not exists public.financeiro_projecao_linhas (
  id uuid primary key default uuid_generate_v4(),
  projecao_id uuid not null references public.financeiro_projecoes(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  chave text not null,
  descricao text not null,
  grupo text not null check (grupo in (
    'receita','deducao','csp','franchising','pessoal','terceiros','marketing','gerais','resultado','indicador'
  )),
  ordem integer not null default 0,
  valores numeric(14, 4)[] not null default '{}',     -- 60 meses (mês 1 = mes1_ano/mes1_mes)
  editado boolean not null default false,
  conferir boolean not null default false,
  unique (projecao_id, chave)
);
create index if not exists idx_fin_proj_linhas on public.financeiro_projecao_linhas(projecao_id, ordem);

-- ============ Trigger atualizado_em ============
drop trigger if exists trg_financeiro_projecoes_upd on public.financeiro_projecoes;
create trigger trg_financeiro_projecoes_upd before update on public.financeiro_projecoes
  for each row execute function public.set_atualizado_em();

-- ============ RLS ============
-- Além do tenant da própria linha, o WITH CHECK amarra a unidade ao tenant
-- da projeção e a linha ao tenant da projeção (o FK ignora a RLS): sem isso,
-- uma projeção com unidade_id de outra rede ocuparia o índice único parcial
-- uq_fin_proj_ativa_unidade daquela unidade. As subconsultas são em OUTRAS
-- tabelas (unidades, financeiro_projecoes), nunca na própria.
alter table public.financeiro_projecoes enable row level security;
alter table public.financeiro_projecao_linhas enable row level security;

drop policy if exists "financeiro_projecoes_tenant" on public.financeiro_projecoes;
create policy "financeiro_projecoes_tenant" on public.financeiro_projecoes
  for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (
    (tenant_id = public.current_tenant_id() or public.is_master())
    and exists (
      select 1 from public.unidades u
      where u.id = financeiro_projecoes.unidade_id and u.tenant_id = financeiro_projecoes.tenant_id
    )
  );

drop policy if exists "financeiro_projecao_linhas_tenant" on public.financeiro_projecao_linhas;
create policy "financeiro_projecao_linhas_tenant" on public.financeiro_projecao_linhas
  for all
  using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (
    (tenant_id = public.current_tenant_id() or public.is_master())
    and exists (
      select 1 from public.financeiro_projecoes p
      where p.id = financeiro_projecao_linhas.projecao_id and p.tenant_id = financeiro_projecao_linhas.tenant_id
    )
  );

-- ============ Salvar projeção (atômico) ============
-- Desativa as outras da unidade, grava o cabeçalho e troca as linhas numa
-- única transação: se qualquer passo falhar, nada muda (a projeção anterior
-- continua ativa e com as 60 colunas). SECURITY INVOKER: roda com a RLS de
-- quem chama. O tenant vem da UNIDADE (não da sessão), então um master grava
-- no tenant certo.
create or replace function public.financeiro_projecao_salvar(
  p_id uuid,
  p_registro jsonb,
  p_linhas jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid := p_id;
  v_unidade uuid := (p_registro->>'unidade_id')::uuid;
  v_tenant uuid;
  v_ativa boolean := coalesce((p_registro->>'ativa')::boolean, false);
begin
  select u.tenant_id into v_tenant from public.unidades u where u.id = v_unidade;
  if v_tenant is null then
    raise exception 'Unidade não encontrada.';
  end if;

  if v_ativa then
    update public.financeiro_projecoes set ativa = false
     where unidade_id = v_unidade and ativa and (v_id is null or id <> v_id);
  end if;

  if v_id is null then
    insert into public.financeiro_projecoes (
      tenant_id, unidade_id, nome, origem, arquivo_path, arquivo_nome, mes1_ano, mes1_mes,
      premissas, investimento, observacoes_ia, ativa, criado_por
    ) values (
      v_tenant, v_unidade, p_registro->>'nome', p_registro->>'origem',
      p_registro->>'arquivo_path', p_registro->>'arquivo_nome',
      (p_registro->>'mes1_ano')::integer, (p_registro->>'mes1_mes')::integer,
      p_registro->'premissas', p_registro->'investimento',
      coalesce(p_registro->'observacoes_ia', '[]'::jsonb), v_ativa, auth.uid()
    ) returning id into v_id;
  else
    update public.financeiro_projecoes set
      nome = p_registro->>'nome',
      origem = p_registro->>'origem',
      arquivo_path = p_registro->>'arquivo_path',
      arquivo_nome = p_registro->>'arquivo_nome',
      mes1_ano = (p_registro->>'mes1_ano')::integer,
      mes1_mes = (p_registro->>'mes1_mes')::integer,
      premissas = p_registro->'premissas',
      investimento = p_registro->'investimento',
      observacoes_ia = coalesce(p_registro->'observacoes_ia', '[]'::jsonb),
      ativa = v_ativa
     where id = v_id and unidade_id = v_unidade;
    if not found then
      raise exception 'Projeção não encontrada.';
    end if;
  end if;

  delete from public.financeiro_projecao_linhas where projecao_id = v_id;
  insert into public.financeiro_projecao_linhas (
    projecao_id, tenant_id, chave, descricao, grupo, ordem, valores, editado, conferir
  )
  select
    v_id, v_tenant, l->>'chave', l->>'descricao', l->>'grupo',
    coalesce((l->>'ordem')::integer, 0),
    array(
      select (x.v)::numeric(14, 4)
        from jsonb_array_elements_text(l->'valores') with ordinality as x(v, n)
       order by x.n
    ),
    coalesce((l->>'editado')::boolean, false),
    coalesce((l->>'conferir')::boolean, false)
  from jsonb_array_elements(coalesce(p_linhas, '[]'::jsonb)) as l;

  return v_id;
end;
$$;

revoke all on function public.financeiro_projecao_salvar(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.financeiro_projecao_salvar(uuid, jsonb, jsonb) to authenticated;

-- ============ Bucket privado do arquivo original (15 MB) ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('projecoes-franqueadora', 'projecoes-franqueadora', false, 15728640, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/csv',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/octet-stream'
])
on conflict (id) do nothing;

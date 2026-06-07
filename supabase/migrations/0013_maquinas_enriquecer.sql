-- =====================================================================
-- LavSync · 0013 · Enriquecer maquinas + ordens de serviço
-- =====================================================================

-- Campos adicionais pra cada máquina
alter table public.maquinas
  add column if not exists equipamento_match text,     -- substring pra match em vendas.equipamento (ex: "TOT10L-00/176246")
  add column if not exists fabricante text,
  add column if not exists modelo text,
  add column if not exists serial_number text,
  add column if not exists data_aquisicao date,
  add column if not exists valor_aquisicao numeric(12, 2),
  add column if not exists ultima_manutencao_em date,
  add column if not exists proxima_manutencao_em date,
  add column if not exists localizacao text;             -- ex: "Box 1, parede norte"

create index if not exists idx_maquinas_eqmatch on public.maquinas(unidade_id, equipamento_match);

-- Tabela de ordens de serviço (manutenções)
create table if not exists public.ordens_servico (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unidade_id uuid not null references public.unidades(id) on delete cascade,
  maquina_id uuid references public.maquinas(id) on delete set null,

  tipo text not null default 'corretiva',              -- preventiva | corretiva | revisao
  titulo text not null,
  descricao text,
  status text not null default 'aberta',               -- aberta | em_andamento | concluida | cancelada
  prioridade text not null default 'media',            -- baixa | media | alta | critica

  custo_estimado numeric(10, 2),
  custo_real numeric(10, 2),
  fornecedor_id uuid references public.fornecedores(id) on delete set null,

  aberta_em timestamptz not null default now(),
  concluida_em timestamptz,
  criado_por uuid references public.usuarios(id) on delete set null,
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_os_unidade on public.ordens_servico(unidade_id, status, aberta_em desc);
create index if not exists idx_os_maquina on public.ordens_servico(maquina_id);

-- Trigger updated_at
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_os_upd') then
    create trigger trg_os_upd before update on public.ordens_servico
      for each row execute function public.set_atualizado_em();
  end if;
end $$;

-- RLS
alter table public.ordens_servico enable row level security;
drop policy if exists "ordens_servico_tenant" on public.ordens_servico;
create policy "ordens_servico_tenant" on public.ordens_servico
  for all using (tenant_id = public.current_tenant_id() or public.is_master())
  with check (tenant_id = public.current_tenant_id() or public.is_master());

-- Seed: tentar popular equipamento_match na máquina TOT10L-00/176246 Buritis
update public.maquinas
   set equipamento_match = '176246'
 where codigo = 'TOT10L-00/176246';

// LavSync · Clube de Vantagens · Queries
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { paginarTodos } from "@/lib/supabase/pagination";
import type { NivelClube } from "./niveis";

export type Classificacao = {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  cliente_cpf: string;
  unidade_id: string;
  unidade_nome: string;
  mes_ref: string;           // YYYY-MM-DD (1º dia mês)
  mes_aplicacao: string;
  ciclos_mes: number;
  ciclos_lavagem: number;
  ciclos_secagem: number;
  faturamento_mes: number;
  nivel: NivelClube;
  desconto_pct: number;
  pontos_acumulado: number;
};

export type ResumoClube = {
  total: number;
  porNivel: Record<NivelClube, number>;
  fatProjetadoDesconto: number;     // R$ que será dado em desconto no mês_aplicacao
  topMembros: Classificacao[];
};

export async function listarClassificacoes(
  unidadeIds: string[],
  mesAplicacao: string,    // YYYY-MM-01
): Promise<Classificacao[]> {
  const sb = await createClient();
  let q = sb.from("clube_classificacoes")
    .select(`
      id, cliente_id, unidade_id, mes_ref, mes_aplicacao,
      ciclos_mes, ciclos_lavagem, ciclos_secagem, faturamento_mes,
      nivel, desconto_pct,
      cliente:clientes(nome, telefone, cpf),
      unidade:unidades(nome)
    `)
    .eq("mes_aplicacao", mesAplicacao)
    .neq("nivel", "nao_classificado")
    .order("ciclos_mes", { ascending: false });
  if (unidadeIds.length > 0) q = q.in("unidade_id", unidadeIds);
  const { data, error } = await q;
  if (error) throw error;

  type Raw = {
    id: string; cliente_id: string; unidade_id: string;
    mes_ref: string; mes_aplicacao: string;
    ciclos_mes: number; ciclos_lavagem: number; ciclos_secagem: number;
    faturamento_mes: number | string;
    nivel: string; desconto_pct: number | string;
    cliente: { nome: string; telefone: string | null; cpf: string } | Array<{ nome: string; telefone: string | null; cpf: string }> | null;
    unidade: { nome: string } | Array<{ nome: string }> | null;
  };
  const rows = (data ?? []) as unknown as Raw[];
  // Buscar pontos totais
  const ids = rows.map((r) => r.cliente_id);
  const pontosMap = new Map<string, number>();
  if (ids.length > 0) {
    type P = { cliente_id: string; total_acumulado: number };
    const pontos = await paginarTodos<P>((r) =>
      sb.from("clube_pontos")
        .select("cliente_id, total_acumulado")
        .in("cliente_id", ids)
        .range(r.from, r.to),
    );
    for (const x of pontos) {
      pontosMap.set(x.cliente_id, x.total_acumulado);
    }
  }

  return rows.map((r) => {
    const un = Array.isArray(r.unidade) ? r.unidade[0] : r.unidade;
    const cli = Array.isArray(r.cliente) ? r.cliente[0] : r.cliente;
    return {
      id: r.id,
      cliente_id: r.cliente_id,
      cliente_nome: cli?.nome ?? "—",
      cliente_telefone: cli?.telefone ?? null,
      cliente_cpf: cli?.cpf ?? "",
      unidade_id: r.unidade_id,
      unidade_nome: un?.nome ?? "—",
      mes_ref: r.mes_ref,
      mes_aplicacao: r.mes_aplicacao,
      ciclos_mes: r.ciclos_mes,
      ciclos_lavagem: r.ciclos_lavagem,
      ciclos_secagem: r.ciclos_secagem,
      faturamento_mes: Number(r.faturamento_mes),
      nivel: r.nivel as NivelClube,
      desconto_pct: Number(r.desconto_pct),
      pontos_acumulado: pontosMap.get(r.cliente_id) ?? 0,
    };
  });
}

export async function resumoClube(unidadeIds: string[], mesAplicacao: string): Promise<ResumoClube> {
  const classif = await listarClassificacoes(unidadeIds, mesAplicacao);
  const porNivel: Record<NivelClube, number> = {
    nao_classificado: 0, bronze: 0, prata: 0, ouro: 0, diamante: 0,
  };
  let fatProj = 0;
  for (const c of classif) {
    porNivel[c.nivel] += 1;
    // Projetar desconto: ciclo médio * 17 * desconto_pct (estimativa simples)
    // Sem dados de comportamento no mês_aplicacao ainda, faz por faturamento_mes_ref como proxy
    fatProj += c.faturamento_mes * (c.desconto_pct / 100);
  }
  return {
    total: classif.length,
    porNivel,
    fatProjetadoDesconto: Math.round(fatProj * 100) / 100,
    topMembros: classif.slice(0, 10),
  };
}

/** Lista os meses disponíveis (com classificação) pra dropdown */
export async function listarMesesDisponiveis(): Promise<string[]> {
  const sb = await createClient();
  const { data } = await sb.from("clube_classificacoes")
    .select("mes_aplicacao")
    .order("mes_aplicacao", { ascending: false });
  const set = new Set<string>();
  for (const r of (data ?? []) as Array<{ mes_aplicacao: string }>) {
    set.add(r.mes_aplicacao);
  }
  return Array.from(set);
}

// ─── Situação ao vivo de TODOS os clientes (sem precisar reclassificar) ─────
// Calcula direto das vendas do mês_ref. Mostra ciclos + nível atual + ciclos
// que faltam pro próximo nível — agrupado por unidade pra UI navegar.
export type SituacaoCliente = {
  cliente_id: string;
  nome: string;
  cpf: string;
  telefone: string | null;
  unidade_id: string;
  unidade_nome: string;
  // ── NÍVEL VIGENTE no mês selecionado (conquistado no mês anterior) ──
  nivel_vigente: import("./niveis").NivelClube | null;  // null = sem desconto este mês
  desconto_vigente: number;
  ciclos_ref: number;            // ciclos do mês de referência (base da mensagem)
  // ── CONTAGEM NOVA do mês atual — zera no dia 1º ──
  ciclos: number;
  ciclos_lavagem: number;
  ciclos_secagem: number;
  faturamento: number;
  nivel_projetado: import("./niveis").NivelClube;  // o que a contagem atual garante pro mês seguinte
  desconto_projetado: number;
  proximo_nivel: import("./niveis").NivelClube | null;
  ciclos_faltam: number;
  pontos: number;
};

export type SituacaoUnidade = {
  unidade_id: string;
  unidade_nome: string;
  total_clientes: number;
  total_ciclos: number;
  faturamento_total: number;
  por_nivel: Record<import("./niveis").NivelClube, number>;
  clientes: SituacaoCliente[];   // ordenado desc por ciclos
};

import { classificar, proximoNivel } from "./niveis";
import { agregarCompetencia } from "./engine";

export async function getSituacaoClientes(
  unidadeIds: string[],
  mesAplicacao: string,    // YYYY-MM-01 — o MÊS ATUAL (de aplicação do desconto)
): Promise<SituacaoUnidade[]> {
  if (unidadeIds.length === 0) return [];
  const sb = await createClient();

  // Modelo do programa: ao virar o mês, o nível conquistado (mês anterior)
  // fica VIGENTE e a contagem de ciclos ZERA — nova corrida começa no dia 1º.
  // Aqui juntamos as duas pontas:
  //   vigente  = clube_classificacoes do mes_aplicacao (persistido)
  //   contagem = agregação AO VIVO do próprio mes_aplicacao (motor único)
  const { porCliente } = await agregarCompetencia(sb, mesAplicacao);

  type ClasseRow = { cliente_id: string; unidade_id: string; nivel: string; desconto_pct: number | string; ciclos_mes: number };
  const vigentes = await paginarTodos<ClasseRow>((r) =>
    sb.from("clube_classificacoes")
      .select("cliente_id, unidade_id, nivel, desconto_pct, ciclos_mes")
      .eq("mes_aplicacao", mesAplicacao)
      .range(r.from, r.to),
  );
  const vigenteMap = new Map(vigentes.map((v) => [v.cliente_id, v]));

  // Universo = quem tem nível vigente (mesmo sem uso ainda) ∪ quem já usou no mês
  const clienteIds = [...new Set([...porCliente.keys(), ...vigenteMap.keys()])];
  type Cli = { id: string; nome: string; cpf: string; telefone: string | null };
  const clientesMap = new Map<string, Cli>();
  const pontosMap = new Map<string, number>();
  for (let i = 0; i < clienteIds.length; i += 200) {
    const slice = clienteIds.slice(i, i + 200);
    const [{ data }, { data: pts }] = await Promise.all([
      sb.from("clientes").select("id, nome, cpf, telefone").in("id", slice),
      sb.from("clube_pontos").select("cliente_id, saldo_pontos").in("cliente_id", slice),
    ]);
    for (const c of (data ?? []) as Cli[]) clientesMap.set(c.id, c);
    for (const p of (pts ?? []) as Array<{ cliente_id: string; saldo_pontos: number }>) {
      pontosMap.set(p.cliente_id, p.saldo_pontos);
    }
  }

  const { data: undData } = await sb.from("unidades")
    .select("id, nome")
    .in("id", unidadeIds);
  const undMap = new Map<string, string>();
  for (const u of (undData ?? []) as Array<{ id: string; nome: string }>) {
    undMap.set(u.id, u.nome);
  }

  const porUnidade = new Map<string, SituacaoUnidade>();
  for (const uid of unidadeIds) {
    porUnidade.set(uid, {
      unidade_id: uid,
      unidade_nome: undMap.get(uid) ?? "—",
      total_clientes: 0,
      total_ciclos: 0,
      faturamento_total: 0,
      por_nivel: { nao_classificado: 0, bronze: 0, prata: 0, ouro: 0, diamante: 0 },
      clientes: [],
    });
  }

  for (const cid of clienteIds) {
    const b = porCliente.get(cid);   // uso no mês atual (pode não existir ainda)
    const v = vigenteMap.get(cid);   // nível vigente (pode não existir)
    const unidadeDoCliente = b?.unidade_principal ?? v?.unidade_id ?? "";
    const unid = porUnidade.get(unidadeDoCliente);
    if (!unid) continue; // fora da seleção
    const cli = clientesMap.get(cid);
    const ciclosAtuais = b?.ciclos ?? 0;
    const nivelProj = classificar(ciclosAtuais);
    const prox = proximoNivel(ciclosAtuais);
    const nivelVigente = (v?.nivel ?? null) as SituacaoCliente["nivel_vigente"];

    unid.clientes.push({
      cliente_id: cid,
      nome: cli?.nome ?? "—",
      cpf: cli?.cpf ?? "",
      telefone: cli?.telefone ?? null,
      unidade_id: unid.unidade_id, unidade_nome: unid.unidade_nome,
      nivel_vigente: nivelVigente,
      desconto_vigente: v ? Number(v.desconto_pct) : 0,
      ciclos_ref: v?.ciclos_mes ?? 0,
      ciclos: ciclosAtuais,
      ciclos_lavagem: b?.ciclos_lavagem ?? 0,
      ciclos_secagem: b?.ciclos_secagem ?? 0,
      faturamento: b?.faturamento ?? 0,
      nivel_projetado: nivelProj.key,
      desconto_projetado: nivelProj.descontoPct,
      proximo_nivel: prox.proximo?.key ?? null,
      ciclos_faltam: prox.faltam,
      pontos: pontosMap.get(cid) ?? 0,
    });
    unid.total_clientes += 1;
    unid.total_ciclos += ciclosAtuais;
    unid.faturamento_total += b?.faturamento ?? 0;
    // chips por nível = VIGENTE (bate com os cards da classificação)
    unid.por_nivel[nivelVigente ?? "nao_classificado"] += 1;
  }

  // Ordena clientes do maior pro menor + arredonda total
  for (const u of porUnidade.values()) {
    u.clientes.sort((a, b) => b.ciclos - a.ciclos);
    u.faturamento_total = Math.round(u.faturamento_total * 100) / 100;
  }

  return Array.from(porUnidade.values()).sort((a, b) => b.total_ciclos - a.total_ciclos);
}

export type TemplateMensagem = {
  id: string;
  tipo: string;
  nivel_alvo: string | null;
  titulo: string;
  mensagem: string;
  ativo: boolean;
  ordem: number;
};

export async function listarTemplates(): Promise<TemplateMensagem[]> {
  const sb = await createClient();
  const { data, error } = await sb.from("clube_templates_mensagem")
    .select("*")
    .order("ordem");
  if (error) throw error;
  return (data ?? []) as TemplateMensagem[];
}

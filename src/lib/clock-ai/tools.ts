// LavSync · CLOCK AI · Ferramentas do agente
//
// O CLOCK lê dados reais (service_role) e executa ações operacionais.
// Ações com efeito colateral exigem `confirmado: true` — o modelo é
// instruído a SEMPRE pedir confirmação ao Daniel antes de setar isso.
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { paginarTodos } from "@/lib/supabase/pagination";
import { agregarCompetencia, janelaMesBR, classificarCompetencia } from "@/lib/clube/engine";
import { classificar, proximoNivel } from "@/lib/clube/niveis";
import { processarFila } from "@/lib/clock-relacionamento/fila";

// ─── Definições (schema JSON pro modelo) ────────────────────────────────────

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "consultar_kpis",
    description:
      "Lê os KPIs de vendas das lavanderias num período: faturamento, ciclos, clientes únicos e ticket médio, com quebra por unidade. Use para perguntas sobre vendas, faturamento, movimento, desempenho de hoje/ontem/semana/mês.",
    input_schema: {
      type: "object" as const,
      properties: {
        data_inicio: { type: "string", description: "Data inicial YYYY-MM-DD (horário de Brasília)" },
        data_fim: { type: "string", description: "Data final YYYY-MM-DD (inclusive)" },
      },
      required: ["data_inicio", "data_fim"],
    },
  },
  {
    name: "situacao_clube",
    description:
      "Situação do Clube de Vantagens/LavCoin no mês vigente: classificados por nível, quantos estão quase no Bronze, progresso do envio das mensagens do mês e status da fila de WhatsApp.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "clientes_inativos",
    description:
      "Lista clientes sem usar a lavanderia há N dias ou mais (nome, telefone, dias parado, LavCoins). Use para win-back e reativação.",
    input_schema: {
      type: "object" as const,
      properties: {
        dias: { type: "integer", description: "Mínimo de dias sem comprar (ex.: 30)" },
        limite: { type: "integer", description: "Máximo de clientes a retornar (default 15)" },
      },
      required: ["dias"],
    },
  },
  {
    name: "buscar_cliente",
    description:
      "Busca um cliente por nome ou CPF e retorna a ficha do programa: ciclos do mês, nível vigente, LavCoins, pontos, última compra, telefone.",
    input_schema: {
      type: "object" as const,
      properties: {
        termo: { type: "string", description: "Nome (parcial) ou CPF (dígitos)" },
      },
      required: ["termo"],
    },
  },
  {
    name: "usuarios_do_dia",
    description:
      "Lista os clientes que usaram a lavanderia num dia específico (default: ontem), com gasto do dia (= LavCoins ganhos), ciclos, saldo total de LavCoins e dias de casa. Use para a rotina diária de mensagem de atualização de saldo e perguntas tipo 'quem usou ontem'.",
    input_schema: {
      type: "object" as const,
      properties: {
        data: { type: "string", description: "Dia YYYY-MM-DD (default: ontem, horário de Brasília)" },
      },
      required: [],
    },
  },
  {
    name: "classificar_mes",
    description:
      "AÇÃO: roda a classificação do Clube para uma competência (recalcula níveis e pontos de todos os clientes). Antes de executar, SEMPRE pergunte ao usuário se confirma; só chame com confirmado=true após o sim explícito.",
    input_schema: {
      type: "object" as const,
      properties: {
        mes_ref: { type: "string", description: "Competência YYYY-MM-01 (mês de referência)" },
        confirmado: { type: "boolean", description: "true SOMENTE após confirmação explícita do usuário" },
      },
      required: ["mes_ref", "confirmado"],
    },
  },
  {
    name: "processar_fila_mensagens",
    description:
      "AÇÃO: processa a fila de mensagens WhatsApp agora (envia as pendentes pelas conexões ativas). Antes de executar, SEMPRE pergunte ao usuário se confirma; só chame com confirmado=true após o sim explícito.",
    input_schema: {
      type: "object" as const,
      properties: {
        confirmado: { type: "boolean", description: "true SOMENTE após confirmação explícita do usuário" },
      },
      required: ["confirmado"],
    },
  },
];

// ─── Executores ─────────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

async function consultarKpis(input: { data_inicio: string; data_fim: string }): Promise<Json> {
  const sb = createAdminClient();
  const ini = `${input.data_inicio}T00:00:00-03:00`;
  const fim = `${input.data_fim}T23:59:59.999-03:00`;
  const dias = (new Date(input.data_fim).getTime() - new Date(input.data_inicio).getTime()) / 86400000;
  if (isNaN(dias) || dias < 0) return { erro: "Período inválido" };
  if (dias > 185) return { erro: "Período máximo de 6 meses por consulta" };

  type V = { unidade_id: string; cliente_id: string | null; valor: number | string; quantidade_ciclos: number | string | null; tipo_servico: string | null };
  const vendas = await paginarTodos<V>((r) =>
    sb.from("vendas")
      .select("unidade_id, cliente_id, valor, quantidade_ciclos, tipo_servico")
      .eq("situacao", "sucesso")
      .gte("data_venda", ini)
      .lte("data_venda", fim)
      .range(r.from, r.to),
  );
  const { data: unds } = await sb.from("unidades").select("id, nome");
  const nomeU = new Map(((unds ?? []) as Array<{ id: string; nome: string }>).map((u) => [u.id, u.nome]));

  const porUnidade = new Map<string, { faturamento: number; ciclos: number; lavagens: number; secagens: number; clientes: Set<string> }>();
  let fat = 0, ciclos = 0;
  const clientes = new Set<string>();
  for (const v of vendas) {
    const c = Math.max(1, Number(v.quantidade_ciclos) || 1);
    const val = Number(v.valor) || 0;
    fat += val; ciclos += c;
    if (v.cliente_id) clientes.add(v.cliente_id);
    const u = porUnidade.get(v.unidade_id) ?? { faturamento: 0, ciclos: 0, lavagens: 0, secagens: 0, clientes: new Set<string>() };
    u.faturamento += val; u.ciclos += c;
    if (v.tipo_servico === "lavagem") u.lavagens += c;
    else if (v.tipo_servico === "secagem") u.secagens += c;
    if (v.cliente_id) u.clientes.add(v.cliente_id);
    porUnidade.set(v.unidade_id, u);
  }
  return {
    periodo: `${input.data_inicio} a ${input.data_fim}`,
    faturamento_total: Math.round(fat * 100) / 100,
    ciclos_total: ciclos,
    clientes_unicos: clientes.size,
    ticket_medio: clientes.size ? Math.round((fat / clientes.size) * 100) / 100 : 0,
    total_vendas: vendas.length,
    por_unidade: [...porUnidade.entries()].map(([id, u]) => ({
      unidade: nomeU.get(id) ?? id,
      faturamento: Math.round(u.faturamento * 100) / 100,
      ciclos: u.ciclos,
      lavagens: u.lavagens,
      secagens: u.secagens,
      clientes: u.clientes.size,
    })).sort((a, b) => b.faturamento - a.faturamento),
  };
}

async function situacaoClube(): Promise<Json> {
  const sb = createAdminClient();
  const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
  const mesRef = hoje.getMonth() === 0
    ? `${hoje.getFullYear() - 1}-12-01`
    : `${hoje.getFullYear()}-${String(hoje.getMonth()).padStart(2, "0")}-01`;

  const [{ data: cls }, { data: envios }, { data: fila }, { data: conexoes }] = await Promise.all([
    sb.from("clube_classificacoes").select("nivel").eq("mes_aplicacao", mesAtual),
    sb.from("clube_envios_manuais").select("tipo").eq("mes_ref", mesRef),
    sb.from("msg_fila").select("status"),
    sb.from("wa_conexoes").select("verified_name, status").eq("ativo", true),
  ]);

  const porNivel: Record<string, number> = {};
  for (const c of (cls ?? []) as Array<{ nivel: string }>) porNivel[c.nivel] = (porNivel[c.nivel] ?? 0) + 1;

  const { porCliente } = await agregarCompetencia(sb, mesRef);
  let abaixoBronze = 0, pertinho = 0;
  for (const c of porCliente.values()) {
    if (classificar(c.ciclos).key === "nao_classificado") {
      abaixoBronze++;
      if (proximoNivel(c.ciclos).faltam <= 3) pertinho++;
    }
  }

  const filaCont: Record<string, number> = {};
  for (const f of (fila ?? []) as Array<{ status: string }>) filaCont[f.status] = (filaCont[f.status] ?? 0) + 1;
  const enviosCont: Record<string, number> = {};
  for (const e of (envios ?? []) as Array<{ tipo: string }>) enviosCont[e.tipo] = (enviosCont[e.tipo] ?? 0) + 1;

  return {
    mes_vigente: mesAtual,
    classificados_por_nivel: porNivel,
    total_classificados: (cls ?? []).length,
    abaixo_do_bronze_no_mes_ref: abaixoBronze,
    quase_no_bronze_faltando_ate_3: pertinho,
    mensagens_manuais_enviadas: enviosCont,
    fila_whatsapp: filaCont,
    conexoes_whatsapp: (conexoes ?? []) as Array<{ verified_name: string; status: string }>,
  };
}

async function clientesInativos(input: { dias: number; limite?: number }): Promise<Json> {
  const sb = createAdminClient();
  const limite = Math.min(input.limite ?? 15, 50);
  const corte = new Date(Date.now() - input.dias * 86400000).toISOString();
  const { data, count } = await sb
    .from("clientes")
    .select("id, nome, telefone, ultima_compra_em", { count: "exact" })
    .lt("ultima_compra_em", corte)
    .not("telefone", "is", null)
    .order("ultima_compra_em", { ascending: false })
    .limit(limite);
  const rows = (data ?? []) as Array<{ id: string; nome: string; telefone: string; ultima_compra_em: string }>;
  const ids = rows.map((r) => r.id);
  const { data: saldos } = ids.length
    ? await sb.from("xoclub_saldos").select("cliente_id, saldo_atual").in("cliente_id", ids)
    : { data: [] };
  const saldoMap = new Map(((saldos ?? []) as Array<{ cliente_id: string; saldo_atual: number }>).map((s) => [s.cliente_id, s.saldo_atual]));
  return {
    total_inativos: count ?? rows.length,
    mostrando: rows.length,
    clientes: rows.map((r) => ({
      nome: r.nome,
      telefone: r.telefone,
      dias_parado: Math.floor((Date.now() - new Date(r.ultima_compra_em).getTime()) / 86400000),
      lavcoins: saldoMap.get(r.id) ?? 0,
    })),
  };
}

async function buscarCliente(input: { termo: string }): Promise<Json> {
  const sb = createAdminClient();
  const digitos = input.termo.replace(/\D/g, "");
  let q = sb.from("clientes").select("id, nome, cpf, telefone, ultima_compra_em").limit(5);
  q = digitos.length >= 11 ? q.eq("cpf", digitos) : q.ilike("nome", `%${input.termo}%`);
  const { data } = await q;
  const rows = (data ?? []) as Array<{ id: string; nome: string; cpf: string; telefone: string | null; ultima_compra_em: string | null }>;
  if (rows.length === 0) return { encontrado: false };

  const hoje = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
  const { ini, fim } = janelaMesBR(mesAtual);

  const fichas = [];
  for (const c of rows) {
    const [{ data: vendas }, { data: cl }, { data: xc }] = await Promise.all([
      sb.from("vendas").select("quantidade_ciclos").eq("cliente_id", c.id).eq("situacao", "sucesso").gte("data_venda", ini).lte("data_venda", fim).limit(1000),
      sb.from("clube_classificacoes").select("nivel, desconto_pct").eq("cliente_id", c.id).eq("mes_aplicacao", mesAtual).maybeSingle(),
      sb.from("xoclub_saldos").select("saldo_atual").eq("cliente_id", c.id).maybeSingle(),
    ]);
    const ciclos = ((vendas ?? []) as Array<{ quantidade_ciclos: number | null }>).reduce((s, v) => s + Math.max(1, Number(v.quantidade_ciclos) || 1), 0);
    const prox = proximoNivel(ciclos);
    fichas.push({
      nome: c.nome,
      telefone: c.telefone,
      nivel_vigente: (cl as { nivel: string } | null)?.nivel ?? "sem desconto",
      desconto_vigente: (cl as { desconto_pct: number } | null)?.desconto_pct ?? 0,
      ciclos_mes_atual: ciclos,
      faltam_proximo_nivel: prox.faltam,
      proximo_nivel: prox.proximo?.key ?? "topo",
      lavcoins: (xc as { saldo_atual: number } | null)?.saldo_atual ?? 0,
      ultima_compra: c.ultima_compra_em,
    });
  }
  return { encontrado: true, clientes: fichas };
}

async function usuariosDoDia(input: { data?: string }): Promise<Json> {
  const sb = createAdminClient();
  let dia = input.data;
  if (!dia) {
    const hojeBR = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const ontem = new Date(hojeBR.getTime() - 86400000);
    dia = `${ontem.getFullYear()}-${String(ontem.getMonth() + 1).padStart(2, "0")}-${String(ontem.getDate()).padStart(2, "0")}`;
  }
  type V = { cliente_id: string | null; valor: number | string; quantidade_ciclos: number | string | null };
  const vendas = await paginarTodos<V>((r) =>
    sb.from("vendas")
      .select("cliente_id, valor, quantidade_ciclos")
      .eq("situacao", "sucesso")
      .gte("data_venda", `${dia}T00:00:00-03:00`)
      .lte("data_venda", `${dia}T23:59:59.999-03:00`)
      .not("cliente_id", "is", null)
      .range(r.from, r.to),
  );
  const agg = new Map<string, { gasto: number; ciclos: number }>();
  for (const v of vendas) {
    if (!v.cliente_id) continue;
    const cur = agg.get(v.cliente_id) ?? { gasto: 0, ciclos: 0 };
    cur.gasto += Number(v.valor) || 0;
    cur.ciclos += Math.max(1, Number(v.quantidade_ciclos) || 1);
    agg.set(v.cliente_id, cur);
  }
  const ids = [...agg.keys()];
  const cliMap = new Map<string, { nome: string; telefone: string | null; cadastrado_em: string | null }>();
  const saldoMap = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 500) {
    const slice = ids.slice(i, i + 500);
    const [{ data: cs }, { data: ss }] = await Promise.all([
      sb.from("clientes").select("id, nome, telefone, cadastrado_em").in("id", slice),
      sb.from("xoclub_saldos").select("cliente_id, saldo_atual").in("cliente_id", slice),
    ]);
    for (const c of (cs ?? []) as Array<{ id: string; nome: string; telefone: string | null; cadastrado_em: string | null }>) cliMap.set(c.id, c);
    for (const s of (ss ?? []) as Array<{ cliente_id: string; saldo_atual: number }>) saldoMap.set(s.cliente_id, s.saldo_atual);
  }
  const agora = Date.now();
  return {
    dia,
    total_clientes: agg.size,
    clientes: [...agg.entries()].map(([cid, a]) => {
      const c = cliMap.get(cid);
      return {
        nome: c?.nome ?? "—",
        telefone: c?.telefone,
        lavcoins_ganhos_no_dia: Math.round(a.gasto),
        ciclos: a.ciclos,
        saldo_total_lavcoins: saldoMap.get(cid) ?? 0,
        dias_de_cliente: c?.cadastrado_em ? Math.floor((agora - new Date(c.cadastrado_em).getTime()) / 86400000) : null,
      };
    }).sort((a, b) => b.lavcoins_ganhos_no_dia - a.lavcoins_ganhos_no_dia),
  };
}

async function acaoClassificarMes(input: { mes_ref: string; confirmado: boolean }): Promise<Json> {
  if (!input.confirmado) return { executado: false, motivo: "Aguardando confirmação do usuário" };
  if (!/^\d{4}-\d{2}-01$/.test(input.mes_ref)) return { executado: false, motivo: "mes_ref deve ser YYYY-MM-01" };
  const sb = createAdminClient();
  const { data: t } = await sb.from("tenants").select("id").limit(1).maybeSingle();
  const tenantId = (t as { id: string } | null)?.id;
  if (!tenantId) return { executado: false, motivo: "Tenant não encontrado" };
  const r = await classificarCompetencia(sb, tenantId, input.mes_ref);
  return { executado: true, classificados: r.classificados, por_nivel: r.porNivel };
}

async function acaoProcessarFila(input: { confirmado: boolean }): Promise<Json> {
  if (!input.confirmado) return { executado: false, motivo: "Aguardando confirmação do usuário" };
  const r = await processarFila({ limite: 200 });
  return { executado: true, ...r };
}

/** Executa uma tool pelo nome. Nunca lança — erros voltam como resultado. */
export async function executarTool(nome: string, input: unknown): Promise<string> {
  try {
    const i = input as never;
    let r: Json;
    switch (nome) {
      case "consultar_kpis": r = await consultarKpis(i); break;
      case "situacao_clube": r = await situacaoClube(); break;
      case "clientes_inativos": r = await clientesInativos(i); break;
      case "buscar_cliente": r = await buscarCliente(i); break;
      case "usuarios_do_dia": r = await usuariosDoDia(i); break;
      case "classificar_mes": r = await acaoClassificarMes(i); break;
      case "processar_fila_mensagens": r = await acaoProcessarFila(i); break;
      default: r = { erro: `Ferramenta desconhecida: ${nome}` };
    }
    return JSON.stringify(r);
  } catch (e) {
    return JSON.stringify({ erro: e instanceof Error ? e.message : String(e) });
  }
}

// LavSync · CLOCK v2 · Briefing — Estágio A: motor DETERMINÍSTICO de fatos
//
// Sem LLM e sem custo: todo número do briefing nasce aqui, em código. A IA
// (gerar.ts) só transforma estes fatos em fala e precisa citar o id de cada
// fato que usar — frase sem fato é descartada. Isso impede número inventado.
//
// Roda no CRON (sem sessão de usuário), então recebe `sb` com SERVICE ROLE e
// filtra SEMPRE por tenant_id explicitamente. Janelas no fuso de Brasília
// (timezone-br) e lotes grandes via paginarTodos.
//
// Fatos por escopo (cada unidade + a rede):
//   · faturamento de ontem (D-1) contra o mesmo dia da semana anterior (D-8)
//     e contra a média das 4 últimas mesmas semanas;
//   · mês até ontem contra o mesmo intervalo do mês anterior + projeção linear
//     de fechamento contra o mês anterior fechado;
//   · ticket médio (faturamento ÷ ciclos — definição única do CLOCK, a mesma
//     do registro e do painel ao vivo), vendas e clientes únicos;
//   · clientes novos (cadastrados ontem) e clientes que voltaram (compraram
//     ontem sem comprar nos 30 dias anteriores);
//   · máquinas em queda (ciclos dos últimos 7 dias contra a média semanal das
//     4 semanas anteriores), fila de WhatsApp com falha/atrasada e tarefas
//     vencidas.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { paginarTodos } from "@/lib/supabase/pagination";
import { addDaysBR, isoDayBR, startOfDayBR, startOfMonthBR } from "@/lib/timezone-br";
import { norm } from "@/lib/utils";

export type SeveridadeFato = "info" | "warn" | "danger";
export type GrupoFato = "briefing" | "alerta";
export type MedidaFato = "reais" | "vendas" | "clientes" | "ciclos" | "mensagens" | "tarefas";

export type Fato = {
  id: string;
  unidade_id: string | null;      // null = rede (ou item sem unidade)
  unidade: string;                // nome da unidade ou "Rede"
  metrica: string;
  descricao: string;              // frase objetiva com os números (fallback de fala)
  atual: number;
  base: number | null;
  base_rotulo: string | null;     // "segunda-feira, 6 de outubro" · "média das 4 segundas anteriores"
  delta_pct: number | null;
  medida: MedidaFato;
  severidade: SeveridadeFato;
  grupo: GrupoFato;               // briefing = narrativa de vendas; alerta = item operacional
  permissao: string;
  href: string | null;
  detalhe?: Record<string, unknown>;
};

export type FatosEscopo = {
  unidade_id: string | null;      // null = rede
  nome: string;
  fatos: Fato[];
};

export type FatosTenant = {
  tenant_id: string;
  ref_data: string;               // YYYY-MM-DD do dia fechado (D-1, Brasília)
  periodo: { d1: string; mes_ate: string; mes_anterior_ate: string; dias_decorridos: number; dias_no_mes: number };
  escopos: FatosEscopo[];         // rede primeiro, depois unidades por nome
};

// ─── Limiares (código, não IA) ─────────────────────────────────────
const QUEDA_WARN = -15;
const QUEDA_DANGER = -30;
const MAQ_QUEDA_WARN = -30;
const MAQ_QUEDA_DANGER = -60;
const MAQ_BASE_MIN_SEMANAL = 7;     // abaixo disso a máquina gira pouco demais para comparar
const FILA_DANGER = 20;
const TAREFAS_WARN = 5;
const DIA_MS = 86_400_000;

const PERM_VENDAS = "performance.view";
const PERM_MANUT = "manutencao.view";
const PERM_FILA = "marketing.view";
const PERM_TAREFAS = "tarefas.view";

const DIAS_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const DIAS_SEMANA_PLURAL = ["domingos", "segundas", "terças", "quartas", "quintas", "sextas", "sábados"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// ─── Helpers ───────────────────────────────────────────────────────
type Venda = {
  unidade_id: string;
  cliente_id: string | null;
  valor: number | string;
  quantidade_ciclos: number | string | null;
  data_venda: string;
  equipamento: string | null;
};
type VendaN = { u: string; c: string | null; v: number; ciclos: number; t: number; eq: string | null };

type Agregado = { fat: number; vendas: number; ciclos: number; clientes: Set<string> };

function agregar(vs: VendaN[], de: Date, ate: Date): Agregado {
  const a: Agregado = { fat: 0, vendas: 0, ciclos: 0, clientes: new Set() };
  const ini = de.getTime();
  const fim = ate.getTime();
  for (const x of vs) {
    if (x.t < ini || x.t >= fim) continue;
    a.fat += x.v;
    a.vendas += 1;
    a.ciclos += x.ciclos;
    if (x.c) a.clientes.add(x.c);
  }
  return a;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r1 = (n: number) => Math.round(n * 10) / 10;

function delta(atual: number, base: number | null): number | null {
  if (base === null || base <= 0) return null;
  return r1(((atual - base) / base) * 100);
}

function sevQueda(d: number | null, warn = QUEDA_WARN, danger = QUEDA_DANGER): SeveridadeFato {
  if (d === null) return "info";
  if (d <= danger) return "danger";
  if (d <= warn) return "warn";
  return "info";
}

function slug(s: string): string {
  return norm(s).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "x";
}

/** Dia BR por extenso a partir do início do dia (UTC): "segunda-feira, 6 de outubro". */
function diaExtenso(inicioDia: Date): string {
  const br = new Date(inicioDia.getTime() - 3 * 3600_000);
  return `${DIAS_SEMANA[br.getUTCDay()]}, ${br.getUTCDate()} de ${MESES[br.getUTCMonth()]}`;
}

function brl(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(d: number | null): string {
  if (d === null) return "sem base de comparação";
  return `${d > 0 ? "+" : ""}${d.toLocaleString("pt-BR")}%`;
}

function diasNoMesBR(inicioMes: Date): number {
  const br = new Date(inicioMes.getTime() - 3 * 3600_000);
  return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth() + 1, 0)).getUTCDate();
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ─── Motor ─────────────────────────────────────────────────────────
export async function calcularFatos(
  sb: SupabaseClient,
  tenantId: string,
  opts: { agora?: Date } = {},
): Promise<FatosTenant> {
  const agora = opts.agora ?? new Date();
  const hojeIni = startOfDayBR(agora);
  const d1Ini = addDaysBR(agora, -1);
  const d1Fim = hojeIni;                                   // exclusivo
  const d8Ini = addDaysBR(agora, -8);
  const semanasIni = [1, 2, 3, 4].map((k) => addDaysBR(agora, -1 - 7 * k));

  const mesIni = startOfMonthBR(d1Ini);
  const diasDecorridos = Math.round((d1Fim.getTime() - mesIni.getTime()) / DIA_MS);
  const diasNoMes = diasNoMesBR(mesIni);
  const mesAntIni = startOfMonthBR(new Date(mesIni.getTime() - 1));
  const diasMesAnt = diasNoMesBR(mesAntIni);
  const mesAntFimFechado = mesIni;                         // exclusivo
  const mesAntFimIntervalo = new Date(mesAntIni.getTime() + Math.min(diasDecorridos, diasMesAnt) * DIA_MS);

  const maqJanelaIni = new Date(hojeIni.getTime() - 7 * DIA_MS);
  const maqBaseIni = new Date(hojeIni.getTime() - 35 * DIA_MS);
  const voltouCorte = new Date(d1Ini.getTime() - 30 * DIA_MS);

  const buscaIni = new Date(Math.min(mesAntIni.getTime(), maqBaseIni.getTime(), voltouCorte.getTime()));

  const nomeDiaD1 = DIAS_SEMANA_PLURAL[new Date(d1Ini.getTime() - 3 * 3600_000).getUTCDay()];
  const ref_data = isoDayBR(d1Ini);

  // ── Leituras (todas com tenant_id explícito: service role ignora RLS) ──
  const [unidadesRes, vendasRaw, maquinasRes, filaRaw, tarefasRaw] = await Promise.all([
    sb.from("unidades").select("id, nome").eq("tenant_id", tenantId).eq("ativo", true).order("nome"),
    paginarTodos<Venda>((r) =>
      sb.from("vendas")
        .select("unidade_id, cliente_id, valor, quantidade_ciclos, data_venda, equipamento")
        .eq("tenant_id", tenantId)
        .eq("situacao", "sucesso")
        .gte("data_venda", buscaIni.toISOString())
        .lt("data_venda", hojeIni.toISOString())
        .order("id")
        .range(r.from, r.to),
    ),
    sb.from("maquinas")
      .select("id, codigo, tipo, unidade_id, equipamento_match")
      .eq("tenant_id", tenantId)
      .eq("status", "ativa"),
    Promise.all([
      paginarTodos<{ unidade_id: string | null; status: string }>((r) =>
        sb.from("msg_fila")
          .select("unidade_id, status")
          .eq("tenant_id", tenantId)
          .in("status", ["falhou", "morto"])
          .gte("atualizado_em", new Date(hojeIni.getTime() - 7 * DIA_MS).toISOString())
          .order("id")
          .range(r.from, r.to),
      ),
      paginarTodos<{ unidade_id: string | null; status: string }>((r) =>
        sb.from("msg_fila")
          .select("unidade_id, status")
          .eq("tenant_id", tenantId)
          .eq("status", "pendente")
          .lt("agendado_para", new Date(agora.getTime() - DIA_MS).toISOString())
          .order("id")
          .range(r.from, r.to),
      ),
    ]).then(([falhas, atrasadas]) => [...falhas, ...atrasadas]),
    paginarTodos<{ unidade_id: string | null; prioridade: string; prazo: string }>((r) =>
      sb.from("tarefas")
        .select("unidade_id, prioridade, prazo")
        .eq("tenant_id", tenantId)
        .in("status", ["pendente", "em_andamento", "bloqueada"])
        .lt("prazo", agora.toISOString())
        .order("id")
        .range(r.from, r.to),
    ),
  ]);
  if (unidadesRes.error) throw new Error(`unidades: ${unidadesRes.error.message}`);
  if (maquinasRes.error) throw new Error(`maquinas: ${maquinasRes.error.message}`);

  const unidades = (unidadesRes.data ?? []) as Array<{ id: string; nome: string }>;
  const vendas: VendaN[] = vendasRaw.map((v) => ({
    u: v.unidade_id,
    c: v.cliente_id,
    v: Number(v.valor) || 0,
    ciclos: Math.max(1, Number(v.quantidade_ciclos) || 1),
    t: new Date(v.data_venda).getTime(),
    eq: v.equipamento,
  }));

  // ── Clientes novos (cadastrados ontem) e cadastro dos que compraram ontem ──
  const compradoresD1 = [...new Set(vendas.filter((x) => x.c && x.t >= d1Ini.getTime() && x.t < d1Fim.getTime()).map((x) => x.c as string))];
  const [novosRes, cadastros] = await Promise.all([
    paginarTodos<{ id: string; unidade_id: string }>((r) =>
      sb.from("clientes")
        .select("id, unidade_id")
        .eq("tenant_id", tenantId)
        .gte("cadastrado_em", d1Ini.toISOString())
        .lt("cadastrado_em", d1Fim.toISOString())
        .order("id")
        .range(r.from, r.to),
    ),
    (async () => {
      const mapa = new Map<string, number | null>();
      for (const ids of chunk(compradoresD1, 300)) {
        const { data, error } = await sb.from("clientes").select("id, cadastrado_em").eq("tenant_id", tenantId).in("id", ids);
        if (error) throw new Error(`clientes: ${error.message}`);
        for (const c of (data ?? []) as Array<{ id: string; cadastrado_em: string | null }>) {
          mapa.set(c.id, c.cadastrado_em ? new Date(c.cadastrado_em).getTime() : null);
        }
      }
      return mapa;
    })(),
  ]);
  const novosPorUnidade = new Map<string, number>();
  for (const c of novosRes) novosPorUnidade.set(c.unidade_id, (novosPorUnidade.get(c.unidade_id) ?? 0) + 1);

  // Última compra antes de D-1 por cliente (dentro da janela buscada).
  const ultimaAntes = new Map<string, number>();
  for (const x of vendas) {
    if (!x.c || x.t >= d1Ini.getTime()) continue;
    if ((ultimaAntes.get(x.c) ?? 0) < x.t) ultimaAntes.set(x.c, x.t);
  }
  /** Voltou = comprou ontem, nada nos 30 dias anteriores, e já era cliente antes disso. */
  const voltou = (cid: string): boolean => {
    const ult = ultimaAntes.get(cid);
    if (ult !== undefined && ult >= voltouCorte.getTime()) return false;
    const cad = cadastros.get(cid);
    const jaEraCliente = (cad !== undefined && cad !== null && cad < voltouCorte.getTime()) || ult !== undefined;
    return jaEraCliente;
  };

  const maquinas = (maquinasRes.data ?? []) as Array<{ id: string; codigo: string; tipo: string; unidade_id: string; equipamento_match: string | null }>;
  const fila = filaRaw;
  const tarefas = tarefasRaw;

  // ── Monta escopos ──
  const escopos: FatosEscopo[] = [];
  const escoposDef: Array<{ unidade_id: string | null; nome: string; ids: Set<string> }> = [
    { unidade_id: null, nome: "Rede", ids: new Set(unidades.map((u) => u.id)) },
    ...unidades.map((u) => ({ unidade_id: u.id, nome: u.nome, ids: new Set([u.id]) })),
  ];

  for (const esc of escoposDef) {
    const pre = esc.unidade_id ? slug(esc.nome) : "rede";
    const vs = vendas.filter((x) => esc.ids.has(x.u));
    const fatos: Fato[] = [];
    const add = (f: Omit<Fato, "id" | "unidade_id" | "unidade"> & { sufixo: string; unidade_id?: string | null }) => {
      const { sufixo, ...resto } = f;
      fatos.push({ id: `${pre}.${sufixo}`, unidade_id: f.unidade_id === undefined ? esc.unidade_id : f.unidade_id, unidade: esc.nome, ...resto });
    };

    // Sem nenhuma unidade (tenant vazio) não há o que narrar.
    if (esc.ids.size === 0) continue;

    // 1. Faturamento D-1 × D-8 e × média 4 semanas
    const aD1 = agregar(vs, d1Ini, d1Fim);
    const aD8 = agregar(vs, d8Ini, new Date(d8Ini.getTime() + DIA_MS));
    const semanas = semanasIni.map((ini) => agregar(vs, ini, new Date(ini.getTime() + DIA_MS)));
    const media4 = r2(semanas.reduce((s, a) => s + a.fat, 0) / semanas.length);
    const dD8 = delta(aD1.fat, aD8.fat);
    const dM4 = delta(aD1.fat, media4);
    add({
      sufixo: "fat_ontem_vs_semana_passada", metrica: "faturamento_d1_vs_d8", medida: "reais",
      descricao: `${esc.nome}: faturamento de ontem ${brl(r2(aD1.fat))} contra ${brl(r2(aD8.fat))} em ${diaExtenso(d8Ini)} (${pct(dD8)})`,
      atual: r2(aD1.fat), base: r2(aD8.fat), base_rotulo: diaExtenso(d8Ini), delta_pct: dD8,
      severidade: sevQueda(dD8), grupo: "briefing", permissao: PERM_VENDAS, href: "/comparativo",
      detalhe: { ontem: diaExtenso(d1Ini) },
    });
    add({
      sufixo: "fat_ontem_vs_media_4_semanas", metrica: "faturamento_d1_vs_media4", medida: "reais",
      descricao: `${esc.nome}: faturamento de ontem ${brl(r2(aD1.fat))} contra média de ${brl(media4)} nas 4 ${nomeDiaD1} anteriores (${pct(dM4)})`,
      atual: r2(aD1.fat), base: media4, base_rotulo: `média das 4 ${nomeDiaD1} anteriores`, delta_pct: dM4,
      severidade: sevQueda(dM4), grupo: "briefing", permissao: PERM_VENDAS, href: "/comparativo",
      detalhe: { semanas: semanasIni.map((ini, i) => ({ dia: isoDayBR(ini), faturamento: r2(semanas[i].fat) })) },
    });

    // 2. Movimento de ontem: vendas e clientes únicos × D-8
    const dVendas = delta(aD1.vendas, aD8.vendas);
    add({
      sufixo: "vendas_ontem", metrica: "vendas_d1_vs_d8", medida: "vendas",
      descricao: `${esc.nome}: ${aD1.vendas} vendas ontem contra ${aD8.vendas} em ${diaExtenso(d8Ini)} (${pct(dVendas)}); ${aD1.clientes.size} clientes únicos contra ${aD8.clientes.size}`,
      atual: aD1.vendas, base: aD8.vendas, base_rotulo: diaExtenso(d8Ini), delta_pct: dVendas,
      severidade: "info", grupo: "briefing", permissao: PERM_VENDAS, href: "/comparativo",
      detalhe: { clientes_unicos: aD1.clientes.size, clientes_unicos_base: aD8.clientes.size, ciclos: aD1.ciclos, ciclos_base: aD8.ciclos },
    });

    // 3. Mês até ontem × mesmo intervalo do mês anterior
    const aMes = agregar(vs, mesIni, d1Fim);
    const aMesAntIntervalo = agregar(vs, mesAntIni, mesAntFimIntervalo);
    const dMes = delta(aMes.fat, aMesAntIntervalo.fat);
    const rotuloMesAnt = `mesmos ${Math.min(diasDecorridos, diasMesAnt)} primeiros dias de ${MESES[new Date(mesAntIni.getTime() - 3 * 3600_000).getUTCMonth()]}`;
    add({
      sufixo: "fat_mes_ate_ontem", metrica: "faturamento_mtd_vs_mes_anterior", medida: "reais",
      descricao: `${esc.nome}: ${brl(r2(aMes.fat))} no mês até ontem contra ${brl(r2(aMesAntIntervalo.fat))} nos ${rotuloMesAnt} (${pct(dMes)})`,
      atual: r2(aMes.fat), base: r2(aMesAntIntervalo.fat), base_rotulo: rotuloMesAnt, delta_pct: dMes,
      severidade: sevQueda(dMes), grupo: "briefing", permissao: PERM_VENDAS, href: "/comparativo",
      detalhe: { dias_decorridos: diasDecorridos },
    });

    // 4. Projeção linear de fechamento × mês anterior fechado
    const aMesAntTotal = agregar(vs, mesAntIni, mesAntFimFechado);
    const projecao = diasDecorridos > 0 ? r2((aMes.fat / diasDecorridos) * diasNoMes) : 0;
    const dProj = delta(projecao, aMesAntTotal.fat);
    const nomeMesAnt = MESES[new Date(mesAntIni.getTime() - 3 * 3600_000).getUTCMonth()];
    add({
      sufixo: "projecao_mes", metrica: "projecao_fechamento", medida: "reais",
      descricao: `${esc.nome}: projeção linear de fechamento do mês ${brl(projecao)} contra ${brl(r2(aMesAntTotal.fat))} em ${nomeMesAnt} fechado (${pct(dProj)})`,
      atual: projecao, base: r2(aMesAntTotal.fat), base_rotulo: `${nomeMesAnt} fechado`, delta_pct: dProj,
      severidade: sevQueda(dProj), grupo: "briefing", permissao: PERM_VENDAS, href: "/comparativo",
      detalhe: { metodo: "linear: mês até ontem ÷ dias decorridos × dias do mês", dias_decorridos: diasDecorridos, dias_no_mes: diasNoMes },
    });

    // 5. Ticket médio (faturamento ÷ ciclos) do mês × mesmo intervalo anterior
    const ticketMes = aMes.ciclos > 0 ? r2(aMes.fat / aMes.ciclos) : 0;
    const ticketAnt = aMesAntIntervalo.ciclos > 0 ? r2(aMesAntIntervalo.fat / aMesAntIntervalo.ciclos) : null;
    const dTicket = delta(ticketMes, ticketAnt);
    add({
      sufixo: "ticket_mes", metrica: "ticket_medio_mtd", medida: "reais",
      descricao: `${esc.nome}: ticket médio do mês ${brl(ticketMes)} contra ${ticketAnt === null ? "sem base" : brl(ticketAnt)} nos ${rotuloMesAnt} (${pct(dTicket)})`,
      atual: ticketMes, base: ticketAnt, base_rotulo: rotuloMesAnt, delta_pct: dTicket,
      severidade: sevQueda(dTicket), grupo: "briefing", permissao: PERM_VENDAS, href: "/comparativo",
      detalhe: { definicao: "faturamento dividido pelo número de ciclos" },
    });

    // 6. Clientes novos e que voltaram (ontem)
    let novos = 0;
    for (const id of esc.ids) novos += novosPorUnidade.get(id) ?? 0;
    const compradoresEsc = new Set(vs.filter((x) => x.c && x.t >= d1Ini.getTime() && x.t < d1Fim.getTime()).map((x) => x.c as string));
    let voltaram = 0;
    for (const cid of compradoresEsc) if (voltou(cid)) voltaram++;
    add({
      sufixo: "clientes_ontem", metrica: "clientes_novos_e_retorno_d1", medida: "clientes",
      descricao: `${esc.nome}: ontem ${novos} clientes novos cadastrados e ${voltaram} clientes voltaram depois de mais de 30 dias sem comprar`,
      atual: novos, base: null, base_rotulo: null, delta_pct: null,
      severidade: "info", grupo: "briefing", permissao: PERM_VENDAS, href: "/clientes",
      detalhe: { novos, voltaram, compradores: compradoresEsc.size },
    });

    // 7. Máquinas em queda (só nos escopos de unidade, para não duplicar alerta)
    if (esc.unidade_id) {
      for (const m of maquinas.filter((mq) => mq.unidade_id === esc.unidade_id)) {
        const match = (m.equipamento_match ?? m.codigo ?? "").trim();
        if (!match) continue;
        let semana = 0, base = 0, ult2dias = 0;
        const doisDiasIni = hojeIni.getTime() - 2 * DIA_MS;
        for (const x of vs) {
          if (!x.eq || !x.eq.includes(match)) continue;
          if (x.t >= maqJanelaIni.getTime()) {
            semana += x.ciclos;
            if (x.t >= doisDiasIni) ult2dias += x.ciclos;
          } else if (x.t >= maqBaseIni.getTime()) {
            base += x.ciclos;
          }
        }
        const baseSemanal = r1(base / 4);
        if (baseSemanal < MAQ_BASE_MIN_SEMANAL) continue;
        const dMaq = delta(semana, baseSemanal);
        const parada = ult2dias === 0 && baseSemanal / 7 >= 2;
        const sev: SeveridadeFato = parada ? "danger" : sevQueda(dMaq, MAQ_QUEDA_WARN, MAQ_QUEDA_DANGER);
        if (sev === "info") continue;
        add({
          sufixo: `maquina_${slug(m.codigo)}`, metrica: "maquina_ciclos_7d_vs_media", medida: "ciclos",
          descricao: parada
            ? `${esc.nome}: ${m.tipo} ${m.codigo} sem nenhum ciclo nos últimos 2 dias; média de ${baseSemanal} ciclos por semana nas 4 semanas anteriores`
            : `${esc.nome}: ${m.tipo} ${m.codigo} com ${semana} ciclos nos últimos 7 dias contra média de ${baseSemanal} por semana nas 4 semanas anteriores (${pct(dMaq)})`,
          atual: semana, base: baseSemanal, base_rotulo: "média semanal das 4 semanas anteriores", delta_pct: dMaq,
          severidade: sev, grupo: "alerta", permissao: PERM_MANUT, href: "/manutencao",
          detalhe: { codigo: m.codigo, tipo: m.tipo, sem_ciclos_2_dias: parada },
        });
      }
    }

    // 8. Fila de WhatsApp: falhas (7 dias) e pendentes atrasados (> 24h).
    //    Na rede entram só os itens sem unidade; os de unidade ficam no escopo dela.
    const daFila = fila.filter((f) => (esc.unidade_id ? f.unidade_id === esc.unidade_id : f.unidade_id === null));
    const falhas = daFila.filter((f) => f.status === "falhou" || f.status === "morto").length;
    const atrasadas = daFila.filter((f) => f.status === "pendente").length;
    if (falhas > 0 || atrasadas > 0) {
      add({
        sufixo: "fila_whatsapp", metrica: "fila_whatsapp_falhas", medida: "mensagens",
        descricao: `${esc.nome}: ${falhas} mensagens de WhatsApp com falha nos últimos 7 dias e ${atrasadas} pendentes há mais de 24 horas`,
        atual: falhas + atrasadas, base: null, base_rotulo: null, delta_pct: null,
        severidade: falhas + atrasadas >= FILA_DANGER ? "danger" : "warn",
        grupo: "alerta", permissao: PERM_FILA, href: "/integracoes/whatsapp",
        detalhe: { falhas, pendentes_atrasadas: atrasadas },
      });
    }

    // 9. Tarefas vencidas (mesma regra de escopo da fila).
    const dasTarefas = tarefas.filter((t) => (esc.unidade_id ? t.unidade_id === esc.unidade_id : t.unidade_id === null));
    if (dasTarefas.length > 0) {
      const criticas = dasTarefas.filter((t) => t.prioridade === "alta" || t.prioridade === "critica").length;
      add({
        sufixo: "tarefas_vencidas", metrica: "tarefas_vencidas", medida: "tarefas",
        descricao: `${esc.nome}: ${dasTarefas.length} tarefas com prazo vencido, ${criticas} de prioridade alta ou crítica`,
        atual: dasTarefas.length, base: null, base_rotulo: null, delta_pct: null,
        severidade: criticas > 0 || dasTarefas.length >= TAREFAS_WARN ? "warn" : "info",
        grupo: "alerta", permissao: PERM_TAREFAS, href: "/tarefas",
        detalhe: { total: dasTarefas.length, alta_ou_critica: criticas },
      });
    }

    escopos.push({ unidade_id: esc.unidade_id, nome: esc.nome, fatos });
  }

  return {
    tenant_id: tenantId,
    ref_data,
    periodo: {
      d1: ref_data,
      mes_ate: ref_data,
      mes_anterior_ate: isoDayBR(new Date(mesAntFimIntervalo.getTime() - 1)),
      dias_decorridos: diasDecorridos,
      dias_no_mes: diasNoMes,
    },
    escopos,
  };
}

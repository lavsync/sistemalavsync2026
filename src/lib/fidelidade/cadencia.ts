// LavSync · Fidelidade · Cadência de relacionamento (cron diário)
//
// Gatilhos: pós-uso (D-1), inatividade (7/21/45 dias), sprint de ciclos
// (reta final do mês). Anti-massante por construção:
//   · CAP global: máx 2 mensagens promo por cliente na janela de 7 dias
//   · 1 gatilho por dia por cliente (o de maior prioridade vence)
//   · dedupe_key idempotente (re-rodar o cron nunca duplica)
//   · opt-out (SAIR/SAIRPROMO) respeitado antes de enfileirar
//   · janela de horário e ritmo ficam no processarFila/msg_rate_config
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { paginarTodos } from "@/lib/supabase/pagination";
import { classificar, proximoNivel, nomeMes } from "@/lib/clube/niveis";
import { enfileirar, type ItemFila } from "@/lib/clock-relacionamento/fila";
import { carregarOptOuts, suprimido } from "@/lib/clock-relacionamento/optout";
import { nowBR, startOfDayBR, endOfDayBR, addDaysBR, startOfMonthBR, isoDayBR } from "@/lib/timezone-br";

const CAP_PROMO_7D = 2; // teto de mensagens promo/cliente/7 dias (todas as origens)

type Automacao = { chave: string; ativo: boolean; corpo: string; params: Record<string, unknown> };
type Cliente = { id: string; nome: string; telefone: string | null; cpf: string; unidade_id: string | null; ultima_compra_em: string | null };

export type ResultadoCadencia = {
  candidatos: number;
  enfileiradas: number;
  suprimidasOptOut: number;
  suprimidasCap: number;
  porGatilho: Record<string, number>;
};

function render(corpo: string, vars: Record<string, string | number>): string {
  let out = corpo;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "gi"), String(v));
  }
  return out;
}

/** Ciclos e gasto do mês corrente por cliente (paginado). */
async function ciclosDoMesAtual(sb: ReturnType<typeof createAdminClient>): Promise<Map<string, { ciclos: number; gasto: number }>> {
  type V = { cliente_id: string | null; valor: number | string; quantidade_ciclos: number | string | null };
  const rows = await paginarTodos<V>((r) =>
    sb.from("vendas")
      .select("cliente_id, valor, quantidade_ciclos")
      .eq("situacao", "sucesso")
      .gte("data_venda", startOfMonthBR().toISOString())
      .not("cliente_id", "is", null)
      .range(r.from, r.to),
  );
  const m = new Map<string, { ciclos: number; gasto: number }>();
  for (const v of rows) {
    if (!v.cliente_id) continue;
    const cur = m.get(v.cliente_id) ?? { ciclos: 0, gasto: 0 };
    cur.ciclos += Number(v.quantidade_ciclos) || 1;
    cur.gasto += Number(v.valor) || 0;
    m.set(v.cliente_id, cur);
  }
  return m;
}

/** Quantas msgs promo cada cliente recebeu/tem na fila nos últimos 7 dias. */
async function contagemPromo7d(sb: ReturnType<typeof createAdminClient>, clienteIds: string[]): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  const desde = addDaysBR(startOfDayBR(), -7).toISOString();
  for (let i = 0; i < clienteIds.length; i += 500) {
    const { data } = await sb
      .from("msg_fila")
      .select("cliente_id")
      .in("cliente_id", clienteIds.slice(i, i + 500))
      .eq("escopo", "promo")
      .in("status", ["pendente", "enviando", "enviado"])
      .gte("criado_em", desde);
    for (const r of (data ?? []) as Array<{ cliente_id: string | null }>) {
      if (r.cliente_id) m.set(r.cliente_id, (m.get(r.cliente_id) ?? 0) + 1);
    }
  }
  return m;
}

/**
 * Roda a cadência do dia. Cada cliente recebe NO MÁXIMO 1 mensagem por
 * execução (prioridade: pos_uso > faltam_ciclos > inatividade).
 */
export async function rodarCadenciaDiaria(): Promise<ResultadoCadencia> {
  const res: ResultadoCadencia = { candidatos: 0, enfileiradas: 0, suprimidasOptOut: 0, suprimidasCap: 0, porGatilho: {} };
  const sb = createAdminClient();
  const { data: t } = await sb.from("tenants").select("id").limit(1).maybeSingle();
  const tenantId = (t as { id: string } | null)?.id;
  if (!tenantId) return res;

  const { data: autosRaw } = await sb
    .from("fidelidade_automacoes")
    .select("chave, ativo, corpo, params")
    .eq("tenant_id", tenantId)
    .eq("ativo", true);
  const autos = new Map(((autosRaw ?? []) as Automacao[]).map((a) => [a.chave, a]));
  if (autos.size === 0) return res;

  const agora = nowBR();
  const mesNome = nomeMes(startOfMonthBR());
  const ciclosMes = await ciclosDoMesAtual(sb);

  // candidato por cliente: primeiro gatilho que casar vence (ordem de prioridade)
  const candidatos = new Map<string, { chave: string; dedupe: string; extra: Record<string, string | number> }>();

  // ── 1) PÓS-USO: quem usou ONTEM ──
  const auPos = autos.get("pos_uso");
  if (auPos?.corpo) {
    const ontemIni = addDaysBR(startOfDayBR(), -1).toISOString();
    const ontemFim = addDaysBR(endOfDayBR(), -1).toISOString();
    type V = { cliente_id: string | null; valor: number | string };
    const vendasOntem = await paginarTodos<V>((r) =>
      sb.from("vendas")
        .select("cliente_id, valor")
        .eq("situacao", "sucesso")
        .gte("data_venda", ontemIni)
        .lte("data_venda", ontemFim)
        .not("cliente_id", "is", null)
        .range(r.from, r.to),
    );
    const gastoOntem = new Map<string, number>();
    for (const v of vendasOntem) {
      if (v.cliente_id) gastoOntem.set(v.cliente_id, (gastoOntem.get(v.cliente_id) ?? 0) + (Number(v.valor) || 0));
    }
    const diaOntem = isoDayBR(addDaysBR(startOfDayBR(), -1));
    for (const [cid, gasto] of gastoOntem.entries()) {
      candidatos.set(cid, {
        chave: "pos_uso",
        dedupe: `fid:pos_uso:${cid}:${diaOntem}`,
        extra: { lavcoins_hoje: Math.round(gasto) },
      });
    }
  }

  // ── 2) FALTAM CICLOS: reta final do mês, a até N ciclos do próximo nível ──
  const auSprint = autos.get("faltam_ciclos");
  if (auSprint?.corpo) {
    const diaInicio = Number(auSprint.params?.dia_inicio ?? 20);
    const faltamMax = Number(auSprint.params?.faltam_max ?? 3);
    if (agora.dia >= diaInicio) {
      const mesAtual = `${agora.ano}-${String(agora.mes).padStart(2, "0")}`;
      for (const [cid, agg] of ciclosMes.entries()) {
        if (candidatos.has(cid)) continue;
        const prox = proximoNivel(agg.ciclos);
        if (prox.proximo && prox.faltam >= 1 && prox.faltam <= faltamMax) {
          candidatos.set(cid, { chave: "faltam_ciclos", dedupe: `fid:faltam:${cid}:${mesAtual}`, extra: {} });
        }
      }
    }
  }

  // ── 3) INATIVIDADE: janela exata de N dias desde a última compra ──
  for (const marco of ["inatividade_7", "inatividade_21", "inatividade_45"] as const) {
    const au = autos.get(marco);
    if (!au?.corpo) continue;
    const dias = Number(au.params?.dias ?? Number(marco.split("_")[1]));
    // última compra dentro do DIA que faz exatamente `dias` dias atrás
    const alvoIni = addDaysBR(startOfDayBR(), -dias).toISOString();
    const alvoFim = addDaysBR(endOfDayBR(), -dias).toISOString();
    const inativos = await paginarTodos<{ id: string; ultima_compra_em: string }>((r) =>
      sb.from("clientes")
        .select("id, ultima_compra_em")
        .gte("ultima_compra_em", alvoIni)
        .lte("ultima_compra_em", alvoFim)
        .not("telefone", "is", null)
        .range(r.from, r.to),
    );
    for (const c of inativos) {
      if (candidatos.has(c.id)) continue;
      candidatos.set(c.id, {
        chave: marco,
        dedupe: `fid:${marco}:${c.id}:${c.ultima_compra_em.slice(0, 10)}`,
        extra: {},
      });
    }
  }

  res.candidatos = candidatos.size;
  if (candidatos.size === 0) return res;

  // ── Guardas: opt-out + cap 2/7d ──
  const ids = [...candidatos.keys()];
  const [optouts, cap7d] = await Promise.all([carregarOptOuts(tenantId, ids), contagemPromo7d(sb, ids)]);

  // Dados dos clientes + saldos LavCoin
  const cliMap = new Map<string, Cliente>();
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await sb
      .from("clientes")
      .select("id, nome, telefone, cpf, unidade_id, ultima_compra_em")
      .in("id", ids.slice(i, i + 500));
    for (const c of (data ?? []) as Cliente[]) cliMap.set(c.id, c);
  }
  const saldoMap = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await sb
      .from("xoclub_saldos").select("cliente_id, saldo_atual").in("cliente_id", ids.slice(i, i + 500));
    for (const s of (data ?? []) as Array<{ cliente_id: string; saldo_atual: number }>) {
      saldoMap.set(s.cliente_id, s.saldo_atual);
    }
  }

  const itens: ItemFila[] = [];
  for (const [cid, cand] of candidatos.entries()) {
    const cli = cliMap.get(cid);
    if (!cli?.telefone) continue;
    if (suprimido("promo", optouts.get(cid))) { res.suprimidasOptOut++; continue; }
    if ((cap7d.get(cid) ?? 0) >= CAP_PROMO_7D) { res.suprimidasCap++; continue; }

    const au = autos.get(cand.chave)!;
    const agg = ciclosMes.get(cid) ?? { ciclos: 0, gasto: 0 };
    const prox = proximoNivel(agg.ciclos);
    const nivelAtual = classificar(agg.ciclos);

    const corpo = render(au.corpo, {
      primeiro_nome: cli.nome.split(" ")[0],
      nome: cli.nome,
      ciclos: agg.ciclos,
      mes_nome: mesNome,
      nivel: nivelAtual.key === "nao_classificado" ? "—" : nivelAtual.label.toUpperCase(),
      faltam: prox.faltam,
      proximo_nivel: prox.proximo ? prox.proximo.label.toUpperCase() : "TOPO",
      desconto_proximo: prox.proximo?.descontoPct ?? 0,
      lavcoins_saldo: saldoMap.get(cid) ?? 0,
      lavcoins_hoje: cand.extra.lavcoins_hoje ?? 0,
      ...cand.extra,
    });

    itens.push({
      tenant_id: tenantId,
      unidade_id: cli.unidade_id,
      tipo: "automacao",
      prioridade: 4,
      escopo: "promo",
      cliente_id: cid,
      template_chave: `fid_${cand.chave}`,
      destinatario_nome: cli.nome,
      destinatario_telefone: cli.telefone,
      destinatario_cpf: cli.cpf,
      corpo_renderizado: corpo,
      dedupe_key: cand.dedupe,
    });
    res.porGatilho[cand.chave] = (res.porGatilho[cand.chave] ?? 0) + 1;
  }

  const r = await enfileirar(itens);
  res.enfileiradas = r.enfileirados;
  return res;
}

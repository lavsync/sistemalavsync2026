// LavSync · Fidelidade · Fechamento mensal automático (cron dia 1)
//
// Versão service_role do classificarMes (lib/clube/actions.ts) para rodar
// sem sessão de usuário, + enfileiramento da mensagem de nível na msg_fila.
// Idempotente: fidelidade_fechamentos garante 1 execução por mês; o
// dedupe_key da fila garante 1 mensagem por cliente/competência.
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { paginarTodos } from "@/lib/supabase/pagination";
import { classificar, proximoNivel, nomeMes, labelDoNivel, NIVEIS, type NivelClube } from "@/lib/clube/niveis";
import { enfileirar, type ItemFila } from "@/lib/clock-relacionamento/fila";
import { carregarOptOuts, suprimido } from "@/lib/clock-relacionamento/optout";
import { nowBR } from "@/lib/timezone-br";

export type ResultadoFechamento = {
  executado: boolean;
  motivo?: string;
  mesRef?: string;
  classificados?: number;
  porNivel?: Record<string, number>;
  msgsEnfileiradas?: number;
  msgsSuprimidas?: number;
};

function isoMes(ano: number, mes1a12: number): string {
  return `${ano}-${String(mes1a12).padStart(2, "0")}-01`;
}

/**
 * Fecha o mês ANTERIOR (competência) se ainda não fechado: classifica todos
 * os clientes pelas vendas do mês, atualiza pontos e enfileira a mensagem
 * de nível pra cada classificado. Chamado pelo cron diário; só age no dia 1
 * (ou sempre que a competência anterior ainda não tiver fechamento).
 */
export async function fecharMesAnterior(opts?: { force?: boolean }): Promise<ResultadoFechamento> {
  const sb = createAdminClient();
  const { data: t } = await sb.from("tenants").select("id").limit(1).maybeSingle();
  const tenantId = (t as { id: string } | null)?.id;
  if (!tenantId) return { executado: false, motivo: "tenant não encontrado" };

  const agora = nowBR();
  // Competência = mês anterior ao mês corrente (BR)
  const refAno = agora.mes === 1 ? agora.ano - 1 : agora.ano;
  const refMes = agora.mes === 1 ? 12 : agora.mes - 1;
  const mesRef = isoMes(refAno, refMes);
  const mesAplic = isoMes(agora.ano, agora.mes);

  // Já fechado?
  const { data: jaFechado } = await sb
    .from("fidelidade_fechamentos")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("mes_ref", mesRef)
    .maybeSingle();
  if (jaFechado && !opts?.force) return { executado: false, motivo: "competência já fechada", mesRef };

  // Fora do dia 1: só roda se a competência anterior nunca fechou (catch-up
  // pro plano Hobby, onde o cron pode falhar num dia)
  if (agora.dia !== 1 && jaFechado) return { executado: false, motivo: "não é dia 1", mesRef };

  // ── 1) Agregar vendas da competência (paginado — pode passar de 1000) ──
  const ini = `${mesRef}T00:00:00-03:00`;
  const fimData = new Date(refAno, refMes, 0); // último dia do mês ref
  const fim = `${refAno}-${String(refMes).padStart(2, "0")}-${String(fimData.getDate()).padStart(2, "0")}T23:59:59.999-03:00`;

  type V = { cliente_id: string | null; unidade_id: string; valor: number | string; tipo_servico: string | null; quantidade_ciclos: number | string | null };
  const vendas = await paginarTodos<V>((r) =>
    sb.from("vendas")
      .select("cliente_id, unidade_id, valor, tipo_servico, quantidade_ciclos")
      .eq("situacao", "sucesso")
      .gte("data_venda", ini)
      .lte("data_venda", fim)
      .not("cliente_id", "is", null)
      .range(r.from, r.to),
  );

  type Agg = { ciclos: number; lav: number; sec: number; fat: number; unidade_id: string };
  const agg = new Map<string, Agg>();
  for (const v of vendas) {
    if (!v.cliente_id) continue;
    const ciclos = Number(v.quantidade_ciclos) || 1;
    const cur = agg.get(v.cliente_id) ?? { ciclos: 0, lav: 0, sec: 0, fat: 0, unidade_id: v.unidade_id };
    cur.ciclos += ciclos;
    cur.fat += Number(v.valor) || 0;
    if (v.tipo_servico === "lavagem") cur.lav += ciclos;
    else if (v.tipo_servico === "secagem") cur.sec += ciclos;
    agg.set(v.cliente_id, cur);
  }

  // ── 2) Upsert das classificações ──
  const porNivel: Record<string, number> = { bronze: 0, prata: 0, ouro: 0, diamante: 0 };
  const batch: Array<Record<string, unknown>> = [];
  for (const [cliente_id, a] of agg.entries()) {
    const nivel = classificar(a.ciclos);
    if (nivel.key === "nao_classificado") continue;
    batch.push({
      tenant_id: tenantId, unidade_id: a.unidade_id, cliente_id,
      mes_ref: mesRef, mes_aplicacao: mesAplic,
      ciclos_mes: a.ciclos, ciclos_lavagem: a.lav, ciclos_secagem: a.sec,
      faturamento_mes: Math.round(a.fat * 100) / 100,
      nivel: nivel.key, desconto_pct: nivel.descontoPct,
    });
    porNivel[nivel.key] += 1;
  }

  await sb.from("clube_classificacoes").delete().eq("mes_ref", mesRef);
  for (let i = 0; i < batch.length; i += 200) {
    const { error } = await sb.from("clube_classificacoes").insert(batch.slice(i, i + 200));
    if (error) return { executado: false, motivo: `insert classificações: ${error.message}`, mesRef };
  }

  // ── 3) Pontos (1 ciclo = 1 ponto; recalcula total pra idempotência) ──
  for (const [cliente_id, a] of agg.entries()) {
    const { data: existente } = await sb
      .from("clube_pontos").select("saldo_pontos, total_acumulado")
      .eq("cliente_id", cliente_id).maybeSingle();
    if (existente) {
      const { data: todas } = await sb
        .from("clube_classificacoes").select("ciclos_mes").eq("cliente_id", cliente_id);
      const total = ((todas ?? []) as Array<{ ciclos_mes: number }>).reduce((s, c) => s + c.ciclos_mes, 0);
      const ex = existente as { saldo_pontos: number; total_acumulado: number };
      await sb.from("clube_pontos").update({
        total_acumulado: total,
        saldo_pontos: Math.max(0, total - (ex.total_acumulado - ex.saldo_pontos)),
      }).eq("cliente_id", cliente_id);
    } else {
      await sb.from("clube_pontos").insert({
        tenant_id: tenantId, cliente_id, saldo_pontos: a.ciclos, total_acumulado: a.ciclos,
      });
    }
  }

  // ── 4) Mensagem de nível (dia 1) via msg_fila ──
  let enfileiradas = 0;
  let suprimidas = 0;

  const { data: autoRow } = await sb
    .from("fidelidade_automacoes").select("ativo")
    .eq("tenant_id", tenantId).eq("chave", "fechamento_nivel").maybeSingle();
  const disparar = (autoRow as { ativo: boolean } | null)?.ativo ?? false;

  if (disparar && batch.length > 0) {
    // Templates do Clube por nível (parabens_nivel)
    const { data: tpls } = await sb
      .from("clube_templates_mensagem").select("nivel_alvo, mensagem")
      .eq("tenant_id", tenantId).eq("tipo", "parabens_nivel").eq("ativo", true);
    const tplPorNivel = new Map<string, string>();
    for (const tp of (tpls ?? []) as Array<{ nivel_alvo: string | null; mensagem: string }>) {
      if (tp.nivel_alvo) tplPorNivel.set(tp.nivel_alvo, tp.mensagem);
    }

    const clienteIds = batch.map((b) => b.cliente_id as string);
    const { data: clientes } = await sb
      .from("clientes").select("id, nome, telefone, cpf")
      .in("id", clienteIds.slice(0, 1000));
    const extra = clienteIds.length > 1000
      ? (await sb.from("clientes").select("id, nome, telefone, cpf").in("id", clienteIds.slice(1000))).data ?? []
      : [];
    const cliMap = new Map(
      ([...(clientes ?? []), ...extra] as Array<{ id: string; nome: string; telefone: string | null; cpf: string }>)
        .map((c) => [c.id, c]),
    );
    const { data: pontos } = await sb
      .from("clube_pontos").select("cliente_id, saldo_pontos").in("cliente_id", clienteIds.slice(0, 1000));
    const pontosMap = new Map(
      ((pontos ?? []) as Array<{ cliente_id: string; saldo_pontos: number }>).map((p) => [p.cliente_id, p.saldo_pontos]),
    );
    const optouts = await carregarOptOuts(tenantId, clienteIds);

    const itens: ItemFila[] = [];
    for (const b of batch) {
      const cli = cliMap.get(b.cliente_id as string);
      const tpl = tplPorNivel.get(b.nivel as string);
      if (!cli?.telefone || !tpl) continue;
      if (suprimido("promo", optouts.get(cli.id))) { suprimidas++; continue; }

      const ciclos = b.ciclos_mes as number;
      const prox = proximoNivel(ciclos);
      const corpo = tpl
        .replace(/\{primeiro_nome\}/gi, cli.nome.split(" ")[0])
        .replace(/\{nome\}/gi, cli.nome)
        .replace(/\{nivel\}/gi, labelDoNivel(b.nivel as NivelClube).toUpperCase())
        .replace(/\{ciclos\}/gi, String(ciclos))
        .replace(/\{desconto\}/gi, String(b.desconto_pct))
        .replace(/\{pontos\}/gi, String(pontosMap.get(cli.id) ?? ciclos))
        .replace(/\{faltam\}/gi, String(prox.faltam))
        .replace(/\{proximo_nivel\}/gi, prox.proximo ? prox.proximo.label.toUpperCase() : "TOPO")
        .replace(/\{desconto_proximo\}/gi, String(prox.proximo?.descontoPct ?? 0))
        .replace(/\{faltam_proximo\}/gi, String(prox.faltam))
        .replace(/\{mes_ref_nome\}/gi, nomeMes(mesRef))
        .replace(/\{mes_aplic_nome\}/gi, nomeMes(mesAplic));

      itens.push({
        tenant_id: tenantId,
        unidade_id: b.unidade_id as string,
        tipo: "automacao",
        prioridade: 3,               // nível: acima de campanha, abaixo de operacional
        escopo: "promo",
        cliente_id: cli.id,
        template_chave: "fid_fechamento_nivel",
        destinatario_nome: cli.nome,
        destinatario_telefone: cli.telefone,
        destinatario_cpf: cli.cpf,
        corpo_renderizado: corpo,
        dedupe_key: `fid:nivel:${cli.id}:${mesAplic}`,
      });
    }
    const r = await enfileirar(itens);
    enfileiradas = r.enfileirados;
  }

  await sb.from("fidelidade_fechamentos").upsert({
    tenant_id: tenantId, mes_ref: mesRef,
    clientes_classificados: batch.length, por_nivel: porNivel,
    msgs_enfileiradas: enfileiradas, msgs_suprimidas: suprimidas,
    executado_em: new Date().toISOString(),
  }, { onConflict: "tenant_id,mes_ref" });

  return {
    executado: true, mesRef, classificados: batch.length, porNivel,
    msgsEnfileiradas: enfileiradas, msgsSuprimidas: suprimidas,
  };
}

export { NIVEIS };

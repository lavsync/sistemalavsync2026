// LavSync · Fidelidade · Fechamento mensal automático (cron dia 1)
//
// Versão service_role do classificarMes (lib/clube/actions.ts) para rodar
// sem sessão de usuário, + enfileiramento da mensagem de nível na msg_fila.
// Idempotente: fidelidade_fechamentos garante 1 execução por mês; o
// dedupe_key da fila garante 1 mensagem por cliente/competência.
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { proximoNivel, nomeMes, labelDoNivel, NIVEIS, type NivelClube } from "@/lib/clube/niveis";
import { classificarCompetencia } from "@/lib/clube/engine";
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

  // ── 1-3) Classificação + pontos pelo MOTOR ÚNICO (lib/clube/engine.ts) ──
  // Mesma lógica da action da UI — nunca reimplementar aqui.
  let resultado: Awaited<ReturnType<typeof classificarCompetencia>>;
  try {
    resultado = await classificarCompetencia(sb, tenantId, mesRef);
  } catch (e) {
    return { executado: false, motivo: e instanceof Error ? e.message : String(e), mesRef };
  }
  const porNivel = resultado.porNivel;

  // Linhas persistidas (pra renderizar as mensagens de nível)
  type ClassRow = { cliente_id: string; unidade_id: string; ciclos_mes: number; nivel: string; desconto_pct: number };
  const { data: classData } = await sb
    .from("clube_classificacoes")
    .select("cliente_id, unidade_id, ciclos_mes, nivel, desconto_pct")
    .eq("mes_ref", mesRef)
    .limit(5000);
  const batch = (classData ?? []) as ClassRow[];

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

    const { data: undsPortal } = await sb.from("unidades").select("id, portal_url");
    const portalMap = new Map(((undsPortal ?? []) as Array<{ id: string; portal_url: string | null }>)
      .map((u) => [u.id, u.portal_url]));
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
        .replace(/\{mes_aplic_nome\}/gi, nomeMes(mesAplic))
        .replace(/\{link_portal\}/gi, portalMap.get(b.unidade_id as string) ?? "https://sistema.lavsync.com.br/meu-clube");

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

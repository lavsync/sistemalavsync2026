// LavSync · CLOCK v2 · Registro · Mídia Indoor (TVs das lavanderias)
//
// Não há lib de leitura reaproveitável (as telas consultam inline), então
// as contagens ficam aqui, com a sessão do usuário e filtradas pelas
// unidades liberadas. Contagens via head:true (sem trazer linhas).
import "server-only";
import { toggleCampaignStatusAction } from "@/app/publicidade/midia-indoor/campanhas/actions";
import type { CtxClock, DefAcao, DefConsulta } from "./tipos";
import { resolverUnidades, inteiro, textoObrig, booleano, nomeUnidade, ErroClock } from "./comum";

async function contar(ctx: CtxClock, tabela: string, ids: string[], filtro?: { col: string; val: string }, desde?: { col: string; iso: string }): Promise<number> {
  let q = ctx.sb.from(tabela).select("id", { count: "exact", head: true }).in("unidade_id", ids);
  if (filtro) q = q.eq(filtro.col, filtro.val);
  if (desde) q = q.gte(desde.col, desde.iso);
  const { count, error } = await q;
  if (error) throw new Error(`${tabela}: ${error.message}`);
  return count ?? 0;
}

const midiaIndoorResumo: DefConsulta = {
  id: "midia_indoor_resumo",
  modulo: "midia_indoor",
  descricao:
    "Mídia Indoor por unidade: campanhas ativas nas TVs e as que vencem em 7 dias, impressões e cliques de QR no período (padrão 30 dias), " +
    "leads de parceiros novos e parceiros pendentes de aprovação.",
  permissao: "midia_indoor.view",
  params: { type: "object", properties: { unidade: { type: "string", description: "Nome/id ou vazio para todas" }, dias: { type: "integer", description: "Janela de impressões/cliques (padrão 30)" } } },
  async executar(ctx, p) {
    const us = resolverUnidades(ctx, p.unidade);
    const dias = inteiro(p, "dias", 30, 1, 365);
    const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
    const em7 = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const porUnidade = [];
    for (const u of us) {
      const ids = [u.id];
      porUnidade.push({
        unidade: u.nome,
        campanhas_ativas: await contar(ctx, "mi_campaigns", ids, { col: "status", val: "ativa" }),
        campanhas_pausadas: await contar(ctx, "mi_campaigns", ids, { col: "status", val: "pausada" }),
        impressoes: await contar(ctx, "mi_campaign_impressions", ids, undefined, { col: "shown_at", iso: desde }),
        cliques_qr: await contar(ctx, "mi_qr_clicks", ids, undefined, { col: "clicked_at", iso: desde }),
        leads_novos: await contar(ctx, "mi_partner_leads", ids, { col: "status", val: "novo" }),
        parceiros_pendentes: await contar(ctx, "mi_partners", ids, { col: "status", val: "pendente" }),
      });
    }
    const { data: vencendo } = await ctx.sb.from("mi_campaigns")
      .select("id, name, ends_at, unidade_id")
      .in("unidade_id", us.map((u) => u.id))
      .eq("status", "ativa").not("ends_at", "is", null).lte("ends_at", em7)
      .order("ends_at", { ascending: true }).limit(10);
    const { data: ativas } = await ctx.sb.from("mi_campaigns")
      .select("id, name, status, unidade_id, ends_at")
      .in("unidade_id", us.map((u) => u.id))
      .in("status", ["ativa", "pausada"]).order("updated_at", { ascending: false }).limit(20);
    type Camp = { id: string; name: string; status?: string; ends_at: string | null; unidade_id: string };
    return {
      janela: `últimos ${dias} dias`,
      por_unidade: porUnidade,
      vencem_em_7_dias: ((vencendo ?? []) as Camp[]).map((c) => ({ id: c.id, nome: c.name, termina_em: c.ends_at, unidade: nomeUnidade(ctx, c.unidade_id) })),
      campanhas: ((ativas ?? []) as Camp[]).map((c) => ({ id: c.id, nome: c.name, status: c.status, termina_em: c.ends_at, unidade: nomeUnidade(ctx, c.unidade_id) })),
    };
  },
};

async function campanhaTv(ctx: CtxClock, id: string): Promise<{ id: string; name: string; status: string; unidade_id: string }> {
  const { data } = await ctx.sb.from("mi_campaigns").select("id, name, status, unidade_id").eq("id", id).maybeSingle();
  const c = data as { id: string; name: string; status: string; unidade_id: string } | null;
  if (!c || !ctx.unidades.some((u) => u.id === c.unidade_id)) throw new ErroClock("Campanha de TV não encontrada nas suas unidades.");
  return c;
}

const alternarCampanhaTv: DefAcao = {
  id: "midia_indoor_alternar_campanha",
  modulo: "midia_indoor",
  descricao: "Pausa ou ativa uma campanha nas TVs da unidade (id de midia_indoor_resumo). ativar=true ativa; false pausa.",
  permissao: "midia_indoor.update",
  risco: "medio",
  params: { type: "object", properties: { campanha_id: { type: "string" }, ativar: { type: "boolean" } }, required: ["campanha_id", "ativar"] },
  async resumir(ctx, p) {
    const c = await campanhaTv(ctx, textoObrig(p, "campanha_id"));
    const ativar = booleano(p, "ativar", false);
    if (ativar && c.status === "ativa") throw new ErroClock("Essa campanha já está ativa.");
    if (!ativar && c.status !== "ativa") throw new ErroClock("Essa campanha não está ativa.");
    if (c.status === "expirada") throw new ErroClock("Campanha expirada: ajuste as datas na tela de campanhas.");
    return `Vou ${ativar ? "ativar" : "pausar"} a campanha "${c.name}" nas TVs da unidade ${nomeUnidade(ctx, c.unidade_id)}. Confirma?`;
  },
  async executar(ctx, p) {
    const c = await campanhaTv(ctx, textoObrig(p, "campanha_id"));
    const ativar = booleano(p, "ativar", false);
    if (ativar === (c.status === "ativa")) return { alterada: false, status: c.status };
    await toggleCampaignStatusAction(c.id, c.status);
    return { alterada: true, status: ativar ? "ativa" : "pausada" };
  },
};

export const CONSULTAS_MIDIA: DefConsulta[] = [midiaIndoorResumo];
export const ACOES_MIDIA: DefAcao[] = [alternarCampanhaTv];

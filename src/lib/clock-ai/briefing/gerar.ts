// LavSync · CLOCK v2 · Briefing — Estágio B: fatos → fala (Claude Opus 5.5)
//
// Recebe SÓ o JSON de fatos do estágio A (fatos.ts) e escreve um briefing
// falado curto + alertas, em saída estruturada (JSON schema). Toda frase e
// todo alerta precisam citar ids de fatos; o servidor descarta o que não
// citar fato válido — a IA não tem como introduzir número novo.
//
// Grava em clock_insights (service role, com tenant_id/unidade_id corretos
// para a RLS filtrar na leitura). Idempotente por ref_data: se o briefing do
// escopo já existe para o dia, não gera de novo (a não ser com `forcar`).
//
// Chamado como etapa best-effort do cron diário (/api/cron/diario).
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODELO_CLOCK } from "@/lib/clock-ai/persona";
import { calcularFatos, type Fato, type FatosEscopo, type FatosTenant, type SeveridadeFato } from "@/lib/clock-ai/briefing/fatos";

const PERM_BRIEFING = "performance.view";
const PESO: Record<SeveridadeFato, number> = { info: 1, warn: 2, danger: 3 };

const SISTEMA_BRIEFING = `Você é o CLOCK, a inteligência do LavSync que opera as lavanderias Xô Varal. Você escreve o briefing falado da manhã a partir de FATOS calculados pelo sistema.

Regras de verdade:
- Use somente os fatos recebidos. Nunca invente, estime, some ou recalcule números; não crie comparação que não esteja num fato.
- Cada frase do briefing e cada alerta cita, no campo "fatos", os ids exatos dos fatos que usa. Frase sem fato será descartada.
- O briefing usa apenas fatos do grupo "briefing". Alertas usam apenas fatos do grupo "alerta", e cada alerta cita fatos de um único assunto.

Regras de fala (tudo será lido em voz alta):
- Números por extenso e arredondados: "doze mil e trezentos reais", "subiu nove por cento". Sem algarismos, "R$" ou "%".
- Toda comparação diz a base, usando o base_rotulo do fato: "contra a segunda passada", "contra os mesmos dias de setembro".
- Alta: evoluiu, subiu, cresceu. Queda: recuou, caiu, perdeu ritmo. Variação menor que três por cento é "estável".
- Frases curtas, no máximo vinte palavras, uma ideia por frase. Sem markdown, listas ou emojis.
- Tom de braço-direito calmo e direto, humor seco na medida, sem bajulação. Notícia ruim com número e sem drama; notícia boa com uma comemoração curta.

Formato:
- "titulo": até sessenta caracteres, sem número.
- "frases": de três a seis frases, em ordem de impacto financeiro: primeiro o dia de ontem, depois o mês e a projeção, depois ticket e clientes. A primeira frase traz o fato principal. A última pode ser "Quer o detalhe de algum?".
- "alertas": um por assunto relevante do grupo "alerta" (máquina, fila de WhatsApp, tarefas), do mais grave para o menos grave. "titulo" curto e "texto_fala" com uma ou duas frases dizendo o problema, o número e onde olhar.`;

type Saida = {
  titulo: string;
  frases: Array<{ texto: string; fatos: string[] }>;
  alertas: Array<{ titulo: string; texto_fala: string; fatos: string[] }>;
};

function schemaSaida(idsBriefing: string[], idsAlerta: string[]): Record<string, unknown> {
  const listaIds = (ids: string[]) => ({
    type: "array",
    items: ids.length > 0 ? { type: "string", enum: ids } : { type: "string" },
  });
  return {
    type: "object",
    additionalProperties: false,
    required: ["titulo", "frases", "alertas"],
    properties: {
      titulo: { type: "string" },
      frases: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["texto", "fatos"],
          properties: { texto: { type: "string" }, fatos: listaIds(idsBriefing) },
        },
      },
      alertas: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["titulo", "texto_fala", "fatos"],
          properties: { titulo: { type: "string" }, texto_fala: { type: "string" }, fatos: listaIds(idsAlerta) },
        },
      },
    },
  };
}

/** Versão enxuta do fato para o modelo (sem campos internos). */
function fatoParaModelo(f: Fato) {
  return {
    id: f.id, grupo: f.grupo, unidade: f.unidade, metrica: f.metrica, descricao: f.descricao,
    atual: f.atual, base: f.base, base_rotulo: f.base_rotulo, delta_pct: f.delta_pct,
    medida: f.medida, severidade: f.severidade, ...(f.detalhe ? { detalhe: f.detalhe } : {}),
  };
}

async function escreverComModelo(client: Anthropic, escopo: FatosEscopo, refData: string): Promise<Saida | null> {
  const idsBriefing = escopo.fatos.filter((f) => f.grupo === "briefing").map((f) => f.id);
  const idsAlerta = escopo.fatos.filter((f) => f.grupo === "alerta").map((f) => f.id);

  const stream = client.messages.stream({
    model: MODELO_CLOCK,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: { type: "json_schema", schema: schemaSaida(idsBriefing, idsAlerta) } },
    system: [{ type: "text", text: SISTEMA_BRIEFING, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: JSON.stringify({
        escopo: escopo.unidade_id ? `unidade ${escopo.nome}` : "rede inteira (todas as unidades)",
        dia_de_referencia: refData,
        fatos: escopo.fatos.map(fatoParaModelo),
      }),
    }],
  });
  const msg = await stream.finalMessage();

  if (msg.stop_reason === "refusal") {
    console.warn(`[clock/briefing] recusa em ${escopo.nome}:`, msg.stop_details?.category ?? "sem categoria");
    return null;
  }
  if (msg.stop_reason === "max_tokens") {
    console.warn(`[clock/briefing] max_tokens em ${escopo.nome}`);
    return null;
  }
  const texto = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  try {
    return JSON.parse(texto) as Saida;
  } catch {
    console.warn(`[clock/briefing] JSON inválido em ${escopo.nome}`);
    return null;
  }
}

type LinhaInsight = {
  tenant_id: string;
  unidade_id: string | null;
  tipo: "briefing" | "alerta";
  titulo: string;
  texto_fala: string;
  fatos: unknown;
  severidade: SeveridadeFato;
  permissao: string;
  href: string | null;
  ref_data: string;
};

/** Valida a saída do modelo contra os fatos e monta as linhas de clock_insights. */
function montarLinhas(tenantId: string, escopo: FatosEscopo, refData: string, saida: Saida | null): LinhaInsight[] {
  const porId = new Map(escopo.fatos.map((f) => [f.id, f]));
  const linhas: LinhaInsight[] = [];

  // Briefing: só frases que citam ao menos um fato válido do grupo briefing.
  if (saida) {
    const frases = (saida.frases ?? [])
      .map((fr) => ({
        texto: String(fr.texto ?? "").trim(),
        fatos: (fr.fatos ?? []).map((id) => porId.get(id)).filter((f): f is Fato => !!f && f.grupo === "briefing"),
      }))
      .filter((fr) => fr.texto && fr.fatos.length > 0);
    if (frases.length > 0) {
      const usados = [...new Map(frases.flatMap((fr) => fr.fatos).map((f) => [f.id, f])).values()];
      linhas.push({
        tenant_id: tenantId,
        unidade_id: escopo.unidade_id,
        tipo: "briefing",
        titulo: String(saida.titulo ?? "").trim().slice(0, 120) || `Briefing ${escopo.nome}`,
        texto_fala: frases.map((fr) => fr.texto).join(" "),
        fatos: { ref_data: refData, frases: frases.map((fr) => ({ texto: fr.texto, fatos: fr.fatos.map((f) => f.id) })), itens: usados },
        severidade: "info",
        permissao: PERM_BRIEFING,
        href: "/comparativo",
        ref_data: refData,
      });
    }
  }

  // Alertas: fatos válidos do grupo alerta, todos com a mesma permissão.
  const cobertos = new Set<string>();
  for (const al of saida?.alertas ?? []) {
    const fatos = (al.fatos ?? []).map((id) => porId.get(id)).filter((f): f is Fato => !!f && f.grupo === "alerta");
    const texto = String(al.texto_fala ?? "").trim();
    if (fatos.length === 0 || !texto) continue;
    if (new Set(fatos.map((f) => f.permissao)).size > 1) continue;
    if (fatos.every((f) => cobertos.has(f.id))) continue;
    fatos.forEach((f) => cobertos.add(f.id));
    const sev = fatos.reduce<SeveridadeFato>((m, f) => (PESO[f.severidade] > PESO[m] ? f.severidade : m), "info");
    linhas.push({
      tenant_id: tenantId,
      unidade_id: fatos[0].unidade_id,
      tipo: "alerta",
      titulo: String(al.titulo ?? "").trim().slice(0, 120) || fatos[0].descricao.slice(0, 120),
      texto_fala: texto,
      fatos: { ref_data: refData, itens: fatos },
      severidade: sev,
      permissao: fatos[0].permissao,
      href: fatos[0].href,
      ref_data: refData,
    });
  }

  // Rede de segurança: fato grave que a IA não cobriu vira alerta com a
  // descrição determinística do próprio fato (sem texto inventado).
  for (const f of escopo.fatos) {
    if (f.grupo !== "alerta" || f.severidade !== "danger" || cobertos.has(f.id)) continue;
    linhas.push({
      tenant_id: tenantId,
      unidade_id: f.unidade_id,
      tipo: "alerta",
      titulo: f.descricao.slice(0, 120),
      texto_fala: `${f.descricao}.`,
      fatos: { ref_data: refData, itens: [f] },
      severidade: f.severidade,
      permissao: f.permissao,
      href: f.href,
      ref_data: refData,
    });
  }

  return linhas;
}

/** Escopo já gerado no dia = qualquer insight (briefing ou alerta) daquele ref_data. */
async function escopoJaGerado(sb: SupabaseClient, tenantId: string, unidadeId: string | null, refData: string): Promise<boolean> {
  let q = sb.from("clock_insights").select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId).eq("ref_data", refData);
  q = unidadeId ? q.eq("unidade_id", unidadeId) : q.is("unidade_id", null);
  const { count, error } = await q;
  if (error) throw new Error(`clock_insights: ${error.message}`);
  return (count ?? 0) > 0;
}

async function apagarDoDia(sb: SupabaseClient, tenantId: string, unidadeId: string | null, refData: string): Promise<void> {
  let q = sb.from("clock_insights").delete().eq("tenant_id", tenantId).eq("ref_data", refData);
  q = unidadeId ? q.eq("unidade_id", unidadeId) : q.is("unidade_id", null);
  const { error } = await q;
  if (error) throw new Error(`clock_insights: ${error.message}`);
}

export type ResultadoBriefing = {
  ref_data?: string;
  tenants: number;
  escopos_gerados: number;
  escopos_pulados: number;
  insights_gravados: number;
  erros: string[];
  motivo?: string;
};

/**
 * Gera o briefing do dia (D-1) para cada tenant ativo, por unidade e rede.
 * Best-effort por escopo: um escopo com erro não impede os demais.
 */
export async function gerarBriefingDiario(opts: { forcar?: boolean; agora?: Date } = {}): Promise<ResultadoBriefing> {
  const res: ResultadoBriefing = { tenants: 0, escopos_gerados: 0, escopos_pulados: 0, insights_gravados: 0, erros: [] };
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ...res, motivo: "ANTHROPIC_API_KEY ausente — briefing não gerado" };
  }

  const sb = createAdminClient();
  const client = new Anthropic();
  const { data: tenants, error } = await sb.from("tenants").select("id").eq("ativo", true);
  if (error) throw new Error(`tenants: ${error.message}`);

  for (const t of (tenants ?? []) as Array<{ id: string }>) {
    res.tenants++;
    let fatos: FatosTenant;
    try {
      fatos = await calcularFatos(sb, t.id, { agora: opts.agora });
    } catch (e) {
      res.erros.push(`tenant ${t.id}: fatos — ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    res.ref_data = fatos.ref_data;

    const resultados = await Promise.allSettled(fatos.escopos.map(async (escopo) => {
      if (await escopoJaGerado(sb, t.id, escopo.unidade_id, fatos.ref_data)) {
        if (!opts.forcar) return { pulado: true, gravados: 0 };
        await apagarDoDia(sb, t.id, escopo.unidade_id, fatos.ref_data);
      }
      const saida = await escreverComModelo(client, escopo, fatos.ref_data);
      const linhas = montarLinhas(t.id, escopo, fatos.ref_data, saida);
      if (linhas.length === 0) return { pulado: false, gravados: 0 };
      const { error: eIns } = await sb.from("clock_insights").insert(linhas);
      if (eIns) throw new Error(eIns.message);
      return { pulado: false, gravados: linhas.length };
    }));

    resultados.forEach((r, i) => {
      const nome = fatos.escopos[i].nome;
      if (r.status === "rejected") {
        const e = r.reason;
        res.erros.push(`${nome}: ${e instanceof Anthropic.APIError ? `API ${e.status ?? "?"} ${e.message}` : e instanceof Error ? e.message : String(e)}`);
      } else if (r.value.pulado) {
        res.escopos_pulados++;
      } else {
        res.escopos_gerados++;
        res.insights_gravados += r.value.gravados;
      }
    });
  }
  return res;
}

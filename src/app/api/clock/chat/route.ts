// LavSync · CLOCK v2 · Cérebro conversacional (Claude Opus 5.5, SSE)
//
// POST { sessao_id?, texto, modo: "voz"|"texto", rota_atual?, acao_id? } → text/event-stream
//   sessao · texto · frase · ferramenta · nav · confirmacao · acao_decidida · fim · erro
//
// acao_id: o id do cartão de confirmação ABERTO no front quando o usuário
// respondeu. Um "sim" só executa se vier com o acao_id da única pendente da
// sessão (nunca vale para um "sim" dito a outra pergunta). O front não manda
// acao_id quando a fala nasceu de barge-in (eco do próprio CLOCK).
// acao_decidida { acao_id, status }: o servidor executou, cancelou ou expirou
// uma pendente neste turno; o front fecha o cartão correspondente.
//
// Princípios:
//  - A conversa mora no SERVIDOR (clock_sessoes/clock_mensagens, append-only).
//    O front manda só o texto novo; nada do histórico é editado — requisito do
//    "preserved thinking" do Opus 5.5 e do cache de prompt.
//  - Prefixo estável para o cache: tools em ordem fixa (geradas do gateway) →
//    persona estática com cache_control → mensagens. Data/hora, usuário,
//    unidades e tela entram num bloco <contexto> dentro da mensagem do usuário.
//  - Leituras e ações passam SEMPRE pelo gateway (sessão do usuário + RBAC +
//    unidades). executar_acao só PROPÕE; quem confirma é o humano (cartão ou
//    "sim" por voz no turno seguinte — nunca o modelo). Qualquer outra fala
//    expira as pendentes de risco baixo/médio da sessão.
//  - Streaming por frase: o texto sai em `texto` (legenda) e é cortado em
//    `frase` completas para o TTS começar a falar antes do turno acabar.
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlock,
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageParam,
  BetaTool,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import {
  criarCtx, CONSULTAS, ACOES, ROTAS, rodarConsulta, proporAcao, executarAcaoPendente,
  cancelarAcaoPendente, expirarPendentes, defAcao, podeUsarClock,
  type CtxClock, type DefConsulta, type DefAcao,
} from "@/lib/clock-ai/gateway";
import { abrirSessao, carregarMensagens, anexarMensagens } from "@/lib/clock-ai/sessao";
import {
  PERSONA_SISTEMA, MODELO_CLOCK, BETAS_CLOCK, betasLigados, montarContexto,
} from "@/lib/clock-ai/persona";
import { lerNovidades, temPermissao, usuarioVeTodasUnidades } from "@/lib/clock-ai/briefing/novidades";
import { norm } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Modo = "voz" | "texto";

const LIMITES: Record<Modo, { iteracoes: number; maxTokens: number; effort: "low" | "medium" }> = {
  voz: { iteracoes: 6, maxTokens: 8000, effort: "low" },
  texto: { iteracoes: 10, maxTokens: 16000, effort: "medium" },
};
/** Teto de parede do turno: passou disso, fecha com uma frase de saída. */
const TETO_TURNO_MS = 90_000;
const TIMEOUT_FERRAMENTA_MS = 15_000;
const MAX_RESULTADO_CHARS = 20_000;
const MAX_TEXTO_USUARIO = 4_000;
/** Sessão muito longa vira sessão nova (o histórico é append-only). */
const MAX_MENSAGENS_SESSAO = 160;
const JANELA_CONFIRMACAO_MS = 10 * 60_000;
/** União dos períodos aceitos por alguma tela (cada rota declara os seus em `filtros`). */
const PERIODOS = [...new Set(ROTAS.flatMap((r) => r.filtros?.periodo?.valores ?? []))];

// ═══ Ferramentas (lista FIXA, gerada do gateway em ordem estável) ═══

/** Atalhos para as consultas mais frequentes: o primeiro id existente no registro vence. */
const ATALHOS: Array<{ nome: string; candidatos: string[] }> = [
  { nome: "consultar_kpis", candidatos: ["kpis_periodo"] },
  { nome: "buscar_cliente", candidatos: ["buscar_cliente"] },
  { nome: "situacao_clube", candidatos: ["situacao_clube"] },
  { nome: "dre_periodo", candidatos: ["dre_periodo"] },
];

function porId<T extends { id: string }>(a: T, b: T): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function resumoParams(schema: { properties?: Record<string, unknown>; required?: string[] }): string {
  const props = Object.keys(schema.properties ?? {});
  if (props.length === 0) return "sem params";
  const req = new Set(schema.required ?? []);
  return `params: ${props.map((p) => (req.has(p) ? p : `${p}?`)).join(", ")}`;
}

type Montagem = {
  tools: BetaTool[];
  consultas: Map<string, DefConsulta>;
  acoes: Map<string, DefAcao>;
  atalhos: Map<string, string>; // nome da tool → id da consulta
};

let montagemCache: Montagem | null = null;

function montarFerramentas(): Montagem {
  if (montagemCache) return montagemCache;
  const consultasOrd = [...CONSULTAS].sort(porId);
  const acoesOrd = [...ACOES].sort(porId);
  const consultas = new Map(consultasOrd.map((c) => [c.id, c]));
  const acoes = new Map(acoesOrd.map((a) => [a.id, a]));
  const rotas = [...new Set(ROTAS.map((r) => r.href))];

  const tools: BetaTool[] = [];

  if (consultasOrd.length > 0) {
    tools.push({
      name: "consultar",
      description:
        "Lê dados do LavSync (somente leitura, já filtrado pelo perfil e unidades do usuário). " +
        "Escolha a consulta pelo id e passe os params que ela pede. Consultas:\n" +
        consultasOrd.map((c) => `- ${c.id} (${resumoParams(c.params)}): ${c.descricao}`).join("\n"),
      input_schema: {
        type: "object",
        properties: {
          consulta: { type: "string", enum: consultasOrd.map((c) => c.id), description: "Id da consulta." },
          params: { type: "object", description: "Parâmetros da consulta escolhida." },
        },
        required: ["consulta"],
      },
      eager_input_streaming: true,
    });
  }

  if (acoesOrd.length > 0) {
    tools.push({
      name: "executar_acao",
      description:
        "PROPÕE uma ação que altera dados. Não executa: o sistema registra a proposta e o usuário confirma " +
        "no cartão (ou com um sim por voz, só para risco baixo ou médio). Depois de propor, diga o resumo e pergunte \"Confirma?\". Ações:\n" +
        acoesOrd.map((a) => `- ${a.id} [risco ${a.risco}] (${resumoParams(a.params)}): ${a.descricao}`).join("\n"),
      input_schema: {
        type: "object",
        properties: {
          acao: { type: "string", enum: acoesOrd.map((a) => a.id), description: "Id da ação." },
          params: { type: "object", description: "Parâmetros da ação escolhida." },
        },
        required: ["acao"],
      },
      eager_input_streaming: true,
    });
  }

  if (rotas.length > 0) {
    tools.push({
      name: "abrir_tela",
      description:
        "Abre uma tela do LavSync no navegador do usuário. Só passe unidade ou período para telas que os aceitam. Telas:\n" +
        ROTAS.map((r) => {
          const extras = [
            r.abas?.length ? `abas: ${r.abas.join(", ")}` : null,
            r.filtros?.unidade ? "aceita unidade" : null,
            r.filtros?.periodo ? `períodos: ${r.filtros.periodo.valores.join(", ")}` : null,
          ].filter(Boolean);
          return `- ${r.href}: ${r.rotulo}${extras.length ? ` (${extras.join("; ")})` : ""}`;
        }).join("\n"),
      input_schema: {
        type: "object",
        properties: {
          rota: { type: "string", enum: rotas },
          aba: { type: "string", description: "Aba da tela, quando ela tiver abas." },
          unidade: { type: "string", description: "Nome da unidade, só para telas que aceitam unidade." },
          periodo: { type: "string", enum: PERIODOS, description: "Só para telas que aceitam período." },
        },
        required: ["rota"],
      },
      eager_input_streaming: true,
    });
  }

  tools.push({
    name: "briefing",
    description: "Lê o briefing do dia e os alertas que o usuário ainda não viu (já filtrados pelo perfil dele).",
    input_schema: { type: "object", properties: {} },
    eager_input_streaming: true,
  });

  const atalhos = new Map<string, string>();
  for (const a of ATALHOS) {
    const id = a.candidatos.find((c) => consultas.has(c));
    if (!id) continue;
    const def = consultas.get(id)!;
    atalhos.set(a.nome, id);
    tools.push({
      name: a.nome,
      description: `Atalho para a consulta ${id}: ${def.descricao}`,
      input_schema: def.params,
      eager_input_streaming: true,
    });
  }

  montagemCache = { tools, consultas, acoes, atalhos };
  return montagemCache;
}

// ═══ Rótulos humanos para o evento `ferramenta` ═══

const ROTULO_MODULO: Record<string, string> = {
  vendas: "as vendas", painel: "o painel ao vivo", comparativo: "o comparativo", performance: "a performance",
  financeiro: "o financeiro", clientes: "os clientes", clube: "o Clube de Vantagens", fidelidade: "a fidelidade",
  xoclub: "o XÔ Club", manutencao: "a manutenção", tarefas: "as tarefas", rotinas: "as rotinas",
  agenda: "a agenda", marketing: "o marketing", integracoes: "as integrações", suporte: "o suporte",
  midia_indoor: "a mídia indoor",
};

function unidadeCitada(ctx: CtxClock, params: Record<string, unknown>): string | null {
  for (const v of Object.values(params)) {
    const vals = Array.isArray(v) ? v : [v];
    for (const x of vals) {
      if (typeof x !== "string") continue;
      const u = ctx.unidades.find((un) => un.id === x || norm(un.nome) === norm(x));
      if (u) return u.nome;
    }
  }
  return null;
}

function rotuloConsulta(ctx: CtxClock, def: DefConsulta | undefined, params: Record<string, unknown>): string {
  const u = unidadeCitada(ctx, params);
  if (u) return `Consultando o ${u}`;
  if (def && ROTULO_MODULO[def.modulo]) return `Consultando ${ROTULO_MODULO[def.modulo]}`;
  return "Consultando o sistema";
}

// ═══ Corte de frases para o TTS ═══

const MIN_FRASE = 25;
const FIM_FRASE = /^([\s\S]*?(?:[.!?…]+["'”»)]*(?=\s)|\n))/;

function limparParaFala(s: string): string {
  return s
    .replace(/[*_`#>]+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

class CortadorFrases {
  private buf = "";
  private acumulado = "";

  push(delta: string): string[] {
    this.buf += delta;
    return this.extrair(false);
  }

  flush(): string[] {
    return this.extrair(true);
  }

  private extrair(fim: boolean): string[] {
    const out: string[] = [];
    for (;;) {
      const m = FIM_FRASE.exec(this.buf);
      if (!m) break;
      this.buf = this.buf.slice(m[1].length);
      const pedaco = limparParaFala(m[1]);
      if (!pedaco) continue;
      this.acumulado = this.acumulado ? `${this.acumulado} ${pedaco}` : pedaco;
      if (this.acumulado.length >= MIN_FRASE) {
        out.push(this.acumulado);
        this.acumulado = "";
      }
    }
    if (fim) {
      const resto = limparParaFala(`${this.acumulado} ${this.buf}`);
      if (resto) out.push(resto);
      this.buf = "";
      this.acumulado = "";
    }
    return out;
  }
}

// ═══ Confirmação por voz ═══

// Sem "confirma"/"confirmado": são palavras que o PRÓPRIO CLOCK fala ao propor
// ("Confirma?"); o eco no alto-falante não pode virar confirmação.
const AFIRMACAO = /^(sim|sim senhor|confirmo|pode|pode sim|pode fazer|pode mandar|pode confirmar|pode ir|manda|manda ver|sim pode|sim pode fazer|sim confirmo|sim manda|confirmo sim)$/;
const NEGACAO = /^(nao|nao confirmo|nao quero|nao precisa|cancela|cancelar|cancele|pode cancelar|esquece|deixa pra la)$/;

function normalizarResposta(t: string): string {
  return norm(t)
    .replace(/[^a-z\s]/g, " ")
    .replace(/\b(clock|por favor|obrigado|obrigada)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type AcaoRow = {
  id: string; acao: string; resumo: string | null; status: string;
  resultado: unknown; criado_em: string; decidido_em: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ABRE_DADOS = "<dados_ferramenta>";
const FECHA_DADOS = "</dados_ferramenta>";

/** Resultado de consulta é DADO: vai delimitado e sem como fechar o delimitador por dentro. */
function comoDados(json: string): string {
  return `${ABRE_DADOS}\n${json.replace(/<\/?\s*dados_ferramenta\s*>/gi, "")}\n${FECHA_DADOS}`;
}

/** Marca sem aspas: o histórico é comparado já serializado em JSON. */
const MARCA_RELATO = (id: string) => `[acao ${id}]`;

function relatoAcao(a: { id: string; resumo: string | null; status: string; resultado: unknown }, origem: string): string {
  const como = a.status === "expirada"
    ? "expirou sem decisão do usuário"
    : `decidido pelo usuário ${origem === "voz" ? "com resposta por voz" : "no cartão"}`;
  const res = a.resultado === undefined || a.resultado === null ? "" : `\nResultado: ${JSON.stringify(a.resultado).slice(0, 2000)}`;
  return `<resultado_acao>\n${MARCA_RELATO(a.id)} status ${a.status}, ${como}.\n${a.resumo ?? ""}${res}\n</resultado_acao>`;
}

// ═══ SSE ═══

type Emissor = { enviar(evento: string, dados: unknown): void; fechar(): void };

function criarEmissor(controller: ReadableStreamDefaultController<Uint8Array>): Emissor {
  const enc = new TextEncoder();
  let fechado = false;
  return {
    enviar(evento, dados) {
      if (fechado) return;
      try {
        controller.enqueue(enc.encode(`event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`));
      } catch {
        fechado = true;
      }
    },
    fechar() {
      if (fechado) return;
      fechado = true;
      try { controller.close(); } catch { /* já fechado pelo cliente */ }
    },
  };
}

function respostaSSE(executar: (e: Emissor) => Promise<void>): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const e = criarEmissor(controller);
      try {
        await executar(e);
      } finally {
        e.fechar();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function mensagemErroApi(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "Minha chave de acesso está inválida. Pede para o Daniel conferir a ANTHROPIC_API_KEY.";
  if (e instanceof Anthropic.PermissionDeniedError) return "A conta da minha inteligência não tem acesso a esse modelo. Avisa o Daniel.";
  if (e instanceof Anthropic.RateLimitError) return "Estou no limite de requisições agora. Me dá uns segundos e tenta de novo.";
  if (e instanceof Anthropic.BadRequestError) return "Minha inteligência recusou a requisição. Já registrei o erro; tenta de novo em instantes.";
  if (e instanceof Anthropic.InternalServerError) return "O servidor da minha inteligência está sobrecarregado. Tenta de novo em instantes.";
  if (e instanceof Anthropic.APIConnectionError) return "Perdi a conexão com a minha inteligência. Tenta de novo.";
  if (e instanceof Anthropic.APIError) return `Deu um erro na minha inteligência (HTTP ${e.status ?? "?"}). Tenta de novo em instantes.`;
  return "Tropecei num erro inesperado aqui. Tenta de novo?";
}

function comTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`tempo esgotado (${ms / 1000}s)`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (err) => { clearTimeout(t); reject(err); });
  });
}

function ehObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

// ═══ Handler ═══

export async function POST(req: NextRequest) {
  const ctx = await criarCtx();
  if (!ctx) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!podeUsarClock(ctx)) return NextResponse.json({ erro: "Seu perfil não tem acesso ao CLOCK. Fale com o Daniel." }, { status: 403 });

  let body: { sessao_id?: unknown; texto?: unknown; modo?: unknown; rota_atual?: unknown; acao_id?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }
  const texto = typeof body.texto === "string" ? body.texto.trim().slice(0, MAX_TEXTO_USUARIO) : "";
  if (!texto) return NextResponse.json({ erro: "texto vazio" }, { status: 400 });
  const modo: Modo = body.modo === "texto" ? "texto" : "voz";
  const rotaAtual = typeof body.rota_atual === "string" && body.rota_atual.startsWith("/") ? body.rota_atual.slice(0, 200) : null;
  const sessaoPedida = typeof body.sessao_id === "string" ? body.sessao_id : null;
  const acaoDoCartao = typeof body.acao_id === "string" && UUID.test(body.acao_id) ? body.acao_id : null;

  if (!process.env.ANTHROPIC_API_KEY) {
    return respostaSSE(async (e) => {
      e.enviar("erro", {
        mensagem: "Ainda não estou ligado na minha inteligência: falta configurar a chave ANTHROPIC_API_KEY na Vercel. Avisa o Daniel.",
      });
    });
  }

  return respostaSSE((e) => conversar(e, req.signal, ctx, { texto, modo, rotaAtual, sessaoPedida, acaoDoCartao }));
}

async function conversar(
  e: Emissor,
  signal: AbortSignal,
  ctx: CtxClock,
  entrada: { texto: string; modo: Modo; rotaAtual: string | null; sessaoPedida: string | null; acaoDoCartao: string | null },
): Promise<void> {
  const inicio = Date.now();
  const lim = LIMITES[entrada.modo];
  const montagem = montarFerramentas();

  // ─── Sessão (servidor guarda o histórico) ───
  let sessao = await abrirSessao(ctx, entrada.sessaoPedida);
  if (!sessao) {
    e.enviar("erro", { mensagem: "Não consegui abrir a conversa agora. Tenta de novo." });
    return;
  }
  let historico = (await carregarMensagens(ctx, sessao.id)) as BetaMessageParam[];
  if (historico.length > MAX_MENSAGENS_SESSAO) {
    const nova = await abrirSessao(ctx, null);
    if (nova) { sessao = nova; historico = []; }
  }
  e.enviar("sessao", { sessao_id: sessao.id });
  const sessaoId = sessao.id;

  // ─── Decisões humanas pendentes de relato + confirmação por voz ───
  const relatos: string[] = [];
  const historicoJson = JSON.stringify(historico);
  const { data: acoesSessao } = await ctx.sb
    .from("clock_acoes")
    .select("id, acao, resumo, status, resultado, criado_em, decidido_em")
    .eq("sessao_id", sessaoId)
    .eq("usuario_id", ctx.userId)
    .gte("criado_em", new Date(Date.now() - 24 * 3600_000).toISOString())
    .order("criado_em", { ascending: false })
    .limit(20);
  const acoes = (acoesSessao ?? []) as AcaoRow[];

  for (const a of acoes) {
    if (a.status !== "pendente" && !historicoJson.includes(MARCA_RELATO(a.id))) {
      relatos.push(relatoAcao(a, "cartao"));
    }
  }

  const abertas = acoes.filter((a) => a.status === "pendente");
  const pendentes = abertas.filter((a) => Date.now() - new Date(a.criado_em).getTime() < JANELA_CONFIRMACAO_MS);
  const resposta = normalizarResposta(entrada.texto);
  // O risco que decide é o do REGISTRO, nunca o que está gravado na linha.
  const riscoDe = (a: AcaoRow) => defAcao(a.acao)?.risco ?? "alto";
  let decidida: string | null = null;

  if (pendentes.length === 1) {
    const p = pendentes[0];
    // Só vale o "sim" que responde ao cartão desta ação (o front manda o id).
    const doCartao = entrada.acaoDoCartao === p.id;
    if (AFIRMACAO.test(resposta) && doCartao) {
      if (riscoDe(p) === "alto") {
        decidida = p.id; // continua pendente: o cartão segue aberto para o clique
        relatos.push(`<aviso_sistema>O usuário respondeu "${entrada.texto}" por voz, mas a ação pendente "${p.resumo ?? p.acao}" é de risco alto e só pode ser confirmada no cartão. Peça para tocar em Confirmar no cartão.</aviso_sistema>`);
      } else {
        decidida = p.id;
        e.enviar("ferramenta", { nome: "executar_acao", rotulo: "Executando a ação confirmada" });
        let r: { ok: boolean; resultado?: unknown; erro?: string };
        try {
          r = await executarAcaoPendente(ctx, p.id, { viaVoz: true });
        } catch (err) {
          r = { ok: false, erro: err instanceof Error ? err.message : String(err) };
        }
        const status = r.ok ? "executada" : "erro";
        e.enviar("acao_decidida", { acao_id: p.id, status });
        relatos.push(relatoAcao(
          { id: p.id, resumo: p.resumo, status, resultado: r.ok ? r.resultado ?? null : { erro: r.erro } },
          "voz",
        ));
      }
    } else if (NEGACAO.test(resposta) && doCartao) {
      decidida = p.id;
      const c = await cancelarAcaoPendente(ctx, p.id);
      if (c.ok) {
        e.enviar("acao_decidida", { acao_id: p.id, status: "cancelada" });
        relatos.push(relatoAcao({ id: p.id, resumo: p.resumo, status: "cancelada", resultado: null }, "voz"));
      }
    } else if (AFIRMACAO.test(resposta) || NEGACAO.test(resposta)) {
      // Resposta de sim/não sem o cartão desta ação (fala sobreposta à voz do
      // CLOCK, ou cartão já fechado): não decide nem expira. Pede de novo.
      decidida = p.id;
      relatos.push(`<aviso_sistema>O usuário respondeu "${entrada.texto}", mas a resposta não veio ligada ao cartão da ação pendente "${p.resumo ?? p.acao}" (pode ter sido eco ou fala por cima). Nada foi executado. Peça para ele repetir com o cartão aberto ou tocar em Confirmar ou Cancelar.</aviso_sistema>`);
    }
  }

  // Qualquer outra fala encerra as pendentes de risco baixo/médio: um "sim"
  // posterior a OUTRA pergunta nunca pode executar a ação antiga. Risco alto
  // fica viva (só o clique no cartão a confirma) até o prazo de 10 minutos.
  if (abertas.length > 0) {
    const manter = abertas
      .filter((a) => a.id === decidida || (riscoDe(a) === "alto" && pendentes.includes(a)))
      .map((a) => a.id);
    const expiradas = await expirarPendentes(ctx, sessaoId, "o usuário seguiu a conversa sem confirmar", manter);
    for (const id of expiradas) {
      const a = abertas.find((x) => x.id === id);
      e.enviar("acao_decidida", { acao_id: id, status: "expirada" });
      relatos.push(relatoAcao({ id, resumo: a?.resumo ?? null, status: "expirada", resultado: null }, "voz"));
    }
  }

  // ─── Mensagem do usuário: <contexto> (volátil) + relatos + fala ───
  const todasUnidades = await usuarioVeTodasUnidades(ctx);
  const blocosUsuario: BetaContentBlockParam[] = [
    {
      type: "text",
      text: montarContexto({
        nome: ctx.nome, papel: ctx.papel, unidades: ctx.unidades, todasUnidades,
        rotaAtual: entrada.rotaAtual, modo: entrada.modo,
      }),
    },
  ];
  if (relatos.length > 0) blocosUsuario.push({ type: "text", text: relatos.join("\n") });
  // O texto do usuário nunca pode se passar por bloco do sistema.
  blocosUsuario.push({ type: "text", text: entrada.texto.replace(/<\/?\s*(contexto|resultado_acao|aviso_sistema|dados_ferramenta)[^>]*>/gi, "") });

  const novas: BetaMessageParam[] = [{ role: "user", content: blocosUsuario }];

  // ─── Loop agêntico ───
  const client = new Anthropic();
  let usarBetas = betasLigados();
  let reiniciouSessao = false;
  let textoTurno = "";
  let faladoIteracao = "";
  let encerrado = false;
  let abortado = false;
  let sessaoAtual = sessaoId;

  const cortador = new CortadorFrases();
  const emitirFrases = (fs: string[]) => { for (const f of fs) e.enviar("frase", { texto: f }); };
  const falar = (t: string) => {
    const sep = textoTurno && !/\s$/.test(textoTurno) ? " " : "";
    e.enviar("texto", { delta: sep + t });
    textoTurno += sep + t;
    emitirFrases(cortador.push(sep + t));
    emitirFrases(cortador.flush());
  };

  const montarParams = (): Record<string, unknown> => ({
    model: MODELO_CLOCK,
    max_tokens: lim.maxTokens,
    thinking: usarBetas
      ? { type: "adaptive", display: "updates", block_binding: { prefix_mismatch_behavior: "drop_block" } }
      : { type: "adaptive" },
    output_config: { effort: lim.effort },
    system: [{ type: "text", text: PERSONA_SISTEMA, cache_control: { type: "ephemeral" } }],
    tools: montagem.tools,
    cache_control: { type: "ephemeral" },
    messages: [...historico, ...novas],
    ...(usarBetas ? { betas: [...BETAS_CLOCK], fallbacks: "default" } : {}),
  });

  /** Roda uma chamada em streaming, emitindo texto/frases. Devolve a mensagem final. */
  const rodarIteracao = async (): Promise<BetaMessage> => {
    // Repete no máximo duas vezes: sem betas, depois em sessão nova (cada flag vira uma vez só).
    for (;;) {
      let emitiu = false;
      faladoIteracao = "";
      const stream = client.beta.messages.stream(
        montarParams() as unknown as Parameters<typeof client.beta.messages.stream>[0],
        { signal },
      );
      try {
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            emitiu = true;
            faladoIteracao += ev.delta.text;
            textoTurno += ev.delta.text;
            e.enviar("texto", { delta: ev.delta.text });
            emitirFrases(cortador.push(ev.delta.text));
          }
        }
        return await stream.finalMessage();
      } catch (err) {
        if (err instanceof Anthropic.APIUserAbortError || signal.aborted) throw err;
        // Degradação: 400 antes de qualquer saída → tira os betas; persistindo
        // (histórico inconsistente), recomeça numa sessão nova.
        if (!emitiu && err instanceof Anthropic.BadRequestError) {
          if (usarBetas) {
            console.warn("[clock/chat] 400 com betas; repetindo sem betas:", err.message);
            usarBetas = false;
            continue;
          }
          if (!reiniciouSessao && historico.length > 0) {
            console.warn("[clock/chat] 400 com histórico; abrindo sessão nova:", err.message);
            const nova = await abrirSessao(ctx, null);
            if (nova) {
              reiniciouSessao = true;
              sessaoAtual = nova.id;
              historico = [];
              e.enviar("sessao", { sessao_id: nova.id });
              continue;
            }
          }
        }
        throw err;
      }
    }
  };

  try {
    for (let i = 0; i < lim.iteracoes && !encerrado; i++) {
      if (Date.now() - inicio > TETO_TURNO_MS) {
        falar("Essa análise está levando tempo demais. Quer que eu continue por partes?");
        encerrado = true;
        break;
      }

      const msg = await rodarIteracao();
      emitirFrases(cortador.flush());
      const toolUses = msg.content.filter((b): b is BetaToolUseBlock => b.type === "tool_use");

      switch (msg.stop_reason) {
        case "tool_use": {
          novas.push({ role: "assistant", content: msg.content as BetaContentBlockParam[] });
          const resultados = await Promise.all(toolUses.map((t) => executarFerramenta(t, ctx, sessaoAtual, montagem, e)));
          novas.push({ role: "user", content: resultados });
          continue;
        }
        case "pause_turn": {
          // Turno pausado pelo servidor: reenvia com o conteúdo parcial anexado.
          novas.push({ role: "assistant", content: msg.content as BetaContentBlockParam[] });
          continue;
        }
        case "max_tokens": {
          novas.push({ role: "assistant", content: somenteTexto(msg.content, faladoIteracao) });
          falar("Ficou longo demais para uma resposta só. Quer que eu resuma?");
          encerrado = true;
          break;
        }
        case "refusal": {
          console.warn("[clock/chat] recusa:", msg.stop_details?.category ?? "sem categoria");
          novas.push({ role: "assistant", content: somenteTexto(msg.content, faladoIteracao) });
          falar("Essa eu não consigo responder. Tenta perguntar de outro jeito?");
          encerrado = true;
          break;
        }
        default: {
          // end_turn / stop_sequence: resposta final.
          novas.push({ role: "assistant", content: msg.content as BetaContentBlockParam[] });
          encerrado = true;
        }
      }
    }
    if (!encerrado) {
      falar("Essa ficou grande demais para uma resposta só. Quebra a pergunta em partes menores para mim?");
    }
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError || signal.aborted) {
      abortado = true;
      // Interrompido (barge-in): guarda só o que já foi falado, sem thinking parcial.
      if (faladoIteracao.trim()) novas.push({ role: "assistant", content: [{ type: "text", text: faladoIteracao.trim() }] });
      novas.push({ role: "user", content: [{ type: "text", text: "<contexto>\nA resposta anterior do CLOCK foi interrompida pelo usuário neste ponto.\n</contexto>" }] });
    } else {
      console.error("[clock/chat]", err);
      e.enviar("erro", { mensagem: mensagemErroApi(err) });
    }
  }

  // ─── Persistência append-only ───
  try {
    // Só user/assistant são gravados (o turno nunca cria mensagem de sistema).
    const paraGravar = garantirSequenciaValida(novas).map((m) => ({ role: m.role === "assistant" ? "assistant" as const : "user" as const, content: m.content }));
    await anexarMensagens(ctx, sessaoAtual, paraGravar);
  } catch (err) {
    console.error("[clock/chat] falha ao persistir a sessão", err);
  }

  if (!abortado) {
    emitirFrases(cortador.flush());
    e.enviar("fim", { texto: textoTurno.trim() });
  }
}

/**
 * Se o turno terminou no meio (erro), não pode ficar tool_use sem tool_result
 * no histórico: corta a sequência no último ponto consistente.
 */
function garantirSequenciaValida(msgs: BetaMessageParam[]): BetaMessageParam[] {
  const out = [...msgs];
  const ultima = out[out.length - 1];
  if (ultima?.role === "assistant" && Array.isArray(ultima.content) && ultima.content.some((b) => b.type === "tool_use")) {
    out.pop();
  }
  return out;
}

/** Conteúdo só-texto (sem thinking/tool_use) para turnos cortados. */
function somenteTexto(content: BetaContentBlock[], falado: string): BetaContentBlockParam[] {
  const t = content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim() || falado.trim();
  return [{ type: "text", text: t || "(resposta interrompida)" }];
}

// ═══ Execução das ferramentas ═══

async function executarFerramenta(
  t: BetaToolUseBlock,
  ctx: CtxClock,
  sessaoId: string,
  m: Montagem,
  e: Emissor,
): Promise<BetaToolResultBlockParam> {
  const erro = (msg: string): BetaToolResultBlockParam => ({
    type: "tool_result", tool_use_id: t.id, is_error: true, content: JSON.stringify({ erro: msg }),
  });
  const ok = (conteudo: string): BetaToolResultBlockParam => ({
    type: "tool_result", tool_use_id: t.id, content: conteudo.slice(0, MAX_RESULTADO_CHARS),
  });

  // eager_input_streaming: o input não é validado pela API — validamos aqui.
  if (!ehObjeto(t.input)) return erro("INVALID_JSON: o input da ferramenta precisa ser um objeto JSON.");
  const input = t.input;

  try {
    switch (t.name) {
      case "consultar": {
        const id = input.consulta;
        const def = typeof id === "string" ? m.consultas.get(id) : undefined;
        if (!def) return erro(`consulta desconhecida. Use um destes ids: ${[...m.consultas.keys()].join(", ")}`);
        const params = ehObjeto(input.params) ? input.params : {};
        e.enviar("ferramenta", { nome: t.name, rotulo: rotuloConsulta(ctx, def, params) });
        return ok(comoDados(await comTimeout(rodarConsulta(ctx, def.id, params), TIMEOUT_FERRAMENTA_MS)));
      }

      case "executar_acao": {
        const id = input.acao;
        const def = typeof id === "string" ? m.acoes.get(id) : undefined;
        if (!def) return erro(`ação desconhecida. Use um destes ids: ${[...m.acoes.keys()].join(", ")}`);
        const params = ehObjeto(input.params) ? input.params : {};
        e.enviar("ferramenta", { nome: t.name, rotulo: "Preparando a ação" });
        const r = await comTimeout(proporAcao(ctx, sessaoId, def.id, params), TIMEOUT_FERRAMENTA_MS);
        if ("erro" in r) return erro(String(r.erro));
        e.enviar("confirmacao", { acao_id: r.acao_id, resumo: r.resumo, risco: r.risco });
        return ok(JSON.stringify({
          status: "aguardando_confirmacao",
          acao_id: r.acao_id,
          resumo: r.resumo,
          risco: r.risco,
          instrucao: r.risco === "alto"
            ? "Diga o resumo e peça para confirmar tocando no cartão. Não diga que executou."
            : "Diga o resumo e pergunte \"Confirma?\". Não diga que executou.",
        }));
      }

      case "abrir_tela":
        return ok(JSON.stringify(abrirTela(ctx, input, e)));

      case "briefing": {
        e.enviar("ferramenta", { nome: t.name, rotulo: "Lendo o briefing do dia" });
        const n = await comTimeout(lerNovidades(ctx), TIMEOUT_FERRAMENTA_MS);
        if (!n.briefing && n.alertas.length === 0) return ok(JSON.stringify({ vazio: true, mensagem: "Nenhuma novidade não vista." }));
        return ok(comoDados(JSON.stringify(n)));
      }

      default: {
        const idAtalho = m.atalhos.get(t.name);
        if (!idAtalho) return erro(`ferramenta desconhecida: ${t.name}`);
        e.enviar("ferramenta", { nome: t.name, rotulo: rotuloConsulta(ctx, m.consultas.get(idAtalho), input) });
        return ok(comoDados(await comTimeout(rodarConsulta(ctx, idAtalho, input), TIMEOUT_FERRAMENTA_MS)));
      }
    }
  } catch (err) {
    return erro(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Valida rota, permissão, aba, unidade e período; emite `nav` e responde na
 * hora. Só grava na URL os filtros que a tela declara ler (DefRota.filtros);
 * o resto volta em `avisos` para o CLOCK não afirmar que filtrou.
 */
function abrirTela(ctx: CtxClock, input: Record<string, unknown>, e: Emissor): Record<string, unknown> {
  const rota = ROTAS.find((r) => r.href === input.rota);
  if (!rota) return { ok: false, erro: "rota desconhecida" };
  if (!temPermissao(ctx, rota.permissao)) return { ok: false, erro: "sem_permissao", permissao: rota.permissao };

  const qs = new URLSearchParams();
  const ignorados: string[] = [];

  if (typeof input.aba === "string" && input.aba) {
    const aba = rota.abas?.find((a) => norm(a) === norm(String(input.aba)));
    if (aba) qs.set(rota.paramAba ?? "aba", aba);
    else ignorados.push(`aba "${input.aba}" não existe nessa tela`);
  }
  if (typeof input.unidade === "string" && input.unidade) {
    const alvo = norm(String(input.unidade));
    const u = ctx.unidades.find((un) => un.id === input.unidade || norm(un.nome) === alvo || norm(un.nome).includes(alvo));
    if (!u) ignorados.push(`unidade "${input.unidade}" não está liberada para este usuário`);
    else if (!rota.filtros?.unidade) ignorados.push(`a tela ${rota.rotulo} não filtra por unidade; abriu sem filtro`);
    else qs.set(rota.filtros.unidade, u.id);
  }
  if (typeof input.periodo === "string" && input.periodo) {
    const per = rota.filtros?.periodo;
    if (!per) ignorados.push(`a tela ${rota.rotulo} não filtra por período; abriu no período padrão dela`);
    else if (!per.valores.includes(input.periodo)) ignorados.push(`período "${input.periodo}" não existe nessa tela (aceita: ${per.valores.join(", ")})`);
    else qs.set(per.param, input.periodo);
  }

  const q = qs.toString();
  const href = q ? `${rota.href}?${q}` : rota.href;
  e.enviar("ferramenta", { nome: "abrir_tela", rotulo: `Abrindo ${rota.rotulo}` });
  e.enviar("nav", { href, rotulo: rota.rotulo });
  return { ok: true, aberta: href, ...(ignorados.length ? { avisos: ignorados } : {}) };
}

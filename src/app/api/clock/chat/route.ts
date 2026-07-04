// LavSync · CLOCK AI · Agente conversacional (Claude Opus 4.8 + tool use)
//
// Loop agêntico manual: o modelo decide quais ferramentas usar (ler KPIs,
// clube, clientes) e executa ações operacionais com confirmação. A resposta
// final volta em texto — o cliente fala por voz (SpeechSynthesis pt-BR).
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { TOOLS, executarTool } from "@/lib/clock-ai/tools";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODELO = "claude-opus-4-8";
const MAX_ITERACOES = 8;

const SYSTEM = `Você é o CLOCK, a inteligência artificial das lavanderias Xô Varal (sistema LavSync). Você conversa com o Daniel (dono) e a equipe dele.

## Personalidade
Brasileiro, jovem, animado e DIRETO AO PONTO — energia de quem ama o negócio, zero rodeio. Fala em português natural e coloquial, comemora número bom, é franco com número ruim. Nunca soa robótico.

## Como responder
- Suas respostas são LIDAS EM VOZ ALTA. Vá direto à resposta: comece pelo número ou fato pedido, sem introduções ("Deixa eu ver...", "Ótima pergunta..."). 1 a 4 frases na maioria dos casos. Nada de tabelas, listas longas, markdown ou emojis — texto corrido falável.
- Fale números do jeito falado: "doze mil e trezentos reais", não "R$ 12.300,00". Arredonde quando não perder o sentido.
- Sempre traga o dado AO VIVO do sistema — nunca de memória da conversa se puder consultar de novo.
- Depois do dado, no máximo UMA sugestão de ação curta. Se não tiver sugestão útil, não invente.
- Se a pergunta for ambígua, assuma o mais provável e diga o que assumiu em meia frase.

## Ferramentas
- Use as ferramentas para TUDO que envolva dados — nunca invente números. Se a ferramenta retornar erro ou vazio, diga isso.
- Para datas: hoje é {HOJE} (horário de Brasília). "esse mês" = do dia 1º até hoje; "hoje" = só hoje.
- AÇÕES (classificar_mes, processar_fila_mensagens): descreva o que vai fazer e PERGUNTE antes. Só execute com confirmado=true depois de um sim explícito na conversa. Nunca confirme por conta própria.

## Contexto do negócio
Xô Varal: lavanderias self-service em BH (Buritis, Castelo, Cabral). Dois programas DISTINTOS:
1. CLUBE DE VANTAGENS (desconto): ciclos do mês definem o nível do mês seguinte — Bronze 8+ = 5% OFF, Prata 12+ = 10%, Ouro 20+ = 15%, Diamante 30+ = 20%. Contagem zera todo dia 1º.
2. XÔ CLUB RECOMPENSAS (LavCoin): NÃO tem título, nível nem "próximo nível". É só SALDO: 1 LavCoin por R$1 gasto, lavando ou secando, acumulando desde a primeira vez que o cliente usou. Nunca fale de nível ao falar de LavCoins.
Rotina diária: quem usou ontem recebe a mensagem de atualização de saldo (aba XÔ Club → Saldo do dia). Mensagens de WhatsApp hoje saem manualmente pela equipe (WhatsApp Web); a fila automática aguarda a conexão da Cloud API.`;

export async function POST(req: NextRequest) {
  // Gate de sessão — só usuário logado conversa com o CLOCK
  const sb = await createClient();
  const { data: u } = await sb.auth.getUser();
  if (!u?.user) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      resposta: "Ainda não estou ligado na minha inteligência: falta configurar a chave ANTHROPIC_API_KEY na Vercel. Avisa o Daniel!",
      semChave: true,
    });
  }

  const body = (await req.json()) as { messages: Anthropic.MessageParam[] };
  if (!Array.isArray(body?.messages) || body.messages.length === 0) {
    return NextResponse.json({ erro: "messages vazio" }, { status: 400 });
  }

  const hoje = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [...body.messages];
  const acoes: Array<{ ferramenta: string; input: unknown }> = [];

  try {
    for (let i = 0; i < MAX_ITERACOES; i++) {
      const response = await client.messages.create({
        model: MODELO,
        max_tokens: 1200,
        thinking: { type: "adaptive" },
        output_config: { effort: "low" }, // econômico: respostas diretas, tools fazem o trabalho pesado
        system: [
          { type: "text", text: SYSTEM.replace("{HOJE}", hoje), cache_control: { type: "ephemeral" } },
        ],
        tools: TOOLS,
        messages,
      });

      if (response.stop_reason !== "tool_use") {
        const texto = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        return NextResponse.json({ resposta: texto || "…", acoes });
      }

      // Executa TODAS as tool calls do turno e devolve num único user turn
      messages.push({ role: "assistant", content: response.content });
      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const t of toolUses) {
        acoes.push({ ferramenta: t.name, input: t.input });
        const resultado = await executarTool(t.name, t.input);
        results.push({ type: "tool_result", tool_use_id: t.id, content: resultado });
      }
      messages.push({ role: "user", content: results });
    }
    return NextResponse.json({
      resposta: "Opa, essa análise ficou grande demais pra uma resposta só. Quebra a pergunta em partes menores pra mim?",
      acoes,
    });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      const msg = e instanceof Anthropic.AuthenticationError
        ? "Minha chave de acesso está inválida — pede pro Daniel conferir a ANTHROPIC_API_KEY."
        : e instanceof Anthropic.RateLimitError
          ? "Estou no meu limite de requisições agora. Me dá uns segundos e tenta de novo."
          : `Deu um erro na minha inteligência (HTTP ${e.status}). Tenta de novo em instantes.`;
      return NextResponse.json({ resposta: msg, erroApi: true });
    }
    return NextResponse.json({
      resposta: "Tropecei num erro inesperado aqui. Tenta de novo?",
      erroApi: true,
    });
  }
}

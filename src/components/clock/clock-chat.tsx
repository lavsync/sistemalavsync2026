"use client";

// LavSync · CLOCK v2 · Conversa (view)
//
// Só desenha o estado do ClockProvider (useClock): a conversa, o microfone e
// o alto-falante vivem no provider e no motor de voz (src/lib/clock-voz), por
// isso rail desktop, sheet mobile e /clock mostram a MESMA conversa e trocar
// de rota não corta o CLOCK no meio da frase.
//
// O que aparece aqui:
//   • legenda em streaming da resposta (texto chega pelo SSE antes do áudio);
//   • indicador ouvindo / pensando / falando, com a ferramenta em uso;
//   • transcrição parcial do que o usuário está dizendo;
//   • card de confirmação de ação (Confirmar / Cancelar) — ação só roda com
//     decisão explícita;
//   • botão grande de microfone (com medidor de nível) e de interromper;
//   • entrada de texto.
// Interromper: em full-duplex basta falar; em half-duplex, botão, toque ou Esc.
import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight, Loader2, Mic, MicOff, RotateCcw, Send, ShieldAlert, Sparkles, Square,
  Volume2, VolumeX, Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClock, type EstadoClock, type MensagemClock, type RiscoAcao } from "@/components/clock/clock-provider";

const SUGESTOES = [
  "Como foram as vendas de hoje?",
  "E ontem, como foi?",
  "Situação do clube este mês",
  "Quem está quase no Bronze?",
  "Clientes parados há 30 dias",
];

const ROTULO_ESTADO: Record<EstadoClock, string> = {
  ocioso: "Pronto",
  ouvindo: "Ouvindo",
  pensando: "Pensando",
  falando: "Falando",
};

const ROTULO_RISCO: Record<RiscoAcao, string> = {
  baixo: "Risco baixo",
  medio: "Risco médio",
  alto: "Risco alto",
};

// ─── Indicador de estado ────────────────────────────────────────────────────

function IndicadorEstado({ estado }: { estado: EstadoClock }) {
  return (
    <span className="relative inline-flex w-2.5 h-2.5 shrink-0" aria-hidden>
      {estado !== "ocioso" && (
        <span
          className={cn(
            "absolute inset-0 rounded-full animate-ping opacity-60",
            estado === "ouvindo" && "bg-danger",
            estado === "pensando" && "bg-warning",
            estado === "falando" && "bg-brand-cyan",
          )}
        />
      )}
      <span
        className={cn(
          "relative inline-flex w-2.5 h-2.5 rounded-full",
          estado === "ocioso" && "bg-muted-foreground/50",
          estado === "ouvindo" && "bg-danger",
          estado === "pensando" && "bg-warning",
          estado === "falando" && "bg-brand-cyan",
        )}
      />
    </span>
  );
}

// ─── Mensagem ───────────────────────────────────────────────────────────────

function Bolha({ m }: { m: MensagemClock }) {
  const doUsuario = m.role === "user";
  return (
    <div className={cn("flex flex-col gap-1", doUsuario ? "items-end" : "items-start")}>
      {!doUsuario && !!m.ferramentas?.length && (
        <div className="flex flex-wrap gap-1 max-w-[85%]">
          {m.ferramentas.map((f, i) => (
            <span key={`${f}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/60 text-[10.5px] text-muted-foreground">
              <Wrench className="w-3 h-3" /> {f}
            </span>
          ))}
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words",
          doUsuario
            ? "bg-gradient-to-r from-brand-cyan to-brand-blue text-white rounded-br-sm"
            : m.erro
              ? "bg-danger/10 text-danger border border-danger/20 rounded-bl-sm"
              : m.aviso
                ? "bg-secondary/40 text-muted-foreground border border-border rounded-bl-sm"
                : "bg-secondary/60 rounded-bl-sm",
        )}
      >
        {m.texto}
        {m.parcial && (
          <span className="inline-block w-1.5 h-3.5 ml-0.5 align-[-2px] bg-current opacity-60 animate-pulse" aria-hidden />
        )}
        {m.parcial && !m.texto && <span className="text-muted-foreground">…</span>}
      </div>
      {!doUsuario && !!m.navegacoes?.length && (
        <div className="flex flex-wrap gap-1 max-w-[85%]">
          {m.navegacoes.map((n, i) => (
            <Link
              key={`${n.href}-${i}`}
              href={n.href}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-brand-cyan/30 text-brand-cyan text-[10.5px] font-semibold hover:bg-brand-cyan/10 transition-smooth"
            >
              {n.rotulo} <ArrowUpRight className="w-3 h-3" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Card de confirmação ────────────────────────────────────────────────────

function CardConfirmacao() {
  const { acaoPendente, confirmarAcao, cancelarAcao } = useClock();
  if (!acaoPendente) return null;
  const decidindo = acaoPendente.status === "decidindo";
  return (
    <div
      role="alertdialog"
      aria-label="Confirmação de ação do CLOCK"
      className={cn(
        "mx-4 mb-2 rounded-xl border p-3 bg-card shadow-sm",
        acaoPendente.risco === "alto" ? "border-danger/40" : acaoPendente.risco === "medio" ? "border-warning/40" : "border-brand-cyan/30",
      )}
    >
      <div className="flex items-start gap-2">
        <ShieldAlert
          className={cn(
            "w-4 h-4 mt-0.5 shrink-0",
            acaoPendente.risco === "alto" ? "text-danger" : acaoPendente.risco === "medio" ? "text-warning" : "text-brand-cyan",
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold">Confirma esta ação?</span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                acaoPendente.risco === "alto" ? "bg-danger/10 text-danger" : acaoPendente.risco === "medio" ? "bg-warning/10 text-warning" : "bg-brand-cyan/10 text-brand-cyan",
              )}
            >
              {ROTULO_RISCO[acaoPendente.risco]}
            </span>
          </div>
          <p className="text-[12.5px] leading-relaxed mt-1 text-foreground/90">{acaoPendente.resumo}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => void confirmarAcao()}
          disabled={decidindo}
          className="flex-1 h-9 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-blue text-white text-[12.5px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 hover:opacity-90 transition-smooth"
        >
          {decidindo && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Confirmar
        </button>
        <button
          onClick={() => void cancelarAcao()}
          disabled={decidindo}
          className="flex-1 h-9 rounded-lg border border-border bg-secondary/50 text-[12.5px] font-semibold disabled:opacity-50 hover:bg-secondary transition-smooth"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Botão de microfone com medidor de nível ────────────────────────────────

function BotaoMicrofone({ grande }: { grande: boolean }) {
  const { estado, ouvir, pararDeOuvir, assinarNivelMic, vozDisponivel } = useClock();
  const anelRef = React.useRef<HTMLSpanElement>(null);
  const ouvindo = estado === "ouvindo";

  // nível do mic direto no DOM (sem re-render a cada quadro)
  React.useEffect(() => {
    if (!ouvindo) {
      if (anelRef.current) anelRef.current.style.transform = "scale(1)";
      return;
    }
    return assinarNivelMic((nivel) => {
      if (anelRef.current) anelRef.current.style.transform = `scale(${1 + nivel * 0.45})`;
    });
  }, [ouvindo, assinarNivelMic]);

  const tamanho = grande ? "w-14 h-14" : "w-11 h-11";
  return (
    <button
      onClick={() => (ouvindo ? pararDeOuvir() : ouvir())}
      disabled={!vozDisponivel}
      title={ouvindo ? "Parar de ouvir" : "Falar com o CLOCK"}
      aria-pressed={ouvindo}
      className={cn("relative rounded-full flex items-center justify-center shrink-0 disabled:opacity-40", tamanho)}
    >
      <span
        ref={anelRef}
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full transition-transform duration-75",
          ouvindo ? "bg-danger/25" : "bg-transparent",
        )}
      />
      <span
        className={cn(
          "relative rounded-full flex items-center justify-center text-white transition-smooth",
          tamanho,
          ouvindo ? "bg-danger" : "bg-gradient-to-br from-brand-cyan to-brand-blue hover:opacity-90",
        )}
      >
        {ouvindo ? <MicOff className={grande ? "w-6 h-6" : "w-5 h-5"} /> : <Mic className={grande ? "w-6 h-6" : "w-5 h-5"} />}
      </span>
    </button>
  );
}

// ─── Componente ─────────────────────────────────────────────────────────────

export function ClockChat({ embutido = false }: { embutido?: boolean }) {
  const {
    mensagens, estado, ferramentaAtual, transcricaoParcial, acaoPendente,
    vozLigada, vozDisponivel, modoDuplex, enviar, interromper, alternarVoz, novaConversa,
  } = useClock();
  const [texto, setTexto] = React.useState("");
  const fimRef = React.useRef<HTMLDivElement>(null);

  const pensando = estado === "pensando";
  const falando = estado === "falando";
  const ouvindo = estado === "ouvindo";
  const ocupado = pensando || falando;

  const ultima = mensagens[mensagens.length - 1];
  React.useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensagens.length, ultima?.texto, transcricaoParcial, acaoPendente?.acao_id]);

  // Esc corta também o "pensando" (o motor já trata o Esc durante a fala)
  React.useEffect(() => {
    if (!pensando) return;
    const tecla = (ev: KeyboardEvent) => { if (ev.key === "Escape") interromper(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [pensando, interromper]);

  function mandar(t: string) {
    const limpo = t.trim();
    if (!limpo) return;
    setTexto("");
    enviar(limpo, "texto");
  }

  const legendaEstado = ouvindo
    ? "Ouvindo você"
    : pensando
      ? ferramentaAtual ?? "Pensando"
      : falando
        ? modoDuplex === "full-duplex"
          ? "Falando. Pode falar por cima para interromper"
          : "Falando. Toque em Interromper ou aperte Esc"
        : "Dados ao vivo por voz ou texto";

  return (
    <div
      className={cn(
        "bg-card overflow-hidden flex flex-col",
        embutido ? "h-full min-h-0" : "rounded-2xl border border-brand-cyan/30",
      )}
      style={embutido ? undefined : { height: 620 }}
    >
      {/* Cabeçalho */}
      <div className="px-5 py-3.5 border-b border-border bg-gradient-to-r from-brand-cyan/10 to-brand-blue/10 flex items-center gap-3">
        <div
          className={cn(
            "w-9 h-9 rounded-full bg-gradient-to-br from-brand-cyan to-brand-blue flex items-center justify-center text-white shrink-0",
            ocupado && "animate-pulse",
          )}
        >
          <Sparkles className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-[14px]">CLOCK</span>
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-muted-foreground" aria-live="polite">
              <IndicadorEstado estado={estado} /> {ROTULO_ESTADO[estado]}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground truncate">{legendaEstado}</div>
        </div>
        <button
          onClick={novaConversa}
          title="Nova conversa"
          className="p-2 rounded-md text-muted-foreground hover:bg-secondary/60 transition-smooth"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={alternarVoz}
          title={vozLigada ? "Desligar respostas por voz" : "Ligar respostas por voz"}
          aria-pressed={vozLigada}
          className={cn(
            "p-2 rounded-md transition-smooth",
            vozLigada ? "text-brand-cyan bg-brand-cyan/10" : "text-muted-foreground bg-secondary/50",
          )}
        >
          {vozLigada ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      {/* Conversa */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 custom-scroll-thin" aria-live="polite">
        {mensagens.length === 0 && !ouvindo && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3">
            <div className="text-[13px] text-muted-foreground max-w-sm">
              Sou o CLOCK. Pergunte por voz ou por texto: eu leio o sistema ao vivo, abro as telas
              e preparo ações para você confirmar.
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 max-w-sm">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => mandar(s)}
                  className="px-2.5 py-1 rounded-full border border-brand-cyan/30 text-brand-cyan text-[10.5px] font-semibold hover:bg-brand-cyan/10 transition-smooth"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensagens.map((m) => <Bolha key={m.id} m={m} />)}

        {ouvindo && (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-[13px] leading-relaxed border border-dashed border-brand-cyan/40 text-muted-foreground italic">
              {transcricaoParcial || "Pode falar…"}
            </div>
          </div>
        )}

        {pensando && ultima?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-secondary/60 px-3.5 py-2.5 inline-flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> {ferramentaAtual ?? "Pensando"}
            </div>
          </div>
        )}
        <div ref={fimRef} />
      </div>

      <CardConfirmacao />

      {/* Controles de voz */}
      <div className="px-4 pt-2 flex items-center justify-center gap-3">
        <BotaoMicrofone grande={!embutido} />
        {ocupado && (
          <button
            onClick={interromper}
            title="Interromper (Esc)"
            className="h-11 px-4 rounded-full border border-border bg-secondary/60 hover:bg-secondary text-[12.5px] font-semibold inline-flex items-center gap-2 transition-smooth"
          >
            <Square className="w-3.5 h-3.5 fill-current" /> Interromper
          </button>
        )}
      </div>
      {!vozDisponivel && (
        <p className="px-4 pt-1 text-center text-[10.5px] text-muted-foreground">Voz carregando ou indisponível neste navegador. O texto funciona normalmente.</p>
      )}

      {/* Texto */}
      <form
        className="px-4 py-3 mt-2 border-t border-border flex items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); mandar(texto); }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={ouvindo ? "Ouvindo… ou digite aqui" : "Pergunte ao CLOCK…"}
          className="form-input flex-1 h-10 text-[13px]"
          aria-label="Mensagem para o CLOCK"
        />
        <button
          type="submit"
          disabled={!texto.trim()}
          title="Enviar"
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-cyan to-brand-blue text-white flex items-center justify-center shrink-0 disabled:opacity-40 hover:opacity-90 transition-smooth"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

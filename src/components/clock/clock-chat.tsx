"use client";

// LavSync · CLOCK AI · Chat com voz
//
// Entrada: texto ou microfone (Web Speech API, pt-BR).
// Saída: texto + fala (SpeechSynthesis, melhor voz pt-BR disponível,
// levemente acelerada e aguda = jovem/animada). Sem dependências externas.
import * as React from "react";
import { Mic, MicOff, Send, Volume2, VolumeX, Loader2, Sparkles, Square } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUGESTOES = [
  "Como foram as vendas de hoje?",
  "Qual a situação do clube este mês?",
  "Quem está quase chegando no Bronze?",
  "Me lista clientes parados há 30 dias",
];

// ─── Voz (TTS) ──────────────────────────────────────────────────────────────
function escolherVozPtBr(): SpeechSynthesisVoice | null {
  const vozes = window.speechSynthesis?.getVoices() ?? [];
  const ptbr = vozes.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith("pt-br"));
  if (ptbr.length === 0) return vozes.find((v) => v.lang.toLowerCase().startsWith("pt")) ?? null;
  // preferência: vozes neurais/naturais conhecidas primeiro
  const ranking = ["luciana", "google", "felipe", "francisca", "microsoft"];
  ptbr.sort((a, b) => {
    const ra = ranking.findIndex((n) => a.name.toLowerCase().includes(n));
    const rb = ranking.findIndex((n) => b.name.toLowerCase().includes(n));
    return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb);
  });
  return ptbr[0];
}

function falar(texto: string, aoTerminar?: () => void) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  const voz = escolherVozPtBr();
  if (voz) u.voice = voz;
  u.lang = "pt-BR";
  u.rate = 1.08;   // levemente acelerado = animado
  u.pitch = 1.06;  // levemente agudo = jovem
  if (aoTerminar) u.onend = aoTerminar;
  synth.speak(u);
}

// ─── Reconhecimento de fala (STT) ───────────────────────────────────────────
type RecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
  start: () => void; stop: () => void;
};

function criarReconhecimento(): RecognitionLike | null {
  const w = window as unknown as { webkitSpeechRecognition?: new () => RecognitionLike; SpeechRecognition?: new () => RecognitionLike };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = "pt-BR";
  r.continuous = false;
  r.interimResults = false;
  return r;
}

// ─── Componente ─────────────────────────────────────────────────────────────
export function ClockChat() {
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [pensando, setPensando] = React.useState(false);
  const [ouvindo, setOuvindo] = React.useState(false);
  const [vozLigada, setVozLigada] = React.useState(true);
  const [falando, setFalando] = React.useState(false);
  const recRef = React.useRef<RecognitionLike | null>(null);
  const fimRef = React.useRef<HTMLDivElement>(null);
  const msgsRef = React.useRef<Msg[]>([]);
  msgsRef.current = msgs;

  React.useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, pensando]);

  // Chrome carrega as vozes de forma assíncrona
  React.useEffect(() => {
    window.speechSynthesis?.getVoices();
    return () => window.speechSynthesis?.cancel();
  }, []);

  const enviar = React.useCallback(async (texto: string) => {
    const t = texto.trim();
    if (!t) return;
    setInput("");
    const novas: Msg[] = [...msgsRef.current, { role: "user", content: t }];
    setMsgs(novas);
    setPensando(true);
    try {
      const r = await fetch("/api/clock/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // manda só as últimas 20 mensagens (contexto suficiente, custo controlado)
        body: JSON.stringify({ messages: novas.slice(-20) }),
      });
      const data = (await r.json()) as { resposta?: string; erro?: string };
      const resposta = data.resposta ?? data.erro ?? "Não consegui responder.";
      setMsgs((m) => [...m, { role: "assistant", content: resposta }]);
      if (vozLigada) {
        setFalando(true);
        falar(resposta, () => setFalando(false));
      }
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Erro de conexão — tenta de novo." }]);
    } finally {
      setPensando(false);
    }
  }, [vozLigada]);

  function alternarMicrofone() {
    if (ouvindo) {
      recRef.current?.stop();
      setOuvindo(false);
      return;
    }
    const rec = criarReconhecimento();
    if (!rec) {
      setMsgs((m) => [...m, { role: "assistant", content: "Seu navegador não suporta reconhecimento de voz — use o Chrome." }]);
      return;
    }
    window.speechSynthesis?.cancel();
    setFalando(false);
    rec.onresult = (ev) => {
      const transcript = ev.results[0]?.[0]?.transcript ?? "";
      if (transcript) void enviar(transcript);
    };
    rec.onend = () => setOuvindo(false);
    rec.onerror = () => setOuvindo(false);
    recRef.current = rec;
    setOuvindo(true);
    rec.start();
  }

  function pararFala() {
    window.speechSynthesis?.cancel();
    setFalando(false);
  }

  return (
    <div className="rounded-2xl border border-brand-cyan/30 bg-card overflow-hidden flex flex-col" style={{ height: 560 }}>
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border bg-gradient-to-r from-brand-cyan/10 to-brand-blue/10 flex items-center gap-3">
        <div className={cn(
          "w-9 h-9 rounded-full bg-gradient-to-br from-brand-cyan to-brand-blue flex items-center justify-center text-white shrink-0",
          (pensando || falando) && "animate-pulse",
        )}>
          <Sparkles className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-[14px]">CLOCK</div>
          <div className="text-[11px] text-muted-foreground">
            {ouvindo ? "Ouvindo você…" : falando ? "Falando…" : pensando ? "Analisando os dados…" : "Pergunte por voz ou texto — leio dados e executo ações"}
          </div>
        </div>
        {falando && (
          <button onClick={pararFala} title="Parar de falar"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-secondary hover:bg-secondary/70">
            <Square className="w-3 h-3" /> Parar
          </button>
        )}
        <button
          onClick={() => { if (vozLigada) pararFala(); setVozLigada((v) => !v); }}
          title={vozLigada ? "Desligar respostas por voz" : "Ligar respostas por voz"}
          className={cn("p-2 rounded-md transition-smooth",
            vozLigada ? "text-brand-cyan bg-brand-cyan/10" : "text-muted-foreground bg-secondary/50")}>
          {vozLigada ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 custom-scroll-thin">
        {msgs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
            <div className="text-[13px] text-muted-foreground max-w-sm">
              E aí! Sou o CLOCK, a inteligência das suas lavanderias. Me pergunta qualquer coisa
              sobre vendas, clube ou clientes — e posso executar ações pra você.
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-md">
              {SUGESTOES.map((s) => (
                <button key={s} onClick={() => void enviar(s)}
                  className="px-3 py-1.5 rounded-full border border-brand-cyan/30 text-brand-cyan text-[11px] font-semibold hover:bg-brand-cyan/10 transition-smooth">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap",
              m.role === "user"
                ? "bg-gradient-to-r from-brand-cyan to-brand-blue text-white rounded-br-sm"
                : "bg-secondary/60 rounded-bl-sm",
            )}>
              {m.content}
            </div>
          </div>
        ))}
        {pensando && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-secondary/60 px-3.5 py-2.5 inline-flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> consultando os dados…
            </div>
          </div>
        )}
        <div ref={fimRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border flex items-center gap-2">
        <button
          onClick={alternarMicrofone}
          disabled={pensando}
          title={ouvindo ? "Parar de ouvir" : "Falar com o CLOCK"}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-smooth",
            ouvindo
              ? "bg-danger text-white animate-pulse"
              : "bg-gradient-to-br from-brand-cyan to-brand-blue text-white hover:opacity-90",
          )}>
          {ouvindo ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) void enviar(input); }}
          placeholder={ouvindo ? "Pode falar…" : "Pergunte ao CLOCK…"}
          disabled={pensando}
          className="form-input flex-1 h-10 text-[13px]"
        />
        <button
          onClick={() => void enviar(input)}
          disabled={pensando || !input.trim()}
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-cyan to-brand-blue text-white flex items-center justify-center shrink-0 disabled:opacity-40 hover:opacity-90 transition-smooth">
          {pensando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

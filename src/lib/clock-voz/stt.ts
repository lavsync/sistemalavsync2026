// LavSync · CLOCK v2 · Voz — reconhecimento de fala (STT)
//
// Principal: ElevenLabs Scribe v2 Realtime por WebSocket, autenticado com
// single-use token gerado em /api/clock/stt-token (a chave fica no servidor).
// O áudio é o PCM 16 kHz da MESMA stream com AEC usada pelo VAD. Protocolo
// conferido na doc oficial (out/2026):
//   wss://api.elevenlabs.io/v1/speech-to-text/realtime?model_id=scribe_v2_realtime
//     &token=…&audio_format=pcm_16000&language_code=pt&commit_strategy=manual&keyterms=…
//   cliente → { message_type: "input_audio_chunk", audio_base_64, commit, sample_rate, previous_text? }
//   commit  → mesmo formato com audio_base_64 "" e commit true
//   servidor → session_started | partial_transcript {text} | committed_transcript {text} | erros
// O commit é nosso, decidido pelo VAD local (fim de fala) — o servidor não
// precisa receber silêncio para fechar o turno.
//
// Fallback: webkitSpeechRecognition quando o token responde 503 (chave sem
// speech_to_text) ou o WebSocket cai antes de abrir a sessão. Ele não aceita a
// stream com AEC, por isso só roda com o CLOCK calado.

const URL_SCRIBE = "wss://api.elevenlabs.io/v1/speech-to-text/realtime";

/** Termos que o Scribe deve favorecer (nomes do negócio). */
export const TERMOS_CHAVE = [
  "Xô Varal", "Buritis", "Castelo", "Cabral", "LavCoin", "LavCoins",
  "Xô Club", "Bronze", "Prata", "Ouro", "Diamante", "CLOCK", "LavSync",
];

// ─── Token ──────────────────────────────────────────────────────────────────

export type RespostaToken = { tipo: "token"; token: string } | { tipo: "fallback" } | { tipo: "erro"; mensagem: string };

const VALIDADE_TOKEN_MS = 14 * 60 * 1000; // a doc dá 15 min; margem de 1

export class CofreDeToken {
  private reserva: { token: string; em: number } | null = null;
  private buscando: Promise<RespostaToken> | null = null;
  private fallbackAte = 0;

  /** Usa o token reservado (se ainda vale) ou busca um novo. Single-use: sai da reserva. */
  async obter(): Promise<RespostaToken> {
    if (Date.now() < this.fallbackAte) return { tipo: "fallback" };
    const r = this.reserva;
    if (r && Date.now() - r.em < VALIDADE_TOKEN_MS) {
      this.reserva = null;
      return { tipo: "token", token: r.token };
    }
    this.reserva = null;
    return this.buscar();
  }

  /** Guarda um token de reserva para o próximo turno (chamado enquanto o CLOCK fala). */
  preparar() {
    if (this.reserva || this.buscando || Date.now() < this.fallbackAte) return;
    void this.buscar().then((r) => {
      if (r.tipo === "token") this.reserva = { token: r.token, em: Date.now() };
    });
  }

  /** Depois de falha no WebSocket, não insiste por 5 minutos. */
  marcarFalha() {
    this.fallbackAte = Date.now() + 5 * 60 * 1000;
    this.reserva = null;
  }

  private buscar(): Promise<RespostaToken> {
    if (this.buscando) return this.buscando;
    this.buscando = (async (): Promise<RespostaToken> => {
      try {
        const r = await fetch("/api/clock/stt-token", { method: "POST" });
        if (r.status === 503) {
          this.fallbackAte = Date.now() + 5 * 60 * 1000;
          return { tipo: "fallback" };
        }
        const j = (await r.json().catch(() => ({}))) as { token?: string; erro?: string };
        if (!r.ok || !j.token) return { tipo: "erro", mensagem: j.erro ?? `token respondeu ${r.status}` };
        return { tipo: "token", token: j.token };
      } catch {
        return { tipo: "erro", mensagem: "Sem conexão para iniciar o reconhecimento de voz." };
      } finally {
        this.buscando = null;
      }
    })();
    return this.buscando;
  }
}

// ─── Scribe realtime ────────────────────────────────────────────────────────

function pcmParaBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let bin = "";
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + passo)));
  }
  return btoa(bin);
}

export type EventosStt = {
  aoParcial: (texto: string) => void;
  aoFinal: (texto: string) => void;
  /** `antesDeAbrir` = a sessão nem começou (vale tentar o fallback). */
  aoErro: (mensagem: string, antesDeAbrir: boolean) => void;
};

/** Quadros de 20 ms agrupados em envios de 100 ms. */
const QUADROS_POR_ENVIO = 5;

export class SessaoScribe {
  private ws: WebSocket;
  private aberta = false;
  private iniciada = false;
  private encerrada = false;
  private pendentes: Int16Array[] = [];
  private lote: Int16Array[] = [];
  private primeiroEnvio = true;
  private textoComitado = "";
  private parcial = "";
  private aguardandoCommit = false;

  constructor(token: string, private eventos: EventosStt, private contexto?: string) {
    const q = new URLSearchParams();
    q.append("model_id", "scribe_v2_realtime");
    q.append("token", token);
    q.append("audio_format", "pcm_16000");
    q.append("language_code", "pt");
    q.append("commit_strategy", "manual");
    for (const t of TERMOS_CHAVE) q.append("keyterms", t);
    this.ws = new WebSocket(`${URL_SCRIBE}?${q.toString()}`);
    this.ws.onopen = () => {
      this.aberta = true;
      const fila = this.pendentes;
      this.pendentes = [];
      fila.forEach((p) => this.empilhar(p));
    };
    this.ws.onmessage = (ev: MessageEvent<string>) => this.receber(ev.data);
    // o onerror do WebSocket não traz detalhe e sempre é seguido do onclose
    this.ws.onclose = () => {
      this.aberta = false;
      if (this.encerrada) return;
      this.encerrada = true;
      if (this.aguardandoCommit) {
        this.aguardandoCommit = false;
        this.eventos.aoFinal(this.textoTotal());
      } else if (!this.iniciada) {
        this.eventos.aoErro("O reconhecimento de voz não abriu.", true);
      } else {
        this.eventos.aoErro("A conexão do reconhecimento de voz caiu.", false);
      }
    };
  }

  private textoTotal(): string {
    return [this.textoComitado, this.parcial].filter(Boolean).join(" ").trim();
  }

  private receber(bruto: string) {
    let msg: { message_type?: string; text?: string; error?: string };
    try { msg = JSON.parse(bruto); } catch { return; }
    switch (msg.message_type) {
      case "session_started":
        this.iniciada = true;
        return;
      case "partial_transcript":
        this.parcial = msg.text ?? "";
        this.eventos.aoParcial(this.textoTotal());
        return;
      case "committed_transcript":
        this.textoComitado = [this.textoComitado, msg.text ?? ""].filter(Boolean).join(" ").trim();
        this.parcial = "";
        if (this.aguardandoCommit) {
          this.aguardandoCommit = false;
          this.eventos.aoFinal(this.textoComitado);
        } else {
          this.eventos.aoParcial(this.textoComitado);
        }
        return;
      case "committed_transcript_with_timestamps":
      case "committed_transcript_entities":
      case "edited_transcript":
      case "warning":
        return;
      default:
        if (msg.error) {
          this.eventos.aoErro(`Reconhecimento de voz: ${msg.error}`, !this.iniciada);
          this.fechar();
        }
    }
  }

  /** Envia 20 ms de PCM 16 kHz (agrupa em 100 ms). */
  enviar(pcm: Int16Array) {
    if (this.encerrada) return;
    if (!this.aberta) { this.pendentes.push(pcm); return; }
    this.empilhar(pcm);
  }

  private empilhar(pcm: Int16Array) {
    this.lote.push(pcm);
    if (this.lote.length >= QUADROS_POR_ENVIO) this.despachar(false);
  }

  private despachar(commit: boolean) {
    if (!this.aberta || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.lote.length) {
      const total = this.lote.reduce((n, p) => n + p.length, 0);
      const junto = new Int16Array(total);
      let o = 0;
      for (const p of this.lote) { junto.set(p, o); o += p.length; }
      this.lote = [];
      const msg: Record<string, unknown> = {
        message_type: "input_audio_chunk",
        audio_base_64: pcmParaBase64(junto),
        commit: false,
        sample_rate: 16000,
      };
      if (this.primeiroEnvio && this.contexto) msg.previous_text = this.contexto.slice(-50);
      this.primeiroEnvio = false;
      this.ws.send(JSON.stringify(msg));
    }
    if (commit) {
      this.ws.send(JSON.stringify({ message_type: "input_audio_chunk", audio_base_64: "", commit: true, sample_rate: 16000 }));
    }
  }

  /**
   * Fecha o turno: manda o resto do áudio + commit e espera o
   * committed_transcript (até `esperaMs`; depois usa o último parcial).
   */
  finalizar(esperaMs = 2500) {
    if (this.encerrada) return;
    if (!this.aberta) {
      // ainda conectando: o áudio pendente vai assim que abrir
      const abrir = this.ws.onopen;
      this.ws.onopen = (ev) => {
        abrir?.call(this.ws, ev);
        this.finalizar(esperaMs);
      };
      return;
    }
    this.aguardandoCommit = true;
    this.despachar(true);
    setTimeout(() => {
      if (!this.aguardandoCommit || this.encerrada) return;
      this.aguardandoCommit = false;
      this.eventos.aoFinal(this.textoTotal());
      this.fechar();
    }, esperaMs);
  }

  fechar() {
    this.encerrada = true;
    this.aguardandoCommit = false;
    try { this.ws.close(); } catch { /* já fechado */ }
  }
}

// ─── Fallback: Web Speech API ───────────────────────────────────────────────

type ReconhecimentoNavegador = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>; resultIndex: number }) => void) | null;
  onend: (() => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};

export function webSpeechDisponivel(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { webkitSpeechRecognition?: unknown; SpeechRecognition?: unknown };
  return !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

export class EscutaWebSpeech {
  private rec: ReconhecimentoNavegador | null = null;
  private final = "";
  private parcial = "";
  private entregue = false;

  constructor(private eventos: EventosStt) {}

  iniciar(): boolean {
    const w = window as unknown as {
      webkitSpeechRecognition?: new () => ReconhecimentoNavegador;
      SpeechRecognition?: new () => ReconhecimentoNavegador;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return false;
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let parcial = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const t = r?.[0]?.transcript ?? "";
        if (r.isFinal) this.final = `${this.final} ${t}`.trim();
        else parcial += t;
      }
      this.parcial = parcial.trim();
      this.eventos.aoParcial(`${this.final} ${this.parcial}`.trim());
    };
    rec.onerror = (ev) => {
      if (ev.error === "no-speech" || ev.error === "aborted") return;
      this.eventos.aoErro(
        ev.error === "not-allowed" ? "Microfone bloqueado para o reconhecimento do navegador." : "O reconhecimento de voz do navegador falhou.",
        false,
      );
    };
    rec.onend = () => this.entregar();
    this.rec = rec;
    try {
      rec.start();
      return true;
    } catch {
      this.rec = null;
      return false;
    }
  }

  private entregar() {
    if (this.entregue) return;
    this.entregue = true;
    this.eventos.aoFinal(`${this.final} ${this.parcial}`.trim());
  }

  /** Encerra e entrega o que já foi reconhecido. */
  finalizar() {
    try { this.rec?.stop(); } catch { this.entregar(); }
  }

  /** Encerra sem entregar. */
  fechar() {
    this.entregue = true;
    try { this.rec?.abort(); } catch { /* já parado */ }
    this.rec = null;
  }
}

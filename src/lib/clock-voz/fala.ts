// LavSync · CLOCK v2 · Voz — fila de frases do TTS
//
// Cada frase vira um POST /api/clock/tts (MP3 em streaming). A frase da vez
// toca enquanto a próxima já está sendo buscada (pré-busca de 1), e cada
// pedido leva `anterior` = frase anterior, para a prosódia emendar.
//
// Reprodução progressiva: ManagedMediaSource (iOS 17.1+) ou MediaSource com
// audio/mpeg — o som começa no 1º pedaço que chega. Sem MediaSource, cai para
// blob completo. O áudio sai SEMPRE pelo <audio> da página (referência do AEC);
// speechSynthesis não é usado aqui.
//
// interromper(): para na hora, aborta TODOS os fetches de TTS pendentes e
// limpa a fila — não pagamos caracteres que ninguém vai ouvir.

type MediaSourceCtor = {
  new (): MediaSource;
  isTypeSupported(tipo: string): boolean;
};

function ctorMediaSource(): MediaSourceCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { ManagedMediaSource?: MediaSourceCtor; MediaSource?: MediaSourceCtor };
  const C = w.ManagedMediaSource ?? w.MediaSource ?? null;
  try {
    return C && C.isTypeSupported("audio/mpeg") ? C : null;
  } catch {
    return null;
  }
}

export class ErroTts extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

/** Uma frase com o fetch já em andamento, guardando os pedaços que chegam. */
class FalaPreparada {
  readonly controle = new AbortController();
  private pedacos: Uint8Array[] = [];
  private terminou = false;
  private erro: unknown = null;
  private avisar: (() => void) | null = null;
  private iniciada = false;

  constructor(readonly texto: string, private anterior: string | null, private voiceId: string | undefined) {}

  /** Dispara o fetch (idempotente). */
  iniciar() {
    if (this.iniciada) return;
    this.iniciada = true;
    void this.baixar(this.anterior, this.voiceId);
  }

  private notificar() {
    const a = this.avisar;
    this.avisar = null;
    a?.();
  }

  private async baixar(anterior: string | null, voiceId: string | undefined) {
    try {
      const r = await fetch("/api/clock/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: this.texto, anterior: anterior ?? undefined, voice_id: voiceId }),
        signal: this.controle.signal,
      });
      if (!r.ok || !r.body) {
        const corpo = (await r.json().catch(() => ({}))) as { erro?: string };
        throw new ErroTts(r.status, corpo.erro ?? `TTS respondeu ${r.status}`);
      }
      const leitor = r.body.getReader();
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        if (value && value.byteLength) {
          this.pedacos.push(value);
          this.notificar();
        }
      }
    } catch (e) {
      this.erro = e;
    } finally {
      this.terminou = true;
      this.notificar();
    }
  }

  /** Itera os pedaços na ordem, esperando os que ainda vão chegar. */
  async *iterar(): AsyncGenerator<Uint8Array> {
    this.iniciar();
    let i = 0;
    for (;;) {
      if (i < this.pedacos.length) { yield this.pedacos[i++]; continue; }
      if (this.erro) throw this.erro;
      if (this.terminou) return;
      await new Promise<void>((r) => { this.avisar = r; });
    }
  }

  async completo(): Promise<Blob> {
    const partes: Uint8Array<ArrayBuffer>[] = [];
    for await (const p of this.iterar()) partes.push(new Uint8Array(p));
    return new Blob(partes, { type: "audio/mpeg" });
  }

  abortar() {
    this.controle.abort();
  }
}

/** Espera o fim da reprodução; erro de mídia vira exceção (nunca fica pendurado). */
function esperarFim(audio: HTMLAudioElement, sinal: AbortSignal): Promise<void> {
  if (audio.ended) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const fim = () => { limpar(); resolve(); };
    const falha = () => { limpar(); reject(new Error("falha ao reproduzir o áudio")); };
    const abortar = () => { limpar(); reject(new DOMException("abortado", "AbortError")); };
    const limpar = () => {
      audio.removeEventListener("ended", fim);
      audio.removeEventListener("error", falha);
      sinal.removeEventListener("abort", abortar);
    };
    if (sinal.aborted) { abortar(); return; }
    audio.addEventListener("ended", fim, { once: true });
    audio.addEventListener("error", falha, { once: true });
    sinal.addEventListener("abort", abortar, { once: true });
  });
}

function esperarEvento(alvo: EventTarget, nome: string, sinal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (sinal.aborted) { reject(new DOMException("abortado", "AbortError")); return; }
    const fim = () => { limpar(); resolve(); };
    const abortar = () => { limpar(); reject(new DOMException("abortado", "AbortError")); };
    const limpar = () => {
      alvo.removeEventListener(nome, fim);
      sinal.removeEventListener("abort", abortar);
    };
    alvo.addEventListener(nome, fim, { once: true });
    sinal.addEventListener("abort", abortar, { once: true });
  });
}

export type EventosFila = {
  /** A fila começou a tocar (estava vazia/calada). */
  aoComecar: () => void;
  /** A fila esvaziou (fim natural ou interrupção). */
  aoTerminar: (motivo: "fim" | "interrompida") => void;
  /** Frase falhou (TTS fora, autoplay bloqueado). */
  aoErro: (erro: unknown, texto: string) => void;
  /** Uma frase começou a sair no alto-falante. */
  aoFrase?: (texto: string) => void;
};

export class FilaDeFala {
  private fila: FalaPreparada[] = [];
  private tocando: FalaPreparada | null = null;
  private ultimaFalada: string | null = null;
  private ultimaEnfileirada: string | null = null;
  private ativa = false;
  private geracao = 0;
  private reproducao: AbortController | null = null;
  private urlAtual: string | null = null;

  constructor(private obterAudio: () => HTMLAudioElement, private eventos: EventosFila) {}

  get tamanho(): number {
    return this.fila.length + (this.tocando ? 1 : 0);
  }

  get falando(): boolean {
    return this.ativa;
  }

  /** Última frase dita (contexto para o STT e para o próximo TTS). */
  get anterior(): string | null {
    return this.ultimaFalada;
  }

  enfileirar(texto: string, voiceId?: string) {
    const t = texto.trim();
    if (!t) return;
    const prep = new FalaPreparada(t, this.ultimaEnfileirada, voiceId);
    this.ultimaEnfileirada = t;
    this.fila.push(prep);
    this.preBuscar();
    if (!this.ativa) void this.rodar();
  }

  /** Pré-busca de 1: a frase da vez e a seguinte; as demais esperam a vez. */
  private preBuscar() {
    const janela = this.tocando ? 1 : 2;
    this.fila.slice(0, janela).forEach((f) => f.iniciar());
  }

  private async rodar() {
    const minhaGeracao = ++this.geracao;
    this.ativa = true;
    this.eventos.aoComecar();
    while (this.fila.length && minhaGeracao === this.geracao) {
      const atual = this.fila.shift()!;
      this.tocando = atual;
      atual.iniciar();
      this.preBuscar();
      try {
        await this.tocar(atual, minhaGeracao);
        this.ultimaFalada = atual.texto;
      } catch (e) {
        if (minhaGeracao !== this.geracao) break;
        if ((e as DOMException)?.name !== "AbortError") this.eventos.aoErro(e, atual.texto);
        // autoplay bloqueado: as próximas também falhariam
        if ((e as DOMException)?.name === "NotAllowedError") {
          this.fila.forEach((f) => f.abortar());
          this.fila = [];
        }
      } finally {
        if (this.tocando === atual) this.tocando = null;
      }
    }
    if (minhaGeracao === this.geracao) {
      this.ativa = false;
      this.ultimaEnfileirada = null;
      this.eventos.aoTerminar("fim");
    }
  }

  private liberarUrl() {
    if (this.urlAtual) {
      URL.revokeObjectURL(this.urlAtual);
      this.urlAtual = null;
    }
  }

  private async tocar(prep: FalaPreparada, geracao: number) {
    const audio = this.obterAudio();
    const controle = new AbortController();
    this.reproducao = controle;
    const sinal = controle.signal;
    const MS = ctorMediaSource();
    this.liberarUrl();

    try {
      if (MS) {
        const ms = new MS();
        this.urlAtual = URL.createObjectURL(ms);
        // exigência do ManagedMediaSource no Safari
        (audio as HTMLAudioElement & { disableRemotePlayback: boolean }).disableRemotePlayback = true;
        audio.src = this.urlAtual;
        await esperarEvento(ms, "sourceopen", sinal);
        const sb = ms.addSourceBuffer("audio/mpeg");
        // play() só resolve com dados suficientes: não pode bloquear os appends
        let tocar: Promise<void> | null = null;
        for await (const pedaco of prep.iterar()) {
          if (sinal.aborted || geracao !== this.geracao) throw new DOMException("abortado", "AbortError");
          if (sb.updating) await esperarEvento(sb, "updateend", sinal);
          sb.appendBuffer(pedaco as Uint8Array<ArrayBuffer>);
          await esperarEvento(sb, "updateend", sinal);
          if (!tocar) {
            tocar = audio.play().then(() => this.eventos.aoFrase?.(prep.texto));
            tocar.catch(() => undefined); // tratado no await abaixo
          }
        }
        if (!tocar) return; // TTS devolveu corpo vazio
        if (ms.readyState === "open" && !sb.updating) ms.endOfStream();
        await tocar;
        await esperarFim(audio, sinal);
      } else {
        const blob = await prep.completo();
        if (sinal.aborted || geracao !== this.geracao) throw new DOMException("abortado", "AbortError");
        this.urlAtual = URL.createObjectURL(blob);
        audio.src = this.urlAtual;
        await audio.play();
        this.eventos.aoFrase?.(prep.texto);
        await esperarFim(audio, sinal);
      }
    } finally {
      if (this.reproducao === controle) this.reproducao = null;
    }
  }

  /** Para tudo agora. Retorna quantas frases foram descartadas (inclui a atual). */
  interromper(): number {
    const descartadas = this.tamanho;
    this.geracao++;
    this.reproducao?.abort();
    this.reproducao = null;
    this.tocando?.abortar();
    this.tocando = null;
    this.fila.forEach((f) => f.abortar());
    this.fila = [];
    this.ultimaEnfileirada = null;
    const audio = this.obterAudio();
    try {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    } catch { /* elemento já liberado */ }
    this.liberarUrl();
    const estavaAtiva = this.ativa;
    this.ativa = false;
    if (estavaAtiva) this.eventos.aoTerminar("interrompida");
    return descartadas;
  }
}

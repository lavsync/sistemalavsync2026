// LavSync · CLOCK v2 · Voz — captura única do microfone + saída pela página
//
// UMA stream (getUserMedia com AEC, supressão de ruído, ganho automático,
// mono) alimenta o VAD e o STT. Ela é aberta no 1º gesto e fica aberta: abrir
// e fechar mic a cada turno custa 200–500 ms e, no iOS, faz o indicador piscar.
//
// O mesmo AudioContext recebe a saída do TTS (<audio> → MediaElementSource →
// ganho → analisador → destino). Assim (1) o AEC do navegador tem a referência
// do que a página toca e (2) o VAD conhece o nível da própria fala do CLOCK.
//
// O AudioWorklet calcula RMS por quadro de 20 ms e já entrega PCM 16 kHz
// (Int16, mono) pronto para o Scribe — reamostragem por média em caixa, que
// funciona como filtro anti-aliasing barato.

const NOME_PROCESSADOR = "clock-captura";

const CODIGO_WORKLET = `
class ClockCaptura extends AudioWorkletProcessor {
  constructor() {
    super();
    this.razao = sampleRate / 16000;
    this.passo = 0;
    this.somaBalde = 0;
    this.nBalde = 0;
    this.buf = new Int16Array(320);
    this.n = 0;
    this.somaQuad = 0;
    this.cont = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      const s = ch[i];
      this.somaQuad += s * s;
      this.cont++;
      this.somaBalde += s;
      this.nBalde++;
      this.passo += 1;
      if (this.passo >= this.razao) {
        this.passo -= this.razao;
        let v = this.somaBalde / this.nBalde;
        this.somaBalde = 0;
        this.nBalde = 0;
        if (v > 1) v = 1; else if (v < -1) v = -1;
        this.buf[this.n++] = v < 0 ? v * 0x8000 : v * 0x7fff;
        if (this.n === 320) {
          const rms = Math.sqrt(this.somaQuad / Math.max(1, this.cont));
          this.port.postMessage({ rms: rms, pcm: this.buf }, [this.buf.buffer]);
          this.buf = new Int16Array(320);
          this.n = 0;
          this.somaQuad = 0;
          this.cont = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("${NOME_PROCESSADOR}", ClockCaptura);
`;

export type QuadroCaptura = {
  /** RMS do mic no quadro (0..1). */
  rmsMic: number;
  /** RMS da saída do CLOCK no mesmo instante (0..1). */
  rmsSaida: number;
  /** 20 ms de PCM 16 kHz mono Int16. */
  pcm: Int16Array;
};

export type InfoCaptura = {
  aec: boolean;
  fone: boolean;
  rotulo: string;
};

type AudioContextCtor = typeof AudioContext;

function ctorAudioContext(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

const RE_FONE = /airpods|headset|headphone|fone|earbud|buds|earphone|auricular/i;

export class CapturaAudio {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private fonte: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private mudo: GainNode | null = null;
  private saidaFonte: MediaElementAudioSourceNode | null = null;
  private saidaGanho: GainNode | null = null;
  private saidaAnalisador: AnalyserNode | null = null;
  private bufSaida: Float32Array<ArrayBuffer> | null = null;
  private ouvintes = new Set<(q: QuadroCaptura) => void>();
  private abrindo: Promise<InfoCaptura> | null = null;
  info: InfoCaptura | null = null;

  get ativa(): boolean {
    return !!this.stream && this.stream.getAudioTracks().some((t) => t.readyState === "live");
  }

  get contexto(): AudioContext | null {
    return this.ctx;
  }

  /**
   * Cria o AudioContext (chamar no gesto) sem abrir o mic. Permite tocar o
   * TTS pela Web Audio antes de o usuário liberar o microfone.
   */
  garantirContexto(): AudioContext | null {
    if (!this.ctx) {
      const Ctor = ctorAudioContext();
      if (!Ctor) return null;
      this.ctx = new Ctor({ latencyHint: "interactive" });
    }
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => undefined);
    return this.ctx;
  }

  /** Abre o mic com AEC. Idempotente. Lança DOMException em caso de recusa. */
  abrir(): Promise<InfoCaptura> {
    if (this.ativa && this.info) return Promise.resolve(this.info);
    if (this.abrindo) return this.abrindo;
    // o contexto TEM de nascer aqui, ainda dentro do gesto, antes de qualquer await
    const ctx = this.garantirContexto();
    this.abrindo = (async () => {
      if (!ctx) throw new Error("Web Audio indisponível neste navegador.");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microfone indisponível neste navegador.");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      this.stream = stream;
      const track = stream.getAudioTracks()[0];
      const ajustes = (track?.getSettings?.() ?? {}) as MediaTrackSettings;
      const rotulo = track?.label ?? "";
      const info: InfoCaptura = {
        aec: ajustes.echoCancellation === true,
        fone: RE_FONE.test(rotulo),
        rotulo,
      };

      const url = URL.createObjectURL(new Blob([CODIGO_WORKLET], { type: "application/javascript" }));
      try {
        await ctx.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      this.fonte = ctx.createMediaStreamSource(stream);
      this.worklet = new AudioWorkletNode(ctx, NOME_PROCESSADOR, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: "explicit",
      });
      // o worklet precisa estar ligado ao destino para ser processado; ganho zero
      // garante que o mic nunca sai no alto-falante
      this.mudo = ctx.createGain();
      this.mudo.gain.value = 0;
      this.fonte.connect(this.worklet);
      this.worklet.connect(this.mudo);
      this.mudo.connect(ctx.destination);
      this.worklet.port.onmessage = (ev: MessageEvent<{ rms: number; pcm: Int16Array }>) => {
        const q: QuadroCaptura = { rmsMic: ev.data.rms, rmsSaida: this.rmsSaida(), pcm: ev.data.pcm };
        this.ouvintes.forEach((cb) => cb(q));
      };
      track?.addEventListener("ended", () => { this.info = null; });

      // fone conectado por outro dispositivo de saída também conta
      try {
        const disps = await navigator.mediaDevices.enumerateDevices();
        if (disps.some((d) => d.kind === "audiooutput" && d.deviceId === "default" && RE_FONE.test(d.label))) info.fone = true;
      } catch { /* sem permissão para listar — segue com o rótulo do mic */ }

      this.info = info;
      return info;
    })();
    return this.abrindo.finally(() => { this.abrindo = null; });
  }

  /** Liga um <audio> à saída da página (uma única vez por elemento). */
  conectarSaida(audio: HTMLAudioElement): boolean {
    const ctx = this.garantirContexto();
    if (!ctx) return false;
    if (this.saidaFonte) return true;
    try {
      this.saidaFonte = ctx.createMediaElementSource(audio);
      this.saidaGanho = ctx.createGain();
      this.saidaAnalisador = ctx.createAnalyser();
      this.saidaAnalisador.fftSize = 512;
      this.bufSaida = new Float32Array(new ArrayBuffer(this.saidaAnalisador.fftSize * 4));
      this.saidaFonte.connect(this.saidaGanho);
      this.saidaGanho.connect(this.saidaAnalisador);
      this.saidaAnalisador.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  get saidaConectada(): boolean {
    return !!this.saidaFonte;
  }

  /** Fade curto (~30 ms) na saída — usado no corte do barge-in. */
  silenciarSaida(): Promise<void> {
    const ctx = this.ctx;
    const g = this.saidaGanho;
    if (!ctx || !g) return Promise.resolve();
    const agora = ctx.currentTime;
    g.gain.cancelScheduledValues(agora);
    g.gain.setValueAtTime(g.gain.value, agora);
    g.gain.linearRampToValueAtTime(0, agora + 0.03);
    return new Promise((r) => setTimeout(r, 32));
  }

  restaurarSaida() {
    const ctx = this.ctx;
    const g = this.saidaGanho;
    if (!ctx || !g) return;
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.setValueAtTime(1, ctx.currentTime);
  }

  rmsSaida(): number {
    const a = this.saidaAnalisador;
    const buf = this.bufSaida;
    if (!a || !buf) return 0;
    a.getFloatTimeDomainData(buf);
    let soma = 0;
    for (let i = 0; i < buf.length; i++) soma += buf[i] * buf[i];
    return Math.sqrt(soma / buf.length);
  }

  assinar(cb: (q: QuadroCaptura) => void): () => void {
    this.ouvintes.add(cb);
    return () => { this.ouvintes.delete(cb); };
  }

  fechar() {
    this.ouvintes.clear();
    try { this.worklet?.port.close(); } catch { /* já fechado */ }
    this.worklet?.disconnect();
    this.fonte?.disconnect();
    this.mudo?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.worklet = null;
    this.fonte = null;
    this.mudo = null;
    this.info = null;
    if (this.ctx) void this.ctx.close().catch(() => undefined);
    this.ctx = null;
    this.saidaFonte = null;
    this.saidaGanho = null;
    this.saidaAnalisador = null;
    this.bufSaida = null;
  }
}

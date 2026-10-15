// LavSync · CLOCK v2 · Voz — motor de áudio no navegador
//
// Junta as peças: captura única com AEC (captura.ts), VAD por energia
// (vad.ts), fila de TTS com pré-busca (fala.ts) e STT Scribe/Web Speech
// (stt.ts). Vive FORA do ciclo de vida do React — o ClockProvider guarda a
// instância e a conversa sobrevive à troca de rota.
//
// Barge-in (full-duplex, só com AEC confirmado ou fone de ouvido):
//   voz do usuário 300 ms contínuos acima do limiar elevado → fade de 30 ms,
//   para o áudio, aborta os fetches de TTS, limpa a fila e abre a escuta já
//   com os ~500 ms de pré-roll (a 1ª sílaba não se perde).
// Half-duplex (sem AEC): o mic não interrompe; corte por toque, botão ou Esc.
//
// Não existe ouvinte de palavra-chave ("pare"/"para"): a regex antiga cortava
// o CLOCK quando ele mesmo dizia "para". Interrupção é energia, nunca texto.

import { CapturaAudio, type InfoCaptura, type QuadroCaptura } from "./captura";
import { FilaDeFala, ErroTts } from "./fala";
import { CofreDeToken, EscutaWebSpeech, SessaoScribe, webSpeechDisponivel, type EventosStt } from "./stt";
import { DetectorVoz, QUADRO_MS } from "./vad";
import type {
  CallbackEscuta,
  ErroVoz,
  EstadoVoz,
  InstantaneoVoz,
  ModoDuplex,
  ModoStt,
  MotorVoz,
  OpcoesFala,
  ResultadoCalibracao,
} from "./tipos";

export type {
  CallbackEscuta,
  ErroVoz,
  EstadoVoz,
  EventoEscuta,
  InstantaneoVoz,
  ModoDuplex,
  ModoStt,
  MotorVoz,
  OpcoesFala,
  ResultadoCalibracao,
} from "./tipos";

const PRE_ROLL_QUADROS = 25;          // 500 ms
const ESPERA_SEM_FALA_MS = 8000;      // escuta aberta sem ninguém falar
const TURNO_MAXIMO_MS = 45000;        // teto de um turno de fala do usuário
const COOLDOWN_POS_FALA_MS = 300;     // cauda do eco depois que o CLOCK cala
const BUFFER_MAXIMO_QUADROS = 750;    // 15 s esperando o token

type Escuta =
  | { id: number; tipo: "aguardando"; buffer: Int16Array[] }
  | { id: number; tipo: "scribe"; sessao: SessaoScribe }
  | { id: number; tipo: "webspeech"; escuta: EscutaWebSpeech };

class MotorVozNavegador implements MotorVoz {
  private captura = new CapturaAudio();
  private vad = new DetectorVoz();
  private cofre = new CofreDeToken();
  private audio: HTMLAudioElement | null = null;
  private fila: FilaDeFala;

  private _estado: EstadoVoz = "ocioso";
  private modo: ModoDuplex = "indefinido";
  private sttAtual: ModoStt = "indisponivel";

  private ouvinteEscuta: CallbackEscuta | null = null;
  private escuta: Escuta | null = null;
  private seqEscuta = 0;
  private falouNaEscuta = false;
  private timerSemFala: ReturnType<typeof setTimeout> | null = null;
  private timerTurno: ReturnType<typeof setTimeout> | null = null;

  private preRoll: Int16Array[] = [];
  private contadorNivel = 0;
  private desligarQuadros: (() => void) | null = null;
  private teclaRegistrada = false;
  private calibrando = false;
  private sondas = new Set<(q: QuadroCaptura, dbMic: number) => void>();

  private ouvintesEstado = new Set<(e: EstadoVoz) => void>();
  private ouvintesInterrupcao = new Set<() => void>();
  private ouvintesNivel = new Set<(n: number) => void>();
  private ouvintesErro = new Set<(e: ErroVoz) => void>();

  constructor() {
    this.fila = new FilaDeFala(() => this.obterAudio(), {
      aoComecar: () => {
        this.captura.restaurarSaida();
        this.cofre.preparar();
        this.mudarEstado("falando");
      },
      aoTerminar: (motivo) => {
        if (this._estado === "falando") this.mudarEstado("ocioso");
        if (motivo === "fim") this.vad.bloquear(COOLDOWN_POS_FALA_MS);
      },
      aoErro: (erro) => {
        if ((erro as DOMException)?.name === "NotAllowedError") {
          this.emitirErro({ codigo: "audio_bloqueado", mensagem: "O navegador bloqueou o áudio. Toque no microfone ou em qualquer botão do CLOCK para liberar." });
        } else if (erro instanceof ErroTts && erro.status === 404) {
          this.emitirErro({ codigo: "tts_falhou", mensagem: "Voz do CLOCK não configurada no servidor." });
        } else {
          this.emitirErro({ codigo: "tts_falhou", mensagem: "Não consegui gerar a voz desta frase." });
        }
      },
    });
  }

  // ─── Estado e assinaturas ────────────────────────────────────────────────

  get estado(): EstadoVoz {
    return this._estado;
  }

  get suportaInterrupcaoPorVoz(): boolean {
    return this.modo === "full-duplex";
  }

  instantaneo(): InstantaneoVoz {
    return {
      estado: this._estado,
      modo: this.modo,
      micAtivo: this.captura.ativa,
      stt: this.sttAtual,
      fila: this.fila.tamanho,
    };
  }

  private mudarEstado(e: EstadoVoz) {
    if (this._estado === e) return;
    this._estado = e;
    this.ouvintesEstado.forEach((cb) => cb(e));
  }

  /** O modo duplex mudou sem troca de estado: reavisa quem desenha a UI. */
  private avisarModo() {
    this.ouvintesEstado.forEach((cb) => cb(this._estado));
  }

  private emitirErro(e: ErroVoz) {
    this.ouvintesErro.forEach((cb) => cb(e));
  }

  onEstado(cb: (estado: EstadoVoz) => void) {
    this.ouvintesEstado.add(cb);
    return () => { this.ouvintesEstado.delete(cb); };
  }

  onInterrupcao(cb: () => void) {
    this.ouvintesInterrupcao.add(cb);
    return () => { this.ouvintesInterrupcao.delete(cb); };
  }

  onNivel(cb: (nivel: number) => void) {
    this.ouvintesNivel.add(cb);
    return () => { this.ouvintesNivel.delete(cb); };
  }

  onErro(cb: (erro: ErroVoz) => void) {
    this.ouvintesErro.add(cb);
    return () => { this.ouvintesErro.delete(cb); };
  }

  // ─── Ativação (no gesto do usuário) ───────────────────────────────────────

  private registrarTecla() {
    if (this.teclaRegistrada || typeof window === "undefined") return;
    this.teclaRegistrada = true;
    window.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && this._estado === "falando") this.interromper();
    });
  }

  private obterAudio(): HTMLAudioElement {
    if (!this.audio) {
      const a = new Audio();
      a.preload = "auto";
      a.setAttribute("playsinline", "");
      this.audio = a;
      if (this.captura.contexto) this.captura.conectarSaida(a);
    }
    return this.audio;
  }

  private decidirModo(info: InfoCaptura): ModoDuplex {
    return info.aec || info.fone ? "full-duplex" : "half-duplex";
  }

  async ativar(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    this.registrarTecla();
    // tudo que exige gesto acontece ANTES do primeiro await
    this.captura.garantirContexto();
    this.captura.conectarSaida(this.obterAudio());
    if (this.captura.ativa && this.captura.info) return true;
    try {
      const info = await this.captura.abrir();
      if (!this.desligarQuadros) this.desligarQuadros = this.captura.assinar((q) => this.aoQuadro(q));
      if (this.modo === "indefinido") {
        this.modo = this.decidirModo(info);
        this.avisarModo();
      }
      return true;
    } catch (e) {
      const nome = (e as DOMException)?.name;
      this.emitirErro(
        nome === "NotAllowedError" || nome === "SecurityError"
          ? { codigo: "mic_negado", mensagem: "Microfone bloqueado. Libere o acesso no cadeado da barra de endereço." }
          : { codigo: "mic_indisponivel", mensagem: "Não encontrei um microfone disponível." },
      );
      return false;
    }
  }

  // ─── Quadro a quadro (20 ms) ──────────────────────────────────────────────

  private aoQuadro(q: QuadroCaptura) {
    this.preRoll.push(q.pcm);
    if (this.preRoll.length > PRE_ROLL_QUADROS) this.preRoll.shift();

    const clockFalando = this._estado === "falando";
    const saida = this.vad.processar({ rmsMic: q.rmsMic, rmsSaida: q.rmsSaida, clockFalando });
    this.sondas.forEach((s) => s(q, saida.nivelDb));

    if (++this.contadorNivel % 4 === 0 && this.ouvintesNivel.size) {
      const nivel = Math.min(1, Math.max(0, (saida.nivelDb + 60) / 50));
      this.ouvintesNivel.forEach((cb) => cb(nivel));
    }

    if (clockFalando) {
      if (this.modo === "full-duplex" && saida.inicioFala && !this.calibrando) this.bargeIn();
      return;
    }

    if (this._estado !== "ouvindo" || !this.escuta) return;
    this.enviarParaEscuta(q.pcm);
    if (saida.inicioFala) {
      this.falouNaEscuta = true;
      this.limparTimerSemFala();
    }
    if (saida.fimFala && this.falouNaEscuta) this.finalizarEscuta();
  }

  private enviarParaEscuta(pcm: Int16Array) {
    const e = this.escuta;
    if (!e) return;
    if (e.tipo === "aguardando") {
      e.buffer.push(pcm);
      if (e.buffer.length > BUFFER_MAXIMO_QUADROS) e.buffer.shift();
    } else if (e.tipo === "scribe") {
      e.sessao.enviar(pcm);
    }
  }

  // ─── Fala ────────────────────────────────────────────────────────────────

  falar(frase: string, opcoes?: OpcoesFala): void {
    if (typeof window === "undefined") return;
    // o usuário está com a palavra: frases atrasadas do turno anterior não entram
    if (this._estado === "ouvindo") return;
    this.registrarTecla();
    this.fila.enfileirar(frase, opcoes?.voiceId);
  }

  interromper(): void {
    this.fila.interromper();
    if (this._estado === "falando") this.mudarEstado("ocioso");
  }

  private bargeIn() {
    // corte com fade de 30 ms; o estado muda já, o áudio some em seguida
    const fila = this.fila;
    void this.captura.silenciarSaida().then(() => fila.interromper());
    this.ouvintesInterrupcao.forEach((cb) => cb());
    if (!this.ouvinteEscuta) {
      this.mudarEstado("ocioso");
      return;
    }
    // a fala já está em curso: a escuta nasce com o pré-roll e o VAD em "fala"
    this.abrirEscuta(true);
  }

  // ─── Escuta ──────────────────────────────────────────────────────────────

  ouvir(cb: CallbackEscuta): void {
    if (typeof window === "undefined") return;
    this.ouvinteEscuta = cb;
    if (this._estado === "falando") this.interromper();
    if (this._estado === "ouvindo") return;
    this.vad.reiniciar();
    this.abrirEscuta(false);
  }

  pararDeOuvir(): void {
    this.seqEscuta++;
    this.fecharEscuta();
    if (this._estado === "ouvindo") this.mudarEstado("ocioso");
  }

  private limparTimerSemFala() {
    if (this.timerSemFala) clearTimeout(this.timerSemFala);
    this.timerSemFala = null;
  }

  private fecharEscuta() {
    this.limparTimerSemFala();
    if (this.timerTurno) clearTimeout(this.timerTurno);
    this.timerTurno = null;
    const e = this.escuta;
    this.escuta = null;
    if (e?.tipo === "scribe") e.sessao.fechar();
    if (e?.tipo === "webspeech") e.escuta.fechar();
  }

  private finalizarEscuta() {
    const e = this.escuta;
    if (!e) return;
    this.limparTimerSemFala();
    if (e.tipo === "scribe") e.sessao.finalizar();
    else if (e.tipo === "webspeech") e.escuta.finalizar();
    // "aguardando": o token ainda não chegou; quando chegar, o buffer vai e o
    // turno é finalizado em seguida (ver conectarStt)
  }

  private entregar(id: number, texto: string, final: boolean, origem: "scribe" | "webspeech") {
    if (id !== this.seqEscuta) return;
    const cb = this.ouvinteEscuta;
    if (final) {
      this.fecharEscuta();
      this.mudarEstado("ocioso");
    }
    cb?.({ texto: texto.trim(), final, origem });
  }

  private abrirEscuta(comPreRoll: boolean) {
    this.fecharEscuta();
    const id = ++this.seqEscuta;
    this.falouNaEscuta = comPreRoll;
    this.mudarEstado("ouvindo");

    const buffer = comPreRoll ? [...this.preRoll] : [];
    this.escuta = { id, tipo: "aguardando", buffer };

    if (!comPreRoll) {
      this.timerSemFala = setTimeout(() => {
        if (id === this.seqEscuta && !this.falouNaEscuta) this.entregar(id, "", true, this.sttAtual === "webspeech" ? "webspeech" : "scribe");
      }, ESPERA_SEM_FALA_MS);
    }
    this.timerTurno = setTimeout(() => {
      if (id === this.seqEscuta) this.finalizarEscuta();
    }, TURNO_MAXIMO_MS);

    void this.conectarStt(id);
  }

  private eventosStt(id: number, origem: "scribe" | "webspeech"): EventosStt {
    return {
      aoParcial: (t) => this.entregar(id, t, false, origem),
      aoFinal: (t) => this.entregar(id, t, true, origem),
      aoErro: (mensagem, antesDeAbrir) => {
        if (id !== this.seqEscuta) return;
        if (origem === "scribe" && antesDeAbrir) {
          this.cofre.marcarFalha();
          if (this.iniciarWebSpeech(id)) return;
        }
        this.emitirErro({ codigo: "stt_falhou", mensagem });
        this.entregar(id, "", true, origem);
      },
    };
  }

  private iniciarWebSpeech(id: number): boolean {
    if (!webSpeechDisponivel()) return false;
    const escuta = new EscutaWebSpeech(this.eventosStt(id, "webspeech"));
    this.escuta = { id, tipo: "webspeech", escuta };
    this.sttAtual = "webspeech";
    return escuta.iniciar();
  }

  private async conectarStt(id: number) {
    // sem mic próprio (negado ou sem gesto ainda): tenta ativar; se não der,
    // o reconhecedor do navegador ainda pode ouvir sozinho
    if (!this.captura.ativa) {
      const ok = await this.ativar();
      if (id !== this.seqEscuta) return;
      if (!ok) {
        if (!this.iniciarWebSpeech(id)) {
          this.emitirErro({ codigo: "stt_indisponivel", mensagem: "Reconhecimento de voz indisponível neste navegador." });
          this.entregar(id, "", true, "webspeech");
        }
        return;
      }
    }

    const r = await this.cofre.obter();
    if (id !== this.seqEscuta || this.escuta?.tipo !== "aguardando") return;
    const pendente = this.escuta.buffer;

    if (r.tipo === "token") {
      const sessao = new SessaoScribe(r.token, this.eventosStt(id, "scribe"), this.fila.anterior ?? undefined);
      this.escuta = { id, tipo: "scribe", sessao };
      this.sttAtual = "scribe";
      pendente.forEach((p) => sessao.enviar(p));
      // a fala terminou enquanto o token chegava
      if (this.falouNaEscuta && !this.vad.emFalaAtual) sessao.finalizar();
      return;
    }

    if (r.tipo === "erro") this.emitirErro({ codigo: "stt_falhou", mensagem: r.mensagem });
    if (!this.iniciarWebSpeech(id)) {
      this.sttAtual = "indisponivel";
      this.emitirErro({ codigo: "stt_indisponivel", mensagem: "Reconhecimento de voz indisponível: configure o Scribe ou use o Chrome." });
      this.entregar(id, "", true, "scribe");
    }
  }

  // ─── Calibração ──────────────────────────────────────────────────────────

  private medir(ms: number, filtro: () => boolean): Promise<number[]> {
    return new Promise((resolve) => {
      const amostras: number[] = [];
      const sonda = (_q: QuadroCaptura, db: number) => { if (filtro()) amostras.push(db); };
      this.sondas.add(sonda);
      setTimeout(() => { this.sondas.delete(sonda); resolve(amostras); }, ms);
    });
  }

  async calibrar(opcoes?: { tocarAmostra?: boolean }): Promise<ResultadoCalibracao> {
    const ok = await this.ativar();
    const info = this.captura.info;
    if (!ok || !info) {
      return { pisoDb: this.vad.piso, vazamentoDb: null, modo: this.modo, aec: false, fone: false };
    }

    // 1) piso de ruído: 1 s em silêncio, mediana
    const piso = await this.medir(1000, () => this._estado !== "falando");
    if (piso.length) {
      const ordenado = [...piso].sort((a, b) => a - b);
      this.vad.definirPiso(ordenado[Math.floor(ordenado.length / 2)]);
    }

    let vazamentoDb: number | null = null;
    let modo = this.decidirModo(info);

    // 2) vazamento: o CLOCK fala uma frase curta e medimos o residual no mic
    if (opcoes?.tocarAmostra && info.aec && !info.fone) {
      const durante: number[] = [];
      const sonda = (_q: QuadroCaptura, db: number) => { if (this._estado === "falando") durante.push(db); };
      this.sondas.add(sonda);
      this.calibrando = true;
      await new Promise<void>((resolve) => {
        let comecou = false;
        const desliga = this.onEstado((e) => {
          if (e === "falando") comecou = true;
          if (comecou && e !== "falando") { desliga(); resolve(); }
        });
        this.falar("Ajustando o áudio do CLOCK. Pode falar comigo quando quiser.");
        setTimeout(() => { desliga(); resolve(); }, 8000);
      });
      this.sondas.delete(sonda);
      this.calibrando = false;
      if (durante.length >= 1000 / QUADRO_MS / 2) {
        vazamentoDb = durante.reduce((s, d) => s + d, 0) / durante.length;
        const limite = this.vad.piso + 18;
        const fracaoAlta = durante.filter((d) => d > limite).length / durante.length;
        // o eco que sobra depois do AEC passaria pelo limiar em boa parte da fala
        if (fracaoAlta > 0.3) modo = "half-duplex";
      }
    }

    if (this.modo !== modo) {
      this.modo = modo;
      this.avisarModo();
    }
    return { pisoDb: this.vad.piso, vazamentoDb, modo, aec: info.aec, fone: info.fone };
  }

  // ─── Encerramento ────────────────────────────────────────────────────────

  encerrar(): void {
    this.pararDeOuvir();
    this.interromper();
    this.desligarQuadros?.();
    this.desligarQuadros = null;
    this.captura.fechar();
    // o <audio> ficou preso ao contexto fechado; o próximo nasce limpo
    this.audio = null;
    this.modo = "indefinido";
    this.preRoll = [];
  }
}

// Uma instância por aba: rail, sheet e /clock são só vistas do mesmo motor
// (evita disputa de microfone entre componentes).
let instancia: MotorVozNavegador | null = null;

/**
 * Devolve o motor de voz da aba (singleton). Seguro de chamar durante SSR:
 * nada toca em window até ativar()/falar()/ouvir().
 */
export function criarMotorVoz(): MotorVoz {
  if (!instancia) instancia = new MotorVozNavegador();
  return instancia;
}

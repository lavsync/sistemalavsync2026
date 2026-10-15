// LavSync · CLOCK v2 · Voz — detector de voz por energia (VAD)
//
// Lição da Contempla: barge-in decidido por ENERGIA num mic que já passou por
// AEC, nunca pelo texto do reconhecedor. Este detector é PURO (recebe RMS por
// quadro de 20 ms, não toca em DOM) e roda dentro do motor a cada quadro.
//
// Regras:
//   • piso de ruído adaptativo, aprendido só em quadros sem fala;
//   • limiar = piso + 10 dB em idle;
//   • enquanto o CLOCK fala: limiar = max(piso + 18 dB, eco residual + 10 dB),
//     com o eco residual aprendido nos quadros abaixo do limiar durante a fala
//     do CLOCK, mais +3 dB quando a própria saída está alta (ducking do limiar);
//   • disparo exige `msDisparo` CONTÍNUOS acima do limiar (300 ms durante a
//     fala do CLOCK), tolerando buracos curtos de até 60 ms;
//   • fim de fala = `msSilencioFim` abaixo do limiar depois de ter havido fala.

export const QUADRO_MS = 20;

export function rmsParaDb(rms: number): number {
  return 20 * Math.log10(Math.max(rms, 1e-7));
}

export type OpcoesVad = {
  /** ms contínuos para considerar fala em idle. */
  msInicioIdle: number;
  /** ms contínuos para interromper o CLOCK (barge-in). */
  msDisparo: number;
  /** ms de silêncio que encerram a fala do usuário. */
  msSilencioFim: number;
  /** buraco máximo tolerado dentro de uma fala (ms). */
  msBuraco: number;
  /** dB acima do piso em idle. */
  margemIdleDb: number;
  /** dB acima do piso enquanto o CLOCK fala. */
  margemFalaDb: number;
  /** dB acima do eco residual enquanto o CLOCK fala. */
  margemEcoDb: number;
};

export const VAD_PADRAO: OpcoesVad = {
  msInicioIdle: 160,
  msDisparo: 300,
  msSilencioFim: 750,
  msBuraco: 60,
  margemIdleDb: 10,
  margemFalaDb: 18,
  margemEcoDb: 10,
};

export type QuadroVad = {
  /** RMS do mic (0..1) neste quadro. */
  rmsMic: number;
  /** RMS da saída do CLOCK (0..1) neste quadro; 0 quando calado. */
  rmsSaida: number;
  /** O CLOCK está falando agora. */
  clockFalando: boolean;
};

export type SaidaVad = {
  /** Este quadro passou do limiar. */
  acima: boolean;
  /** Há fala sustentada em curso (já confirmada). */
  emFala: boolean;
  /** Fala acabou de ser confirmada neste quadro (borda de subida). */
  inicioFala: boolean;
  /** Fala acabou de terminar neste quadro (borda de descida). */
  fimFala: boolean;
  /** Limiar usado neste quadro (dBFS). */
  limiarDb: number;
  /** Nível do mic (dBFS). */
  nivelDb: number;
};

export class DetectorVoz {
  private opcoes: OpcoesVad;
  private pisoDb = -60;
  private ecoDb = -70;
  private msAcima = 0;
  private msBuracoAtual = 0;
  private msSilencio = 0;
  private emFala = false;
  private bloqueadoAteMs = 0;
  private relogioMs = 0;

  constructor(opcoes: Partial<OpcoesVad> = {}) {
    this.opcoes = { ...VAD_PADRAO, ...opcoes };
  }

  get piso(): number { return this.pisoDb; }
  get eco(): number { return this.ecoDb; }
  /** Há fala confirmada em curso. */
  get emFalaAtual(): boolean { return this.emFala; }

  /** Força um piso conhecido (calibração). */
  definirPiso(db: number) {
    this.pisoDb = Math.min(-30, Math.max(-80, db));
  }

  /** Ignora disparos por `ms` (cooldown depois de o CLOCK parar). */
  bloquear(ms: number) {
    this.bloqueadoAteMs = this.relogioMs + ms;
    this.reiniciar();
  }

  /** Zera a fala em curso (sem esquecer piso/eco). */
  reiniciar() {
    this.msAcima = 0;
    this.msBuracoAtual = 0;
    this.msSilencio = 0;
    this.emFala = false;
  }

  limiar(clockFalando: boolean, rmsSaida: number): number {
    if (!clockFalando) return Math.max(this.pisoDb + this.opcoes.margemIdleDb, -55);
    const ducking = rmsParaDb(rmsSaida) > -30 ? 3 : 0;
    return Math.max(this.pisoDb + this.opcoes.margemFalaDb, this.ecoDb + this.opcoes.margemEcoDb) + ducking;
  }

  processar(q: QuadroVad): SaidaVad {
    this.relogioMs += QUADRO_MS;
    const nivelDb = rmsParaDb(q.rmsMic);
    const limiarDb = this.limiar(q.clockFalando, q.rmsSaida);
    const acima = nivelDb > limiarDb;

    // aprendizado só em quadros sem fala
    if (!acima && !this.emFala) {
      if (q.clockFalando) {
        // eco residual: sobe devagar, desce rápido
        this.ecoDb = nivelDb > this.ecoDb ? this.ecoDb * 0.9 + nivelDb * 0.1 : this.ecoDb * 0.6 + nivelDb * 0.4;
      } else {
        this.pisoDb = nivelDb > this.pisoDb ? this.pisoDb * 0.97 + nivelDb * 0.03 : this.pisoDb * 0.7 + nivelDb * 0.3;
        this.pisoDb = Math.min(-30, Math.max(-80, this.pisoDb));
        // sem o CLOCK falando, o eco esquecido volta ao piso aos poucos
        this.ecoDb = this.ecoDb * 0.98 + this.pisoDb * 0.02;
      }
    }

    let inicioFala = false;
    let fimFala = false;
    const bloqueado = this.relogioMs < this.bloqueadoAteMs;

    if (acima && !bloqueado) {
      this.msAcima += QUADRO_MS;
      this.msBuracoAtual = 0;
      this.msSilencio = 0;
      const alvo = q.clockFalando ? this.opcoes.msDisparo : this.opcoes.msInicioIdle;
      if (!this.emFala && this.msAcima >= alvo) {
        this.emFala = true;
        inicioFala = true;
      }
    } else {
      this.msBuracoAtual += QUADRO_MS;
      if (this.msBuracoAtual > this.opcoes.msBuraco) this.msAcima = 0;
      if (this.emFala) {
        this.msSilencio += QUADRO_MS;
        if (this.msSilencio >= this.opcoes.msSilencioFim) {
          this.emFala = false;
          this.msSilencio = 0;
          fimFala = true;
        }
      }
    }

    return { acima, emFala: this.emFala, inicioFala, fimFala, limiarDb, nivelDb };
  }
}

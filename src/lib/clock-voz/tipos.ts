// LavSync · CLOCK v2 · Voz — tipos públicos do motor de áudio
//
// Contrato entre o motor (src/lib/clock-voz/motor.ts) e quem o consome
// (o ClockProvider guarda UMA instância e a UI só lê o estado).
//
// Estados:
//   ocioso   → mic pode estar aberto, mas ninguém está falando nem sendo ouvido
//   ouvindo  → turno de escuta aberto (STT recebendo áudio)
//   falando  → fila de frases do CLOCK tocando
//
// Modo duplex:
//   full-duplex → AEC confirmado no mic: a voz do usuário interrompe o CLOCK
//                 (decisão por ENERGIA/VAD, nunca pelo texto do reconhecedor)
//   half-duplex → sem AEC confiável: interrupção só por toque, botão ou Esc
//   indefinido  → mic ainda não foi aberto

export type EstadoVoz = "ocioso" | "ouvindo" | "falando";

export type ModoDuplex = "full-duplex" | "half-duplex" | "indefinido";

/** Motor de reconhecimento em uso no turno de escuta. */
export type ModoStt = "scribe" | "webspeech" | "indisponivel";

/** Evento entregue ao callback de ouvir(). */
export type EventoEscuta = {
  /** Texto reconhecido até agora (parcial) ou o texto final do turno. */
  texto: string;
  /** true = turno encerrado; o texto é o que o usuário disse. */
  final: boolean;
  /** Motor que produziu o texto. */
  origem: Exclude<ModoStt, "indisponivel">;
};

export type CallbackEscuta = (ev: EventoEscuta) => void;

export type ErroVoz = {
  codigo:
    | "mic_negado"
    | "mic_indisponivel"
    | "audio_bloqueado"
    | "tts_falhou"
    | "stt_falhou"
    | "stt_indisponivel";
  mensagem: string;
};

export type ResultadoCalibracao = {
  /** Piso de ruído medido em idle (dBFS). */
  pisoDb: number;
  /** Nível residual médio no mic enquanto o CLOCK falava (dBFS), se medido. */
  vazamentoDb: number | null;
  /** Modo decidido depois da calibração. */
  modo: ModoDuplex;
  /** AEC informado pelo navegador (track.getSettings().echoCancellation). */
  aec: boolean;
  /** Fone de ouvido detectado pelo rótulo do dispositivo. */
  fone: boolean;
};

export type InstantaneoVoz = {
  estado: EstadoVoz;
  modo: ModoDuplex;
  micAtivo: boolean;
  stt: ModoStt;
  /** Frases ainda na fila (inclui a que está tocando). */
  fila: number;
};

export type OpcoesFala = {
  /** Sobrescreve a voz configurada (usado na amostra de vozes). */
  voiceId?: string;
};

export interface MotorVoz {
  /** Estado atual (getter). */
  readonly estado: EstadoVoz;
  /** true quando a voz do usuário pode interromper o CLOCK (full-duplex). */
  readonly suportaInterrupcaoPorVoz: boolean;
  /** Fotografia completa para a UI. */
  instantaneo(): InstantaneoVoz;

  /**
   * Abre o mic (getUserMedia com AEC) e o AudioContext. Chame DENTRO de um
   * gesto do usuário (clique/toque) — exigência do iOS. Idempotente.
   */
  ativar(): Promise<boolean>;

  /** Enfileira uma frase para TTS. Toca em sequência, com pré-busca da próxima. */
  falar(frase: string, opcoes?: OpcoesFala): void;
  /** Para o áudio na hora, aborta TTS pendente e limpa a fila. */
  interromper(): void;

  /**
   * Abre um turno de escuta. O callback recebe parciais e, no fim, um evento
   * final. Também é o callback usado quando a voz do usuário interrompe o CLOCK.
   */
  ouvir(cb: CallbackEscuta): void;
  /** Fecha o turno de escuta sem entregar texto final. */
  pararDeOuvir(): void;

  /** Assina mudanças de estado. Retorna a função de cancelamento. */
  onEstado(cb: (estado: EstadoVoz) => void): () => void;
  /** Disparado quando a voz do usuário cortou o CLOCK (barge-in). */
  onInterrupcao(cb: () => void): () => void;
  /** Nível do mic, 0..1, ~12 vezes por segundo (para o indicador visual). */
  onNivel(cb: (nivel: number) => void): () => void;
  /** Erros de mic, TTS e STT, já em português. */
  onErro(cb: (erro: ErroVoz) => void): () => void;

  /**
   * Mede o piso de ruído e, com `tocarAmostra`, o vazamento do alto-falante
   * no mic. Vazamento alto ou AEC ausente → half-duplex.
   */
  calibrar(opcoes?: { tocarAmostra?: boolean }): Promise<ResultadoCalibracao>;

  /** Libera mic, AudioContext e conexões. */
  encerrar(): void;
}

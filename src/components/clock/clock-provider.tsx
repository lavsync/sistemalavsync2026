"use client";

// LavSync · CLOCK v2 · Provider global da conversa
//
// Montado UMA vez em src/app/layout.tsx. O AppShell é renderizado por página,
// então tudo que precisa sobreviver à troca de rota mora aqui: sessão, mensagens
// exibidas, estado (ocioso | ouvindo | pensando | falando), ação pendente,
// novidades, a conexão SSE com /api/clock/chat e o motor de voz.
//
// Páginas públicas não carregam nada pesado: o provider fica inerte até um
// AppShell autenticado montar <ClockSessao/> (ativação). O motor de voz
// (src/lib/clock-voz/motor.ts) é importado sob demanda só depois disso.
//
// Rail desktop, sheet mobile e a página /clock são apenas VIEWS deste estado:
// uma única conversa, um único microfone, um único alto-falante.
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

// ─── Contrato do motor de voz ──────────────────────────────────────────────
// Os tipos moram em src/lib/clock-voz/tipos.ts (squad de voz) e a implementação
// em src/lib/clock-voz/motor.ts: `export function criarMotorVoz(): MotorVoz`.
// O provider guarda UMA instância; as views só leem o estado daqui.
import type { EstadoVoz, MotorVoz, ModoDuplex, OpcoesFala } from "@/lib/clock-voz/tipos";

export type { EstadoVoz as EstadoMotorVoz, MotorVoz, OpcoesFala } from "@/lib/clock-voz/tipos";

/** Assinatura do módulo src/lib/clock-voz/motor.ts. */
export type CriarMotorVoz = () => MotorVoz;
type EstadoMotorVoz = EstadoVoz;

// ─── Tipos do estado da conversa ───────────────────────────────────────────

export type EstadoClock = "ocioso" | "ouvindo" | "pensando" | "falando";
export type ModoClock = "voz" | "texto";
export type RiscoAcao = "baixo" | "medio" | "alto";

export type MensagemClock = {
  id: string;
  role: "user" | "assistant";
  texto: string;
  modo: ModoClock;
  criadoEm: number;
  /** Resposta ainda chegando pelo SSE. */
  parcial?: boolean;
  erro?: boolean;
  /** Rótulos das ferramentas consultadas no turno (ex.: "Consultando o Castelo"). */
  ferramentas?: string[];
  /** Telas abertas pelo CLOCK no turno. */
  navegacoes?: Array<{ href: string; rotulo: string }>;
  /** Mensagem informativa gerada pelo próprio front (resultado de ação, aviso). */
  aviso?: boolean;
};

export type AcaoPendenteClock = {
  acao_id: string;
  resumo: string;
  risco: RiscoAcao;
  /** "decidindo" enquanto o POST /api/clock/acao está em voo. */
  status: "pendente" | "decidindo";
};

export type BriefingClock = { id: string; titulo: string; texto_fala: string; criado_em: string };
export type AlertaClock = {
  id: string;
  titulo: string;
  texto_fala: string;
  severidade: string;
  href?: string | null;
};
export type NovidadesClock = { briefing?: BriefingClock | null; alertas: AlertaClock[] };

export type UsuarioClock = { id: string; nome: string };

export type ClockContexto = {
  /** true depois que um AppShell autenticado ativou o CLOCK nesta aba. */
  ativo: boolean;
  usuario: UsuarioClock | null;
  sessaoId: string | null;
  mensagens: MensagemClock[];
  estado: EstadoClock;
  /** Rótulo da ferramenta em execução no turno atual. */
  ferramentaAtual: string | null;
  /** Transcrição parcial enquanto ouve. */
  transcricaoParcial: string;
  acaoPendente: AcaoPendenteClock | null;
  novidades: NovidadesClock;
  /** Respostas em voz ligadas. */
  vozLigada: boolean;
  /** Motor de voz carregado e pronto. */
  vozDisponivel: boolean;
  /** full-duplex: a voz do usuário interrompe o CLOCK; half-duplex: só toque/botão/Esc. */
  modoDuplex: ModoDuplex;
  /** Assina o nível do microfone (0..1) sem re-render do provider; devolve o cancelamento. */
  assinarNivelMic: (cb: (nivel: number) => void) => () => void;

  enviar: (texto: string, modo?: ModoClock) => void;
  confirmarAcao: () => Promise<void>;
  cancelarAcao: () => Promise<void>;
  /** Para tudo: corta a fala, cancela o stream em andamento e fecha o microfone. */
  interromper: () => void;
  /** Abre o microfone para um turno por voz. */
  ouvir: () => void;
  pararDeOuvir: () => void;
  alternarVoz: () => void;
  novaConversa: () => void;
  /** Fala um texto avulso pelo motor (briefing, alerta, amostra de voz). */
  falarTexto: (texto: string, opcoes?: OpcoesFala) => void;
  marcarNovidadesVistas: (ids: string[]) => Promise<void>;
  recarregarNovidades: () => Promise<void>;

  /** Estado de UI que também precisa sobreviver à navegação. */
  railRecolhido: boolean;
  setRailRecolhido: (v: boolean) => void;
  sheetAberto: boolean;
  setSheetAberto: (v: boolean) => void;

  /** Chamado por <ClockSessao/> no AppShell. */
  ativar: (usuario: UsuarioClock) => void;
};

const Ctx = React.createContext<ClockContexto | null>(null);

export function useClock(): ClockContexto {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useClock precisa estar dentro de <ClockProvider>");
  return v;
}

// ─── Constantes ────────────────────────────────────────────────────────────

const CHAVE_RAIL = "lavsync.copilot.collapsed";
const CHAVE_VOZ = "lavsync.clock.voz";
const CHAVE_CONVERSA = "lavsync.clock.conversa";
const MAX_MENSAGENS_GUARDADAS = 60;
const INTERVALO_NOVIDADES_MS = 5 * 60 * 1000;

/** Mesma lista de rotas públicas do proxy (src/lib/supabase/proxy-helper.ts). */
const PREFIXOS_PUBLICOS = [
  "/login", "/auth", "/m/", "/player", "/qr", "/parceiro", "/quero-ser-parceiro",
  "/regulamento-clube", "/meu-clube", "/politica-de-privacidade", "/termos-de-uso",
  "/politica-de-cookies", "/direitos-lgpd",
];

function rotaPublica(pathname: string | null): boolean {
  if (!pathname) return true;
  return PREFIXOS_PUBLICOS.some((p) => pathname.startsWith(p));
}

// Confirmação por voz: quem decide é SÓ o servidor (uma regra, um lugar).
// O front manda o acao_id do cartão aberto junto com a fala e fecha o cartão
// quando chega o evento `acao_decidida` (executada, cancelada ou expirada).

function novoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Só aceita caminho interno ("/financeiro?aba=dre"), nunca URL externa nem "//host". */
function hrefInterno(href: unknown): string | null {
  if (typeof href !== "string") return null;
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  return href;
}

function lerStorage(chave: string): string | null {
  try { return window.sessionStorage.getItem(chave); } catch { return null; }
}
function gravarStorage(chave: string, valor: string | null) {
  try {
    if (valor === null) window.sessionStorage.removeItem(chave);
    else window.sessionStorage.setItem(chave, valor);
  } catch { /* storage indisponível: segue só em memória */ }
}
function lerLocal(chave: string): string | null {
  try { return window.localStorage.getItem(chave); } catch { return null; }
}
function gravarLocal(chave: string, valor: string) {
  try { window.localStorage.setItem(chave, valor); } catch { /* idem */ }
}

type ConversaGuardada = { usuarioId: string; sessaoId: string | null; mensagens: MensagemClock[] };

// ─── Leitor de SSE (POST não funciona com EventSource) ─────────────────────

type EventoSSE = { evento: string; dados: unknown };

async function* lerSSE(corpo: ReadableStream<Uint8Array>): AsyncGenerator<EventoSSE> {
  const leitor = corpo.getReader();
  const dec = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await leitor.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let corte: number;
      while ((corte = buffer.indexOf("\n\n")) >= 0) {
        const bloco = buffer.slice(0, corte);
        buffer = buffer.slice(corte + 2);
        const ev = parseBloco(bloco);
        if (ev) yield ev;
      }
    }
    const resto = parseBloco(buffer);
    if (resto) yield resto;
  } finally {
    leitor.releaseLock();
  }
}

function parseBloco(bloco: string): EventoSSE | null {
  let evento = "message";
  const linhas: string[] = [];
  for (const linha of bloco.split("\n")) {
    if (linha.startsWith(":")) continue; // comentário / keep-alive
    if (linha.startsWith("event:")) evento = linha.slice(6).trim();
    else if (linha.startsWith("data:")) linhas.push(linha.slice(5).replace(/^ /, ""));
  }
  if (linhas.length === 0) return null;
  const bruto = linhas.join("\n");
  try { return { evento, dados: JSON.parse(bruto) }; } catch { return { evento, dados: bruto }; }
}

function campo<T = string>(dados: unknown, nome: string): T | undefined {
  if (dados && typeof dados === "object" && nome in dados) {
    return (dados as Record<string, unknown>)[nome] as T;
  }
  return undefined;
}

// ─── Provider ──────────────────────────────────────────────────────────────

export function ClockProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [usuario, setUsuario] = React.useState<UsuarioClock | null>(null);
  const [sessaoId, setSessaoId] = React.useState<string | null>(null);
  const [mensagens, setMensagens] = React.useState<MensagemClock[]>([]);
  const [transmitindo, setTransmitindo] = React.useState(false);
  const [estadoMotor, setEstadoMotor] = React.useState<EstadoMotorVoz>("ocioso");
  const [ferramentaAtual, setFerramentaAtual] = React.useState<string | null>(null);
  const [transcricaoParcial, setTranscricaoParcial] = React.useState("");
  const [acaoPendente, setAcaoPendente] = React.useState<AcaoPendenteClock | null>(null);
  const [novidades, setNovidades] = React.useState<NovidadesClock>({ briefing: null, alertas: [] });
  const [vozLigada, setVozLigada] = React.useState(true);
  const [vozDisponivel, setVozDisponivel] = React.useState(false);
  const [modoDuplex, setModoDuplex] = React.useState<ModoDuplex>("indefinido");
  const [railRecolhido, setRailRecolhidoState] = React.useState(false);
  const [sheetAberto, setSheetAberto] = React.useState(false);

  const ativo = usuario !== null && !rotaPublica(pathname);

  // Refs para callbacks estáveis (o SSE vive mais que qualquer render)
  const sessaoRef = React.useRef<string | null>(null);
  sessaoRef.current = sessaoId;
  const vozLigadaRef = React.useRef(vozLigada);
  vozLigadaRef.current = vozLigada;
  const acaoRef = React.useRef<AcaoPendenteClock | null>(null);
  acaoRef.current = acaoPendente;
  const motorRef = React.useRef<MotorVoz | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  /** Último turno foi por voz: ao terminar de falar, reabre o microfone (conversa contínua). */
  const conversaPorVozRef = React.useRef(false);
  /** A fala em curso nasceu de barge-in (pode ser eco do CLOCK): não vale como confirmação. */
  const falaDeBargeInRef = React.useRef(false);
  const transmitindoRef = React.useRef(false);
  transmitindoRef.current = transmitindo;
  const enviarRef = React.useRef<(texto: string, modo?: ModoClock) => void>(() => {});

  // ── Preferências locais (rail recolhido, voz ligada) ──
  // Lidas depois da hidratação (no servidor não existe localStorage), no
  // próximo quadro para não renderizar em cascata dentro do efeito.
  React.useEffect(() => {
    const quadro = window.requestAnimationFrame(() => {
      if (lerLocal(CHAVE_RAIL) === "1") setRailRecolhidoState(true);
      if (lerLocal(CHAVE_VOZ) === "0") setVozLigada(false);
    });
    return () => window.cancelAnimationFrame(quadro);
  }, []);

  const setRailRecolhido = React.useCallback((v: boolean) => {
    setRailRecolhidoState(v);
    gravarLocal(CHAVE_RAIL, v ? "1" : "0");
  }, []);

  // ── Ativação (só AppShell autenticado chama) ──
  const ativar = React.useCallback((u: UsuarioClock) => {
    setUsuario((atual) => {
      if (atual && atual.id === u.id && atual.nome === u.nome) return atual;
      if (!atual || atual.id !== u.id) {
        // Outro usuário (ou primeira ativação): restaura a conversa DESTE usuário nesta aba
        const bruto = lerStorage(CHAVE_CONVERSA);
        let guardada: ConversaGuardada | null = null;
        if (bruto) {
          try { guardada = JSON.parse(bruto) as ConversaGuardada; } catch { guardada = null; }
        }
        if (guardada && guardada.usuarioId === u.id) {
          setSessaoId(guardada.sessaoId);
          setMensagens((guardada.mensagens ?? []).map((m) => ({ ...m, parcial: false })));
        } else {
          setSessaoId(null);
          setMensagens([]);
          setAcaoPendente(null);
        }
      }
      return u;
    });
  }, []);

  // ── Persiste a conversa exibida nesta aba (sobrevive a recarregar a página) ──
  React.useEffect(() => {
    if (!usuario) return;
    const guardar: ConversaGuardada = {
      usuarioId: usuario.id,
      sessaoId,
      mensagens: mensagens.filter((m) => !m.parcial).slice(-MAX_MENSAGENS_GUARDADAS),
    };
    gravarStorage(CHAVE_CONVERSA, JSON.stringify(guardar));
  }, [usuario, sessaoId, mensagens]);

  // ── Motor de voz: carregado sob demanda só com o CLOCK ativo ──
  React.useEffect(() => {
    if (!ativo || motorRef.current) return;
    let cancelado = false;
    const assinaturas: Array<() => void> = [];
    import("@/lib/clock-voz/motor")
      .then((mod: { criarMotorVoz: CriarMotorVoz }) => {
        if (cancelado) return;
        const motor = mod.criarMotorVoz();
        motorRef.current = motor;
        setEstadoMotor(motor.estado);
        setModoDuplex(motor.instantaneo().modo);
        assinaturas.push(
          motor.onEstado((e) => {
            setEstadoMotor(e);
            setModoDuplex(motor.instantaneo().modo);
            if (e !== "ouvindo") setTranscricaoParcial("");
          }),
          // Barge-in: a voz do usuário cortou o CLOCK → para de gerar a resposta
          // antiga; o que ele disser chega pelo callback de ouvir() como turno de voz.
          motor.onInterrupcao(() => {
            conversaPorVozRef.current = true;
            falaDeBargeInRef.current = true;
            abortRef.current?.abort();
          }),
          motor.onErro((erro) => {
            if (erro.codigo === "mic_negado" || erro.codigo === "mic_indisponivel" ||
                erro.codigo === "stt_falhou" || erro.codigo === "stt_indisponivel") {
              conversaPorVozRef.current = false;
            }
            avisoRef.current(erro.mensagem);
          }),
        );
        setVozDisponivel(true);
      })
      .catch(() => {
        if (!cancelado) setVozDisponivel(false);
      });
    return () => {
      cancelado = true;
      assinaturas.forEach((f) => f());
    };
  }, [ativo]);

  // ── Saiu para rota pública: silencia tudo ──
  React.useEffect(() => {
    if (ativo) return;
    abortRef.current?.abort();
    motorRef.current?.interromper();
    motorRef.current?.pararDeOuvir();
    conversaPorVozRef.current = false;
  }, [ativo]);

  // ── Desmontagem do provider (fecha a aba / troca de documento) ──
  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
      motorRef.current?.encerrar();
      motorRef.current = null;
    };
  }, []);

  // ── Conversa contínua por voz: terminou de falar → volta a ouvir ──
  const estadoMotorAnterior = React.useRef<EstadoMotorVoz>("ocioso");
  React.useEffect(() => {
    const antes = estadoMotorAnterior.current;
    estadoMotorAnterior.current = estadoMotor;
    // Com ação pendente de risco baixo/médio o microfone reabre: o "sim" falado
    // é a confirmação do contrato. Risco alto só se confirma no cartão.
    if (
      antes === "falando" && estadoMotor === "ocioso" &&
      conversaPorVozRef.current && !transmitindoRef.current && acaoRef.current?.risco !== "alto"
    ) {
      abrirMicrofone();
    }
    // abrirMicrofone é estável (só usa refs)
  }, [estadoMotor]);

  // ── Mensagens ──
  const acrescentar = React.useCallback((m: Omit<MensagemClock, "id" | "criadoEm">) => {
    const nova: MensagemClock = { ...m, id: novoId(), criadoEm: Date.now() };
    setMensagens((lista) => [...lista, nova]);
    return nova.id;
  }, []);

  const atualizar = React.useCallback((id: string, f: (m: MensagemClock) => MensagemClock) => {
    setMensagens((lista) => lista.map((m) => (m.id === id ? f(m) : m)));
  }, []);

  const avisoRef = React.useRef<(texto: string) => void>(() => {});
  avisoRef.current = (texto: string) => {
    acrescentar({ role: "assistant", texto, modo: "voz", erro: true, aviso: true });
  };

  const falar = React.useCallback((texto: string, opcoes?: OpcoesFala) => {
    const t = texto.trim();
    if (!t) return;
    motorRef.current?.falar(t, opcoes);
  }, []);

  // ── Envio de um turno (SSE) ──
  const enviar = React.useCallback((texto: string, modo: ModoClock = "texto") => {
    const t = texto.trim();
    if (!t || !usuario) return;

    // Turno por voz: (re)ativa mic + AudioContext ainda dentro do gesto (Safari/iOS).
    // Turno por texto não toca no microfone (nada de pedido de permissão à toa).
    if (modo === "voz") void motorRef.current?.ativar();
    motorRef.current?.interromper();
    abortRef.current?.abort();
    conversaPorVozRef.current = modo === "voz";

    // Cartão aberto: a fala segue com o id dele (o servidor só aceita um "sim"
    // ligado a esta ação). Fala nascida de barge-in não carrega o id.
    const deBargeIn = modo === "voz" && falaDeBargeInRef.current;
    falaDeBargeInRef.current = false;
    const acaoAberta = acaoRef.current && acaoRef.current.status === "pendente" && !deBargeIn
      ? acaoRef.current.acao_id
      : undefined;

    acrescentar({ role: "user", texto: t, modo });
    const idResposta = acrescentar({ role: "assistant", texto: "", modo, parcial: true, ferramentas: [], navegacoes: [] });

    const controle = new AbortController();
    abortRef.current = controle;
    setTransmitindo(true);
    setFerramentaAtual(null);

    const rotaAtual = typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : pathname ?? undefined;

    void (async () => {
      let acumulado = "";
      let finalizado = false;
      try {
        const r = await fetch("/api/clock/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({
            sessao_id: sessaoRef.current ?? undefined,
            texto: t,
            modo,
            rota_atual: rotaAtual,
            acao_id: acaoAberta,
          }),
          signal: controle.signal,
        });

        if (!r.ok || !r.body) {
          let mensagem = "Não consegui falar com o servidor agora. Tenta de novo em instantes.";
          try {
            const j = (await r.json()) as { erro?: string; mensagem?: string };
            mensagem = j.mensagem ?? j.erro ?? mensagem;
          } catch { /* corpo não é JSON */ }
          atualizar(idResposta, (m) => ({ ...m, texto: mensagem, parcial: false, erro: true }));
          return;
        }

        for await (const { evento, dados } of lerSSE(r.body)) {
          if (controle.signal.aborted) break;
          switch (evento) {
            case "sessao": {
              const id = campo(dados, "sessao_id");
              if (id) setSessaoId(id);
              break;
            }
            case "texto": {
              const delta = campo(dados, "delta") ?? "";
              acumulado += delta;
              const atual = acumulado;
              atualizar(idResposta, (m) => ({ ...m, texto: atual }));
              break;
            }
            case "frase": {
              const frase = campo(dados, "texto");
              if (frase && vozLigadaRef.current) falar(frase);
              break;
            }
            case "ferramenta": {
              const rotulo = campo(dados, "rotulo") ?? campo(dados, "nome") ?? "";
              setFerramentaAtual(rotulo || null);
              if (rotulo) {
                atualizar(idResposta, (m) => ({ ...m, ferramentas: [...(m.ferramentas ?? []), rotulo] }));
              }
              break;
            }
            case "nav": {
              const href = hrefInterno(campo(dados, "href"));
              const rotulo = campo(dados, "rotulo") ?? href ?? "";
              if (href) {
                atualizar(idResposta, (m) => ({ ...m, navegacoes: [...(m.navegacoes ?? []), { href, rotulo }] }));
                // No celular o sheet cobre a tela: fecha para o usuário ver o que o CLOCK abriu
                if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1280px)").matches) {
                  setSheetAberto(false);
                }
                React.startTransition(() => router.push(href));
              }
              break;
            }
            case "confirmacao": {
              const acao_id = campo(dados, "acao_id");
              const resumo = campo(dados, "resumo") ?? "";
              const risco = (campo<RiscoAcao>(dados, "risco") ?? "medio");
              if (acao_id) setAcaoPendente({ acao_id, resumo, risco, status: "pendente" });
              break;
            }
            case "acao_decidida": {
              // O servidor executou, cancelou ou expirou a ação: fecha o cartão dela
              const acao_id = campo(dados, "acao_id");
              if (acao_id) setAcaoPendente((a) => (a && a.acao_id === acao_id ? null : a));
              break;
            }
            case "fim": {
              const final = campo(dados, "texto");
              finalizado = true;
              atualizar(idResposta, (m) => ({
                ...m,
                texto: (final && final.trim()) ? final : (m.texto || acumulado),
                parcial: false,
              }));
              break;
            }
            case "erro": {
              const mensagem = campo(dados, "mensagem") ?? "Algo falhou do meu lado. Tenta de novo.";
              finalizado = true;
              atualizar(idResposta, (m) => ({
                ...m,
                texto: m.texto ? `${m.texto}\n\n${mensagem}` : mensagem,
                parcial: false,
                erro: true,
              }));
              if (vozLigadaRef.current && modo === "voz") falar(mensagem);
              break;
            }
            default:
              break;
          }
        }
        if (!finalizado) {
          atualizar(idResposta, (m) => ({ ...m, texto: m.texto || acumulado, parcial: false }));
        }
      } catch (e) {
        const abortado = controle.signal.aborted || (e instanceof DOMException && e.name === "AbortError");
        atualizar(idResposta, (m) => (
          abortado
            ? { ...m, texto: m.texto ? `${m.texto} [interrompido]` : "[interrompido]", parcial: false }
            : { ...m, texto: m.texto || "Perdi a conexão no meio da resposta. Tenta de novo.", parcial: false, erro: true }
        ));
      } finally {
        if (abortRef.current === controle) {
          abortRef.current = null;
          setTransmitindo(false);
          setFerramentaAtual(null);
          // Turno por voz sem nada para falar (voz desligada): reabre o microfone já
          if (
            !controle.signal.aborted && conversaPorVozRef.current &&
            motorRef.current?.estado === "ocioso" && acaoRef.current?.risco !== "alto"
          ) {
            abrirMicrofone();
          }
        }
      }
    })();
    // abrirMicrofone usa só refs
  }, [usuario, pathname, router, acrescentar, atualizar, falar]);
  enviarRef.current = enviar;

  // ── Microfone ──
  // Função comum (sem estado de React) para poder ser chamada de efeitos e do SSE
  function abrirMicrofone() {
    const motor = motorRef.current;
    if (!motor) return;
    setTranscricaoParcial("");
    // Escuta aberta de propósito (não é barge-in): a fala pode confirmar ação
    falaDeBargeInRef.current = false;
    // ativar() é idempotente; a 1ª chamada acontece dentro do gesto (ouvir)
    void motor.ativar().then((ok) => {
      if (!ok) { conversaPorVozRef.current = false; return; }
      motor.ouvir((ev) => {
        if (!ev.final) { setTranscricaoParcial(ev.texto); return; }
        setTranscricaoParcial("");
        if (ev.texto.trim()) enviarRef.current(ev.texto, "voz");
        else conversaPorVozRef.current = false;
      });
    });
  }

  const ouvir = React.useCallback(() => {
    const motor = motorRef.current;
    if (!motor) {
      acrescentar({
        role: "assistant",
        texto: "O motor de voz ainda não carregou neste navegador. Pode digitar enquanto isso.",
        modo: "texto",
        aviso: true,
      });
      return;
    }
    motor.interromper();
    abrirMicrofone();
  }, [acrescentar]);

  const pararDeOuvir = React.useCallback(() => {
    conversaPorVozRef.current = false;
    motorRef.current?.pararDeOuvir();
    setTranscricaoParcial("");
  }, []);

  const interromper = React.useCallback(() => {
    conversaPorVozRef.current = false;
    motorRef.current?.interromper();
    motorRef.current?.pararDeOuvir();
    abortRef.current?.abort();
    setTranscricaoParcial("");
  }, []);

  const alternarVoz = React.useCallback(() => {
    setVozLigada((v) => {
      const novo = !v;
      if (!novo) motorRef.current?.interromper();
      gravarLocal(CHAVE_VOZ, novo ? "1" : "0");
      return novo;
    });
  }, []);

  const novaConversa = React.useCallback(() => {
    interromper();
    setSessaoId(null);
    setMensagens([]);
    setAcaoPendente(null);
  }, [interromper]);

  const falarTexto = React.useCallback((texto: string, opcoes?: OpcoesFala) => {
    const motor = motorRef.current;
    if (!motor) return;
    motor.interromper();
    conversaPorVozRef.current = false;
    falar(texto, opcoes);
  }, [falar]);

  // ── Ação pendente ──
  const decidir = React.useCallback(async (decisao: "confirmar" | "cancelar") => {
    const acao = acaoRef.current;
    if (!acao || acao.status === "decidindo") return;
    setAcaoPendente({ ...acao, status: "decidindo" });
    try {
      const r = await fetch("/api/clock/acao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao_id: acao.acao_id, decisao }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; erro?: string };
      setAcaoPendente(null);
      let texto: string;
      if (decisao === "cancelar") texto = j.ok === false && j.erro ? j.erro : "Cancelado. Nada foi alterado.";
      else texto = j.ok ? "Feito. Ação executada e registrada." : (j.erro ?? "Não consegui executar a ação.");
      const erro = decisao === "confirmar" && !j.ok;
      acrescentar({ role: "assistant", texto, modo: "texto", aviso: true, erro });
      if (vozLigadaRef.current) falar(texto);
    } catch {
      setAcaoPendente({ ...acao, status: "pendente" });
      acrescentar({
        role: "assistant",
        texto: "Sem conexão para registrar a decisão. A ação continua pendente.",
        modo: "texto",
        aviso: true,
        erro: true,
      });
    }
  }, [acrescentar, falar]);

  const confirmarAcao = React.useCallback(() => decidir("confirmar"), [decidir]);
  const cancelarAcao = React.useCallback(() => decidir("cancelar"), [decidir]);

  // ── Novidades (briefing do dia + alertas) ──
  const recarregarNovidades = React.useCallback(async () => {
    try {
      const r = await fetch("/api/clock/novidades", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as Partial<NovidadesClock>;
      setNovidades({
        briefing: j.briefing ?? null,
        alertas: Array.isArray(j.alertas) ? j.alertas : [],
      });
    } catch { /* sem rede: mantém o que já tem */ }
  }, []);

  const marcarNovidadesVistas = React.useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const conjunto = new Set(ids);
    setNovidades((n) => ({
      briefing: n.briefing && conjunto.has(n.briefing.id) ? null : n.briefing,
      alertas: n.alertas.filter((a) => !conjunto.has(a.id)),
    }));
    try {
      await fetch("/api/clock/novidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    } catch { /* volta na próxima leitura */ }
  }, []);

  React.useEffect(() => {
    if (!ativo) return;
    // Primeira leitura fora do corpo do efeito (o fetch atualiza o estado)
    const inicial = window.setTimeout(() => void recarregarNovidades(), 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void recarregarNovidades();
    }, INTERVALO_NOVIDADES_MS);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void recarregarNovidades();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.clearTimeout(inicial);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [ativo, recarregarNovidades]);

  const assinarNivelMic = React.useCallback((cb: (nivel: number) => void) => {
    return motorRef.current?.onNivel(cb) ?? (() => {});
    // vozDisponivel: reassina quando o motor termina de carregar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vozDisponivel]);

  // ── Estado derivado ──
  const estado: EstadoClock =
    estadoMotor === "falando" ? "falando"
      : estadoMotor === "ouvindo" ? "ouvindo"
        : transmitindo ? "pensando"
          : "ocioso";

  const valor = React.useMemo<ClockContexto>(() => ({
    ativo,
    usuario,
    sessaoId,
    mensagens,
    estado,
    ferramentaAtual,
    transcricaoParcial,
    acaoPendente,
    novidades,
    vozLigada,
    vozDisponivel,
    modoDuplex,
    assinarNivelMic,
    enviar,
    confirmarAcao,
    cancelarAcao,
    interromper,
    ouvir,
    pararDeOuvir,
    alternarVoz,
    novaConversa,
    falarTexto,
    marcarNovidadesVistas,
    recarregarNovidades,
    railRecolhido,
    setRailRecolhido,
    sheetAberto,
    setSheetAberto,
    ativar,
  }), [
    ativo, usuario, sessaoId, mensagens, estado, ferramentaAtual, transcricaoParcial, acaoPendente,
    novidades, vozLigada, vozDisponivel, modoDuplex, assinarNivelMic, enviar, confirmarAcao, cancelarAcao, interromper, ouvir,
    pararDeOuvir, alternarVoz, novaConversa, falarTexto, marcarNovidadesVistas, recarregarNovidades,
    railRecolhido, setRailRecolhido, sheetAberto, ativar,
  ]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/**
 * Ativa o CLOCK para o usuário autenticado. Renderizado pelo AppShell (Server
 * Component que já validou a sessão). Não desativa ao desmontar: a troca de
 * página desmonta o AppShell, e a conversa precisa continuar viva.
 */
export function ClockSessao({ usuarioId, nome }: { usuarioId: string; nome: string }) {
  const { ativar } = useClock();
  React.useEffect(() => {
    ativar({ id: usuarioId, nome });
  }, [ativar, usuarioId, nome]);
  return null;
}

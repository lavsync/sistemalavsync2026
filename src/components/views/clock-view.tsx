"use client";

// LavSync · /clock — Central do CLOCK
//
// Tudo aqui é dado real: a conversa é a do ClockProvider (a mesma do rail),
// briefing e alertas vêm de /api/clock/novidades (clock_insights), o histórico
// é clock_acoes do próprio usuário e a lista de vozes vem de /api/clock/vozes.
// Nada de número fixo na tela.
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  CircleSlash,
  Clock3,
  History,
  Loader2,
  Newspaper,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Square,
  Volume2,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ClockChat } from "@/components/clock/clock-chat";
import { useClock, type AlertaClock, type EstadoClock } from "@/components/clock/clock-provider";
import { cn } from "@/lib/utils";

export type AcaoHistorico = {
  id: string;
  acao: string;
  resumo: string | null;
  risco: "baixo" | "medio" | "alto" | string | null;
  status: "pendente" | "executada" | "cancelada" | "expirada" | "erro" | string;
  criado_em: string;
  decidido_em: string | null;
};

type VozCandidata = { nome: string; voice_id: string; descricao: string };
type RespostaVozes = { atual: string | null; candidatas: VozCandidata[] };

const AMOSTRA_VOZ = "Oi, eu sou o CLOCK. Quando quiser saber como está a operação, é só me chamar.";

const ROTULO_ESTADO: Record<EstadoClock, string> = {
  ocioso: "Pronto para conversar",
  ouvindo: "Ouvindo você",
  pensando: "Consultando o sistema",
  falando: "Falando",
};

const fmtDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function dataHora(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : fmtDataHora.format(d);
}

const semAssinatura = () => () => {};
const saudacaoServidor = (): string | null => null;

function saudacao(): string {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(new Date()),
  );
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

// ─── View ──────────────────────────────────────────────────────────────────

export function ClockView({
  nome,
  acoes,
  historicoIndisponivel,
  podeEscolherVoz,
}: {
  nome: string | null;
  acoes: AcaoHistorico[];
  historicoIndisponivel: boolean;
  podeEscolherVoz: boolean;
}) {
  const { estado, interromper } = useClock();
  // Saudação só no cliente: o horário do servidor (UTC) não é o do usuário.
  // No servidor e na hidratação o snapshot é null; depois vale o do navegador.
  const ola = React.useSyncExternalStore(semAssinatura, saudacao, saudacaoServidor);
  const primeiroNome = nome?.trim().split(/\s+/)[0] ?? null;

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6">
      <PageHeader
        eyebrow="IA & Insights · CLOCK"
        title={ola && primeiroNome ? `${ola}, ${primeiroNome}.` : "Central do CLOCK"}
        subtitle="Converse por voz ou texto com os dados ao vivo. O CLOCK abre telas, prepara o briefing do dia e só executa ações depois da sua confirmação."
        actions={<EstadoBadge estado={estado} onParar={interromper} />}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        {/* Conversa grande — mesma conversa do rail */}
        <section className="xl:col-span-2 min-w-0" aria-label="Conversa com o CLOCK">
          <ClockChat />
        </section>

        {/* Coluna lateral: novidades + voz */}
        <div className="space-y-5 min-w-0">
          <PainelNovidades />
          <SeletorVoz podeEscolher={podeEscolherVoz} />
        </div>
      </div>

      <HistoricoAcoes acoes={acoes} indisponivel={historicoIndisponivel} />
    </div>
  );
}

// ─── Estado atual ──────────────────────────────────────────────────────────

function EstadoBadge({ estado, onParar }: { estado: EstadoClock; onParar: () => void }) {
  const cor =
    estado === "ouvindo" ? "bg-danger"
      : estado === "falando" ? "bg-brand-cyan"
        : estado === "pensando" ? "bg-warning"
          : "bg-success";
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-2 px-3 h-8 rounded-lg border border-border bg-card text-xs font-semibold">
        <span className={cn("w-2 h-2 rounded-full", cor, estado !== "ocioso" && "animate-pulse")} />
        {ROTULO_ESTADO[estado]}
      </span>
      {estado !== "ocioso" && (
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onParar}>
          <Square className="w-3 h-3 mr-1" /> Parar
        </Button>
      )}
    </div>
  );
}

// ─── Cartão base ───────────────────────────────────────────────────────────

function Cartao({
  icone: Icone,
  titulo,
  subtitulo,
  acoes,
  children,
  className,
}: {
  icone: React.ComponentType<{ className?: string }>;
  titulo: string;
  subtitulo?: string;
  acoes?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card", className)}>
      <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-border">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-cyan/10 text-brand-cyan flex items-center justify-center shrink-0">
            <Icone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-[15px] tracking-tight">{titulo}</h2>
            {subtitulo && <p className="text-[11.5px] text-muted-foreground mt-0.5">{subtitulo}</p>}
          </div>
        </div>
        {acoes && <div className="flex items-center gap-1.5 shrink-0">{acoes}</div>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="text-[12.5px] text-muted-foreground leading-relaxed">{children}</p>;
}

// ─── Briefing + alertas ────────────────────────────────────────────────────

function tomSeveridade(sev: string | null | undefined): { classe: string; Icone: React.ComponentType<{ className?: string }> } {
  const s = (sev ?? "").toLowerCase();
  if (["alta", "alto", "critica", "crítica", "critico", "crítico", "danger"].includes(s)) {
    return { classe: "border-danger/30 bg-danger/10 text-danger", Icone: ShieldAlert };
  }
  if (["media", "média", "medio", "médio", "atencao", "atenção", "warn", "warning"].includes(s)) {
    return { classe: "border-warning/30 bg-warning/10 text-warning", Icone: AlertTriangle };
  }
  return { classe: "border-brand-cyan/30 bg-brand-cyan/10 text-brand-cyan", Icone: Bell };
}

function PainelNovidades() {
  const { novidades, falarTexto, marcarNovidadesVistas, recarregarNovidades, vozDisponivel } = useClock();
  const [atualizando, setAtualizando] = React.useState(false);
  const { briefing, alertas } = novidades;

  async function atualizar() {
    setAtualizando(true);
    await recarregarNovidades();
    setAtualizando(false);
  }

  return (
    <Cartao
      icone={Newspaper}
      titulo="Briefing e alertas"
      subtitulo="O que o CLOCK separou para você e ainda não foi visto"
      acoes={
        <button
          onClick={() => void atualizar()}
          aria-label="Atualizar novidades"
          title="Atualizar"
          className="p-1.5 rounded-md hover:bg-secondary transition-smooth text-muted-foreground"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", atualizando && "animate-spin")} />
        </button>
      }
    >
      <div className="space-y-4">
        {briefing ? (
          <article className="rounded-xl border border-brand-cyan/30 bg-brand-cyan/[0.06] p-4">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-cyan">Briefing do dia</span>
              <span className="text-[10.5px] text-muted-foreground font-mono">{dataHora(briefing.criado_em)}</span>
            </div>
            <h3 className="font-display font-semibold text-[14px] leading-snug">{briefing.titulo}</h3>
            <p className="text-[12.5px] text-foreground/90 leading-relaxed mt-1.5 whitespace-pre-line">{briefing.texto_fala}</p>
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                className="h-7 text-[11px] bg-brand-cyan hover:bg-brand-cyan/90 text-primary-foreground"
                disabled={!vozDisponivel}
                onClick={() => falarTexto(briefing.texto_fala)}
              >
                <Volume2 className="w-3 h-3 mr-1" /> Ouvir
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => void marcarNovidadesVistas([briefing.id])}>
                <Check className="w-3 h-3 mr-1" /> Já vi
              </Button>
            </div>
          </article>
        ) : (
          <Vazio>Nenhum briefing novo. O resumo do dia aparece aqui assim que a rotina diária do CLOCK gerar.</Vazio>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Alertas {alertas.length > 0 && `· ${alertas.length}`}
            </span>
            {alertas.length > 1 && (
              <button
                onClick={() => void marcarNovidadesVistas(alertas.map((a) => a.id))}
                className="text-[11px] font-semibold text-brand-cyan hover:underline"
              >
                Marcar todos como vistos
              </button>
            )}
          </div>
          {alertas.length === 0 ? (
            <Vazio>Sem alertas pendentes.</Vazio>
          ) : (
            <ul className="space-y-2">
              {alertas.map((a) => (
                <ItemAlerta
                  key={a.id}
                  alerta={a}
                  podeOuvir={vozDisponivel}
                  onOuvir={() => falarTexto(a.texto_fala)}
                  onVisto={() => void marcarNovidadesVistas([a.id])}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Cartao>
  );
}

function ItemAlerta({
  alerta, podeOuvir, onOuvir, onVisto,
}: { alerta: AlertaClock; podeOuvir: boolean; onOuvir: () => void; onVisto: () => void }) {
  const { classe, Icone } = tomSeveridade(alerta.severidade);
  return (
    <li className={cn("rounded-xl border p-3", classe)}>
      <div className="flex items-start gap-2">
        <Icone className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-foreground leading-snug">{alerta.titulo}</div>
          <p className="text-[12px] text-foreground/80 leading-relaxed mt-0.5">{alerta.texto_fala}</p>
          <div className="flex items-center gap-3 mt-2">
            {alerta.href && alerta.href.startsWith("/") && !alerta.href.startsWith("//") && (
              <Link href={alerta.href} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-cyan hover:underline">
                Abrir <ArrowRight className="w-3 h-3" />
              </Link>
            )}
            {podeOuvir && (
              <button onClick={onOuvir} className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                <Volume2 className="w-3 h-3" /> Ouvir
              </button>
            )}
            <button onClick={onVisto} className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
              <Check className="w-3 h-3" /> Visto
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

// ─── Seletor de voz ────────────────────────────────────────────────────────

function SeletorVoz({ podeEscolher }: { podeEscolher: boolean }) {
  const { falarTexto, interromper, estado, vozDisponivel } = useClock();
  const [dados, setDados] = React.useState<RespostaVozes | null>(null);
  const [carregando, setCarregando] = React.useState(true);
  const [erro, setErro] = React.useState<string | null>(null);
  const [salvando, setSalvando] = React.useState<string | null>(null);
  const [tocando, setTocando] = React.useState<string | null>(null);

  React.useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch("/api/clock/vozes", { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as Partial<RespostaVozes>;
        if (vivo) setDados({ atual: j.atual ?? null, candidatas: Array.isArray(j.candidatas) ? j.candidatas : [] });
      } catch {
        if (vivo) setErro("Não consegui carregar a lista de vozes agora.");
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, []);

  // A amostra terminou (ou foi cortada): limpa o destaque do botão.
  // Ajuste durante o render na mudança de estado (sem efeito em cascata).
  const [estadoVisto, setEstadoVisto] = React.useState(estado);
  if (estado !== estadoVisto) {
    setEstadoVisto(estado);
    if (estado !== "falando") setTocando(null);
  }

  function ouvirAmostra(v: VozCandidata) {
    if (tocando === v.voice_id) {
      interromper();
      setTocando(null);
      return;
    }
    setTocando(v.voice_id);
    falarTexto(AMOSTRA_VOZ, { voiceId: v.voice_id });
  }

  async function usar(v: VozCandidata) {
    setSalvando(v.voice_id);
    setErro(null);
    try {
      const r = await fetch("/api/clock/vozes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice_id: v.voice_id }),
      });
      const j = (await r.json().catch(() => ({}))) as { erro?: string; em_uso?: string };
      if (!r.ok) throw new Error(j.erro ?? "Não foi possível salvar a voz.");
      // em_uso: a voz que de fato toca (a env ELEVENLABS_VOICE_ID tem precedência)
      const emUso = j.em_uso ?? v.voice_id;
      setDados((d) => (d ? { ...d, atual: emUso } : d));
      if (emUso !== v.voice_id) {
        setErro("A escolha foi salva, mas a voz definida na configuração do servidor continua valendo até ser removida.");
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a voz.");
    } finally {
      setSalvando(null);
    }
  }

  return (
    <Cartao
      icone={Volume2}
      titulo="Voz do CLOCK"
      subtitulo={podeEscolher ? "Ouça as amostras e escolha a voz da rede" : "Só administradores trocam a voz"}
    >
      {carregando ? (
        <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando vozes
        </div>
      ) : !dados || dados.candidatas.length === 0 ? (
        <Vazio>{erro ?? "Nenhuma voz disponível."}</Vazio>
      ) : (
        <div className="space-y-2">
          {erro && <p className="text-[12px] text-danger">{erro}</p>}
          {!vozDisponivel && (
            <p className="text-[11.5px] text-muted-foreground">O motor de voz ainda não carregou neste navegador; as amostras ficam disponíveis assim que ele subir.</p>
          )}
          <ul className="space-y-2">
            {dados.candidatas.map((v) => {
              const atual = dados.atual === v.voice_id;
              return (
                <li
                  key={v.voice_id}
                  className={cn(
                    "rounded-xl border p-3 transition-smooth",
                    atual ? "border-brand-cyan/50 bg-brand-cyan/[0.06]" : "border-border",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold flex items-center gap-1.5">
                        {v.nome}
                        {atual && (
                          <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold uppercase tracking-wider text-brand-cyan">
                            <CheckCircle2 className="w-3 h-3" /> Em uso
                          </span>
                        )}
                      </div>
                      {v.descricao && <p className="text-[11.5px] text-muted-foreground leading-relaxed mt-0.5">{v.descricao}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px]"
                      disabled={!vozDisponivel}
                      onClick={() => ouvirAmostra(v)}
                    >
                      {tocando === v.voice_id
                        ? <><Square className="w-3 h-3 mr-1" /> Parar</>
                        : <><Play className="w-3 h-3 mr-1" /> Ouvir amostra</>}
                    </Button>
                    {podeEscolher && !atual && (
                      <Button
                        size="sm"
                        className="h-7 text-[11px] bg-brand-cyan hover:bg-brand-cyan/90 text-primary-foreground"
                        disabled={salvando !== null}
                        onClick={() => void usar(v)}
                      >
                        {salvando === v.voice_id
                          ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          : <Check className="w-3 h-3 mr-1" />}
                        Usar esta voz
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Cartao>
  );
}

// ─── Histórico de ações ────────────────────────────────────────────────────

const STATUS_ACAO: Record<string, { rotulo: string; classe: string; Icone: React.ComponentType<{ className?: string }> }> = {
  pendente: { rotulo: "Aguardando confirmação", classe: "text-warning bg-warning/10 border-warning/30", Icone: Clock3 },
  executada: { rotulo: "Executada", classe: "text-success bg-success/10 border-success/30", Icone: CheckCircle2 },
  cancelada: { rotulo: "Cancelada", classe: "text-muted-foreground bg-secondary border-border", Icone: CircleSlash },
  expirada: { rotulo: "Expirada", classe: "text-muted-foreground bg-secondary border-border", Icone: Clock3 },
  erro: { rotulo: "Falhou", classe: "text-danger bg-danger/10 border-danger/30", Icone: XCircle },
};

const ROTULO_RISCO: Record<string, string> = { baixo: "Risco baixo", medio: "Risco médio", alto: "Risco alto" };

function HistoricoAcoes({ acoes, indisponivel }: { acoes: AcaoHistorico[]; indisponivel: boolean }) {
  const router = useRouter();
  const [atualizando, startTransition] = React.useTransition();

  return (
    <Cartao
      icone={History}
      titulo="Histórico de ações"
      subtitulo="Tudo que o CLOCK propôs ou executou a seu pedido, com auditoria"
      acoes={
        <button
          onClick={() => startTransition(() => router.refresh())}
          aria-label="Atualizar histórico"
          title="Atualizar"
          className="p-1.5 rounded-md hover:bg-secondary transition-smooth text-muted-foreground"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", atualizando && "animate-spin")} />
        </button>
      }
    >
      {indisponivel ? (
        <Vazio>Não consegui ler o histórico agora. Tente atualizar em instantes.</Vazio>
      ) : acoes.length === 0 ? (
        <Vazio>
          Nenhuma ação ainda. Quando você pedir algo que altera dados, o CLOCK mostra o resumo e o impacto, e só executa depois do seu Confirmar.
        </Vazio>
      ) : (
        <ul className="divide-y divide-border">
          {acoes.map((a) => {
            const st = STATUS_ACAO[a.status] ?? { rotulo: a.status, classe: "text-muted-foreground bg-secondary border-border", Icone: Sparkles };
            return (
              <li key={a.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                <div className="text-[10.5px] font-mono text-muted-foreground w-[82px] shrink-0 pt-0.5">{dataHora(a.criado_em)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] leading-relaxed">{a.resumo || a.acao}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold", st.classe)}>
                      <st.Icone className="w-3 h-3" /> {st.rotulo}
                    </span>
                    {a.risco && ROTULO_RISCO[a.risco] && (
                      <span className="text-[10.5px] text-muted-foreground">{ROTULO_RISCO[a.risco]}</span>
                    )}
                    {a.decidido_em && (
                      <span className="text-[10.5px] text-muted-foreground">decidido em {dataHora(a.decidido_em)}</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Cartao>
  );
}

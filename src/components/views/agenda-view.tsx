"use client";

import * as React from "react";
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth,
  isToday, isWeekend, parseISO, startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar, ChevronLeft, ChevronRight, Plus, MapPin, Clock, Trash2,
  CheckCircle2, Circle, Bell, Briefcase, User as UserIcon, Loader2, X,
  AlertTriangle, MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import type { Evento, Feriado, AgendaResumo, EventoTipo, EventoPrioridade } from "@/lib/agenda-queries";
import {
  criarEvento, atualizarEvento, excluirEvento,
  atualizarStatusTarefa, criarTarefa, excluirTarefa,
  adicionarAlerta, excluirAlerta,
  type CriarEventoInput,
} from "@/lib/agenda-actions";
import { useRouter } from "next/navigation";

// ─── Helpers visuais ────────────────────────────────────────────────────────
const TIPO_META: Record<EventoTipo, { label: string; icon: React.ElementType; tone: string }> = {
  negocio: { label: "Negócio", icon: Briefcase, tone: "text-brand-cyan bg-brand-cyan/10 border-brand-cyan/25" },
  particular: { label: "Particular", icon: UserIcon, tone: "text-brand-purple bg-brand-purple/10 border-brand-purple/25" },
};

const PRIORIDADE_META: Record<EventoPrioridade, { label: string; tone: string }> = {
  baixa: { label: "Baixa", tone: "bg-muted text-muted-foreground" },
  normal: { label: "Normal", tone: "bg-secondary text-foreground" },
  alta: { label: "Alta", tone: "bg-warning/15 text-warning" },
  critica: { label: "Crítica", tone: "bg-danger/15 text-danger" },
};

function buildMonthGrid(anchor: Date): Date[] {
  const start = startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 });
  const days: Date[] = [];
  let cur = start;
  while (cur <= end) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

function eventColorFromHex(hex: string | null, tipo: EventoTipo): string {
  if (hex) return hex;
  return tipo === "negocio" ? "var(--brand-cyan)" : "var(--brand-purple)";
}

// Convert ISO → "YYYY-MM-DDTHH:mm" para <input type="datetime-local">
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}
function localInputToIso(local: string): string {
  // <input> retorna "YYYY-MM-DDTHH:mm" no horário local
  return new Date(local).toISOString();
}

// ─── Props do view ──────────────────────────────────────────────────────────
type Props = {
  anchorIso: string;             // primeiro dia do mês (ISO)
  eventos: Evento[];
  feriados: Feriado[];
  resumo: AgendaResumo;
};

export function AgendaView({ anchorIso, eventos, feriados, resumo }: Props) {
  const router = useRouter();
  const anchor = React.useMemo(() => parseISO(anchorIso), [anchorIso]);
  const [selectedDay, setSelectedDay] = React.useState<Date>(() => new Date());
  const [creating, setCreating] = React.useState<{ open: boolean; defaultDate?: Date }>({ open: false });
  const [editing, setEditing] = React.useState<Evento | null>(null);

  const monthDays = React.useMemo(() => buildMonthGrid(anchor), [anchor]);
  const eventsByDay = React.useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const e of eventos) {
      const k = format(parseISO(e.inicio_em), "yyyy-MM-dd");
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return m;
  }, [eventos]);
  const feriadosByDay = React.useMemo(() => {
    const m = new Map<string, Feriado>();
    for (const f of feriados) m.set(f.data, f);
    return m;
  }, [feriados]);

  const eventsOfSelectedDay = React.useMemo(() => {
    const k = format(selectedDay, "yyyy-MM-dd");
    return (eventsByDay.get(k) ?? []).slice().sort(
      (a, b) => +new Date(a.inicio_em) - +new Date(b.inicio_em),
    );
  }, [selectedDay, eventsByDay]);

  function navigateMonth(delta: number) {
    const next = delta > 0 ? addMonths(anchor, 1) : subMonths(anchor, 1);
    const ymd = format(next, "yyyy-MM");
    router.push(`/agenda?m=${ymd}`);
  }
  function goToday() {
    const ymd = format(new Date(), "yyyy-MM");
    setSelectedDay(new Date());
    router.push(`/agenda?m=${ymd}`);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] font-semibold text-brand-cyan">
            Agenda · operação 360°
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight mt-1 capitalize">
            {format(anchor, "LLLL 'de' yyyy", { locale: ptBR })}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {resumo.total} {resumo.total === 1 ? "compromisso" : "compromissos"} no mês ·{" "}
            <span className="text-foreground font-semibold">{resumo.agendados}</span> agendados ·{" "}
            <span className="text-warning font-semibold">{resumo.emAndamento}</span> em andamento ·{" "}
            <span className="text-success font-semibold">{resumo.concluidos}</span> concluídos
            {resumo.proximoEvento && (
              <> · próximo: <span className="text-foreground font-semibold">{resumo.proximoEvento.titulo}</span> em{" "}
                {format(parseISO(resumo.proximoEvento.inicio_em), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigateMonth(-1)} aria-label="Mês anterior">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>Hoje</Button>
          <Button variant="outline" size="sm" onClick={() => navigateMonth(1)} aria-label="Próximo mês">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            className="ml-1 bg-gradient-to-r from-brand-cyan to-brand-blue text-white hover:opacity-90"
            onClick={() => setCreating({ open: true, defaultDate: selectedDay })}
          >
            <Plus className="w-4 h-4 mr-1" /> Novo compromisso
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        {/* Month grid */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-7 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground bg-muted/40 border-b border-border">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d, i) => (
              <div key={d} className={cn("px-2 py-2 text-center", (i === 0 || i === 6) && "text-brand-cyan/80")}>
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-[minmax(96px,auto)] divide-x divide-y divide-border/60">
            {monthDays.map((d) => {
              const k = format(d, "yyyy-MM-dd");
              const dayEvents = eventsByDay.get(k) ?? [];
              const feriado = feriadosByDay.get(k);
              const inMonth = isSameMonth(d, anchor);
              const today = isToday(d);
              const selected = isSameDay(d, selectedDay);
              return (
                <button
                  key={k}
                  onClick={() => setSelectedDay(d)}
                  onDoubleClick={() => setCreating({ open: true, defaultDate: d })}
                  className={cn(
                    "group relative text-left px-2 py-1.5 transition-colors min-h-[96px] flex flex-col gap-1",
                    !inMonth && "bg-muted/20 text-muted-foreground/60",
                    isWeekend(d) && inMonth && "bg-muted/10",
                    selected && "ring-2 ring-brand-cyan/50 ring-inset z-10",
                    "hover:bg-secondary/40",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "inline-flex items-center justify-center text-[11px] font-semibold w-6 h-6 rounded-full",
                      today && "bg-brand-cyan text-white",
                    )}>
                      {format(d, "d")}
                    </span>
                    {feriado && (
                      <span title={feriado.nome} className="text-[9px] font-bold uppercase tracking-wider text-danger truncate max-w-[60%]">
                        {feriado.tipo === "facultativo" ? "FAC." : "FER."}
                      </span>
                    )}
                  </div>
                  {feriado && (
                    <div className="text-[9px] text-danger/80 truncate">{feriado.nome}</div>
                  )}
                  <div className="flex flex-col gap-0.5 mt-auto">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const c = eventColorFromHex(ev.cor, ev.tipo);
                      return (
                        <div
                          key={ev.id}
                          className="text-[10px] font-medium leading-tight rounded-[3px] px-1 py-0.5 truncate"
                          style={{ background: `color-mix(in oklab, ${c} 18%, transparent)`, color: c }}
                          title={`${format(parseISO(ev.inicio_em), "HH:mm")} · ${ev.titulo}`}
                        >
                          <span className="opacity-80 mr-1">{format(parseISO(ev.inicio_em), "HH:mm")}</span>
                          {ev.titulo}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[9px] text-muted-foreground font-semibold">
                        + {dayEvents.length - 3} mais
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Day rail */}
        <aside className="rounded-2xl border border-border bg-card flex flex-col">
          <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                {format(selectedDay, "EEEE", { locale: ptBR })}
              </div>
              <div className="font-display text-xl font-bold capitalize">
                {format(selectedDay, "dd 'de' LLLL", { locale: ptBR })}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCreating({ open: true, defaultDate: selectedDay })}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Novo
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scroll-thin p-3 space-y-2 max-h-[640px]">
            {feriadosByDay.get(format(selectedDay, "yyyy-MM-dd")) && (
              <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
                <div>
                  <div className="text-[12px] font-semibold text-danger">
                    {feriadosByDay.get(format(selectedDay, "yyyy-MM-dd"))!.nome}
                  </div>
                  <div className="text-[10px] text-danger/80 uppercase tracking-wider">
                    {feriadosByDay.get(format(selectedDay, "yyyy-MM-dd"))!.tipo}
                  </div>
                </div>
              </div>
            )}
            {eventsOfSelectedDay.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <div className="text-[13px]">Nenhum compromisso neste dia.</div>
                <button
                  className="text-[12px] text-brand-cyan font-semibold mt-2 hover:underline"
                  onClick={() => setCreating({ open: true, defaultDate: selectedDay })}
                >
                  Adicionar o primeiro
                </button>
              </div>
            )}
            {eventsOfSelectedDay.map((ev) => {
              const TipoIcon = TIPO_META[ev.tipo].icon;
              const c = eventColorFromHex(ev.cor, ev.tipo);
              return (
                <button
                  key={ev.id}
                  onClick={() => setEditing(ev)}
                  className="w-full text-left rounded-lg border border-border bg-background hover:border-brand-cyan/40 hover:bg-secondary/30 transition-smooth p-3 group"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-1 self-stretch rounded-full" style={{ background: c }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <TipoIcon className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                          {TIPO_META[ev.tipo].label}
                        </span>
                        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider", PRIORIDADE_META[ev.prioridade].tone)}>
                          {PRIORIDADE_META[ev.prioridade].label}
                        </span>
                      </div>
                      <div className="text-[14px] font-semibold leading-tight truncate">{ev.titulo}</div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                          <Clock className="w-3 h-3" />
                          {ev.dia_inteiro
                            ? "Dia inteiro"
                            : `${format(parseISO(ev.inicio_em), "HH:mm")} – ${format(parseISO(ev.fim_em), "HH:mm")}`}
                        </span>
                        {ev.local && (
                          <span className="inline-flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3" /> {ev.local}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Create dialog */}
      <EventoDialog
        open={creating.open}
        onOpenChange={(o) => setCreating({ open: o })}
        mode="create"
        defaultDate={creating.defaultDate ?? selectedDay}
      />

      {/* Edit dialog */}
      <EventoDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        mode="edit"
        evento={editing}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// EventoDialog — criar / editar evento + tarefas + alertas
// ────────────────────────────────────────────────────────────────────────────
type EventoDialogProps =
  | {
      open: boolean;
      onOpenChange: (o: boolean) => void;
      mode: "create";
      defaultDate: Date;
      evento?: undefined;
    }
  | {
      open: boolean;
      onOpenChange: (o: boolean) => void;
      mode: "edit";
      evento: Evento | null;
      defaultDate?: undefined;
    };

function EventoDialog(props: EventoDialogProps) {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const initialStart = React.useMemo(() => {
    if (isEdit && props.evento) return parseISO(props.evento.inicio_em);
    const d = props.mode === "create" ? new Date(props.defaultDate) : new Date();
    d.setHours(9, 0, 0, 0);
    return d;
  }, [isEdit, props]);
  const initialEnd = React.useMemo(() => {
    if (isEdit && props.evento) return parseISO(props.evento.fim_em);
    const d = new Date(initialStart);
    d.setHours(d.getHours() + 1);
    return d;
  }, [isEdit, props, initialStart]);

  const [titulo, setTitulo] = React.useState(isEdit ? (props.evento?.titulo ?? "") : "");
  const [descricao, setDescricao] = React.useState(isEdit ? (props.evento?.descricao ?? "") : "");
  const [local, setLocal] = React.useState(isEdit ? (props.evento?.local ?? "") : "");
  const [tipo, setTipo] = React.useState<EventoTipo>(isEdit ? (props.evento?.tipo ?? "negocio") : "negocio");
  const [prioridade, setPrioridade] = React.useState<EventoPrioridade>(
    isEdit ? (props.evento?.prioridade ?? "normal") : "normal",
  );
  const [diaInteiro, setDiaInteiro] = React.useState(isEdit ? (props.evento?.dia_inteiro ?? false) : false);
  const [inicio, setInicio] = React.useState(isoToLocalInput(initialStart.toISOString()));
  const [fim, setFim] = React.useState(isoToLocalInput(initialEnd.toISOString()));

  // Tarefas / alertas (somente UI no momento da criação;
  // no modo edit usamos botões dedicados)
  const [novasTarefas, setNovasTarefas] = React.useState<{ titulo: string }[]>([]);
  const [whatsapp, setWhatsapp] = React.useState("");
  const [whatsappAntes, setWhatsappAntes] = React.useState(30);

  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!props.open) {
      setBusy(false);
      setErr(null);
      setNovasTarefas([]);
      setWhatsapp("");
    }
  }, [props.open]);

  // Quando o evento de edição muda, recarrega o form
  React.useEffect(() => {
    if (isEdit && props.evento) {
      setTitulo(props.evento.titulo);
      setDescricao(props.evento.descricao ?? "");
      setLocal(props.evento.local ?? "");
      setTipo(props.evento.tipo);
      setPrioridade(props.evento.prioridade);
      setDiaInteiro(props.evento.dia_inteiro);
      setInicio(isoToLocalInput(props.evento.inicio_em));
      setFim(isoToLocalInput(props.evento.fim_em));
    }
  }, [isEdit, props]);

  async function handleSave() {
    setBusy(true);
    setErr(null);
    try {
      if (isEdit && props.evento) {
        await atualizarEvento({
          id: props.evento.id,
          titulo,
          descricao: descricao || null,
          local: local || null,
          tipo,
          prioridade,
          dia_inteiro: diaInteiro,
          inicio_em: localInputToIso(inicio),
          fim_em: localInputToIso(fim),
        });
      } else {
        const input: CriarEventoInput = {
          titulo,
          descricao: descricao || null,
          local: local || null,
          tipo,
          prioridade,
          dia_inteiro: diaInteiro,
          inicio_em: localInputToIso(inicio),
          fim_em: localInputToIso(fim),
          tarefas: novasTarefas.filter((t) => t.titulo.trim()).map((t) => ({ titulo: t.titulo.trim() })),
          alertas: whatsapp.trim()
            ? [{ canal: "whatsapp", destino: whatsapp.trim(), minutos_antes: whatsappAntes }]
            : undefined,
        };
        await criarEvento(input);
      }
      router.refresh();
      props.onOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!isEdit || !props.evento) return;
    if (!confirm("Excluir este compromisso? Tarefas e alertas serão removidos.")) return;
    setBusy(true);
    try {
      await excluirEvento(props.evento.id);
      router.refresh();
      props.onOpenChange(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <AnimatePresence>
          {props.open && (
            <>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed inset-0 z-50 grid place-items-center p-4 outline-none"
                >
                  <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl">
                    <div className="flex items-start justify-between p-5 border-b border-border/60">
                      <div>
                        <Dialog.Title className="font-display text-lg font-bold">
                          {isEdit ? "Editar compromisso" : "Novo compromisso"}
                        </Dialog.Title>
                        <Dialog.Description className="text-[12px] text-muted-foreground mt-0.5">
                          {isEdit ? "Atualize os detalhes." : "Preencha os campos para agendar."}
                        </Dialog.Description>
                      </div>
                      <Dialog.Close asChild>
                        <button className="w-7 h-7 rounded-md hover:bg-secondary inline-flex items-center justify-center" aria-label="Fechar">
                          <X className="w-4 h-4" />
                        </button>
                      </Dialog.Close>
                    </div>

                    <div className="p-5 space-y-4">
                      <Field label="Título *">
                        <input
                          autoFocus
                          value={titulo}
                          onChange={(e) => setTitulo(e.target.value)}
                          placeholder="Reunião com fornecedor, manutenção, etc."
                          className="form-input"
                        />
                      </Field>

                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Tipo">
                          <select value={tipo} onChange={(e) => setTipo(e.target.value as EventoTipo)} className="form-input">
                            <option value="negocio">Negócio</option>
                            <option value="particular">Particular</option>
                          </select>
                        </Field>
                        <Field label="Prioridade">
                          <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as EventoPrioridade)} className="form-input">
                            <option value="baixa">Baixa</option>
                            <option value="normal">Normal</option>
                            <option value="alta">Alta</option>
                            <option value="critica">Crítica</option>
                          </select>
                        </Field>
                      </div>

                      <label className="flex items-center gap-2 text-[13px]">
                        <input
                          type="checkbox"
                          checked={diaInteiro}
                          onChange={(e) => setDiaInteiro(e.target.checked)}
                          className="accent-brand-cyan w-4 h-4"
                        />
                        Dia inteiro
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Início *">
                          <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} className="form-input font-mono" />
                        </Field>
                        <Field label="Fim *">
                          <input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} className="form-input font-mono" />
                        </Field>
                      </div>

                      <Field label="Local (opcional)">
                        <input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Endereço, sala ou link" className="form-input" />
                      </Field>

                      <Field label="Descrição (opcional)">
                        <textarea
                          value={descricao}
                          onChange={(e) => setDescricao(e.target.value)}
                          rows={3}
                          placeholder="Notas, agenda da reunião, instruções..."
                          className="form-input resize-none"
                        />
                      </Field>

                      {!isEdit && (
                        <>
                          {/* Tarefas iniciais */}
                          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Tarefas iniciais
                              </div>
                              <button
                                type="button"
                                onClick={() => setNovasTarefas((x) => [...x, { titulo: "" }])}
                                className="text-[11px] font-semibold text-brand-cyan hover:underline"
                              >
                                + adicionar
                              </button>
                            </div>
                            {novasTarefas.map((t, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <input
                                  value={t.titulo}
                                  onChange={(e) => setNovasTarefas((x) => x.map((y, j) => (j === i ? { titulo: e.target.value } : y)))}
                                  placeholder={`Tarefa ${i + 1}`}
                                  className="form-input flex-1 text-[13px]"
                                />
                                <button
                                  type="button"
                                  onClick={() => setNovasTarefas((x) => x.filter((_, j) => j !== i))}
                                  className="text-muted-foreground hover:text-danger"
                                  aria-label="Remover tarefa"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Alerta inicial whatsapp */}
                          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <MessageCircle className="w-3.5 h-3.5 text-success" />
                              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Alerta WhatsApp (opcional)
                              </div>
                            </div>
                            <div className="grid grid-cols-[1fr_120px] gap-2">
                              <input
                                value={whatsapp}
                                onChange={(e) => setWhatsapp(e.target.value)}
                                placeholder="+55 31 9 7360-3600"
                                className="form-input text-[13px]"
                              />
                              <select
                                value={whatsappAntes}
                                onChange={(e) => setWhatsappAntes(Number(e.target.value))}
                                className="form-input text-[13px]"
                              >
                                <option value={5}>5 min antes</option>
                                <option value={15}>15 min antes</option>
                                <option value={30}>30 min antes</option>
                                <option value={60}>1 h antes</option>
                                <option value={1440}>1 dia antes</option>
                              </select>
                            </div>
                          </div>
                        </>
                      )}

                      {isEdit && props.evento && (
                        <EventoDetalhesEdicao eventoId={props.evento.id} />
                      )}

                      {err && (
                        <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">
                          {err}
                        </div>
                      )}
                    </div>

                    <div className="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-between gap-2 rounded-b-2xl">
                      {isEdit ? (
                        <Button variant="outline" onClick={handleDelete} disabled={busy} className="text-danger border-danger/30 hover:bg-danger/10">
                          <Trash2 className="w-4 h-4 mr-1" /> Excluir
                        </Button>
                      ) : <div />}
                      <div className="flex items-center gap-2 ml-auto">
                        <Dialog.Close asChild>
                          <Button variant="ghost" disabled={busy}>Cancelar</Button>
                        </Dialog.Close>
                        <Button
                          onClick={handleSave}
                          disabled={busy || !titulo.trim() || !inicio || !fim}
                          className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white hover:opacity-90"
                        >
                          {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                          {isEdit ? "Salvar alterações" : "Criar compromisso"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// EventoDetalhesEdicao — sub-painéis tarefas + alertas (somente no modo edit)
// ────────────────────────────────────────────────────────────────────────────
function EventoDetalhesEdicao({ eventoId }: { eventoId: string }) {
  const router = useRouter();
  const [novaTarefa, setNovaTarefa] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");
  const [antes, setAntes] = React.useState(30);
  const [busy, setBusy] = React.useState(false);

  async function handleAddTarefa() {
    if (!novaTarefa.trim()) return;
    setBusy(true);
    try {
      await criarTarefa(eventoId, novaTarefa.trim());
      setNovaTarefa("");
      router.refresh();
    } finally { setBusy(false); }
  }
  async function handleAddAlerta() {
    if (!whatsapp.trim()) return;
    setBusy(true);
    try {
      await adicionarAlerta(eventoId, "whatsapp", whatsapp.trim(), antes);
      setWhatsapp("");
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-brand-cyan" />
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Adicionar tarefa rápida
          </div>
        </div>
        <div className="flex gap-2">
          <input
            value={novaTarefa}
            onChange={(e) => setNovaTarefa(e.target.value)}
            placeholder="Ex.: Confirmar com o time"
            className="form-input flex-1 text-[13px]"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTarefa())}
          />
          <Button size="sm" onClick={handleAddTarefa} disabled={busy || !novaTarefa.trim()}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-success" />
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Adicionar alerta WhatsApp
          </div>
        </div>
        <div className="grid grid-cols-[1fr_110px_auto] gap-2">
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+55..."
            className="form-input text-[13px]"
          />
          <select value={antes} onChange={(e) => setAntes(Number(e.target.value))} className="form-input text-[13px]">
            <option value={5}>5 min</option>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={60}>1 h</option>
            <option value={1440}>1 dia</option>
          </select>
          <Button size="sm" onClick={handleAddAlerta} disabled={busy || !whatsapp.trim()}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Field — wrapper de label/input
// ────────────────────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}

// Re-exports não usadas mas mantidas para silêncio do linter
void atualizarStatusTarefa; void excluirTarefa; void excluirAlerta;

"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList, Plus, Search, Filter, Calendar as CalendarIcon, AlertTriangle,
  Building2, User, Clock, CheckCircle2, X, Loader2, Save,
  Trash2, MessageSquare, ChevronDown, Edit2, Play, Pause,
  ListChecks, TimerReset, LayoutGrid, List, GanttChart, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { Tarefa, TarefaResumo } from "@/lib/tarefas/queries";
import { criarTarefa, atualizarTarefa, excluirTarefa, type TarefaInput } from "@/lib/tarefas/actions";
import type { KanbanColuna } from "@/lib/tarefas/kanban-queries";
import { KanbanView } from "./kanban-view";
import { CalendarioView } from "./calendario-view";
import { GanttView } from "./gantt-view";
import { ObservadorView } from "./observador-view";

type Unidade = { id: string; nome: string };
type Usuario = { id: string; nome: string };
type Rotina = { id: string; titulo: string };

const STATUS_META: Record<Tarefa["status"], { label: string; tone: string; icon: React.ElementType }> = {
  pendente:     { label: "Pendente",      tone: "muted-foreground", icon: ClipboardList },
  em_andamento: { label: "Em andamento",  tone: "brand-cyan",       icon: Play },
  concluida:    { label: "Concluída",     tone: "success",          icon: CheckCircle2 },
  cancelada:    { label: "Cancelada",     tone: "danger",           icon: X },
  bloqueada:    { label: "Bloqueada",     tone: "warning",          icon: Pause },
};

const PRI_META: Record<Tarefa["prioridade"], { label: string; tone: string }> = {
  baixa:   { label: "Baixa",    tone: "muted-foreground" },
  media:   { label: "Média",    tone: "brand-cyan" },
  alta:    { label: "Alta",     tone: "warning" },
  critica: { label: "Crítica",  tone: "danger" },
};

export function TarefasView({
  tarefas, resumo, unidades, usuarios, rotinas, colunasKanban,
}: {
  tarefas: Tarefa[];
  resumo: TarefaResumo;
  unidades: Unidade[];
  usuarios: Usuario[];
  rotinas: Rotina[];
  colunasKanban: KanbanColuna[];
}) {
  const [view, setView] = React.useState<"lista" | "kanban" | "calendario" | "gantt" | "observador">("kanban");
  const [busca, setBusca] = React.useState("");
  const [filtroStatus, setFiltroStatus] = React.useState<Tarefa["status"] | "todos">("todos");
  const [filtroPri, setFiltroPri] = React.useState<Tarefa["prioridade"] | "todas">("todas");
  const [editando, setEditando] = React.useState<Tarefa | "nova" | null>(null);

  const filtradas = tarefas.filter((t) => {
    if (filtroStatus !== "todos" && t.status !== filtroStatus) return false;
    if (filtroPri !== "todas" && t.prioridade !== filtroPri) return false;
    const b = busca.trim().toLowerCase();
    if (!b) return true;
    return t.titulo.toLowerCase().includes(b)
      || (t.descricao ?? "").toLowerCase().includes(b)
      || (t.atribuida_para_nome ?? "").toLowerCase().includes(b);
  });

  const hojeIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="px-6 lg:px-8 py-6 space-y-5">
      <PageHeader
        eyebrow="Operacional · Gestão"
        title="Tarefas"
        subtitle={`${resumo.total} no total · ${resumo.atrasadas} atrasadas · ${resumo.vencem_hoje} vencem hoje`}
        actions={
          <Button onClick={() => setEditando("nova")} className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white">
            <Plus className="w-3.5 h-3.5 mr-1" /> Nova tarefa
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Total"          valor={resumo.total}                  tone="brand-cyan" icon={ClipboardList} />
        <KpiCard label="Pendentes"      valor={resumo.por_status.pendente}    tone="muted-foreground" icon={ListChecks} />
        <KpiCard label="Em andamento"   valor={resumo.por_status.em_andamento} tone="brand-blue" icon={Play} />
        <KpiCard label="Atrasadas"      valor={resumo.atrasadas}              tone="danger"     icon={AlertTriangle} />
        <KpiCard label="Vencem hoje"    valor={resumo.vencem_hoje}            tone="warning"    icon={TimerReset} />
      </div>

      {/* Switcher de view */}
      <Tabs.Root value={view} onValueChange={(v) => setView(v as typeof view)}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Tabs.List className="flex gap-1 rounded-xl border border-border bg-card p-1 w-fit">
            <ViewTab value="kanban"     icon={LayoutGrid} label="Kanban" />
            <ViewTab value="lista"      icon={List}       label="Lista" />
            <ViewTab value="calendario" icon={CalendarIcon} label="Calendário" />
            <ViewTab value="gantt"      icon={GanttChart} label="Gantt" />
            <ViewTab value="observador" icon={Activity}   label="Observador" />
          </Tabs.List>

          {/* Filtros */}
          <div className="rounded-xl border border-border bg-card p-2 flex flex-wrap items-center gap-2 flex-1 max-w-3xl">
            <Search className="w-4 h-4 text-muted-foreground ml-1" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar..."
              className="flex-1 bg-transparent text-[12px] outline-none min-w-[150px]" />
            <FilterSelect icon={Filter} value={filtroStatus} onChange={(v) => setFiltroStatus(v as typeof filtroStatus)}
              options={[
                { value: "todos", label: "Todos status" },
                ...(Object.keys(STATUS_META) as Tarefa["status"][]).map((k) => ({ value: k, label: STATUS_META[k].label })),
              ]} />
            <FilterSelect icon={AlertTriangle} value={filtroPri} onChange={(v) => setFiltroPri(v as typeof filtroPri)}
              options={[
                { value: "todas", label: "Todas prioridades" },
                ...(Object.keys(PRI_META) as Tarefa["prioridade"][]).map((k) => ({ value: k, label: PRI_META[k].label })),
              ]} />
          </div>
        </div>

        <Tabs.Content value="kanban" className="outline-none mt-4">
          <KanbanView
            tarefas={filtradas}
            colunas={colunasKanban}
            onCardClick={(t) => setEditando(t)}
            onAddTarefa={() => setEditando("nova")}
          />
        </Tabs.Content>

        <Tabs.Content value="calendario" className="outline-none mt-4">
          <CalendarioView tarefas={filtradas} onClick={(t) => setEditando(t)} />
        </Tabs.Content>

        <Tabs.Content value="gantt" className="outline-none mt-4">
          <GanttView tarefas={filtradas} onClick={(t) => setEditando(t)} />
        </Tabs.Content>

        <Tabs.Content value="observador" className="outline-none mt-4">
          <ObservadorView tarefas={filtradas} />
        </Tabs.Content>

        <Tabs.Content value="lista" className="outline-none mt-4">
      {/* Lista */}
      <div className="space-y-2">
        {filtradas.map((t, i) => {
          const Status = STATUS_META[t.status].icon;
          const statusTone = STATUS_META[t.status].tone;
          const priTone = PRI_META[t.prioridade].tone;
          const atrasada = t.prazo && t.prazo.slice(0, 10) < hojeIso
            && (t.status === "pendente" || t.status === "em_andamento");
          const venceHoje = t.prazo && t.prazo.slice(0, 10) === hojeIso
            && (t.status === "pendente" || t.status === "em_andamento");

          return (
            <motion.div key={t.id}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.01, 0.2) }}
              onClick={() => setEditando(t)}
              className={cn(
                "rounded-xl border bg-card p-3 hover:border-brand-cyan transition-smooth cursor-pointer",
                atrasada && "border-danger/30 bg-danger/[0.03]",
                venceHoje && !atrasada && "border-warning/30 bg-warning/[0.03]",
                t.status === "concluida" && "opacity-60",
              )}>
              <div className="flex items-start gap-3">
                <div className={cn("w-9 h-9 rounded-md border flex items-center justify-center shrink-0",
                  `bg-${statusTone}/10 text-${statusTone} border-${statusTone}/30`)}>
                  <Status className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn("font-display font-bold text-[14px]", t.status === "concluida" && "line-through")}>
                      {t.titulo}
                    </div>
                    <span className={cn("inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                      `bg-${priTone}/15 text-${priTone}`)}>
                      {PRI_META[t.prioridade].label}
                    </span>
                    {t.routine_titulo && (
                      <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-brand-purple/15 text-brand-purple">
                        <ListChecks className="w-2.5 h-2.5" /> Rotina
                      </span>
                    )}
                  </div>
                  {t.descricao && (
                    <div className="text-[12px] text-muted-foreground mb-1.5 line-clamp-2">{t.descricao}</div>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    {t.atribuida_para_nome && (
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3 h-3" /> {t.atribuida_para_nome}
                      </span>
                    )}
                    {t.unidade_nome && (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> {t.unidade_nome}
                      </span>
                    )}
                    {t.prazo && (
                      <span className={cn("inline-flex items-center gap-1",
                        atrasada && "text-danger font-bold",
                        venceHoje && "text-warning font-bold",
                      )}>
                        <CalendarIcon className="w-3 h-3" />
                        {new Date(t.prazo).toLocaleDateString("pt-BR")}
                        {atrasada && " · atrasada"}
                        {venceHoje && " · hoje"}
                      </span>
                    )}
                    {t.tempo_estimado_minutes && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {t.tempo_estimado_minutes}min
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
        {filtradas.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-border bg-muted/10 p-12 text-center">
            <ClipboardList className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <div className="text-[13px] font-semibold">Nenhuma tarefa</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Clica em &quot;Nova tarefa&quot; pra começar.
            </div>
          </div>
        )}
      </div>
        </Tabs.Content>
      </Tabs.Root>

      <TarefaDialog
        tarefa={editando === "nova" ? null : editando}
        modoNovo={editando === "nova"}
        unidades={unidades}
        usuarios={usuarios}
        rotinas={rotinas}
        onClose={() => setEditando(null)}
      />
    </div>
  );
}

function ViewTab({ value, icon: Icon, label }: { value: string; icon: React.ElementType; label: string }) {
  return (
    <Tabs.Trigger value={value}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-smooth data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-cyan data-[state=active]:to-brand-blue data-[state=active]:text-white data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-secondary">
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden md:inline">{label}</span>
    </Tabs.Trigger>
  );
}

function KpiCard({ label, valor, tone, icon: Icon }: { label: string; valor: number; tone: string; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">{label}</span>
        <Icon className={cn("w-3.5 h-3.5", `text-${tone}`)} />
      </div>
      <div className={cn("font-display font-bold text-2xl tabular-nums", `text-${tone}`)}>{valor}</div>
    </div>
  );
}

function FilterSelect({ icon: Icon, value, onChange, options }: {
  icon: React.ElementType; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 border border-border bg-muted/30 rounded-md px-2.5 py-1.5">
      <Icon className="w-3 h-3 text-muted-foreground" />
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent text-[11px] outline-none">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function TarefaDialog({ tarefa, modoNovo, unidades, usuarios, rotinas, onClose }: {
  tarefa: Tarefa | null | undefined;
  modoNovo: boolean;
  unidades: Unidade[];
  usuarios: Usuario[];
  rotinas: Rotina[];
  onClose: () => void;
}) {
  const aberto = tarefa !== null && tarefa !== undefined || modoNovo;
  const [form, setForm] = React.useState<TarefaInput>({
    titulo: "", descricao: "", prioridade: "media", status: "pendente",
    unidade_id: null, atribuida_para: null, routine_id: null,
    prazo: null, tempo_estimado_minutes: null, tags: [],
  });
  const [saving, setSaving] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (modoNovo) {
      setForm({
        titulo: "", descricao: "", prioridade: "media", status: "pendente",
        unidade_id: null, atribuida_para: null, routine_id: null,
        prazo: null, tempo_estimado_minutes: null, tags: [],
      });
    } else if (tarefa) {
      setForm({
        titulo: tarefa.titulo,
        descricao: tarefa.descricao,
        prioridade: tarefa.prioridade,
        status: tarefa.status,
        unidade_id: tarefa.unidade_id,
        atribuida_para: tarefa.atribuida_para,
        routine_id: tarefa.routine_id,
        prazo: tarefa.prazo ? tarefa.prazo.slice(0, 10) : null,
        tempo_estimado_minutes: tarefa.tempo_estimado_minutes,
        tags: tarefa.tags,
      });
    }
    setErro(null);
  }, [tarefa, modoNovo]);

  async function salvar() {
    setSaving(true); setErro(null);
    try {
      if (modoNovo) await criarTarefa(form);
      else if (tarefa) await atualizarTarefa(tarefa.id, form);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally { setSaving(false); }
  }

  async function deletar() {
    if (!tarefa) return;
    if (!confirm("Excluir tarefa?")) return;
    setSaving(true);
    try { await excluirTarefa(tarefa.id); onClose(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Erro"); setSaving(false); }
  }

  return (
    <Dialog.Root open={aberto} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <AnimatePresence>
          {aberto && (
            <>
              <Dialog.Overlay asChild forceMount>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
                  className="fixed inset-0 z-50 grid place-items-center p-4">
                  <div className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
                    <div className="p-5 border-b border-border/60 flex items-start justify-between">
                      <Dialog.Title className="font-display text-lg font-bold inline-flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-brand-cyan" />
                        {modoNovo ? "Nova tarefa" : "Editar tarefa"}
                      </Dialog.Title>
                      <Dialog.Close asChild>
                        <button className="w-8 h-8 rounded-md hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4" /></button>
                      </Dialog.Close>
                    </div>

                    <div className="p-5 space-y-3">
                      <Field label="Título">
                        <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="form-input" autoFocus />
                      </Field>
                      <Field label="Descrição">
                        <textarea value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} className="form-input resize-none" />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Prioridade">
                          <select value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value as TarefaInput["prioridade"] })} className="form-input">
                            <option value="baixa">Baixa</option>
                            <option value="media">Média</option>
                            <option value="alta">Alta</option>
                            <option value="critica">Crítica</option>
                          </select>
                        </Field>
                        <Field label="Status">
                          <select value={form.status ?? "pendente"} onChange={(e) => setForm({ ...form, status: e.target.value as TarefaInput["status"] })} className="form-input">
                            <option value="pendente">Pendente</option>
                            <option value="em_andamento">Em andamento</option>
                            <option value="concluida">Concluída</option>
                            <option value="bloqueada">Bloqueada</option>
                            <option value="cancelada">Cancelada</option>
                          </select>
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Unidade">
                          <select value={form.unidade_id ?? ""} onChange={(e) => setForm({ ...form, unidade_id: e.target.value || null })} className="form-input">
                            <option value="">— Qualquer —</option>
                            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                          </select>
                        </Field>
                        <Field label="Atribuída para">
                          <select value={form.atribuida_para ?? ""} onChange={(e) => setForm({ ...form, atribuida_para: e.target.value || null })} className="form-input">
                            <option value="">— Ninguém —</option>
                            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                          </select>
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Prazo">
                          <input type="date" value={form.prazo ?? ""} onChange={(e) => setForm({ ...form, prazo: e.target.value || null })} className="form-input" />
                        </Field>
                        <Field label="Tempo estimado (min)">
                          <input type="number" value={form.tempo_estimado_minutes ?? ""}
                            onChange={(e) => setForm({ ...form, tempo_estimado_minutes: e.target.value ? Number(e.target.value) : null })}
                            className="form-input font-mono" />
                        </Field>
                      </div>
                      <Field label="Vincular a rotina (opcional)">
                        <select value={form.routine_id ?? ""} onChange={(e) => setForm({ ...form, routine_id: e.target.value || null })} className="form-input">
                          <option value="">— Sem rotina —</option>
                          {rotinas.map((r) => <option key={r.id} value={r.id}>{r.titulo}</option>)}
                        </select>
                      </Field>

                      {erro && <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{erro}</div>}
                    </div>

                    <div className="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-between">
                      {!modoNovo && tarefa ? (
                        <Button variant="ghost" onClick={deletar} disabled={saving} className="text-danger">
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                        </Button>
                      ) : <span />}
                      <div className="flex gap-2">
                        <Dialog.Close asChild><Button variant="ghost" disabled={saving}>Cancelar</Button></Dialog.Close>
                        <Button onClick={salvar} disabled={saving || !form.titulo} className="bg-brand-cyan text-primary-foreground">
                          {saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                          <Save className="w-3.5 h-3.5 mr-1" /> Salvar
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

void MessageSquare; void Edit2; void ChevronDown;

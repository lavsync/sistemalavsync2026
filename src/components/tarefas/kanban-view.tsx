"use client";

import * as React from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import {
  Plus, Settings, Edit2, Trash2, X, Loader2, GripVertical, Save,
  Building2, Calendar, Clock, AlertTriangle, User,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Tarefa } from "@/lib/tarefas/queries";
import type { KanbanColuna } from "@/lib/tarefas/kanban-queries";
import {
  moverTarefaKanban, salvarColuna, excluirColuna, type ColunaInput,
} from "@/lib/tarefas/kanban-actions";

const PRI_COLOR: Record<Tarefa["prioridade"], string> = {
  baixa: "var(--muted-foreground)",
  media: "var(--brand-cyan)",
  alta: "var(--warning)",
  critica: "var(--danger)",
};

export function KanbanView({
  tarefas, colunas, onCardClick, onAddTarefa,
}: {
  tarefas: Tarefa[];
  colunas: KanbanColuna[];
  onCardClick?: (t: Tarefa) => void;
  onAddTarefa?: (colunaId: string) => void;
}) {
  const [localTarefas, setLocalTarefas] = React.useState(tarefas);
  const [configOpen, setConfigOpen] = React.useState(false);

  React.useEffect(() => setLocalTarefas(tarefas), [tarefas]);

  function porColuna(colId: string): Tarefa[] {
    return localTarefas
      .filter((t) => (t.kanban_coluna_id ?? colunas.find((c) => c.is_inicial)?.id) === colId)
      .sort((a, b) => (a.prazo ?? "9").localeCompare(b.prazo ?? "9"));
  }

  async function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    if (result.destination.droppableId === result.source.droppableId
        && result.destination.index === result.source.index) return;

    const tarefaId = result.draggableId;
    const novaColunaId = result.destination.droppableId;

    // Optimistic
    setLocalTarefas((arr) => arr.map((t) =>
      t.id === tarefaId ? { ...t, kanban_coluna_id: novaColunaId } : t
    ));

    try {
      await moverTarefaKanban(tarefaId, novaColunaId);
    } catch (e) {
      alert("Erro ao mover: " + (e instanceof Error ? e.message : String(e)));
      setLocalTarefas(tarefas);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setConfigOpen(true)} size="sm" variant="outline" className="text-[12px]">
          <Settings className="w-3.5 h-3.5 mr-1.5" /> Configurar colunas
        </Button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="overflow-x-auto">
          <div className="flex gap-3 min-w-fit pb-2">
            {colunas.map((col) => {
              const cards = porColuna(col.id);
              return (
                <Droppable key={col.id} droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "w-72 shrink-0 rounded-xl border bg-card flex flex-col max-h-[calc(100vh-260px)]",
                        snapshot.isDraggingOver ? "border-brand-cyan ring-2 ring-brand-cyan/30" : "border-border",
                      )}
                    >
                      <div
                        className="px-3 py-2.5 border-b border-border flex items-center justify-between sticky top-0 bg-card rounded-t-xl"
                        style={{ borderTopColor: col.color, borderTopWidth: 3 }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: col.color }} />
                          <span className="font-display font-bold text-[12px] uppercase tracking-wider truncate">{col.label}</span>
                          <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {cards.length}
                          </span>
                        </div>
                        {onAddTarefa && (
                          <button onClick={() => onAddTarefa(col.id)}
                            className="w-6 h-6 rounded hover:bg-secondary inline-flex items-center justify-center"
                            aria-label="Nova tarefa">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {cards.map((t, i) => (
                          <Draggable key={t.id} draggableId={t.id} index={i}>
                            {(prov, snap) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                onClick={() => onCardClick?.(t)}
                                className={cn(
                                  "rounded-lg border border-border bg-background p-2.5 cursor-grab active:cursor-grabbing hover:border-brand-cyan transition-colors",
                                  snap.isDragging && "shadow-2xl rotate-1 ring-2 ring-brand-cyan",
                                )}
                                style={{
                                  ...prov.draggableProps.style,
                                  borderLeftWidth: 3,
                                  borderLeftColor: PRI_COLOR[t.prioridade],
                                }}
                              >
                                <div className="text-[12px] font-semibold mb-1 line-clamp-2">{t.titulo}</div>
                                <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                                  {t.atribuida_para_nome && (
                                    <span className="inline-flex items-center gap-1">
                                      <User className="w-2.5 h-2.5" /> {t.atribuida_para_nome.split(" ")[0]}
                                    </span>
                                  )}
                                  {t.unidade_nome && (
                                    <span className="inline-flex items-center gap-1">
                                      <Building2 className="w-2.5 h-2.5" /> {t.unidade_nome}
                                    </span>
                                  )}
                                  {t.prazo && (
                                    <span className="inline-flex items-center gap-1">
                                      <Calendar className="w-2.5 h-2.5" />
                                      {new Date(t.prazo).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                                    </span>
                                  )}
                                  {t.routine_id && (
                                    <span className="inline-flex items-center gap-1 text-brand-purple font-bold">
                                      ROT
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {cards.length === 0 && (
                          <div className="text-[10px] text-muted-foreground/50 text-center py-3 italic">
                            Sem cards
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </div>
      </DragDropContext>

      <ConfigColunasDialog open={configOpen} onClose={() => setConfigOpen(false)} colunas={colunas} />
    </div>
  );
}

function ConfigColunasDialog({ open, onClose, colunas }: {
  open: boolean; onClose: () => void; colunas: KanbanColuna[];
}) {
  const [editando, setEditando] = React.useState<KanbanColuna | "nova" | null>(null);

  return (
    <>
      <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
        <Dialog.Portal>
          {open && (
            <>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
              <Dialog.Content className="fixed inset-0 z-50 grid place-items-center p-4">
                <div className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl max-h-[80vh] overflow-y-auto">
                  <div className="p-5 border-b border-border/60 flex items-center justify-between">
                    <Dialog.Title className="font-display text-lg font-bold inline-flex items-center gap-2">
                      <Settings className="w-4 h-4 text-brand-cyan" /> Configurar colunas
                    </Dialog.Title>
                    <Dialog.Close asChild>
                      <button className="w-8 h-8 rounded-md hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4" /></button>
                    </Dialog.Close>
                  </div>
                  <div className="p-5 space-y-2">
                    {colunas.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg border border-border bg-muted/20">
                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                        <div className="w-4 h-4 rounded" style={{ background: c.color }} />
                        <div className="flex-1">
                          <div className="font-semibold text-[12px]">{c.label}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{c.codigo} · ordem {c.ordem}</div>
                        </div>
                        {c.is_final && <span className="text-[9px] font-bold uppercase text-success">FINAL</span>}
                        {c.is_inicial && <span className="text-[9px] font-bold uppercase text-brand-cyan">INICIAL</span>}
                        <button onClick={() => setEditando(c)} className="w-7 h-7 rounded hover:bg-secondary inline-flex items-center justify-center" aria-label="Editar">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <Button onClick={() => setEditando("nova")} size="sm" className="w-full mt-3 bg-brand-cyan text-primary-foreground">
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Nova coluna
                    </Button>
                  </div>
                </div>
              </Dialog.Content>
            </>
          )}
        </Dialog.Portal>
      </Dialog.Root>

      <ColunaForm coluna={editando === "nova" ? null : editando} modoNovo={editando === "nova"} onClose={() => setEditando(null)} />
    </>
  );
}

function ColunaForm({ coluna, modoNovo, onClose }: { coluna: KanbanColuna | null | undefined; modoNovo: boolean; onClose: () => void }) {
  const aberto = coluna !== null && coluna !== undefined || modoNovo;
  const [form, setForm] = React.useState<ColunaInput>({
    codigo: "", label: "", color: "#0F859A", ordem: 100,
    status_alvo: "em_andamento", is_final: false, is_inicial: false,
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (modoNovo) {
      setForm({ codigo: "", label: "", color: "#0F859A", ordem: 100, status_alvo: "em_andamento", is_final: false, is_inicial: false });
    } else if (coluna) {
      setForm({
        codigo: coluna.codigo, label: coluna.label, color: coluna.color,
        ordem: coluna.ordem, status_alvo: coluna.status_alvo,
        is_final: coluna.is_final, is_inicial: coluna.is_inicial,
      });
    }
  }, [coluna, modoNovo]);

  async function salvar() {
    setSaving(true);
    try {
      await salvarColuna(coluna?.id ?? null, form);
      onClose();
    } catch (e) {
      alert("Erro: " + (e instanceof Error ? e.message : String(e)));
    } finally { setSaving(false); }
  }

  async function deletar() {
    if (!coluna) return;
    if (!confirm(`Excluir coluna "${coluna.label}"?`)) return;
    setSaving(true);
    try { await excluirColuna(coluna.id); onClose(); }
    catch (e) { alert(e instanceof Error ? e.message : "Erro"); setSaving(false); }
  }

  return (
    <Dialog.Root open={aberto} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        {aberto && (
          <>
            <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" />
            <Dialog.Content className="fixed inset-0 z-[60] grid place-items-center p-4">
              <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
                <div className="p-5 border-b border-border/60 flex items-center justify-between">
                  <Dialog.Title className="font-display text-lg font-bold">
                    {modoNovo ? "Nova coluna" : "Editar coluna"}
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button className="w-8 h-8 rounded-md hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4" /></button>
                  </Dialog.Close>
                </div>
                <div className="p-5 space-y-3">
                  <Campo label="Nome da coluna">
                    <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value, codigo: form.codigo || e.target.value.toLowerCase().replace(/\s+/g, "_") })} className="form-input" autoFocus />
                  </Campo>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Código">
                      <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} className="form-input font-mono" />
                    </Campo>
                    <Campo label="Ordem">
                      <input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })} className="form-input font-mono" />
                    </Campo>
                  </div>
                  <Campo label="Cor">
                    <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="form-input h-9" />
                  </Campo>
                  <Campo label="Status alvo (ao mover pra cá)">
                    <select value={form.status_alvo} onChange={(e) => setForm({ ...form, status_alvo: e.target.value as ColunaInput["status_alvo"] })} className="form-input">
                      <option value="pendente">Pendente</option>
                      <option value="em_andamento">Em andamento</option>
                      <option value="bloqueada">Bloqueada</option>
                      <option value="concluida">Concluída</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </Campo>
                  <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                    <input type="checkbox" checked={form.is_final ?? false} onChange={(e) => setForm({ ...form, is_final: e.target.checked })} />
                    Coluna final (marca tarefa como concluída ao mover pra cá)
                  </label>
                  <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                    <input type="checkbox" checked={form.is_inicial ?? false} onChange={(e) => setForm({ ...form, is_inicial: e.target.checked })} />
                    Coluna inicial (default ao criar tarefa)
                  </label>
                </div>
                <div className="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-between">
                  {!modoNovo && coluna ? (
                    <Button variant="ghost" onClick={deletar} disabled={saving} className="text-danger">
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                    </Button>
                  ) : <span />}
                  <div className="flex gap-2">
                    <Dialog.Close asChild><Button variant="ghost" disabled={saving}>Cancelar</Button></Dialog.Close>
                    <Button onClick={salvar} disabled={saving || !form.label} className="bg-brand-cyan text-primary-foreground">
                      {saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                      <Save className="w-3.5 h-3.5 mr-1" /> Salvar
                    </Button>
                  </div>
                </div>
              </div>
            </Dialog.Content>
          </>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

void Clock; void AlertTriangle;

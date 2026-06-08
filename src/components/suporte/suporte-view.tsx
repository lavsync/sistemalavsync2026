"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import {
  LifeBuoy, Plus, Bug, Lightbulb, Wrench, Headphones, HelpCircle,
  AlertCircle, Save, Loader2, X, Trash2, Building2, Edit2,
  Filter, CheckCircle2, Clock, Flame, MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import type { Ticket, TicketCategoria, TicketPrioridade, TicketStatus } from "@/lib/suporte/queries";
import { salvarTicket, deletarTicket, type TicketInput } from "@/lib/suporte/actions";

type Unidade = { id: string; nome: string };

const CATEGORIAS: Array<{ key: TicketCategoria; label: string; icon: React.ElementType; cor: string }> = [
  { key: "bug",         label: "Bug do sistema",   icon: Bug,        cor: "danger" },
  { key: "sugestao",    label: "Sugestão",         icon: Lightbulb,  cor: "brand-cyan" },
  { key: "maquina",     label: "Máquina",          icon: Wrench,     cor: "warning" },
  { key: "atendimento", label: "Atendimento",      icon: Headphones, cor: "brand-purple" },
  { key: "duvida",      label: "Dúvida",           icon: HelpCircle, cor: "muted-foreground" },
  { key: "outro",       label: "Outro",            icon: AlertCircle,cor: "muted-foreground" },
];
const PRIOS: Array<{ key: TicketPrioridade; label: string; cor: string }> = [
  { key: "baixa",   label: "Baixa",    cor: "muted-foreground" },
  { key: "media",   label: "Média",    cor: "brand-cyan" },
  { key: "alta",    label: "Alta",     cor: "warning" },
  { key: "critica", label: "Crítica",  cor: "danger" },
];
const STATUS: Array<{ key: TicketStatus; label: string; icon: React.ElementType; cor: string }> = [
  { key: "aberto",       label: "Aberto",       icon: Flame,         cor: "danger" },
  { key: "em_andamento", label: "Em andamento", icon: Clock,         cor: "warning" },
  { key: "resolvido",    label: "Resolvido",    icon: CheckCircle2,  cor: "success" },
  { key: "fechado",      label: "Fechado",      icon: CheckCircle2,  cor: "muted-foreground" },
];

const fmtBR = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function SuporteView({
  tickets, unidades, unidadeAtivaId,
}: {
  tickets: Ticket[];
  unidades: Unidade[];
  unidadeAtivaId: string;
}) {
  const [filtroStatus, setFiltroStatus] = React.useState<"todos" | TicketStatus>("todos");
  const [editando, setEditando] = React.useState<Ticket | "novo" | null>(null);

  const filtrados = tickets.filter((t) => filtroStatus === "todos" || t.status === filtroStatus);

  const stats = {
    abertos: tickets.filter((t) => t.status === "aberto").length,
    andamento: tickets.filter((t) => t.status === "em_andamento").length,
    resolvidos: tickets.filter((t) => t.status === "resolvido").length,
    criticos: tickets.filter((t) => t.prioridade === "critica" && t.status !== "resolvido" && t.status !== "fechado").length,
  };

  return (
    <div className="px-6 lg:px-8 py-6 space-y-5">
      <PageHeader
        eyebrow="Sistema · Suporte"
        title="Chamados e tickets internos"
        subtitle="Reporte bugs, sugestões, problemas em máquinas ou dúvidas. Acompanhe o status."
        actions={
          <Button onClick={() => setEditando("novo")} className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white">
            <Plus className="w-3.5 h-3.5 mr-1" /> Abrir chamado
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiQuick icon={Flame}         label="Abertos"      valor={String(stats.abertos)}    tone="danger" />
        <KpiQuick icon={Clock}         label="Em andamento" valor={String(stats.andamento)}  tone="warning" />
        <KpiQuick icon={CheckCircle2}  label="Resolvidos"   valor={String(stats.resolvidos)} tone="success" />
        <KpiQuick icon={AlertCircle}   label="Críticos ativos" valor={String(stats.criticos)} tone="danger" />
      </div>

      {/* Filtro */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Status</span>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}
            className="form-input h-7 py-0 text-[12px]">
            <option value="todos">Todos ({tickets.length})</option>
            {STATUS.map((s) => (
              <option key={s.key} value={s.key}>{s.label} ({tickets.filter((t) => t.status === s.key).length})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela */}
      {filtrados.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-muted/10 p-12 text-center">
          <LifeBuoy className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <div className="text-[13px] font-semibold">Nenhum chamado {filtroStatus !== "todos" ? `(${filtroStatus})` : ""}</div>
          <div className="text-[11px] text-muted-foreground mt-1">Clique em &quot;Abrir chamado&quot; pra reportar.</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-secondary/30 border-b border-border">
              <tr className="text-[9px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left py-2.5 px-3 font-semibold w-12">#</th>
                <th className="text-left py-2.5 px-3 font-semibold">Título</th>
                <th className="text-left py-2.5 px-3 font-semibold">Categoria</th>
                <th className="text-left py-2.5 px-3 font-semibold">Prioridade</th>
                <th className="text-left py-2.5 px-3 font-semibold">Status</th>
                <th className="text-left py-2.5 px-3 font-semibold">Unidade</th>
                <th className="text-right py-2.5 px-3 font-semibold">Aberto em</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtrados.map((t) => <TicketRow key={t.id} t={t} onClick={() => setEditando(t)} />)}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      {editando && (
        <TicketDialog
          open
          onClose={() => setEditando(null)}
          ticket={editando === "novo" ? null : editando}
          unidades={unidades}
          unidadeAtivaId={unidadeAtivaId}
        />
      )}
    </div>
  );
}

function KpiQuick({ icon: Icon, label, valor, tone }: { icon: React.ElementType; label: string; valor: string; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("w-3.5 h-3.5", `text-${tone}`)} />
        <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</div>
      </div>
      <div className={cn("font-display font-bold text-[18px]", `text-${tone}`)}>{valor}</div>
    </div>
  );
}

function TicketRow({ t, onClick }: { t: Ticket; onClick: () => void }) {
  const cat = CATEGORIAS.find((c) => c.key === t.categoria) ?? CATEGORIAS[5];
  const prio = PRIOS.find((p) => p.key === t.prioridade) ?? PRIOS[1];
  const status = STATUS.find((s) => s.key === t.status) ?? STATUS[0];
  const CatIcon = cat.icon;
  const StIcon = status.icon;
  return (
    <motion.tr
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -10 }}
      onClick={onClick}
      className="border-b border-border/40 hover:bg-secondary/20 cursor-pointer"
    >
      <td className="py-2 px-3 font-mono font-bold text-brand-cyan">#{t.numero}</td>
      <td className="py-2 px-3">
        <div className="font-semibold">{t.titulo}</div>
        <div className="text-[10px] text-muted-foreground line-clamp-1">{t.descricao}</div>
      </td>
      <td className="py-2 px-3">
        <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
          `bg-${cat.cor}/15 text-${cat.cor}`)}>
          <CatIcon className="w-2.5 h-2.5" /> {cat.label}
        </span>
      </td>
      <td className="py-2 px-3">
        <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
          `bg-${prio.cor}/15 text-${prio.cor}`)}>{prio.label}</span>
      </td>
      <td className="py-2 px-3">
        <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider",
          `text-${status.cor}`)}>
          <StIcon className="w-2.5 h-2.5" /> {status.label}
        </span>
      </td>
      <td className="py-2 px-3 text-[11px] text-muted-foreground">{t.unidade_nome ?? "Todas"}</td>
      <td className="py-2 px-3 text-right font-mono text-muted-foreground whitespace-nowrap">{fmtBR(t.criado_em)}</td>
    </motion.tr>
  );
}

function TicketDialog({ open, onClose, ticket, unidades, unidadeAtivaId }: {
  open: boolean; onClose: () => void; ticket: Ticket | null;
  unidades: Unidade[]; unidadeAtivaId: string;
}) {
  const [form, setForm] = React.useState<TicketInput>(() => ticket ? {
    id: ticket.id, unidade_id: ticket.unidade_id, titulo: ticket.titulo, descricao: ticket.descricao,
    categoria: ticket.categoria, prioridade: ticket.prioridade, status: ticket.status, resposta: ticket.resposta,
  } : {
    unidade_id: unidadeAtivaId, titulo: "", descricao: "",
    categoria: "bug", prioridade: "media", status: "aberto",
  });
  const [saving, setSaving] = React.useState(false);

  async function salvar() {
    if (!form.titulo.trim() || !form.descricao.trim()) return alert("Título e descrição obrigatórios");
    setSaving(true);
    try { await salvarTicket(form); onClose(); }
    catch (e) { alert("Erro: " + (e instanceof Error ? e.message : String(e))); }
    finally { setSaving(false); }
  }
  async function excluir() {
    if (!form.id) return;
    if (!confirm("Excluir este chamado?")) return;
    setSaving(true);
    try { await deletarTicket(form.id); onClose(); }
    catch (e) { alert("Erro: " + String(e)); }
    finally { setSaving(false); }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <AnimatePresence>
          {open && (
            <>
              <Dialog.Overlay asChild forceMount>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                  className="fixed left-[50%] top-[50%] z-50 w-[min(96vw,640px)] max-h-[92vh] translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-border bg-popover shadow-2xl flex flex-col overflow-hidden">
                  <header className="px-5 py-4 border-b border-border flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-cyan/15 border border-brand-cyan/30 flex items-center justify-center">
                      <LifeBuoy className="w-4 h-4 text-brand-cyan" />
                    </div>
                    <div className="flex-1">
                      <Dialog.Title className="font-display font-bold text-[15px]">
                        {ticket ? `Chamado #${ticket.numero}` : "Abrir chamado"}
                      </Dialog.Title>
                      <Dialog.Description className="text-[12px] text-muted-foreground">
                        {ticket ? "Atualize status, prioridade e resposta" : "Reporte bug, sugestão, problema em máquina, etc."}
                      </Dialog.Description>
                    </div>
                    <Dialog.Close asChild>
                      <button className="w-8 h-8 rounded hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4" /></button>
                    </Dialog.Close>
                  </header>
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                    <Field label="Título *">
                      <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="form-input" placeholder="Ex: Lavadora LV-01 está travando no ciclo final" autoFocus />
                    </Field>
                    <Field label="Descrição *">
                      <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={4} className="form-input resize-none" placeholder="Detalhe o que está acontecendo, passos pra reproduzir, frequência..." />
                    </Field>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Categoria">
                        <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value as TicketInput["categoria"] })} className="form-input">
                          {CATEGORIAS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Prioridade">
                        <select value={form.prioridade} onChange={(e) => setForm({ ...form, prioridade: e.target.value as TicketInput["prioridade"] })} className="form-input">
                          {PRIOS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Unidade">
                        <select value={form.unidade_id ?? ""} onChange={(e) => setForm({ ...form, unidade_id: e.target.value || null })} className="form-input">
                          <option value="">— Todas / Sistema —</option>
                          {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                        </select>
                      </Field>
                      <Field label="Status">
                        <select value={form.status ?? "aberto"} onChange={(e) => setForm({ ...form, status: e.target.value as TicketInput["status"] })} className="form-input">
                          {STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      </Field>
                    </div>
                    {ticket && (
                      <Field label="Resposta / Resolução">
                        <textarea value={form.resposta ?? ""} onChange={(e) => setForm({ ...form, resposta: e.target.value || null })} rows={3} className="form-input resize-none" placeholder="Como foi resolvido, ações tomadas..." />
                      </Field>
                    )}
                  </div>
                  <footer className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
                    {form.id && (
                      <Button variant="outline" onClick={excluir} disabled={saving} className="mr-auto border-danger/40 text-danger hover:bg-danger/10">
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                      </Button>
                    )}
                    <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button onClick={salvar} disabled={saving} className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white">
                      {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />} Salvar
                    </Button>
                  </footer>
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
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

void Building2; void Edit2; void MoreVertical;

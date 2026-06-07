"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Wrench, Plus, Edit2, Trash2, Power, AlertTriangle, CheckCircle2,
  Activity, Droplet, Wind, Smartphone, Layers, Building2,
  Calendar, DollarSign, Clock, X, Save, Loader2, Search, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import type { MaquinaComStats } from "@/lib/manutencao/queries";
import { salvarMaquina, deletarMaquina, autoCadastrarMaquina, type MaquinaInput } from "@/lib/manutencao/actions";

type Unidade = { id: string; nome: string };

const fmtBRL = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtData = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
};

const TIPO_ICON: Record<string, React.ElementType> = {
  lavadora: Droplet, secadora: Wind, totem: Smartphone, dobradora: Layers,
};
const TIPO_LABEL: Record<string, string> = {
  lavadora: "Lavadora", secadora: "Secadora", totem: "Totem", dobradora: "Dobradora",
};

export function ManutencaoView({
  maquinas, unidades, equipamentosNaoCadastrados, unidadeAtivaId,
}: {
  maquinas: MaquinaComStats[];
  unidades: Unidade[];
  equipamentosNaoCadastrados: Array<{ equipamento: string; vendas: number; ultima: string }>;
  unidadeAtivaId: string;
}) {
  const [filtroUnidade, setFiltroUnidade] = React.useState<string>(unidadeAtivaId);
  const [editando, setEditando] = React.useState<MaquinaComStats | "nova" | null>(null);
  const [busca, setBusca] = React.useState("");

  const filtradas = maquinas
    .filter((m) => filtroUnidade === "todas" || m.unidade_id === filtroUnidade)
    .filter((m) => !busca || m.codigo.toLowerCase().includes(busca.toLowerCase()));

  const stats = React.useMemo(() => ({
    total: filtradas.length,
    ativas: filtradas.filter((m) => m.status === "ativa").length,
    manutencao: filtradas.filter((m) => m.status === "manutencao").length,
    semUso: filtradas.filter((m) => (m.dias_sem_uso ?? 999) > 7).length,
    fat30d: filtradas.reduce((s, m) => s + m.faturamento_30d, 0),
  }), [filtradas]);

  return (
    <div className="px-6 lg:px-8 py-6 space-y-5">
      <PageHeader
        eyebrow="Operacional · Sistema"
        title="Manutenção das máquinas"
        subtitle="Status técnico, utilização real (vendas vinculadas), ordens de serviço."
        actions={
          <Button onClick={() => setEditando("nova")} className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white">
            <Plus className="w-3.5 h-3.5 mr-1" /> Nova máquina
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiQuick icon={Activity}      label="Total"            valor={String(stats.total)} tone="brand-cyan" />
        <KpiQuick icon={CheckCircle2}  label="Ativas"           valor={String(stats.ativas)} tone="success" />
        <KpiQuick icon={Wrench}        label="Em manutenção"    valor={String(stats.manutencao)} tone="warning" />
        <KpiQuick icon={AlertTriangle} label="Sem uso > 7d"     valor={String(stats.semUso)} tone="danger" />
        <KpiQuick icon={DollarSign}    label="Faturamento 30d"  valor={fmtBRL(stats.fat30d)} tone="brand-purple" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card">
          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
          <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)}
            className="form-input h-7 py-0 text-[12px]">
            <option value="todas">Todas unidades</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código..." className="form-input h-7 py-0 text-[12px] flex-1 border-none" />
        </div>
      </div>

      {/* Grid de máquinas */}
      {filtradas.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-muted/10 p-12 text-center">
          <Wrench className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <div className="text-[13px] font-semibold">Nenhuma máquina cadastrada</div>
          <div className="text-[11px] text-muted-foreground mt-1">Clique em "Nova máquina" pra começar.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <AnimatePresence>
            {filtradas.map((m) => (
              <MaquinaCard key={m.id} maquina={m} onEdit={() => setEditando(m)} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Equipamentos detectados não cadastrados */}
      {equipamentosNaoCadastrados.length > 0 && (
        <div className="rounded-2xl border border-warning/30 bg-gradient-to-br from-warning/[0.05] to-transparent p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-warning" />
            <h3 className="font-display font-bold text-[14px]">
              {equipamentosNaoCadastrados.length} equipamento{equipamentosNaoCadastrados.length === 1 ? "" : "s"} detectado{equipamentosNaoCadastrados.length === 1 ? "" : "s"} nas vendas sem cadastro
            </h3>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">
            A CLOCK encontrou esses códigos nas suas vendas que ainda não estão cadastrados como máquinas. Clique pra auto-cadastrar.
          </p>
          <div className="space-y-1.5">
            {equipamentosNaoCadastrados.slice(0, 10).map((eq) => (
              <DetectedRow key={eq.equipamento} equipamento={eq} unidadeId={filtroUnidade === "todas" ? unidades[0]?.id ?? "" : filtroUnidade} />
            ))}
          </div>
        </div>
      )}

      {/* Dialog edit/new */}
      {editando && (
        <MaquinaDialog
          open
          onClose={() => setEditando(null)}
          unidades={unidades}
          maquina={editando === "nova" ? null : editando}
          unidadeAtivaId={filtroUnidade !== "todas" ? filtroUnidade : (unidades[0]?.id ?? "")}
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

function MaquinaCard({ maquina: m, onEdit }: { maquina: MaquinaComStats; onEdit: () => void }) {
  const Icon = TIPO_ICON[m.tipo] ?? Activity;
  const statusTone =
    m.status === "ativa" ? "success" :
    m.status === "manutencao" ? "warning" :
    "muted-foreground";
  const statusLabel =
    m.status === "ativa" ? "Operando" :
    m.status === "manutencao" ? "Em manutenção" :
    "Inativa";
  const alertSemUso = (m.dias_sem_uso ?? 0) > 7;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "rounded-2xl border bg-card p-4 transition-smooth hover:shadow-lg",
        alertSemUso ? "border-danger/30" : "border-border"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center",
            m.status === "ativa" ? "bg-success/15 text-success" :
            m.status === "manutencao" ? "bg-warning/15 text-warning" :
            "bg-muted text-muted-foreground"
          )}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-[14px] leading-tight truncate" title={m.codigo}>{m.codigo}</div>
            <div className="text-[10px] text-muted-foreground">
              {TIPO_LABEL[m.tipo]} · {m.unidade_nome} {m.capacidade_kg ? `· ${m.capacidade_kg}kg` : ""}
            </div>
          </div>
        </div>
        <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
          `bg-${statusTone}/15 text-${statusTone}`)}>
          <Power className="w-2.5 h-2.5" /> {statusLabel}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 py-2 border-y border-border/50 my-2">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Vendas 30d</div>
          <div className="font-mono font-bold text-[13px]">{m.vendas_30d}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Fat. 30d</div>
          <div className="font-mono font-bold text-[13px]">{fmtBRL(m.faturamento_30d)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Sem uso</div>
          <div className={cn("font-mono font-bold text-[13px]",
            alertSemUso ? "text-danger" : m.dias_sem_uso != null ? "text-foreground" : "text-muted-foreground")}>
            {m.dias_sem_uso != null ? `${m.dias_sem_uso}d` : "—"}
          </div>
        </div>
      </div>

      {/* Detalhes */}
      <div className="space-y-1 text-[11px] text-muted-foreground">
        {m.fabricante && <div className="flex items-center gap-1.5"><Activity className="w-3 h-3" /> {m.fabricante} {m.modelo ? `· ${m.modelo}` : ""}</div>}
        {m.localizacao && <div className="flex items-center gap-1.5"><Building2 className="w-3 h-3" /> {m.localizacao}</div>}
        {m.equipamento_match && <div className="font-mono">Match: <code className="text-brand-cyan">{m.equipamento_match}</code></div>}
        {m.proxima_manutencao_em && (
          <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Próx. preventiva: {fmtData(m.proxima_manutencao_em)}</div>
        )}
        {m.ultima_venda_em && (
          <div className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> Última venda: {fmtData(m.ultima_venda_em)}</div>
        )}
      </div>

      {alertSemUso && (
        <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-danger font-semibold">
          <AlertTriangle className="w-3.5 h-3.5" /> Inativa há {m.dias_sem_uso} dias — verificar
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-border flex items-center justify-end gap-1">
        <button onClick={onEdit}
          className="px-2 py-1 rounded text-[11px] font-semibold text-brand-cyan hover:bg-brand-cyan/10 inline-flex items-center gap-1">
          <Edit2 className="w-3 h-3" /> Editar
        </button>
      </div>
    </motion.div>
  );
}

function DetectedRow({ equipamento: eq, unidadeId }: { equipamento: { equipamento: string; vendas: number; ultima: string }; unidadeId: string }) {
  const [adding, setAdding] = React.useState(false);
  async function autoadd() {
    if (!unidadeId) return alert("Selecione uma unidade primeiro");
    setAdding(true);
    try { await autoCadastrarMaquina(unidadeId, eq.equipamento); } catch (e) { alert("Erro: " + String(e)); }
    finally { setAdding(false); }
  }
  return (
    <div className="flex items-center gap-2 p-2 rounded bg-card border border-border text-[11px]">
      <div className="flex-1 min-w-0">
        <div className="font-mono font-semibold truncate" title={eq.equipamento}>{eq.equipamento}</div>
        <div className="text-[10px] text-muted-foreground">{eq.vendas} vendas · última {fmtData(eq.ultima)}</div>
      </div>
      <button onClick={autoadd} disabled={adding}
        className="px-2 py-1 rounded bg-warning/15 hover:bg-warning/25 text-warning font-semibold text-[10px] inline-flex items-center gap-1 disabled:opacity-50">
        {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Cadastrar
      </button>
    </div>
  );
}

function MaquinaDialog({ open, onClose, maquina, unidades, unidadeAtivaId }: {
  open: boolean; onClose: () => void; maquina: MaquinaComStats | null;
  unidades: Unidade[]; unidadeAtivaId: string;
}) {
  const [form, setForm] = React.useState<MaquinaInput>(() => maquina ? {
    id: maquina.id, unidade_id: maquina.unidade_id, codigo: maquina.codigo, tipo: maquina.tipo, status: maquina.status,
    capacidade_kg: maquina.capacidade_kg, equipamento_match: maquina.equipamento_match,
    fabricante: maquina.fabricante, modelo: maquina.modelo, serial_number: maquina.serial_number,
    data_aquisicao: maquina.data_aquisicao, valor_aquisicao: maquina.valor_aquisicao,
    ultima_manutencao_em: maquina.ultima_manutencao_em, proxima_manutencao_em: maquina.proxima_manutencao_em,
    localizacao: maquina.localizacao, observacoes: maquina.observacoes,
  } : {
    unidade_id: unidadeAtivaId, codigo: "", tipo: "lavadora", status: "ativa",
  });
  const [saving, setSaving] = React.useState(false);

  async function salvar() {
    if (!form.codigo.trim()) return alert("Código obrigatório");
    setSaving(true);
    try {
      await salvarMaquina(form);
      onClose();
    } catch (e) { alert("Erro: " + (e instanceof Error ? e.message : String(e))); }
    finally { setSaving(false); }
  }

  async function excluir() {
    if (!form.id) return;
    if (!confirm(`Excluir máquina "${form.codigo}"? Esta ação não apaga vendas vinculadas.`)) return;
    setSaving(true);
    try { await deletarMaquina(form.id); onClose(); }
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
                      <Wrench className="w-4 h-4 text-brand-cyan" />
                    </div>
                    <div className="flex-1">
                      <Dialog.Title className="font-display font-bold text-[15px]">{form.id ? "Editar máquina" : "Nova máquina"}</Dialog.Title>
                      <Dialog.Description className="text-[12px] text-muted-foreground">{form.id ? form.codigo : "Cadastre o equipamento"}</Dialog.Description>
                    </div>
                    <Dialog.Close asChild>
                      <button className="w-8 h-8 rounded hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4" /></button>
                    </Dialog.Close>
                  </header>
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Código *">
                        <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} className="form-input" placeholder="LV-01 ou TOT10L-00/176246" autoFocus />
                      </Field>
                      <Field label="Tipo">
                        <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as MaquinaInput["tipo"] })} className="form-input">
                          <option value="lavadora">Lavadora</option>
                          <option value="secadora">Secadora</option>
                          <option value="totem">Totem</option>
                          <option value="dobradora">Dobradora</option>
                        </select>
                      </Field>
                      <Field label="Unidade">
                        <select value={form.unidade_id} onChange={(e) => setForm({ ...form, unidade_id: e.target.value })} className="form-input">
                          {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                        </select>
                      </Field>
                      <Field label="Status">
                        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as MaquinaInput["status"] })} className="form-input">
                          <option value="ativa">Operando</option>
                          <option value="manutencao">Em manutenção</option>
                          <option value="inativa">Inativa</option>
                        </select>
                      </Field>
                      <Field label="Capacidade (kg)">
                        <input type="number" step="0.1" value={form.capacidade_kg ?? ""} onChange={(e) => setForm({ ...form, capacidade_kg: e.target.value ? Number(e.target.value) : null })} className="form-input font-mono" />
                      </Field>
                      <Field label="Match vendas (substring de equipamento)" hint="Ex: '176246' acha 'TOT10L-00/176246 (B827...)'">
                        <input value={form.equipamento_match ?? ""} onChange={(e) => setForm({ ...form, equipamento_match: e.target.value || null })} className="form-input font-mono" placeholder="ex: 176246" />
                      </Field>
                      <Field label="Fabricante">
                        <input value={form.fabricante ?? ""} onChange={(e) => setForm({ ...form, fabricante: e.target.value || null })} className="form-input" placeholder="LG, Brastemp, etc." />
                      </Field>
                      <Field label="Modelo">
                        <input value={form.modelo ?? ""} onChange={(e) => setForm({ ...form, modelo: e.target.value || null })} className="form-input" />
                      </Field>
                      <Field label="Serial">
                        <input value={form.serial_number ?? ""} onChange={(e) => setForm({ ...form, serial_number: e.target.value || null })} className="form-input font-mono" />
                      </Field>
                      <Field label="Localização">
                        <input value={form.localizacao ?? ""} onChange={(e) => setForm({ ...form, localizacao: e.target.value || null })} className="form-input" placeholder="ex: Box 1, parede norte" />
                      </Field>
                      <Field label="Data de aquisição">
                        <input type="date" value={form.data_aquisicao ?? ""} onChange={(e) => setForm({ ...form, data_aquisicao: e.target.value || null })} className="form-input" />
                      </Field>
                      <Field label="Valor aquisição (R$)">
                        <input type="number" step="0.01" value={form.valor_aquisicao ?? ""} onChange={(e) => setForm({ ...form, valor_aquisicao: e.target.value ? Number(e.target.value) : null })} className="form-input font-mono" />
                      </Field>
                      <Field label="Última manutenção">
                        <input type="date" value={form.ultima_manutencao_em ?? ""} onChange={(e) => setForm({ ...form, ultima_manutencao_em: e.target.value || null })} className="form-input" />
                      </Field>
                      <Field label="Próxima manutenção">
                        <input type="date" value={form.proxima_manutencao_em ?? ""} onChange={(e) => setForm({ ...form, proxima_manutencao_em: e.target.value || null })} className="form-input" />
                      </Field>
                    </div>
                    <Field label="Observações">
                      <textarea value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value || null })} rows={3} className="form-input resize-none" />
                    </Field>
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1">{label}</div>
      {children}
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </label>
  );
}

"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import {
  Megaphone, Plus, Send, Eye, Trash2, Save, X, Loader2,
  MessageCircle, Mail, Smartphone, Users, Crown, Heart, TrendingDown,
  UserPlus, AlertTriangle, CheckCircle2, Clock, Sparkles, Building2,
  Edit2, Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import type { Campanha, SegmentoRFM } from "@/lib/marketing/queries";
import {
  salvarCampanha, deletarCampanha, dispararCampanha,
  type CampanhaInput,
} from "@/lib/marketing/actions";
import { ClubeView } from "./clube-view";
import { XoClubView } from "./xoclub-view";
import type { Classificacao, ResumoClube, TemplateMensagem, SituacaoUnidade } from "@/lib/clube/queries";
import type { ResumoXoClub, SaldoCliente, Produto, Resgate, XoClubConfig } from "@/lib/xoclub/queries";
import type { SelecaoUnidades } from "@/lib/unidade-multi";

type Unidade = { id: string; nome: string };

const SEGMENTOS: Array<{ key: SegmentoRFM; label: string; descricao: string; icon: React.ElementType; cor: string }> = [
  { key: "todos", label: "Todos", descricao: "Toda a base ativa com telefone", icon: Users, cor: "brand-cyan" },
  { key: "campeoes", label: "Campeões", descricao: "5+ compras · alta recência", icon: Crown, cor: "brand-purple" },
  { key: "fieis", label: "Fiéis", descricao: "3-4 compras", icon: Heart, cor: "success" },
  { key: "novos", label: "Novos", descricao: "1 compra apenas", icon: UserPlus, cor: "brand-cyan" },
  { key: "em_risco", label: "Em risco", descricao: "30-60 dias sem comprar", icon: AlertTriangle, cor: "warning" },
  { key: "dormentes", label: "Dormentes", descricao: "60+ dias sem comprar", icon: TrendingDown, cor: "danger" },
];

const TEMPLATES_SUGERIDOS: Record<SegmentoRFM, { titulo: string; msg: string }> = {
  todos: { titulo: "Promoção geral", msg: "Olá {primeiro_nome}! 💧 Xô Varal tá com promoção essa semana: leve 2 lavagens pelo preço de 1.5. Te esperamos!" },
  campeoes: { titulo: "Reconhecer fidelidade", msg: "Oi {primeiro_nome}! Você é cliente VIP nosso 👑 Por isso te liberamos uma secagem cortesia na sua próxima visita. Mostra essa mensagem no caixa!" },
  fieis: { titulo: "Fidelizar mais", msg: "Oi {primeiro_nome}! Que tal completar 5 lavagens conosco? Na 5ª, secagem é por nossa conta 🎁" },
  novos: { titulo: "Onboarding 2ª compra", msg: "Olá {primeiro_nome}! Obrigado pela primeira lavagem na Xô Varal 💧 Na 2ª, ganha 30% off no ciclo de secagem. Te esperamos!" },
  em_risco: { titulo: "Reativação suave", msg: "{primeiro_nome}, faz um tempo que não te vemos! Voltou pra Xô Varal antes de virar mês ganha 20% off na lavagem 😊" },
  dormentes: { titulo: "Win-back agressivo", msg: "{primeiro_nome}, voltou esquentando! 🔥 Cupom WINBACK50 = 50% off na próxima lavagem. Válido até domingo." },
};

const CANAIS = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, cor: "success" },
  { key: "email", label: "E-mail", icon: Mail, cor: "brand-cyan" },
  { key: "sms", label: "SMS", icon: Smartphone, cor: "warning" },
] as const;

const fmtBR = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function MarketingView({
  campanhas, unidades, unidadeAtivaId,
  clubeResumo, clubeClassificacoes, clubeMesAplicacao, clubeMesesDisponiveis, clubeTemplates,
  clubeSituacao, clubeSelecaoUnidades,
  xoclubResumo, xoclubSaldos, xoclubProdutos, xoclubResgates, xoclubConfig,
}: {
  campanhas: Campanha[];
  unidades: Unidade[];
  unidadeAtivaId: string;
  clubeResumo: ResumoClube;
  clubeClassificacoes: Classificacao[];
  clubeMesAplicacao: string;
  clubeMesesDisponiveis: string[];
  clubeTemplates: TemplateMensagem[];
  clubeSituacao: SituacaoUnidade[];
  clubeSelecaoUnidades: SelecaoUnidades;
  xoclubResumo: ResumoXoClub;
  xoclubSaldos: SaldoCliente[];
  xoclubProdutos: Produto[];
  xoclubResgates: Resgate[];
  xoclubConfig: XoClubConfig | null;
}) {
  const [tab, setTab] = React.useState<"campanhas" | "clube" | "xoclub">("campanhas");
  const [filtroUnidade, setFiltroUnidade] = React.useState<string>(unidadeAtivaId);
  const [editando, setEditando] = React.useState<Campanha | "nova" | null>(null);
  const [disparando, setDisparando] = React.useState<string | null>(null);

  const filtradas = campanhas.filter((c) =>
    filtroUnidade === "todas" || c.unidade_id === filtroUnidade
  );

  async function onDisparar(c: Campanha) {
    if (!confirm(`Disparar "${c.nome}"?\n\nVai criar envios no log pra todos do segmento ${c.segmento}.\n\nObs: integração WhatsApp ainda não está ativa — você verá a lista de quem receberia e a mensagem renderizada. Pode exportar pra disparar manualmente.`)) return;
    setDisparando(c.id);
    try {
      const r = await dispararCampanha(c.id);
      alert(
        `✓ ${r.destinatarios} alvos · ${r.envios} enfileirados${r.suprimidos > 0 ? ` · ${r.suprimidos} suprimidos por opt-out (SAIR/SAIRPROMO)` : ""}.`,
      );
    } catch (e) {
      alert("Erro: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDisparando(null);
    }
  }

  return (
    <div className="px-6 lg:px-8 py-6 space-y-5">
      <PageHeader
        eyebrow="Operacional · Marketing"
        title="Campanhas, win-back e Clube de Vantagens"
        subtitle="Gestão integrada de comunicação com clientes — RFM, gamificação por níveis, mensagens renderizadas."
        actions={
          tab === "campanhas" ? (
            <Button onClick={() => setEditando("nova")} className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white">
              <Plus className="w-3.5 h-3.5 mr-1" /> Nova campanha
            </Button>
          ) : null
        }
      />

      <Tabs.Root value={tab} onValueChange={(v) => setTab(v as "campanhas" | "clube" | "xoclub")}>
        <Tabs.List className="flex gap-1 rounded-xl border border-border bg-card p-1 w-fit">
          <Tabs.Trigger value="campanhas"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[12px] font-semibold transition-smooth data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-cyan data-[state=active]:to-brand-blue data-[state=active]:text-white data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-secondary">
            <Megaphone className="w-3.5 h-3.5" /> Campanhas
            <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/15">{campanhas.length}</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="clube"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[12px] font-semibold transition-smooth data-[state=active]:bg-gradient-to-r data-[state=active]:from-warning data-[state=active]:to-brand-cyan data-[state=active]:text-white data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-secondary">
            <Trophy className="w-3.5 h-3.5" /> Clube de Vantagens
            <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/15">{clubeResumo.total}</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="xoclub"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[12px] font-semibold transition-smooth data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-purple data-[state=active]:to-brand-cyan data-[state=active]:text-white data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-secondary">
            <Sparkles className="w-3.5 h-3.5" /> XÔ Club
            <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/15">{xoclubResumo.total_clientes}</span>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="campanhas" className="outline-none mt-5 space-y-5">

      {/* Aviso integração */}
      <div className="rounded-xl border border-warning/30 bg-gradient-to-br from-warning/[0.06] to-transparent p-4 flex items-center gap-3">
        <Sparkles className="w-4 h-4 text-warning shrink-0" />
        <div className="flex-1 text-[12px]">
          <strong>WhatsApp não conectado ainda.</strong> A engine CLOCK Relacionamento já está ativa: ao disparar, o sistema renderiza as mensagens, aplica opt-out (SAIR/SAIRPROMO) e enfileira tudo na fila unificada (em dry-run). Você consegue exportar e disparar manualmente. Próximo passo: provider oficial Meta WhatsApp Cloud API.
        </div>
      </div>

      {/* Filtro */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card">
          <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
          <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)}
            className="form-input h-7 py-0 text-[12px]">
            <option value="todas">Todas unidades</option>
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </div>
      </div>

      {/* Lista campanhas */}
      {filtradas.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-muted/10 p-12 text-center">
          <Megaphone className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <div className="text-[13px] font-semibold">Nenhuma campanha</div>
          <div className="text-[11px] text-muted-foreground mt-1">Clique em &quot;Nova campanha&quot; pra criar a primeira.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <AnimatePresence>
            {filtradas.map((c) => (
              <CampanhaCard key={c.id} c={c}
                onEdit={() => setEditando(c)}
                onDisparar={() => onDisparar(c)}
                disparando={disparando === c.id}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Segmentos guia */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display font-bold text-[13px] mb-3 inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-brand-cyan" /> Segmentos disponíveis (RFM)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {SEGMENTOS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.key} className={cn("rounded-lg border border-border p-3 text-[11px]")}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={cn("w-3.5 h-3.5", `text-${s.cor}`)} />
                  <span className="font-display font-bold">{s.label}</span>
                </div>
                <div className="text-muted-foreground">{s.descricao}</div>
              </div>
            );
          })}
        </div>
      </div>

        </Tabs.Content>

        <Tabs.Content value="clube" className="outline-none mt-5">
          <ClubeView
            resumo={clubeResumo}
            classificacoes={clubeClassificacoes}
            mesAplicacao={clubeMesAplicacao}
            mesesDisponiveis={clubeMesesDisponiveis}
            unidades={unidades}
            templates={clubeTemplates}
            selecaoUnidadeIds={clubeSelecaoUnidades.ids}
            situacaoUnidades={clubeSituacao}
            selecaoUnidades={clubeSelecaoUnidades}
          />
        </Tabs.Content>

        <Tabs.Content value="xoclub" className="outline-none mt-5">
          <XoClubView
            resumo={xoclubResumo}
            saldos={xoclubSaldos}
            produtos={xoclubProdutos}
            resgates={xoclubResgates}
            config={xoclubConfig}
            unidades={unidades}
          />
        </Tabs.Content>
      </Tabs.Root>

      {editando && (
        <CampanhaDialog
          open
          onClose={() => setEditando(null)}
          unidades={unidades}
          campanha={editando === "nova" ? null : editando}
          unidadeAtivaId={filtroUnidade !== "todas" ? filtroUnidade : (unidades[0]?.id ?? "")}
        />
      )}
    </div>
  );
}

function CampanhaCard({ c, onEdit, onDisparar, disparando }: {
  c: Campanha; onEdit: () => void; onDisparar: () => void; disparando: boolean;
}) {
  const seg = SEGMENTOS.find((s) => s.key === c.segmento) ?? SEGMENTOS[0];
  const SegIcon = seg.icon;
  const canal = CANAIS.find((ca) => ca.key === c.canal) ?? CANAIS[0];
  const CanIcon = canal.icon;

  const statusTone =
    c.status === "rascunho" ? "muted-foreground" :
    c.status === "agendada" ? "warning" :
    c.status === "enviando" ? "brand-cyan" :
    c.status === "concluida" ? "success" :
    "danger";
  const statusLabel = c.status[0].toUpperCase() + c.status.slice(1);

  return (
    <motion.div
      layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-2xl border border-border bg-card p-4 hover:shadow-lg transition-smooth"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-[14px] truncate">{c.nome}</div>
          {c.descricao && <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{c.descricao}</div>}
        </div>
        <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0",
          `bg-${statusTone}/15 text-${statusTone}`)}>
          {statusLabel}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 my-2">
        <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
          `bg-${seg.cor}/15 text-${seg.cor}`)}>
          <SegIcon className="w-2.5 h-2.5" /> {seg.label}
        </span>
        <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
          `bg-${canal.cor}/15 text-${canal.cor}`)}>
          <CanIcon className="w-2.5 h-2.5" /> {canal.label}
        </span>
      </div>

      <div className="rounded-lg bg-secondary/30 p-2.5 text-[11px] my-2 italic text-muted-foreground line-clamp-3">
        &ldquo;{c.template_mensagem}&rdquo;
      </div>

      {(c.total_destinatarios > 0 || c.total_enviados > 0) && (
        <div className="grid grid-cols-3 gap-1 py-2 border-y border-border/40 my-2 text-[11px]">
          <div><span className="text-muted-foreground">Alvos</span><div className="font-mono font-bold">{c.total_destinatarios}</div></div>
          <div><span className="text-muted-foreground">Enviados</span><div className="font-mono font-bold text-success">{c.total_enviados}</div></div>
          <div><span className="text-muted-foreground">Falhas</span><div className="font-mono font-bold text-danger">{c.total_erros}</div></div>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground mb-2">
        Criada em {fmtBR(c.criado_em)}
        {c.concluida_em && ` · concluída ${fmtBR(c.concluida_em)}`}
      </div>

      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
        <button onClick={onEdit}
          className="px-2 py-1 rounded text-[11px] font-semibold text-muted-foreground hover:bg-secondary inline-flex items-center gap-1">
          <Edit2 className="w-3 h-3" /> Editar
        </button>
        {c.status !== "concluida" && (
          <button onClick={onDisparar} disabled={disparando}
            className="ml-auto px-3 py-1.5 rounded text-[11px] font-bold text-white bg-gradient-to-r from-brand-cyan to-brand-blue hover:opacity-90 inline-flex items-center gap-1 disabled:opacity-50">
            {disparando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Disparar
          </button>
        )}
        {c.status === "concluida" && (
          <a href={`/publicidade/${c.id}`}
            className="ml-auto px-3 py-1.5 rounded text-[11px] font-bold text-brand-cyan border border-brand-cyan/30 hover:bg-brand-cyan/10 inline-flex items-center gap-1">
            <Eye className="w-3 h-3" /> Ver envios
          </a>
        )}
      </div>
    </motion.div>
  );
}

function CampanhaDialog({ open, onClose, campanha, unidades, unidadeAtivaId }: {
  open: boolean; onClose: () => void; campanha: Campanha | null;
  unidades: Unidade[]; unidadeAtivaId: string;
}) {
  const [form, setForm] = React.useState<CampanhaInput>(() => campanha ? {
    id: campanha.id, unidade_id: campanha.unidade_id ?? unidadeAtivaId,
    nome: campanha.nome, descricao: campanha.descricao,
    canal: campanha.canal, template_mensagem: campanha.template_mensagem,
    segmento: campanha.segmento, filtro_dias_sem_compra: campanha.filtro_dias_sem_compra,
    filtro_ltv_minimo: campanha.filtro_ltv_minimo, status: campanha.status,
    agendada_para: campanha.agendada_para,
  } : {
    unidade_id: unidadeAtivaId, nome: "", canal: "whatsapp",
    template_mensagem: TEMPLATES_SUGERIDOS.todos.msg, segmento: "todos", status: "rascunho",
  });
  const [saving, setSaving] = React.useState(false);

  function aplicarTemplate(seg: SegmentoRFM) {
    const t = TEMPLATES_SUGERIDOS[seg];
    setForm({ ...form, segmento: seg, template_mensagem: t.msg, nome: form.nome || t.titulo });
  }

  async function salvar() {
    if (!form.nome.trim()) return alert("Nome obrigatório");
    if (!form.template_mensagem.trim()) return alert("Mensagem obrigatória");
    setSaving(true);
    try { await salvarCampanha(form); onClose(); }
    catch (e) { alert("Erro: " + (e instanceof Error ? e.message : String(e))); }
    finally { setSaving(false); }
  }
  async function excluir() {
    if (!form.id) return;
    if (!confirm(`Excluir campanha "${form.nome}"? Os envios serão apagados também.`)) return;
    setSaving(true);
    try { await deletarCampanha(form.id); onClose(); }
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
                  className="fixed left-[50%] top-[50%] z-50 w-[min(96vw,720px)] max-h-[92vh] translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-border bg-popover shadow-2xl flex flex-col overflow-hidden">
                  <header className="px-5 py-4 border-b border-border flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-cyan/15 border border-brand-cyan/30 flex items-center justify-center">
                      <Megaphone className="w-4 h-4 text-brand-cyan" />
                    </div>
                    <div className="flex-1">
                      <Dialog.Title className="font-display font-bold text-[15px]">{form.id ? "Editar campanha" : "Nova campanha"}</Dialog.Title>
                      <Dialog.Description className="text-[12px] text-muted-foreground">Segmento, template e canal</Dialog.Description>
                    </div>
                    <Dialog.Close asChild>
                      <button className="w-8 h-8 rounded hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4" /></button>
                    </Dialog.Close>
                  </header>
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                    <Field label="Nome *">
                      <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="form-input" placeholder="Ex: Win-back dormentes maio" autoFocus />
                    </Field>
                    <Field label="Descrição">
                      <input value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value || null })} className="form-input" placeholder="Objetivo, observações..." />
                    </Field>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Unidade">
                        <select value={form.unidade_id} onChange={(e) => setForm({ ...form, unidade_id: e.target.value })} className="form-input">
                          {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                        </select>
                      </Field>
                      <Field label="Canal">
                        <select value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value as CampanhaInput["canal"] })} className="form-input">
                          {CANAIS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                      </Field>
                    </div>

                    <Field label="Segmento RFM (clique pra aplicar template)">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                        {SEGMENTOS.map((s) => {
                          const Icon = s.icon;
                          const active = form.segmento === s.key;
                          return (
                            <button key={s.key} type="button" onClick={() => aplicarTemplate(s.key)}
                              className={cn("p-2 rounded-lg border text-left transition-smooth",
                                active ? `border-${s.cor} bg-${s.cor}/10` : "border-border hover:border-border-strong")}>
                              <div className="flex items-center gap-1 mb-0.5">
                                <Icon className={cn("w-3 h-3", `text-${s.cor}`)} />
                                <span className="font-semibold text-[11px]">{s.label}</span>
                              </div>
                              <div className="text-[9px] text-muted-foreground">{s.descricao}</div>
                            </button>
                          );
                        })}
                      </div>
                    </Field>

                    <Field label="Mensagem *" hint="Placeholders: {primeiro_nome}, {nome}, {cpf}, {ultima_compra}">
                      <textarea value={form.template_mensagem} onChange={(e) => setForm({ ...form, template_mensagem: e.target.value })}
                        rows={5} className="form-input resize-none" />
                    </Field>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Filtro: dias sem comprar (opcional)">
                        <input type="number" value={form.filtro_dias_sem_compra ?? ""} onChange={(e) => setForm({ ...form, filtro_dias_sem_compra: e.target.value ? Number(e.target.value) : null })} className="form-input font-mono" placeholder="ex: 30" />
                      </Field>
                      <Field label="Filtro: LTV mínimo (R$)">
                        <input type="number" step="0.01" value={form.filtro_ltv_minimo ?? ""} onChange={(e) => setForm({ ...form, filtro_ltv_minimo: e.target.value ? Number(e.target.value) : null })} className="form-input font-mono" placeholder="ex: 100" />
                      </Field>
                    </div>
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

void Clock;
void CheckCircle2;

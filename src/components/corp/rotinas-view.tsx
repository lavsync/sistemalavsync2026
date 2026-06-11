"use client";

import * as React from "react";
import * as Tabs from "@radix-ui/react-tabs";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  Network, Library, ListTree, BarChart3, ChevronRight, Search,
  Filter, Plus, Edit2, Trash2, Save, X, Loader2, CheckCircle2,
  ListChecks, Calendar, Clock, AlertTriangle, User, Building2,
  Download, FileBox, Sparkles, Layers, Crown, Wrench, Package,
  DollarSign, Megaphone, MessageCircle, Sun, Play, PlayCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type {
  OrgUnit, Categoria, RoutineTemplate, Routine, DashboardRotinas,
  Frequencia, Criticidade,
} from "@/lib/corp/queries";
import type { RotinaHoje } from "@/lib/corp/minhas-rotinas";
import {
  criarRotina, atualizarRotina, excluirRotina, importarTemplates,
  salvarTemplate, excluirTemplate,
  atribuirResponsavelLote, ativarDesativarLote, excluirRotinasLote,
  type RoutineInput, type TemplateInput,
} from "@/lib/corp/actions";
import {
  iniciarExecucao, concluirExecucao, concluirRotinaDireto, marcarStep,
} from "@/lib/corp/execucoes-actions";

type Unidade = { id: string; nome: string };
type Usuario = { id: string; nome: string };

const FREQ_LABEL: Record<Frequencia, string> = {
  continua: "Contínua",
  diaria: "Diária",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  trimestral: "Trimestral",
  sazonal: "Sazonal",
  evento: "Evento",
  contingencia: "Contingência",
  automatica: "Automática",
};

const CRIT_META: Record<Criticidade, { label: string; tone: string }> = {
  baixa:       { label: "Baixa",        tone: "muted-foreground" },
  media:       { label: "Média",        tone: "brand-cyan" },
  alta:        { label: "Alta",         tone: "warning" },
  critica:     { label: "Crítica",      tone: "danger" },
  estrategica: { label: "Estratégica",  tone: "brand-purple" },
  emergencial: { label: "Emergencial",  tone: "danger" },
};

const CAT_ICON_MAP: Record<string, React.ElementType> = {
  PlayCircle: Sparkles, Wrench, Package, DollarSign, Megaphone, MessageCircle,
  AlertTriangle, BarChart3,
};

export function RotinasCorporativasView({
  tree, categorias, templates, rotinas, dashboard, unidades, usuarios, minhasHoje,
}: {
  tree: OrgUnit[];
  categorias: Categoria[];
  templates: RoutineTemplate[];
  rotinas: Routine[];
  dashboard: DashboardRotinas;
  unidades: Unidade[];
  usuarios: Usuario[];
  minhasHoje: RotinaHoje[];
}) {
  const [tab, setTab] = React.useState<"hoje" | "dashboard" | "organograma" | "biblioteca" | "rotinas">("hoje");
  const concluidasHoje = minhasHoje.filter((r) => r.ja_concluida_hoje).length;
  const pendentesHoje = minhasHoje.length - concluidasHoje;

  return (
    <div className="px-6 lg:px-8 py-6 space-y-5">
      <PageHeader
        eyebrow="Operacional · Governança"
        title="Rotinas Corporativas"
        subtitle={`${rotinas.length} rotinas ativas · ${templates.length} templates disponíveis · estrutura organizacional 10 níveis`}
      />

      <Tabs.Root value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <Tabs.List className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 w-fit">
          <TabBtn value="hoje"        icon={Sun}        label={`Minhas Rotinas Hoje (${pendentesHoje})`} />
          <TabBtn value="dashboard"   icon={BarChart3}  label="Dashboard" />
          <TabBtn value="organograma" icon={Network}    label="Organograma" />
          <TabBtn value="biblioteca"  icon={Library}    label={`Biblioteca (${templates.length})`} />
          <TabBtn value="rotinas"     icon={ListTree}   label={`Rotinas (${rotinas.length})`} />
        </Tabs.List>

        <Tabs.Content value="hoje" className="outline-none mt-5">
          <MinhasRotinasHoje rotinas={minhasHoje} />
        </Tabs.Content>

        <Tabs.Content value="dashboard" className="outline-none mt-5">
          <Dashboard d={dashboard} />
        </Tabs.Content>
        <Tabs.Content value="organograma" className="outline-none mt-5">
          <OrganogramaView tree={tree} />
        </Tabs.Content>
        <Tabs.Content value="biblioteca" className="outline-none mt-5">
          <BibliotecaView templates={templates} categorias={categorias} />
        </Tabs.Content>
        <Tabs.Content value="rotinas" className="outline-none mt-5">
          <RotinasList rotinas={rotinas} categorias={categorias} unidades={unidades} usuarios={usuarios} tree={tree} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// MINHAS ROTINAS HOJE
// ────────────────────────────────────────────────────────────
function MinhasRotinasHoje({ rotinas }: { rotinas: RotinaHoje[] }) {
  if (rotinas.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-muted/10 p-12 text-center">
        <Sun className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <div className="text-[13px] font-semibold">Nenhuma rotina pra hoje</div>
        <div className="text-[11px] text-muted-foreground mt-1">
          Importe templates da Biblioteca ou crie rotinas na tab &quot;Rotinas&quot;.
        </div>
      </div>
    );
  }

  const pendentes = rotinas.filter((r) => !r.ja_concluida_hoje);
  const feitas = rotinas.filter((r) => r.ja_concluida_hoje);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <SumStat label="Pendentes" valor={pendentes.length} tone="warning" icon={Clock} />
        <SumStat label="Concluídas" valor={feitas.length} tone="success" icon={CheckCircle2} />
        <SumStat label="Total do dia" valor={rotinas.length} tone="brand-cyan" icon={ListChecks} />
      </div>

      {pendentes.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">A fazer · {pendentes.length}</div>
          {pendentes.map((r) => <RotinaHojeCard key={r.id} rotina={r} />)}
        </div>
      )}

      {feitas.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider font-bold text-success">Feitas hoje · {feitas.length}</div>
          {feitas.map((r) => <RotinaHojeCard key={r.id} rotina={r} />)}
        </div>
      )}
    </div>
  );
}

function SumStat({ label, valor, tone, icon: Icon }: { label: string; valor: number; tone: string; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">{label}</span>
        <Icon className={cn("w-3.5 h-3.5", `text-${tone}`)} />
      </div>
      <div className={cn("font-display font-bold text-3xl tabular-nums", `text-${tone}`)}>{valor}</div>
    </div>
  );
}

function RotinaHojeCard({ rotina }: { rotina: RotinaHoje }) {
  const [aberto, setAberto] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [obs, setObs] = React.useState("");
  const [stepsState, setStepsState] = React.useState<Record<string, boolean>>({});

  const isConcluida = rotina.ja_concluida_hoje;
  const temSteps = rotina.steps.length > 0;
  const corCrit = CRIT_META[rotina.criticidade].tone;

  async function rapidoConcluir() {
    setBusy(true);
    try {
      await concluirRotinaDireto(rotina.id);
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function iniciarChecklist() {
    setBusy(true);
    try {
      await iniciarExecucao(rotina.id);
      setAberto(true);
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function concluirChecklist() {
    if (!rotina.execucao_aberta_id) {
      // sem execução aberta, vamos iniciar+concluir
      setBusy(true);
      try {
        const r = await iniciarExecucao(rotina.id);
        await concluirExecucao(r.executionId, obs || undefined);
      } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
      finally { setBusy(false); }
      return;
    }
    setBusy(true);
    try {
      await concluirExecucao(rotina.execucao_aberta_id, obs || undefined);
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className={cn(
      "rounded-xl border bg-card transition-smooth",
      isConcluida ? "border-success/30 bg-success/[0.03] opacity-70" : "border-border",
    )}>
      <div className="p-4 flex items-start gap-3">
        <div className={cn("w-10 h-10 rounded-md flex items-center justify-center shrink-0",
          isConcluida ? "bg-success/15 text-success" : `bg-${corCrit}/10 text-${corCrit}`)}>
          {isConcluida ? <CheckCircle2 className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className={cn("font-display font-bold text-[14px]", isConcluida && "line-through")}>
              {rotina.titulo}
            </div>
            <span className={cn("inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
              `bg-${corCrit}/15 text-${corCrit}`)}>
              {CRIT_META[rotina.criticidade].label}
            </span>
            {rotina.category_nome && (
              <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ background: `${rotina.category_color}20`, color: rotina.category_color ?? undefined }}>
                {rotina.category_nome}
              </span>
            )}
          </div>
          {rotina.descricao && (
            <div className="text-[12px] text-muted-foreground line-clamp-2 mb-1.5">{rotina.descricao}</div>
          )}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            {rotina.horario_alvo && (
              <span className="inline-flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3" /> {rotina.horario_alvo.slice(0, 5)}
              </span>
            )}
            {rotina.org_unit_nome && (
              <span className="inline-flex items-center gap-1">
                <User className="w-3 h-3" /> {rotina.org_unit_nome}
              </span>
            )}
            {rotina.unidade_nome && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="w-3 h-3" /> {rotina.unidade_nome}
              </span>
            )}
            {rotina.estimated_minutes && (
              <span className="inline-flex items-center gap-1">
                ~{rotina.estimated_minutes}min
              </span>
            )}
            {temSteps && (
              <span className="inline-flex items-center gap-1">
                <ListChecks className="w-3 h-3" /> {rotina.steps.length} steps
              </span>
            )}
          </div>
        </div>
        {!isConcluida && (
          <div className="flex flex-col gap-1.5">
            {temSteps ? (
              rotina.execucao_aberta_id ? (
                <Button onClick={() => setAberto(!aberto)} size="sm" variant="outline" disabled={busy} className="border-brand-cyan text-brand-cyan">
                  {aberto ? "Fechar" : "Abrir checklist"}
                </Button>
              ) : (
                <Button onClick={iniciarChecklist} size="sm" disabled={busy} className="bg-brand-cyan text-primary-foreground">
                  {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1" />}
                  Iniciar
                </Button>
              )
            ) : (
              <Button onClick={rapidoConcluir} size="sm" disabled={busy} className="bg-success text-white">
                {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                Concluir
              </Button>
            )}
          </div>
        )}
      </div>

      {aberto && temSteps && (
        <div className="border-t border-border/40 p-4 bg-muted/10 space-y-2">
          <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Checklist</div>
          {rotina.steps.map((s) => (
            <label key={s.id} className="flex items-start gap-2 text-[12px] cursor-pointer p-2 rounded hover:bg-secondary/40">
              <input
                type="checkbox"
                checked={stepsState[s.id] ?? false}
                onChange={(e) => setStepsState({ ...stepsState, [s.id]: e.target.checked })}
                className="mt-0.5"
              />
              <span className={cn(stepsState[s.id] && "line-through text-muted-foreground")}>
                {s.titulo}
                {s.obrigatorio && <span className="text-danger ml-1">*</span>}
              </span>
            </label>
          ))}
          <textarea value={obs} onChange={(e) => setObs(e.target.value)}
            placeholder="Observações (opcional)..."
            rows={2}
            className="form-input resize-none w-full text-[12px] mt-2" />
          <div className="flex justify-end">
            <Button onClick={concluirChecklist} size="sm" disabled={busy} className="bg-success text-white">
              {busy && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Concluir rotina
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ value, icon: Icon, label }: { value: string; icon: React.ElementType; label: string }) {
  return (
    <Tabs.Trigger value={value}
      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[12px] font-semibold transition-smooth data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-cyan data-[state=active]:to-brand-blue data-[state=active]:text-white data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-secondary">
      <Icon className="w-3.5 h-3.5" /> {label}
    </Tabs.Trigger>
  );
}

// ────────────────────────────────────────────────────────────
// DASHBOARD
// ────────────────────────────────────────────────────────────
function Dashboard({ d }: { d: DashboardRotinas }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Rotinas ativas" valor={d.ativas} tone="brand-cyan" icon={ListTree} />
        <KPI label="Total rotinas"  valor={d.total_rotinas} tone="brand-purple" icon={Layers} />
        <KPI label="Sem responsável" valor={d.sem_responsavel} tone={d.sem_responsavel > 0 ? "warning" : "muted-foreground"} icon={User} />
        <KPI label="Críticas"       valor={d.por_criticidade.critica + d.por_criticidade.emergencial} tone="danger" icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="font-display font-bold text-[14px] mb-3 inline-flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-cyan" /> Por categoria
          </div>
          <div className="space-y-2">
            {d.por_categoria.map((c) => {
              const pct = d.total_rotinas > 0 ? (c.qtd / d.total_rotinas) * 100 : 0;
              return (
                <div key={c.nome} className="flex items-center gap-3 text-[12px]">
                  <div className="font-semibold min-w-[140px]">{c.nome}</div>
                  <div className="h-2 flex-1 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color ?? "var(--brand-cyan)" }} />
                  </div>
                  <div className="font-mono font-bold text-right min-w-[30px]">{c.qtd}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="font-display font-bold text-[14px] mb-3 inline-flex items-center gap-2">
            <Clock className="w-4 h-4 text-warning" /> Por frequência
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(FREQ_LABEL) as Frequencia[]).map((k) => (
              <div key={k} className="flex items-center justify-between p-2 rounded border border-border/40">
                <span className="text-[11px] capitalize">{FREQ_LABEL[k]}</span>
                <span className="font-mono font-bold text-brand-cyan">{d.por_frequencia[k] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="font-display font-bold text-[14px] mb-3 inline-flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-danger" /> Por criticidade
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {(Object.keys(CRIT_META) as Criticidade[]).map((k) => (
            <div key={k} className={cn("rounded-lg border p-3 text-center",
              `bg-${CRIT_META[k].tone}/8 border-${CRIT_META[k].tone}/30`)}>
              <div className={cn("font-display font-bold text-2xl", `text-${CRIT_META[k].tone}`)}>
                {d.por_criticidade[k] ?? 0}
              </div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-1">
                {CRIT_META[k].label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KPI({ label, valor, tone, icon: Icon }: { label: string; valor: number; tone: string; icon: React.ElementType }) {
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

// ────────────────────────────────────────────────────────────
// ORGANOGRAMA
// ────────────────────────────────────────────────────────────
function OrganogramaView({ tree }: { tree: OrgUnit[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="font-display font-bold text-[14px] mb-3 inline-flex items-center gap-2">
        <Network className="w-4 h-4 text-brand-cyan" /> Estrutura organizacional
      </div>
      <div className="text-[11px] text-muted-foreground mb-4">
        Hierarquia: Rede &gt; Diretorias &gt; Operação &gt; Unidades &gt; Funções
      </div>
      <div className="space-y-1">
        {tree.map((node) => <OrgNode key={node.id} node={node} depth={0} />)}
      </div>
    </div>
  );
}

function OrgNode({ node, depth }: { node: OrgUnit; depth: number }) {
  const [open, setOpen] = React.useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const iconByType: Record<string, React.ElementType> = {
    rede: Crown, diretoria: Layers, operacao: Network, unidade: Building2, funcao: User,
  };
  const Icon = iconByType[node.unit_type] ?? Network;

  return (
    <div>
      <div
        onClick={() => hasChildren && setOpen(!open)}
        className={cn("flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-secondary/40 cursor-pointer transition-smooth",
          !hasChildren && "cursor-default")}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}>
        {hasChildren ? (
          <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", open && "rotate-90")} />
        ) : (
          <span className="w-3.5" />
        )}
        <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: `${node.color}20`, color: node.color ?? "#0F859A" }}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="font-semibold text-[12px]">{node.nome}</span>
        <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
          {node.unit_type}
        </span>
        {hasChildren && (
          <span className="text-[10px] text-muted-foreground ml-auto">{node.children!.length} subs</span>
        )}
      </div>
      {open && hasChildren && (
        <div>
          {node.children!.map((c) => <OrgNode key={c.id} node={c} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// BIBLIOTECA
// ────────────────────────────────────────────────────────────
function BibliotecaView({ templates, categorias }: { templates: RoutineTemplate[]; categorias: Categoria[] }) {
  const [busca, setBusca] = React.useState("");
  const [filtroPack, setFiltroPack] = React.useState<string>("todos");
  const [filtroCat, setFiltroCat] = React.useState<string>("todos");
  const [selecionados, setSelecionados] = React.useState<Set<string>>(new Set());
  const [importando, setImportando] = React.useState(false);
  const [editando, setEditando] = React.useState<RoutineTemplate | "novo" | null>(null);

  const packs = Array.from(new Set(templates.map((t) => t.pack)));

  const filtrados = templates.filter((t) => {
    if (filtroPack !== "todos" && t.pack !== filtroPack) return false;
    if (filtroCat !== "todos" && t.category_code !== filtroCat) return false;
    const b = busca.trim().toLowerCase();
    if (!b) return true;
    return t.titulo.toLowerCase().includes(b) || (t.descricao ?? "").toLowerCase().includes(b);
  });

  function toggle(id: string) {
    setSelecionados((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  async function importarSelecionados() {
    if (selecionados.size === 0) return;
    setImportando(true);
    try {
      const r = await importarTemplates(Array.from(selecionados));
      alert(`${r.importadas} rotinas importadas.`);
      setSelecionados(new Set());
    } catch (e) {
      alert("Erro: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar template..."
          className="flex-1 bg-transparent text-[13px] outline-none min-w-[200px]" />
        <div className="inline-flex items-center gap-1.5 border border-border bg-muted/30 rounded-md px-2.5 py-1.5">
          <FileBox className="w-3 h-3 text-muted-foreground" />
          <select value={filtroPack} onChange={(e) => setFiltroPack(e.target.value)} className="bg-transparent text-[11px] outline-none">
            <option value="todos">Todos packs</option>
            {packs.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="inline-flex items-center gap-1.5 border border-border bg-muted/30 rounded-md px-2.5 py-1.5">
          <Filter className="w-3 h-3 text-muted-foreground" />
          <select value={filtroCat} onChange={(e) => setFiltroCat(e.target.value)} className="bg-transparent text-[11px] outline-none">
            <option value="todos">Todas categorias</option>
            {categorias.map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}
          </select>
        </div>
        {selecionados.size > 0 && (
          <Button onClick={importarSelecionados} disabled={importando} className="bg-success text-white">
            {importando ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
            Importar {selecionados.size}
          </Button>
        )}
        <Button onClick={() => setEditando("novo")} className="ml-auto bg-brand-cyan text-primary-foreground">
          <Plus className="w-3.5 h-3.5 mr-1" /> Novo template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filtrados.map((t) => {
          const cat = categorias.find((c) => c.codigo === t.category_code);
          const IconCat = cat?.icon ? (CAT_ICON_MAP[cat.icon] ?? Sparkles) : Sparkles;
          const importada = t.already_imported;
          const selec = selecionados.has(t.id);
          return (
            <div key={t.id}
              className={cn(
                "rounded-xl border bg-card p-4 transition-smooth relative group",
                importada ? "opacity-60" : "cursor-pointer hover:border-brand-cyan",
                selec && "border-brand-cyan ring-2 ring-brand-cyan/30 bg-brand-cyan/[0.03]",
              )}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest(".tpl-edit")) return;
                if (!importada) toggle(t.id);
              }}>
              <button
                onClick={(e) => { e.stopPropagation(); setEditando(t); }}
                className="tpl-edit absolute top-2 right-2 w-7 h-7 rounded hover:bg-secondary inline-flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Editar template">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-start gap-3 mb-2">
                <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: `${cat?.color ?? "#0F859A"}20`, color: cat?.color ?? "#0F859A" }}>
                  <IconCat className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-[13px]">{t.titulo}</div>
                  {t.descricao && <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{t.descricao}</div>}
                </div>
                {importada ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : selec ? (
                  <CheckCircle2 className="w-4 h-4 text-brand-cyan" />
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                  {FREQ_LABEL[t.frequencia]}
                </span>
                <span className={cn("inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                  `bg-${CRIT_META[t.criticidade].tone}/15 text-${CRIT_META[t.criticidade].tone}`)}>
                  {CRIT_META[t.criticidade].label}
                </span>
                {t.estimated_minutes && (
                  <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> ~{t.estimated_minutes}min
                  </span>
                )}
                {t.horario_alvo && (
                  <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" /> {t.horario_alvo.slice(0, 5)}
                  </span>
                )}
                {t.steps && t.steps.length > 0 && (
                  <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                    <ListChecks className="w-2.5 h-2.5" /> {t.steps.length} steps
                  </span>
                )}
                {importada && (
                  <span className="ml-auto text-[10px] text-success font-bold">JÁ IMPORTADA</span>
                )}
              </div>
            </div>
          );
        })}
        {filtrados.length === 0 && (
          <div className="col-span-full text-center text-[12px] text-muted-foreground py-12">
            Nenhum template bate com os filtros.
          </div>
        )}
      </div>

      <TemplateDialog
        template={editando === "novo" ? null : editando}
        modoNovo={editando === "novo"}
        categorias={categorias}
        onClose={() => setEditando(null)} />
    </div>
  );
}

function TemplateDialog({ template, modoNovo, categorias, onClose }: {
  template: RoutineTemplate | null | undefined;
  modoNovo: boolean;
  categorias: Categoria[];
  onClose: () => void;
}) {
  const aberto = template !== null && template !== undefined || modoNovo;
  const [form, setForm] = React.useState<TemplateInput>({
    pack: "lavanderia_core", codigo: "", titulo: "", descricao: "",
    frequencia: "diaria", criticidade: "media", impacto_financeiro: "baixo",
    kpis: [], steps: [], ordem: 100,
  });
  const [stepsLocal, setStepsLocal] = React.useState<Array<{ ordem: number; titulo: string; descricao?: string; obrigatorio?: boolean }>>([]);
  const [saving, setSaving] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (modoNovo) {
      setForm({ pack: "lavanderia_core", codigo: "", titulo: "", descricao: "", frequencia: "diaria", criticidade: "media", impacto_financeiro: "baixo", kpis: [], steps: [], ordem: 100 });
      setStepsLocal([]);
    } else if (template) {
      setForm({
        pack: template.pack, codigo: template.codigo, titulo: template.titulo, descricao: template.descricao,
        category_code: template.category_code, role_unit_code: template.role_unit_code,
        frequencia: template.frequencia, criticidade: template.criticidade,
        impacto_financeiro: template.impacto_financeiro,
        estimated_minutes: template.estimated_minutes,
        sla_ideal_minutes: template.sla_ideal_minutes,
        sla_max_minutes: template.sla_max_minutes,
        horario_alvo: template.horario_alvo,
        dias_semana: template.dias_semana,
        kpis: template.kpis ?? [],
        steps: template.steps ?? [],
        ordem: template.ordem,
      });
      setStepsLocal(template.steps ?? []);
    }
    setErro(null);
  }, [template, modoNovo]);

  function addStep() {
    setStepsLocal([...stepsLocal, { ordem: stepsLocal.length + 1, titulo: "", obrigatorio: true }]);
  }
  function updateStep(i: number, patch: Partial<typeof stepsLocal[0]>) {
    setStepsLocal(stepsLocal.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }
  function removeStep(i: number) {
    setStepsLocal(stepsLocal.filter((_, idx) => idx !== i));
  }

  async function salvar() {
    setSaving(true); setErro(null);
    try {
      await salvarTemplate(template?.id ?? null, { ...form, steps: stepsLocal });
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally { setSaving(false); }
  }

  async function deletar() {
    if (!template) return;
    if (!confirm(`Excluir template "${template.titulo}"?\n\nIsso NÃO afeta rotinas já importadas.`)) return;
    setSaving(true);
    try { await excluirTemplate(template.id); onClose(); }
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
                  <div className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
                    <div className="p-5 border-b border-border/60 flex items-start justify-between">
                      <Dialog.Title className="font-display text-lg font-bold inline-flex items-center gap-2">
                        <Library className="w-4 h-4 text-brand-cyan" />
                        {modoNovo ? "Novo template" : "Editar template"}
                      </Dialog.Title>
                      <Dialog.Close asChild>
                        <button className="w-8 h-8 rounded-md hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4" /></button>
                      </Dialog.Close>
                    </div>

                    <div className="p-5 space-y-3">
                      <Field label="Título"><input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="form-input" autoFocus /></Field>
                      <Field label="Descrição"><textarea value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} className="form-input resize-none" /></Field>

                      <div className="grid grid-cols-3 gap-3">
                        <Field label="Código">
                          <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} className="form-input font-mono text-[11px]" />
                        </Field>
                        <Field label="Pack">
                          <input value={form.pack} onChange={(e) => setForm({ ...form, pack: e.target.value })} className="form-input font-mono text-[11px]" />
                        </Field>
                        <Field label="Ordem">
                          <input type="number" value={form.ordem ?? 100} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })} className="form-input font-mono" />
                        </Field>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Categoria">
                          <select value={form.category_code ?? ""} onChange={(e) => setForm({ ...form, category_code: e.target.value || null })} className="form-input">
                            <option value="">— Sem categoria —</option>
                            {categorias.map((c) => <option key={c.codigo} value={c.codigo}>{c.nome}</option>)}
                          </select>
                        </Field>
                        <Field label="Cargo (código org_unit)">
                          <input value={form.role_unit_code ?? ""} onChange={(e) => setForm({ ...form, role_unit_code: e.target.value || null })} placeholder="FN_ATENDENTE" className="form-input font-mono text-[11px]" />
                        </Field>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <Field label="Frequência">
                          <select value={form.frequencia} onChange={(e) => setForm({ ...form, frequencia: e.target.value as Frequencia })} className="form-input">
                            {(Object.keys(FREQ_LABEL) as Frequencia[]).map((k) => <option key={k} value={k}>{FREQ_LABEL[k]}</option>)}
                          </select>
                        </Field>
                        <Field label="Criticidade">
                          <select value={form.criticidade} onChange={(e) => setForm({ ...form, criticidade: e.target.value as Criticidade })} className="form-input">
                            {(Object.keys(CRIT_META) as Criticidade[]).map((k) => <option key={k} value={k}>{CRIT_META[k].label}</option>)}
                          </select>
                        </Field>
                        <Field label="Impacto financeiro">
                          <select value={form.impacto_financeiro ?? "baixo"} onChange={(e) => setForm({ ...form, impacto_financeiro: e.target.value as TemplateInput["impacto_financeiro"] })} className="form-input">
                            <option value="nenhum">Nenhum</option><option value="baixo">Baixo</option><option value="medio">Médio</option><option value="alto">Alto</option><option value="critico">Crítico</option>
                          </select>
                        </Field>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <Field label="Estimativa (min)">
                          <input type="number" value={form.estimated_minutes ?? ""} onChange={(e) => setForm({ ...form, estimated_minutes: e.target.value ? Number(e.target.value) : null })} className="form-input font-mono" />
                        </Field>
                        <Field label="SLA ideal (min)">
                          <input type="number" value={form.sla_ideal_minutes ?? ""} onChange={(e) => setForm({ ...form, sla_ideal_minutes: e.target.value ? Number(e.target.value) : null })} className="form-input font-mono" />
                        </Field>
                        <Field label="SLA máximo (min)">
                          <input type="number" value={form.sla_max_minutes ?? ""} onChange={(e) => setForm({ ...form, sla_max_minutes: e.target.value ? Number(e.target.value) : null })} className="form-input font-mono" />
                        </Field>
                      </div>

                      <Field label="Horário alvo">
                        <input type="time" value={form.horario_alvo ?? ""} onChange={(e) => setForm({ ...form, horario_alvo: e.target.value || null })} className="form-input" />
                      </Field>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Steps do checklist</div>
                          <button onClick={addStep} type="button" className="text-[11px] text-brand-cyan font-semibold inline-flex items-center gap-1 hover:underline">
                            <Plus className="w-3 h-3" /> Step
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {stepsLocal.map((s, i) => (
                            <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-muted/20 p-2">
                              <span className="text-[10px] font-mono font-bold text-muted-foreground w-6">{i + 1}</span>
                              <input value={s.titulo} onChange={(e) => updateStep(i, { titulo: e.target.value })} placeholder="Descrição do step" className="form-input flex-1 text-[12px] py-1" />
                              <label className="text-[10px] inline-flex items-center gap-1 cursor-pointer">
                                <input type="checkbox" checked={s.obrigatorio ?? true} onChange={(e) => updateStep(i, { obrigatorio: e.target.checked })} /> obrig.
                              </label>
                              <button onClick={() => removeStep(i)} type="button" className="w-6 h-6 rounded hover:bg-danger/10 text-danger inline-flex items-center justify-center">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          {stepsLocal.length === 0 && (
                            <div className="text-[11px] text-muted-foreground/60 italic text-center py-3">Sem steps · clica em &quot;Step&quot; pra adicionar</div>
                          )}
                        </div>
                      </div>

                      {erro && <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{erro}</div>}
                    </div>

                    <div className="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-between">
                      {!modoNovo && template ? (
                        <Button variant="ghost" onClick={deletar} disabled={saving} className="text-danger">
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                        </Button>
                      ) : <span />}
                      <div className="flex gap-2">
                        <Dialog.Close asChild><Button variant="ghost" disabled={saving}>Cancelar</Button></Dialog.Close>
                        <Button onClick={salvar} disabled={saving || !form.titulo || !form.codigo} className="bg-brand-cyan text-primary-foreground">
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

// ────────────────────────────────────────────────────────────
// LISTA DE ROTINAS
// ────────────────────────────────────────────────────────────
function RotinasList({ rotinas, categorias, unidades, usuarios, tree }: {
  rotinas: Routine[]; categorias: Categoria[]; unidades: Unidade[]; usuarios: Usuario[]; tree: OrgUnit[];
}) {
  const [busca, setBusca] = React.useState("");
  const [editando, setEditando] = React.useState<Routine | "nova" | null>(null);
  const [selecionadas, setSelecionadas] = React.useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const [bulkResp, setBulkResp] = React.useState<string>("");

  const filtradas = rotinas.filter((r) => {
    const b = busca.trim().toLowerCase();
    if (!b) return true;
    return r.titulo.toLowerCase().includes(b)
      || (r.descricao ?? "").toLowerCase().includes(b)
      || (r.org_unit_nome ?? "").toLowerCase().includes(b)
      || (r.category_nome ?? "").toLowerCase().includes(b);
  });

  function toggleSel(id: string) {
    setSelecionadas((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selecionarTodas() {
    setSelecionadas(new Set(filtradas.map((r) => r.id)));
  }
  function limparSel() { setSelecionadas(new Set()); }

  async function atribuirResp() {
    if (selecionadas.size === 0) return;
    setBulkBusy(true);
    try {
      const r = await atribuirResponsavelLote(Array.from(selecionadas), bulkResp || null);
      alert(`${r.atualizadas} rotinas atualizadas`);
      limparSel(); setBulkResp("");
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setBulkBusy(false); }
  }
  async function ativarBulk(ativo: boolean) {
    if (selecionadas.size === 0) return;
    setBulkBusy(true);
    try {
      const r = await ativarDesativarLote(Array.from(selecionadas), ativo);
      alert(`${r.atualizadas} rotinas ${ativo ? "ativadas" : "desativadas"}`);
      limparSel();
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setBulkBusy(false); }
  }
  async function excluirBulk() {
    if (selecionadas.size === 0) return;
    if (!confirm(`Excluir PERMANENTEMENTE ${selecionadas.size} rotinas?`)) return;
    setBulkBusy(true);
    try {
      const r = await excluirRotinasLote(Array.from(selecionadas));
      alert(`${r.excluidas} rotinas excluídas`);
      limparSel();
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setBulkBusy(false); }
  }

  // Achata org tree pra função selecionável
  const funcOptions: OrgUnit[] = [];
  function walk(n: OrgUnit) {
    if (n.unit_type === "funcao") funcOptions.push(n);
    n.children?.forEach(walk);
  }
  tree.forEach(walk);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar rotina..."
          className="flex-1 bg-transparent text-[13px] outline-none" />
        <Button onClick={() => setEditando("nova")} size="sm" className="bg-brand-cyan text-primary-foreground">
          <Plus className="w-3.5 h-3.5 mr-1" /> Nova rotina
        </Button>
      </div>

      {/* Barra de bulk actions */}
      {selecionadas.size > 0 && (
        <div className="rounded-xl border border-brand-cyan/40 bg-brand-cyan/8 p-3 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-bold text-brand-cyan">{selecionadas.size} selecionada{selecionadas.size === 1 ? "" : "s"}</span>
          <button onClick={limparSel} className="text-[11px] text-muted-foreground hover:underline">limpar seleção</button>
          <div className="ml-auto inline-flex items-center gap-2 flex-wrap">
            <select value={bulkResp} onChange={(e) => setBulkResp(e.target.value)} className="form-input h-8 text-[12px] py-0">
              <option value="">— sem responsável —</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
            <Button onClick={atribuirResp} size="sm" disabled={bulkBusy} className="bg-brand-cyan text-primary-foreground">
              <User className="w-3.5 h-3.5 mr-1" /> Atribuir
            </Button>
            <Button onClick={() => ativarBulk(true)} size="sm" disabled={bulkBusy} variant="outline">Ativar</Button>
            <Button onClick={() => ativarBulk(false)} size="sm" disabled={bulkBusy} variant="outline">Desativar</Button>
            <Button onClick={excluirBulk} size="sm" disabled={bulkBusy} variant="outline" className="text-danger border-danger/40 hover:bg-danger/10">
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card z-10 border-b border-border">
              <tr className="text-[9px] uppercase tracking-wider text-muted-foreground">
                <th className="text-center py-2 px-2 font-semibold w-8">
                  <input type="checkbox"
                    checked={selecionadas.size > 0 && selecionadas.size === filtradas.length}
                    onChange={() => selecionadas.size === filtradas.length ? limparSel() : selecionarTodas()} />
                </th>
                <th className="text-left py-2 px-3 font-semibold">Rotina</th>
                <th className="text-left py-2 px-3 font-semibold">Categoria</th>
                <th className="text-left py-2 px-3 font-semibold">Função</th>
                <th className="text-left py-2 px-3 font-semibold">Frequência</th>
                <th className="text-left py-2 px-3 font-semibold">Criticidade</th>
                <th className="text-right py-2 px-3 font-semibold">SLA</th>
                <th className="text-left py-2 px-3 font-semibold">Responsável</th>
                <th className="text-center py-2 px-3 font-semibold w-10">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r) => (
                <tr key={r.id}
                  className={cn("border-b border-border/40 hover:bg-secondary/20",
                    selecionadas.has(r.id) && "bg-brand-cyan/5")}>
                  <td className="py-2 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selecionadas.has(r.id)} onChange={() => toggleSel(r.id)} />
                  </td>
                  <td className="py-2 px-3 cursor-pointer" onClick={() => setEditando(r)}>
                    <div className="font-semibold">{r.titulo}</div>
                    {r.horario_alvo && (
                      <div className="text-[10px] text-muted-foreground">
                        <Calendar className="w-2.5 h-2.5 inline mr-0.5" /> {r.horario_alvo.slice(0, 5)}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {r.category_nome && (
                      <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: `${r.category_color}20`, color: r.category_color ?? undefined }}>
                        {r.category_nome}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-[11px]">{r.org_unit_nome ?? "—"}</td>
                  <td className="py-2 px-3 text-[11px]">{FREQ_LABEL[r.frequencia]}</td>
                  <td className="py-2 px-3">
                    <span className={cn("inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                      `bg-${CRIT_META[r.criticidade].tone}/15 text-${CRIT_META[r.criticidade].tone}`)}>
                      {CRIT_META[r.criticidade].label}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-[11px]">
                    {r.sla_ideal_minutes ?? r.estimated_minutes ?? "—"}
                    {r.sla_ideal_minutes && <span className="text-muted-foreground">m</span>}
                  </td>
                  <td className="py-2 px-3 text-[11px]">{r.responsavel_nome ?? <span className="text-warning">— sem —</span>}</td>
                  <td className="py-2 px-3 text-center">
                    <Edit2 className="w-3 h-3 text-muted-foreground inline" />
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-[12px] text-muted-foreground">
                  Nenhuma rotina ainda. Importe templates da Biblioteca pra começar.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RotinaDialog
        rotina={editando === "nova" ? null : editando}
        modoNovo={editando === "nova"}
        categorias={categorias}
        unidades={unidades}
        usuarios={usuarios}
        funcOptions={funcOptions}
        onClose={() => setEditando(null)}
      />
    </div>
  );
}

function RotinaDialog({ rotina, modoNovo, categorias, unidades, usuarios, funcOptions, onClose }: {
  rotina: Routine | null | undefined;
  modoNovo: boolean;
  categorias: Categoria[];
  unidades: Unidade[];
  usuarios: Usuario[];
  funcOptions: OrgUnit[];
  onClose: () => void;
}) {
  const aberto = rotina !== null && rotina !== undefined || modoNovo;
  const [form, setForm] = React.useState<RoutineInput>({
    titulo: "", descricao: "", frequencia: "diaria", criticidade: "media",
    impacto_financeiro: "baixo", operational_weight: 5,
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (modoNovo) {
      setForm({ titulo: "", descricao: "", frequencia: "diaria", criticidade: "media", impacto_financeiro: "baixo", operational_weight: 5 });
    } else if (rotina) {
      setForm({
        titulo: rotina.titulo, descricao: rotina.descricao,
        codigo: rotina.codigo, category_id: rotina.category_id,
        org_unit_id: rotina.org_unit_id, unidade_id: rotina.unidade_id,
        frequencia: rotina.frequencia, criticidade: rotina.criticidade,
        impacto_financeiro: rotina.impacto_financeiro,
        operational_weight: rotina.operational_weight,
        estimated_minutes: rotina.estimated_minutes,
        sla_ideal_minutes: rotina.sla_ideal_minutes,
        sla_max_minutes: rotina.sla_max_minutes,
        horario_alvo: rotina.horario_alvo,
        responsavel_id: rotina.responsavel_id,
        kpis: rotina.kpis,
        ativo: rotina.ativo,
      });
    }
  }, [rotina, modoNovo]);

  async function salvar() {
    setSaving(true);
    try {
      if (modoNovo) await criarRotina(form);
      else if (rotina) await atualizarRotina(rotina.id, form);
      onClose();
    } catch (e) {
      alert("Erro: " + (e instanceof Error ? e.message : String(e)));
    } finally { setSaving(false); }
  }

  async function deletar() {
    if (!rotina) return;
    if (!confirm("Excluir rotina?")) return;
    setSaving(true);
    try { await excluirRotina(rotina.id); onClose(); }
    catch (e) { alert(e instanceof Error ? e.message : "Erro"); setSaving(false); }
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
                  <div className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
                    <div className="p-5 border-b border-border/60 flex items-start justify-between">
                      <Dialog.Title className="font-display text-lg font-bold inline-flex items-center gap-2">
                        <ListTree className="w-4 h-4 text-brand-cyan" />
                        {modoNovo ? "Nova rotina" : "Editar rotina"}
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
                        <textarea value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} className="form-input resize-none" />
                      </Field>

                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Categoria">
                          <select value={form.category_id ?? ""} onChange={(e) => setForm({ ...form, category_id: e.target.value || null })} className="form-input">
                            <option value="">— Sem categoria —</option>
                            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                          </select>
                        </Field>
                        <Field label="Função (cargo)">
                          <select value={form.org_unit_id ?? ""} onChange={(e) => setForm({ ...form, org_unit_id: e.target.value || null })} className="form-input">
                            <option value="">— Sem função —</option>
                            {funcOptions.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                          </select>
                        </Field>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <Field label="Frequência">
                          <select value={form.frequencia} onChange={(e) => setForm({ ...form, frequencia: e.target.value as Frequencia })} className="form-input">
                            {(Object.keys(FREQ_LABEL) as Frequencia[]).map((k) => <option key={k} value={k}>{FREQ_LABEL[k]}</option>)}
                          </select>
                        </Field>
                        <Field label="Criticidade">
                          <select value={form.criticidade} onChange={(e) => setForm({ ...form, criticidade: e.target.value as Criticidade })} className="form-input">
                            {(Object.keys(CRIT_META) as Criticidade[]).map((k) => <option key={k} value={k}>{CRIT_META[k].label}</option>)}
                          </select>
                        </Field>
                        <Field label="Impacto financeiro">
                          <select value={form.impacto_financeiro ?? "baixo"} onChange={(e) => setForm({ ...form, impacto_financeiro: e.target.value as RoutineInput["impacto_financeiro"] })} className="form-input">
                            <option value="nenhum">Nenhum</option>
                            <option value="baixo">Baixo</option>
                            <option value="medio">Médio</option>
                            <option value="alto">Alto</option>
                            <option value="critico">Crítico</option>
                          </select>
                        </Field>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <Field label="Estimativa (min)">
                          <input type="number" value={form.estimated_minutes ?? ""} onChange={(e) => setForm({ ...form, estimated_minutes: e.target.value ? Number(e.target.value) : null })} className="form-input font-mono" />
                        </Field>
                        <Field label="SLA ideal (min)">
                          <input type="number" value={form.sla_ideal_minutes ?? ""} onChange={(e) => setForm({ ...form, sla_ideal_minutes: e.target.value ? Number(e.target.value) : null })} className="form-input font-mono" />
                        </Field>
                        <Field label="SLA máximo (min)">
                          <input type="number" value={form.sla_max_minutes ?? ""} onChange={(e) => setForm({ ...form, sla_max_minutes: e.target.value ? Number(e.target.value) : null })} className="form-input font-mono" />
                        </Field>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Horário alvo">
                          <input type="time" value={form.horario_alvo ?? ""} onChange={(e) => setForm({ ...form, horario_alvo: e.target.value || null })} className="form-input" />
                        </Field>
                        <Field label="Unidade (opcional)">
                          <select value={form.unidade_id ?? ""} onChange={(e) => setForm({ ...form, unidade_id: e.target.value || null })} className="form-input">
                            <option value="">— Todas —</option>
                            {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                          </select>
                        </Field>
                      </div>

                      <Field label="Responsável principal">
                        <select value={form.responsavel_id ?? ""} onChange={(e) => setForm({ ...form, responsavel_id: e.target.value || null })} className="form-input">
                          <option value="">— Sem responsável —</option>
                          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                        </select>
                      </Field>

                      <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                        <input type="checkbox" checked={form.ativo ?? true} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
                        Rotina ativa
                      </label>
                    </div>

                    <div className="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-between">
                      {!modoNovo && rotina ? (
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

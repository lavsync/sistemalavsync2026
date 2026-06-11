"use client";

import * as React from "react";
import * as Tabs from "@radix-ui/react-tabs";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  Coins, Gift, ShoppingBag, Users, TrendingUp, Trophy,
  Award, Crown, Gem, Medal, Search, Filter, Phone,
  Plus, Edit2, Trash2, Check, X, Loader2, Save,
  PackageCheck, PackageOpen, AlertTriangle, Sparkles, Tag,
  CheckCircle2, XCircle, Building2, Wallet, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  NIVEIS_XC, classificarXC, proximoNivelXC, type NivelXoClub, iconDoNivelXC, corDoNivelXC, labelDoNivelXC,
} from "@/lib/xoclub/niveis";
import type {
  ResumoXoClub, SaldoCliente, Produto, Resgate, XoClubConfig,
} from "@/lib/xoclub/queries";
import {
  salvarProduto, deletarProduto, aprovarResgate, entregarResgate, cancelarResgate,
  creditarAjusteManual, salvarConfigXoClub, solicitarResgate,
  type ProdutoInput,
} from "@/lib/xoclub/actions";

type Unidade = { id: string; nome: string };

const fmtBRL = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const NIVEL_ICON_MAP: Record<NivelXoClub, React.ElementType> = {
  bronze: Medal, prata: Award, ouro: Crown, diamante: Gem,
};

export function XoClubView({
  resumo, saldos, produtos, resgates, config, unidades,
}: {
  resumo: ResumoXoClub;
  saldos: SaldoCliente[];
  produtos: Produto[];
  resgates: Resgate[];
  config: XoClubConfig | null;
  unidades: Unidade[];
}) {
  const [tab, setTab] = React.useState<"dashboard" | "saldos" | "store" | "resgates" | "config">("dashboard");
  void unidades;

  return (
    <div className="space-y-5">
      {/* HERO */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-brand-cyan/10 via-brand-blue/5 to-brand-purple/10 p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand-cyan/15 border border-brand-cyan/30 mb-2">
              <Coins className="w-3 h-3 text-brand-cyan" />
              <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-brand-cyan">XÔ CLUB</span>
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight">XÔ Club · Recompensas Xô Varal</h2>
            <p className="text-[12px] text-muted-foreground mt-1">
              Ganhe Xô Coins (XC) e troque por benefícios. 1 BRL = 1 XC.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MiniKPI label="Em circulação" valor={resumo.total_xc_em_circulacao.toLocaleString("pt-BR") + " XC"} tone="brand-cyan" />
            <MiniKPI label="Clientes" valor={resumo.total_clientes.toLocaleString("pt-BR")} tone="brand-purple" />
          </div>
        </div>
      </div>

      <Tabs.Root value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <Tabs.List className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
          <TabBtn value="dashboard" icon={TrendingUp}     label="Dashboard" />
          <TabBtn value="saldos"    icon={Users}          label={`Saldos (${resumo.total_clientes})`} />
          <TabBtn value="store"     icon={ShoppingBag}    label={`Store (${produtos.filter((p) => p.ativo).length})`} />
          <TabBtn value="resgates"  icon={Gift}           label={`Resgates (${resgates.filter((r) => r.status === "solicitado").length})`} />
          <TabBtn value="config"    icon={Sparkles}       label="Configurações" />
        </Tabs.List>

        <Tabs.Content value="dashboard" className="outline-none mt-5">
          <Dashboard resumo={resumo} />
        </Tabs.Content>
        <Tabs.Content value="saldos" className="outline-none mt-5">
          <SaldosView saldos={saldos} />
        </Tabs.Content>
        <Tabs.Content value="store" className="outline-none mt-5">
          <StoreView produtos={produtos} saldos={saldos} />
        </Tabs.Content>
        <Tabs.Content value="resgates" className="outline-none mt-5">
          <ResgatesView resgates={resgates} />
        </Tabs.Content>
        <Tabs.Content value="config" className="outline-none mt-5">
          <ConfigView config={config} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

function TabBtn({ value, icon: Icon, label }: { value: string; icon: React.ElementType; label: string }) {
  return (
    <Tabs.Trigger value={value}
      className="group inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-semibold transition-smooth data-[state=active]:bg-gradient-to-r data-[state=active]:from-brand-cyan data-[state=active]:to-brand-blue data-[state=active]:text-white data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-secondary">
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </Tabs.Trigger>
  );
}

function MiniKPI({ label, valor, tone }: { label: string; valor: string; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-2.5 min-w-[140px]">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">{label}</div>
      <div className={cn("font-display font-bold text-lg tabular-nums", `text-${tone}`)}>{valor}</div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// DASHBOARD
// ────────────────────────────────────────────────────────────
function Dashboard({ resumo }: { resumo: ResumoXoClub }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI label="Total clientes" valor={resumo.total_clientes} icon={Users} tone="brand-cyan" />
        <KPI label="Ativos (45d)" valor={resumo.clientes_ativos} icon={CheckCircle2} tone="success" />
        <KPI label="Inativos" valor={resumo.clientes_inativos} icon={AlertTriangle} tone="warning" />
        <KPI label="XC emitidos" valor={resumo.total_xc_emitidos} icon={Coins} tone="brand-purple" />
        <KPI label="XC resgatados" valor={resumo.total_xc_resgatados} icon={Gift} tone="brand-blue" />
        <KPI label="Em circulação" valor={resumo.total_xc_em_circulacao} icon={Wallet} tone="brand-cyan" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="font-display font-bold text-[14px] mb-3 inline-flex items-center gap-2">
            <Trophy className="w-4 h-4 text-warning" />
            Distribuição por nível
          </div>
          <div className="space-y-2">
            {NIVEIS_XC.map((n) => {
              const Icon = NIVEL_ICON_MAP[n.key];
              const qtd = resumo.por_nivel[n.key] ?? 0;
              const pct = resumo.total_clientes > 0 ? (qtd / resumo.total_clientes) * 100 : 0;
              return (
                <div key={n.key} className="flex items-center gap-3">
                  <div className={cn("w-7 h-7 rounded-md flex items-center justify-center", `bg-${n.cor}/15 text-${n.cor}`)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline justify-between text-[12px]">
                      <span className="font-semibold">{n.label}</span>
                      <span className="text-muted-foreground">
                        {n.xcMax != null ? `${n.xcMin}–${n.xcMax}` : `${n.xcMin}+`} XC
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
                        <div className={cn("h-full rounded-full", `bg-${n.cor}`)} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={cn("font-mono font-bold text-[13px] min-w-[40px] text-right", `text-${n.cor}`)}>{qtd}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="font-display font-bold text-[14px] mb-3 inline-flex items-center gap-2">
            <Trophy className="w-4 h-4 text-brand-cyan" />
            Top 10 saldos
          </div>
          <div className="space-y-1.5">
            {resumo.saldo_top10.map((s, i) => {
              const Icon = NIVEL_ICON_MAP[s.nivel];
              const cor = corDoNivelXC(s.nivel);
              return (
                <div key={s.cliente_id} className="flex items-center gap-2 text-[12px] py-1 border-b border-border/40 last:border-b-0">
                  <span className="font-mono font-bold text-muted-foreground w-6">#{i + 1}</span>
                  <Icon className={cn("w-3.5 h-3.5", `text-${cor}`)} />
                  <span className="flex-1 truncate font-semibold">{s.cliente_nome}</span>
                  <span className="text-[10px] text-muted-foreground">{s.unidade_nome}</span>
                  <span className={cn("font-mono font-bold", `text-${cor}`)}>{s.saldo_atual} XC</span>
                </div>
              );
            })}
            {resumo.saldo_top10.length === 0 && (
              <div className="text-center text-[12px] text-muted-foreground py-6">Sem dados ainda</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, valor, icon: Icon, tone }: { label: string; valor: number; icon: React.ElementType; tone: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">{label}</span>
        <Icon className={cn("w-3.5 h-3.5", `text-${tone}`)} />
      </div>
      <div className={cn("font-display font-bold text-2xl tabular-nums", `text-${tone}`)}>
        {valor.toLocaleString("pt-BR")}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// SALDOS
// ────────────────────────────────────────────────────────────
function SaldosView({ saldos }: { saldos: SaldoCliente[] }) {
  const [busca, setBusca] = React.useState("");
  const [filtroNivel, setFiltroNivel] = React.useState<NivelXoClub | "todos">("todos");
  const [ajustando, setAjustando] = React.useState<SaldoCliente | null>(null);

  const filtrados = saldos.filter((s) => {
    if (filtroNivel !== "todos" && s.nivel !== filtroNivel) return false;
    const b = busca.trim().toLowerCase();
    if (!b) return true;
    return s.cliente_nome.toLowerCase().includes(b)
      || s.cliente_cpf.replace(/\D/g, "").includes(b.replace(/\D/g, ""))
      || (s.cliente_telefone ?? "").includes(b);
  });

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar nome, CPF ou telefone..."
          className="flex-1 bg-transparent text-[13px] outline-none min-w-[200px]" />
        <div className="inline-flex items-center gap-1.5 border border-border bg-muted/30 rounded-md px-2.5 py-1.5">
          <Filter className="w-3 h-3 text-muted-foreground" />
          <select value={filtroNivel} onChange={(e) => setFiltroNivel(e.target.value as NivelXoClub | "todos")}
            className="bg-transparent text-[11px] outline-none">
            <option value="todos">Todos os níveis</option>
            {NIVEIS_XC.map((n) => <option key={n.key} value={n.key}>{n.label}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto max-h-[640px] overflow-y-auto custom-scroll-thin">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card z-10 border-b border-border">
              <tr className="text-[9px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left py-2 px-3 font-semibold w-12">#</th>
                <th className="text-left py-2 px-3 font-semibold">Cliente</th>
                <th className="text-left py-2 px-3 font-semibold">Nível</th>
                <th className="text-left py-2 px-3 font-semibold">Unidade</th>
                <th className="text-right py-2 px-3 font-semibold">Saldo XC</th>
                <th className="text-right py-2 px-3 font-semibold">Lifetime</th>
                <th className="text-right py-2 px-3 font-semibold">Resgatado</th>
                <th className="text-left py-2 px-3 font-semibold">Próximo nível</th>
                <th className="text-center py-2 px-3 font-semibold">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((s, i) => {
                const cor = corDoNivelXC(s.nivel);
                const Icon = NIVEL_ICON_MAP[s.nivel];
                const prox = proximoNivelXC(s.total_ganho_lifetime);
                const ProxIcon = prox.proximo ? NIVEL_ICON_MAP[prox.proximo.key] : null;
                return (
                  <motion.tr key={s.cliente_id}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.005, 0.2) }}
                    className="border-b border-border/40 hover:bg-secondary/20">
                    <td className="py-2 px-3 font-mono font-bold text-muted-foreground">#{i + 1}</td>
                    <td className="py-2 px-3">
                      <div className="font-semibold">{s.cliente_nome}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{s.cliente_cpf}</div>
                    </td>
                    <td className="py-2 px-3">
                      <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                        `bg-${cor}/15 text-${cor}`)}>
                        <Icon className="w-3 h-3" /> {labelDoNivelXC(s.nivel)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-[11px] text-muted-foreground">{s.unidade_nome}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-brand-cyan">{s.saldo_atual}</td>
                    <td className="py-2 px-3 text-right font-mono text-muted-foreground">{s.total_ganho_lifetime}</td>
                    <td className="py-2 px-3 text-right font-mono text-muted-foreground">{s.total_resgatado_lifetime}</td>
                    <td className="py-2 px-3">
                      {prox.proximo && ProxIcon ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px]">
                          <ProxIcon className={cn("w-3 h-3", `text-${prox.proximo.cor}`)} />
                          <span className={cn("font-semibold", `text-${prox.proximo.cor}`)}>{prox.proximo.label}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="font-mono font-bold text-warning">faltam {prox.faltam} XC</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-success font-semibold">
                          <Gem className="w-3 h-3" /> Topo
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button onClick={() => setAjustando(s)}
                        className="text-[10px] font-semibold text-brand-cyan hover:underline inline-flex items-center gap-1">
                        <Edit2 className="w-3 h-3" /> Ajustar
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          {filtrados.length === 0 && (
            <div className="py-12 text-center text-[12px] text-muted-foreground">
              Nenhum cliente bate com os filtros.
            </div>
          )}
        </div>
      </div>

      <AjustarSaldoDialog saldo={ajustando} onClose={() => setAjustando(null)} />
    </div>
  );
}

function AjustarSaldoDialog({ saldo, onClose }: { saldo: SaldoCliente | null; onClose: () => void }) {
  const [xc, setXc] = React.useState("");
  const [motivo, setMotivo] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  React.useEffect(() => { setXc(""); setMotivo(""); setErro(null); setSaving(false); }, [saldo]);

  async function aplicar() {
    if (!saldo) return;
    setSaving(true); setErro(null);
    try {
      await creditarAjusteManual(saldo.cliente_id, parseInt(xc, 10) || 0, motivo);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={!!saldo} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <AnimatePresence>
          {saldo && (
            <>
              <Dialog.Overlay asChild forceMount>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
                  className="fixed inset-0 z-50 grid place-items-center p-4">
                  <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
                    <div className="p-5 border-b border-border/60 flex items-start justify-between">
                      <div>
                        <Dialog.Title className="font-display text-lg font-bold inline-flex items-center gap-2">
                          <Edit2 className="w-4 h-4 text-brand-cyan" /> Ajuste manual de XC
                        </Dialog.Title>
                        <div className="text-[12px] text-muted-foreground mt-0.5">{saldo.cliente_nome}</div>
                      </div>
                      <Dialog.Close asChild>
                        <button className="w-8 h-8 rounded-md hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4" /></button>
                      </Dialog.Close>
                    </div>

                    <div className="p-5 space-y-3">
                      <div className="rounded-lg border border-border bg-muted/20 p-3 text-[12px]">
                        Saldo atual: <span className="font-mono font-bold text-brand-cyan">{saldo.saldo_atual} XC</span>
                      </div>
                      <label className="block">
                        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">XC (positivo credita, negativo debita)</div>
                        <input value={xc} onChange={(e) => setXc(e.target.value)} placeholder="100 ou -50"
                          className="form-input font-mono" autoFocus />
                      </label>
                      <label className="block">
                        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Motivo</div>
                        <input value={motivo} onChange={(e) => setMotivo(e.target.value)}
                          placeholder="Ex: cortesia, ajuste de campanha..."
                          className="form-input" />
                      </label>
                      {erro && <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{erro}</div>}
                    </div>

                    <div className="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-end gap-2">
                      <Dialog.Close asChild><Button variant="ghost" disabled={saving}>Cancelar</Button></Dialog.Close>
                      <Button onClick={aplicar} disabled={saving || !xc || !motivo} className="bg-brand-cyan text-primary-foreground">
                        {saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                        <Save className="w-3.5 h-3.5 mr-1" /> Aplicar
                      </Button>
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
// STORE — Produtos + Resgate manual
// ────────────────────────────────────────────────────────────
function StoreView({ produtos, saldos }: { produtos: Produto[]; saldos: SaldoCliente[] }) {
  const [editando, setEditando] = React.useState<Produto | "novo" | null>(null);
  const [resgatando, setResgatando] = React.useState<Produto | null>(null);

  const fisicos = produtos.filter((p) => p.categoria === "fisico").sort((a, b) => a.ordem - b.ordem);
  const operacionais = produtos.filter((p) => p.categoria === "operacional").sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-muted-foreground">{produtos.length} produtos · {produtos.filter((p) => p.ativo).length} ativos</div>
        <Button onClick={() => setEditando("novo")} size="sm" className="bg-brand-cyan text-primary-foreground">
          <Plus className="w-3.5 h-3.5 mr-1" /> Novo produto
        </Button>
      </div>

      <Secao titulo="Produtos físicos" icon={PackageOpen}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {fisicos.map((p) => (
            <ProdutoCard key={p.id} produto={p} onEditar={() => setEditando(p)} onResgatar={() => setResgatando(p)} />
          ))}
          {fisicos.length === 0 && <div className="col-span-full text-center text-[12px] text-muted-foreground py-6">Sem produtos físicos</div>}
        </div>
      </Secao>

      <Secao titulo="Resgates operacionais (alta margem)" icon={Tag}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {operacionais.map((p) => (
            <ProdutoCard key={p.id} produto={p} onEditar={() => setEditando(p)} onResgatar={() => setResgatando(p)} />
          ))}
          {operacionais.length === 0 && <div className="col-span-full text-center text-[12px] text-muted-foreground py-6">Sem resgates operacionais</div>}
        </div>
      </Secao>

      <ProdutoDialog
        produto={editando === "novo" ? null : editando}
        modoNovo={editando === "novo"}
        onClose={() => setEditando(null)}
      />

      <ResgateClienteDialog
        produto={resgatando}
        saldos={saldos}
        onClose={() => setResgatando(null)}
      />
    </div>
  );
}

function Secao({ titulo, icon: Icon, children }: { titulo: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="font-display font-bold text-[14px] inline-flex items-center gap-2">
        <Icon className="w-4 h-4 text-brand-cyan" /> {titulo}
      </div>
      {children}
    </div>
  );
}

function ProdutoCard({ produto, onEditar, onResgatar }: {
  produto: Produto; onEditar: () => void; onResgatar: () => void;
}) {
  const margem = produto.valor_percebido_brl != null && produto.custo_operacional_brl != null
    ? produto.valor_percebido_brl - produto.custo_operacional_brl : null;
  const semEstoque = produto.estoque != null && produto.estoque <= 0;
  const alertaEstoque = produto.estoque != null && produto.estoque_alerta != null && produto.estoque <= produto.estoque_alerta;

  return (
    <div className={cn("rounded-xl border bg-card p-4 transition-smooth", !produto.ativo && "opacity-60")}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-[14px]">{produto.nome}</div>
          {produto.descricao && <div className="text-[11px] text-muted-foreground mt-0.5">{produto.descricao}</div>}
        </div>
        <button onClick={onEditar} className="w-7 h-7 rounded-md hover:bg-secondary inline-flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Editar">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-baseline justify-between mt-3 pb-3 border-b border-border/40">
        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Custo</div>
        <div className="inline-flex items-center gap-1">
          <Coins className="w-4 h-4 text-brand-cyan" />
          <span className="font-display font-bold text-2xl text-brand-cyan tabular-nums">{produto.custo_xc}</span>
          <span className="text-[10px] text-muted-foreground font-bold">XC</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] mt-3">
        {produto.valor_percebido_brl != null && (
          <div>
            <div className="text-muted-foreground text-[9px] uppercase tracking-wider">Valor percebido</div>
            <div className="font-mono font-bold">{fmtBRL(produto.valor_percebido_brl)}</div>
          </div>
        )}
        {produto.custo_operacional_brl != null && (
          <div>
            <div className="text-muted-foreground text-[9px] uppercase tracking-wider">Custo real</div>
            <div className="font-mono font-bold text-danger">{fmtBRL(produto.custo_operacional_brl)}</div>
          </div>
        )}
        {margem != null && (
          <div>
            <div className="text-muted-foreground text-[9px] uppercase tracking-wider">Margem</div>
            <div className="font-mono font-bold text-success">{fmtBRL(margem)}</div>
          </div>
        )}
        {produto.estoque != null && (
          <div>
            <div className="text-muted-foreground text-[9px] uppercase tracking-wider">Estoque</div>
            <div className={cn("font-mono font-bold",
              semEstoque ? "text-danger" : alertaEstoque ? "text-warning" : "text-foreground")}>
              {produto.estoque}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onResgatar}
        disabled={!produto.ativo || semEstoque}
        className="w-full mt-3 px-3 py-2 rounded-md bg-gradient-to-r from-brand-cyan to-brand-blue text-white font-bold text-[12px] inline-flex items-center justify-center gap-1.5 disabled:opacity-40">
        <Gift className="w-3.5 h-3.5" /> Resgatar para cliente
      </button>
    </div>
  );
}

function ProdutoDialog({ produto, modoNovo, onClose }: { produto: Produto | null | undefined; modoNovo: boolean; onClose: () => void }) {
  const aberto = produto !== null && produto !== undefined || modoNovo;
  const [form, setForm] = React.useState<ProdutoInput>(() => ({
    nome: "", descricao: "", categoria: "fisico",
    custo_xc: 0, valor_percebido_brl: null, custo_operacional_brl: null,
    estoque: null, estoque_alerta: 5,
    efeito_tipo: null, efeito_valor_brl: null, validade_dias: 30,
    ativo: true, ordem: 100,
  }));
  const [saving, setSaving] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (modoNovo) {
      setForm({
        nome: "", descricao: "", categoria: "fisico",
        custo_xc: 0, valor_percebido_brl: null, custo_operacional_brl: null,
        estoque: null, estoque_alerta: 5,
        efeito_tipo: null, efeito_valor_brl: null, validade_dias: 30,
        ativo: true, ordem: 100,
      });
    } else if (produto) {
      setForm({
        nome: produto.nome, descricao: produto.descricao ?? "",
        categoria: produto.categoria,
        custo_xc: produto.custo_xc,
        valor_percebido_brl: produto.valor_percebido_brl,
        custo_operacional_brl: produto.custo_operacional_brl,
        estoque: produto.estoque,
        estoque_alerta: produto.estoque_alerta,
        efeito_tipo: produto.efeito_tipo,
        efeito_valor_brl: produto.efeito_valor_brl,
        validade_dias: produto.validade_dias,
        ativo: produto.ativo,
        ordem: produto.ordem,
      });
    }
    setErro(null);
  }, [produto, modoNovo]);

  async function salvar() {
    setSaving(true); setErro(null);
    try {
      await salvarProduto(produto?.id ?? null, form);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally { setSaving(false); }
  }

  async function deletar() {
    if (!produto) return;
    if (!confirm(`Excluir "${produto.nome}"?`)) return;
    setSaving(true);
    try { await deletarProduto(produto.id); onClose(); }
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
                        <ShoppingBag className="w-4 h-4 text-brand-cyan" />
                        {modoNovo ? "Novo produto" : "Editar produto"}
                      </Dialog.Title>
                      <Dialog.Close asChild>
                        <button className="w-8 h-8 rounded-md hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4" /></button>
                      </Dialog.Close>
                    </div>

                    <div className="p-5 space-y-3">
                      <FormField label="Nome">
                        <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="form-input" autoFocus />
                      </FormField>
                      <FormField label="Descrição">
                        <textarea value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} className="form-input resize-none" />
                      </FormField>
                      <FormField label="Categoria">
                        <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value as "fisico" | "operacional" })} className="form-input">
                          <option value="fisico">Físico (brinde)</option>
                          <option value="operacional">Operacional (desconto/serviço grátis)</option>
                        </select>
                      </FormField>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Custo XC">
                          <input type="number" value={form.custo_xc} onChange={(e) => setForm({ ...form, custo_xc: Number(e.target.value) })} className="form-input font-mono" />
                        </FormField>
                        <FormField label="Ordem">
                          <input type="number" value={form.ordem ?? 100} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })} className="form-input font-mono" />
                        </FormField>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Valor percebido (R$)">
                          <input type="number" step="0.01" value={form.valor_percebido_brl ?? ""}
                            onChange={(e) => setForm({ ...form, valor_percebido_brl: e.target.value ? Number(e.target.value) : null })}
                            className="form-input font-mono" />
                        </FormField>
                        <FormField label="Custo operacional (R$)">
                          <input type="number" step="0.01" value={form.custo_operacional_brl ?? ""}
                            onChange={(e) => setForm({ ...form, custo_operacional_brl: e.target.value ? Number(e.target.value) : null })}
                            className="form-input font-mono" />
                        </FormField>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Estoque (vazio = ilimitado)">
                          <input type="number" value={form.estoque ?? ""}
                            onChange={(e) => setForm({ ...form, estoque: e.target.value ? Number(e.target.value) : null })}
                            className="form-input font-mono" />
                        </FormField>
                        <FormField label="Alerta de estoque">
                          <input type="number" value={form.estoque_alerta ?? ""}
                            onChange={(e) => setForm({ ...form, estoque_alerta: e.target.value ? Number(e.target.value) : null })}
                            className="form-input font-mono" />
                        </FormField>
                      </div>
                      {form.categoria === "operacional" && (
                        <div className="rounded-lg border border-brand-cyan/30 bg-brand-cyan/5 p-3 space-y-3">
                          <div className="text-[11px] font-bold text-brand-cyan">Efeito ao resgatar</div>
                          <FormField label="Tipo de efeito">
                            <select value={form.efeito_tipo ?? ""} onChange={(e) => setForm({ ...form, efeito_tipo: e.target.value || null })} className="form-input">
                              <option value="">Nenhum</option>
                              <option value="desconto_brl">Desconto R$</option>
                              <option value="lavagem_gratis">Lavagem grátis</option>
                              <option value="secagem_gratis">Secagem grátis</option>
                              <option value="ciclo_completo">Ciclo completo grátis</option>
                            </select>
                          </FormField>
                          <FormField label="Valor R$ (pra desconto)">
                            <input type="number" step="0.01" value={form.efeito_valor_brl ?? ""}
                              onChange={(e) => setForm({ ...form, efeito_valor_brl: e.target.value ? Number(e.target.value) : null })}
                              className="form-input font-mono" />
                          </FormField>
                          <FormField label="Validade do voucher (dias)">
                            <input type="number" value={form.validade_dias ?? 30}
                              onChange={(e) => setForm({ ...form, validade_dias: Number(e.target.value) })}
                              className="form-input font-mono" />
                          </FormField>
                        </div>
                      )}
                      <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                        <input type="checkbox" checked={form.ativo ?? true} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
                        Produto ativo (visível no resgate)
                      </label>
                      {erro && <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{erro}</div>}
                    </div>

                    <div className="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-between">
                      {!modoNovo && produto ? (
                        <Button variant="ghost" onClick={deletar} disabled={saving} className="text-danger">
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                        </Button>
                      ) : <span />}
                      <div className="flex gap-2">
                        <Dialog.Close asChild><Button variant="ghost" disabled={saving}>Cancelar</Button></Dialog.Close>
                        <Button onClick={salvar} disabled={saving || !form.nome} className="bg-brand-cyan text-primary-foreground">
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

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

function ResgateClienteDialog({ produto, saldos, onClose }: { produto: Produto | null; saldos: SaldoCliente[]; onClose: () => void }) {
  const [busca, setBusca] = React.useState("");
  const [clienteSel, setClienteSel] = React.useState<SaldoCliente | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => { setBusca(""); setClienteSel(null); setSaving(false); setErro(null); }, [produto]);

  const candidatos = saldos.filter((s) => {
    if (produto && s.saldo_atual < produto.custo_xc) return false;
    const b = busca.trim().toLowerCase();
    if (!b) return true;
    return s.cliente_nome.toLowerCase().includes(b) || (s.cliente_telefone ?? "").includes(b);
  }).slice(0, 50);

  async function confirmar() {
    if (!produto || !clienteSel) return;
    setSaving(true); setErro(null);
    try {
      await solicitarResgate(clienteSel.cliente_id, produto.id);
      alert(`Resgate solicitado.\n${clienteSel.cliente_nome} → ${produto.nome}\n${produto.custo_xc} XC debitados.`);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally { setSaving(false); }
  }

  return (
    <Dialog.Root open={!!produto} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <AnimatePresence>
          {produto && (
            <>
              <Dialog.Overlay asChild forceMount>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
                  className="fixed inset-0 z-50 grid place-items-center p-4">
                  <div className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
                    <div className="p-5 border-b border-border/60 flex items-start justify-between">
                      <div>
                        <Dialog.Title className="font-display text-lg font-bold inline-flex items-center gap-2">
                          <Gift className="w-4 h-4 text-brand-cyan" /> Resgatar {produto.nome}
                        </Dialog.Title>
                        <div className="text-[12px] text-muted-foreground mt-0.5">
                          Custo: <span className="font-mono font-bold text-brand-cyan">{produto.custo_xc} XC</span>
                        </div>
                      </div>
                      <Dialog.Close asChild>
                        <button className="w-8 h-8 rounded-md hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4" /></button>
                      </Dialog.Close>
                    </div>

                    <div className="p-5 space-y-3">
                      <label className="block">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Cliente (com saldo suficiente)</div>
                        <input value={busca} onChange={(e) => setBusca(e.target.value)}
                          placeholder="Buscar nome ou telefone..." className="form-input" autoFocus />
                      </label>

                      <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-muted/10">
                        {candidatos.map((c) => (
                          <button key={c.cliente_id} onClick={() => setClienteSel(c)}
                            className={cn("w-full text-left px-3 py-2 text-[12px] border-b border-border/40 last:border-b-0 hover:bg-secondary/30 flex items-center gap-2",
                              clienteSel?.cliente_id === c.cliente_id && "bg-brand-cyan/10")}>
                            <span className="font-semibold flex-1 truncate">{c.cliente_nome}</span>
                            <span className="text-[10px] text-muted-foreground">{c.unidade_nome}</span>
                            <span className="font-mono font-bold text-brand-cyan">{c.saldo_atual} XC</span>
                            {clienteSel?.cliente_id === c.cliente_id && <Check className="w-3.5 h-3.5 text-brand-cyan" />}
                          </button>
                        ))}
                        {candidatos.length === 0 && <div className="text-center text-[12px] text-muted-foreground py-6">Nenhum cliente com saldo suficiente</div>}
                      </div>

                      {erro && <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{erro}</div>}
                    </div>

                    <div className="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-end gap-2">
                      <Dialog.Close asChild><Button variant="ghost" disabled={saving}>Cancelar</Button></Dialog.Close>
                      <Button onClick={confirmar} disabled={!clienteSel || saving} className="bg-brand-cyan text-primary-foreground">
                        {saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                        <Send className="w-3.5 h-3.5 mr-1" /> Confirmar resgate
                      </Button>
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
// RESGATES (workflow)
// ────────────────────────────────────────────────────────────
function ResgatesView({ resgates }: { resgates: Resgate[] }) {
  const [filtro, setFiltro] = React.useState<Resgate["status"] | "todos">("todos");
  const filtrados = resgates.filter((r) => filtro === "todos" || r.status === filtro);

  const tons: Record<Resgate["status"], string> = {
    solicitado: "warning", aprovado: "brand-cyan", entregue: "success", cancelado: "danger",
  };

  async function handleAprovar(id: string) {
    try {
      const r = await aprovarResgate(id);
      alert(`Resgate aprovado.\nVoucher: ${r.voucher}`);
    } catch (e) { alert("Erro: " + (e instanceof Error ? e.message : String(e))); }
  }
  async function handleEntregar(id: string) {
    if (!confirm("Marcar como entregue?")) return;
    try { await entregarResgate(id); }
    catch (e) { alert("Erro: " + (e instanceof Error ? e.message : String(e))); }
  }
  async function handleCancelar(id: string) {
    const motivo = prompt("Motivo do cancelamento:");
    if (!motivo) return;
    try { await cancelarResgate(id, motivo); }
    catch (e) { alert("Erro: " + (e instanceof Error ? e.message : String(e))); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {(["todos", "solicitado", "aprovado", "entregue", "cancelado"] as const).map((s) => {
          const ativo = filtro === s;
          const qtd = s === "todos" ? resgates.length : resgates.filter((r) => r.status === s).length;
          return (
            <button key={s} onClick={() => setFiltro(s)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-semibold transition-smooth capitalize",
                ativo ? "bg-gradient-to-r from-brand-cyan to-brand-blue text-white" : "text-muted-foreground hover:bg-secondary",
              )}>
              {s}
              <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold",
                ativo ? "bg-white/20" : "bg-secondary")}>{qtd}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card z-10 border-b border-border">
              <tr className="text-[9px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left py-2 px-3 font-semibold">Solicitado</th>
                <th className="text-left py-2 px-3 font-semibold">Cliente</th>
                <th className="text-left py-2 px-3 font-semibold">Produto</th>
                <th className="text-left py-2 px-3 font-semibold">Unidade</th>
                <th className="text-right py-2 px-3 font-semibold">XC</th>
                <th className="text-left py-2 px-3 font-semibold">Status</th>
                <th className="text-left py-2 px-3 font-semibold">Voucher</th>
                <th className="text-center py-2 px-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => {
                const tom = tons[r.status];
                return (
                  <tr key={r.id} className="border-b border-border/40 hover:bg-secondary/20">
                    <td className="py-2 px-3 text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(r.solicitado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-semibold">{r.cliente_nome}</div>
                      {r.cliente_telefone && <div className="text-[10px] text-muted-foreground inline-flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {r.cliente_telefone}</div>}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-semibold">{r.produto_nome}</div>
                      <div className="text-[10px] text-muted-foreground capitalize">{r.produto_categoria}</div>
                    </td>
                    <td className="py-2 px-3 text-[11px] text-muted-foreground">{r.unidade_nome}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-brand-cyan">{r.custo_xc}</td>
                    <td className="py-2 px-3">
                      <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                        `bg-${tom}/15 text-${tom}`)}>
                        {r.status === "solicitado" && <PackageOpen className="w-3 h-3" />}
                        {r.status === "aprovado"   && <Sparkles className="w-3 h-3" />}
                        {r.status === "entregue"   && <PackageCheck className="w-3 h-3" />}
                        {r.status === "cancelado"  && <XCircle className="w-3 h-3" />}
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px]">{r.voucher_codigo ?? "—"}</td>
                    <td className="py-2 px-3 text-center">
                      <div className="inline-flex items-center gap-1">
                        {r.status === "solicitado" && (
                          <button onClick={() => handleAprovar(r.id)}
                            className="text-[10px] font-semibold px-2 py-1 rounded text-brand-cyan hover:bg-brand-cyan/10"
                            title="Aprovar">
                            <Check className="w-3 h-3 inline" /> Aprovar
                          </button>
                        )}
                        {r.status === "aprovado" && (
                          <button onClick={() => handleEntregar(r.id)}
                            className="text-[10px] font-semibold px-2 py-1 rounded text-success hover:bg-success/10"
                            title="Marcar entregue">
                            <PackageCheck className="w-3 h-3 inline" /> Entregar
                          </button>
                        )}
                        {(r.status === "solicitado" || r.status === "aprovado") && (
                          <button onClick={() => handleCancelar(r.id)}
                            className="text-[10px] font-semibold px-2 py-1 rounded text-danger hover:bg-danger/10"
                            title="Cancelar">
                            <X className="w-3 h-3 inline" /> Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr><td colSpan={8} className="text-center text-[12px] text-muted-foreground py-12">Nenhum resgate</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// CONFIG
// ────────────────────────────────────────────────────────────
function ConfigView({ config }: { config: XoClubConfig | null }) {
  const [c, setC] = React.useState<XoClubConfig | null>(config);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  React.useEffect(() => { setC(config); }, [config]);

  if (!c) return <div className="text-center text-[12px] text-muted-foreground py-12">Config não encontrada</div>;

  function patch<K extends keyof XoClubConfig>(k: K, v: XoClubConfig[K]) {
    setC((s) => s ? { ...s, [k]: v } : s);
  }

  async function salvar() {
    if (!c) return;
    setSaving(true);
    try {
      await salvarConfigXoClub({
        conversao_brl_xc: c.conversao_brl_xc,
        vencimento_meses: c.vencimento_meses,
        bonus_primeira_lavagem: c.bonus_primeira_lavagem,
        bonus_cadastro_completo: c.bonus_cadastro_completo,
        bonus_aniversario: c.bonus_aniversario,
        bonus_avaliacao_google: c.bonus_avaliacao_google,
        bonus_indicador: c.bonus_indicador,
        bonus_indicado: c.bonus_indicado,
        nivel_prata_min: c.nivel_prata_min,
        nivel_ouro_min: c.nivel_ouro_min,
        nivel_diamante_min: c.nivel_diamante_min,
        store_gera_xc: c.store_gera_xc,
        alerta_proximo_resgate_xc: c.alerta_proximo_resgate_xc,
        alerta_proximo_nivel_xc: c.alerta_proximo_nivel_xc,
        alerta_inativo_dias: c.alerta_inativo_dias,
        alerta_expiracao_dias: c.alerta_expiracao_dias,
        ativo: c.ativo,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-display font-bold text-[14px]">Parâmetros do programa</div>
          <Button onClick={salvar} disabled={saving} className="bg-brand-cyan text-primary-foreground">
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            {saved ? "Salvo" : "Salvar"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSec titulo="Conversão" icon={Coins}>
            <ConfigField label="BRL → XC" value={c.conversao_brl_xc} onChange={(v) => patch("conversao_brl_xc", v)} suffix="XC/R$" decimals={4} />
            <ConfigField label="Vencimento (meses, 0=sem)" value={c.vencimento_meses ?? 0} onChange={(v) => patch("vencimento_meses", v > 0 ? v : null)} decimals={0} />
          </CardSec>

          <CardSec titulo="Faixas de nível" icon={Trophy}>
            <ConfigField label="Prata a partir de" value={c.nivel_prata_min} onChange={(v) => patch("nivel_prata_min", v)} decimals={0} suffix="XC" />
            <ConfigField label="Ouro a partir de" value={c.nivel_ouro_min} onChange={(v) => patch("nivel_ouro_min", v)} decimals={0} suffix="XC" />
            <ConfigField label="Diamante a partir de" value={c.nivel_diamante_min} onChange={(v) => patch("nivel_diamante_min", v)} decimals={0} suffix="XC" />
          </CardSec>

          <CardSec titulo="Bônus de engajamento" icon={Sparkles}>
            <ConfigField label="1ª lavagem" value={c.bonus_primeira_lavagem} onChange={(v) => patch("bonus_primeira_lavagem", v)} decimals={0} suffix="XC" />
            <ConfigField label="Cadastro completo" value={c.bonus_cadastro_completo} onChange={(v) => patch("bonus_cadastro_completo", v)} decimals={0} suffix="XC" />
            <ConfigField label="Aniversário" value={c.bonus_aniversario} onChange={(v) => patch("bonus_aniversario", v)} decimals={0} suffix="XC" />
            <ConfigField label="Avaliação Google" value={c.bonus_avaliacao_google} onChange={(v) => patch("bonus_avaliacao_google", v)} decimals={0} suffix="XC" />
          </CardSec>

          <CardSec titulo="Indicações" icon={Users}>
            <ConfigField label="Indicador ganha" value={c.bonus_indicador} onChange={(v) => patch("bonus_indicador", v)} decimals={0} suffix="XC" />
            <ConfigField label="Indicado ganha" value={c.bonus_indicado} onChange={(v) => patch("bonus_indicado", v)} decimals={0} suffix="XC" />
          </CardSec>

          <CardSec titulo="Automações" icon={Send}>
            <ConfigField label="Avisar próx. resgate (XC)" value={c.alerta_proximo_resgate_xc} onChange={(v) => patch("alerta_proximo_resgate_xc", v)} decimals={0} />
            <ConfigField label="Avisar próx. nível (XC)" value={c.alerta_proximo_nivel_xc} onChange={(v) => patch("alerta_proximo_nivel_xc", v)} decimals={0} />
            <ConfigField label="Inativo após (dias)" value={c.alerta_inativo_dias} onChange={(v) => patch("alerta_inativo_dias", v)} decimals={0} />
            <ConfigField label="Avisar expiração (dias antes)" value={c.alerta_expiracao_dias} onChange={(v) => patch("alerta_expiracao_dias", v)} decimals={0} />
          </CardSec>

          <CardSec titulo="Outros" icon={Building2}>
            <label className="flex items-center gap-2 text-[12px] cursor-pointer">
              <input type="checkbox" checked={c.store_gera_xc} onChange={(e) => patch("store_gera_xc", e.target.checked)} />
              Compras na Store geram XC (1 BRL = 1 XC)
            </label>
            <label className="flex items-center gap-2 text-[12px] cursor-pointer">
              <input type="checkbox" checked={c.ativo} onChange={(e) => patch("ativo", e.target.checked)} />
              Programa ativo (credita XC em vendas novas)
            </label>
          </CardSec>
        </div>
      </div>
    </div>
  );
}

function CardSec({ titulo, icon: Icon, children }: { titulo: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-2">
      <div className="font-display font-bold text-[12px] inline-flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-brand-cyan" /> {titulo}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ConfigField({ label, value, onChange, suffix, decimals = 2 }: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string; decimals?: number;
}) {
  const [local, setLocal] = React.useState(value.toString().replace(".", ","));
  React.useEffect(() => { setLocal(value.toString().replace(".", ",")); }, [value]);
  return (
    <div className="flex items-center gap-2">
      <label className="text-[11px] text-muted-foreground flex-1">{label}</label>
      <input value={local} onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const v = parseFloat(local.replace(",", "."));
          if (!isNaN(v)) onChange(v);
        }}
        className="form-input h-7 w-24 text-[11px] font-mono text-right py-0" />
      {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
      <span className="hidden">{decimals}</span>
    </div>
  );
}

// Suprime linter de imports não consumidos
void Tag;

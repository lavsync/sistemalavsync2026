"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  Activity, TrendingUp, TrendingDown, RefreshCw, Wind, Droplet,
  Users, Receipt, Building2, Zap, Clock, AlertTriangle, CheckCircle2,
  Radio, Pause, Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  UnidadePainelAoVivo, PainelAoVivoTotal, VendaLiveItem,
} from "@/lib/painel-ao-vivo-queries";

const fmtBRL = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtBRLcompact = (n: number) =>
  n >= 1000
    ? `R$ ${(n / 1000).toFixed(1).replace(".", ",")}k`
    : `R$ ${n.toFixed(2).replace(".", ",")}`;

export function PainelAoVivoView({
  unidadesIniciais, totalInicial, geradoEmInicial,
}: {
  unidadesIniciais: UnidadePainelAoVivo[];
  totalInicial: PainelAoVivoTotal;
  geradoEmInicial: string;
}) {
  const router = useRouter();
  const [autoRefresh, setAutoRefresh] = React.useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = React.useState(geradoEmInicial);
  const [contador, setContador] = React.useState(15);

  // Auto-refresh a cada 15s
  React.useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setContador((c) => {
        if (c <= 1) {
          router.refresh();
          setUltimaAtualizacao(new Date().toISOString());
          return 15;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, router]);

  // Reset contador quando server retorna dados novos
  React.useEffect(() => {
    setUltimaAtualizacao(geradoEmInicial);
    setContador(15);
  }, [geradoEmInicial]);

  function refreshAgora() {
    router.refresh();
    setContador(15);
  }

  return (
    <div className="px-4 md:px-6 lg:px-8 py-5 space-y-5">
      {/* ===== HEADER COM PILL "AO VIVO" ===== */}
      <div className="rounded-2xl border border-brand-cyan/20 bg-gradient-to-br from-brand-deep via-card to-card p-5 lg:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2">
              <span className="relative flex w-2.5 h-2.5">
                <span className="absolute inset-0 rounded-full bg-danger/70 animate-ping" />
                <span className="relative rounded-full bg-danger w-2.5 h-2.5" />
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-danger">
                AO VIVO · Tempo real
              </span>
              <Radio className="w-3 h-3 text-danger animate-pulse" />
            </div>
            <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-white mt-2">
              Painel de Vendas
            </h1>
            <p className="text-[13px] text-white/70 mt-1">
              Acompanhe em tempo real o que está acontecendo nas{" "}
              <span className="text-brand-cyan font-semibold">{unidadesIniciais.length} unidade{unidadesIniciais.length === 1 ? "" : "s"}</span>{" "}
              da rede Xô Varal.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-[11px] text-white/70">
              <Clock className="w-3 h-3" />
              <span>Próx. refresh em <span className="font-mono font-bold text-white">{contador}s</span></span>
            </div>
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold border",
                autoRefresh
                  ? "bg-success/15 border-success/30 text-success"
                  : "bg-warning/15 border-warning/30 text-warning",
              )}
            >
              {autoRefresh ? <><Pause className="w-3 h-3" /> Pausar</> : <><Play className="w-3 h-3" /> Retomar</>}
            </button>
            <button
              onClick={refreshAgora}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-cyan/15 border border-brand-cyan/30 text-brand-cyan text-[11px] font-semibold hover:bg-brand-cyan/25"
            >
              <RefreshCw className="w-3 h-3" /> Atualizar
            </button>
          </div>
        </div>

        {/* TOTAIS DA REDE — números gigantes */}
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <BigNumberRede
            icon={Receipt}
            label="Faturamento hoje"
            value={fmtBRL(totalInicial.faturamentoHoje)}
            hint={`${totalInicial.vendasUltimaHora} vendas na última hora`}
          />
          <BigNumberRede
            icon={RefreshCw}
            label="Ciclos hoje"
            value={totalInicial.ciclosHoje.toString()}
            hint={`${fmtBRL(totalInicial.ticketMedioHoje)} ticket médio`}
          />
          <BigNumberRede
            icon={Droplet}
            label="Lavagens"
            value={totalInicial.lavagensHoje.toString()}
            hint={`${pct(totalInicial.lavagensHoje, totalInicial.ciclosHoje)}% dos ciclos`}
          />
          <BigNumberRede
            icon={Wind}
            label="Secagens"
            value={totalInicial.secagensHoje.toString()}
            hint={`${pct(totalInicial.secagensHoje, totalInicial.ciclosHoje)}% dos ciclos`}
          />
        </div>
      </div>

      {/* ===== CARDS POR UNIDADE ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {unidadesIniciais.map((u) => (
          <UnidadeCard key={u.unidade_id} unidade={u} />
        ))}
      </div>

      {/* ===== STREAM GLOBAL DE VENDAS ===== */}
      <StreamGlobal unidades={unidadesIniciais} />

      <div className="text-center text-[10px] text-muted-foreground">
        Última atualização: {new Date(ultimaAtualizacao).toLocaleTimeString("pt-BR")}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// CARD POR UNIDADE
// ────────────────────────────────────────────────────────────
function UnidadeCard({ unidade }: { unidade: UnidadePainelAoVivo }) {
  const variacaoVsOntem =
    unidade.faturamentoOntemMesmoHorario > 0
      ? ((unidade.faturamentoHoje - unidade.faturamentoOntemMesmoHorario) / unidade.faturamentoOntemMesmoHorario) * 100
      : unidade.faturamentoHoje > 0 ? 100 : 0;

  const ativa = unidade.minutosDesdeUltimaVenda !== null && unidade.minutosDesdeUltimaVenda < 60;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col"
    >
      {/* Header da unidade */}
      <div
        className="px-5 py-4 flex items-center justify-between border-b border-border"
        style={{
          background: ativa
            ? "linear-gradient(135deg, rgba(25,199,203,0.12), rgba(15,133,154,0.04))"
            : "linear-gradient(135deg, rgba(255,255,255,0.02), transparent)",
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: ativa
                ? "linear-gradient(135deg, #01385B, #0F859A, #19C7CB)"
                : "linear-gradient(135deg, #334155, #475569)",
            }}
          >
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-[16px] tracking-tight">{unidade.unidade_nome}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {ativa ? (
                <>
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="absolute inset-0 rounded-full bg-success/60 animate-ping" />
                    <span className="relative rounded-full bg-success w-1.5 h-1.5" />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-success">
                    Ativa · {unidade.minutosDesdeUltimaVenda}min atrás
                  </span>
                </>
              ) : (
                <>
                  <Pause className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {unidade.minutosDesdeUltimaVenda === null
                      ? "Sem vendas hoje"
                      : `Sem vendas há ${Math.floor(unidade.minutosDesdeUltimaVenda / 60)}h${unidade.minutosDesdeUltimaVenda % 60}min`}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <VariacaoBadge valor={variacaoVsOntem} />
      </div>

      {/* KPIs gigantes */}
      <div className="p-5 grid grid-cols-2 gap-3">
        <KpiMassivo
          label="Faturamento"
          valor={fmtBRLcompact(unidade.faturamentoHoje)}
          highlight
          icon={Receipt}
        />
        <KpiMassivo
          label="Ciclos hoje"
          valor={unidade.ciclosHoje.toString()}
          icon={RefreshCw}
        />
        <KpiMassivo
          label="Lavagens"
          valor={unidade.lavagensHoje.toString()}
          icon={Droplet}
          tone="cyan"
        />
        <KpiMassivo
          label="Secagens"
          valor={unidade.secagensHoje.toString()}
          icon={Wind}
          tone="purple"
        />
      </div>

      {/* Mini-gráfico hora-a-hora */}
      <div className="px-5 pb-3">
        <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 flex items-center justify-between">
          <span>Faturamento por hora · hoje</span>
          <span className="text-[10px] text-muted-foreground">
            {unidade.clientesUnicosHoje} cliente{unidade.clientesUnicosHoje === 1 ? "" : "s"} único{unidade.clientesUnicosHoje === 1 ? "" : "s"}
          </span>
        </div>
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={unidade.faturamentoPorHora}>
              <defs>
                <linearGradient id={`grad-${unidade.unidade_id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#19C7CB" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#19C7CB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="hora" stroke="var(--muted-foreground)" fontSize={8} tickLine={false} axisLine={false} interval={3} />
              <YAxis stroke="var(--muted-foreground)" fontSize={8} tickLine={false} axisLine={false} hide />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 11 }}
                formatter={(v) => [fmtBRL(Number(v ?? 0)), "Faturamento"] as [string, string]}
              />
              <Area type="monotone" dataKey="valor" stroke="#19C7CB" strokeWidth={2} fill={`url(#grad-${unidade.unidade_id})`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Últimas vendas em stream */}
      <div className="border-t border-border bg-muted/20 px-3 py-3 flex-1">
        <div className="px-2 mb-2 flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1">
            <Activity className="w-3 h-3" /> Stream ao vivo
          </span>
          <span className="text-[10px] text-muted-foreground">{unidade.ultimasVendas.length} últimas</span>
        </div>
        {unidade.ultimasVendas.length === 0 ? (
          <div className="text-center py-6 text-[12px] text-muted-foreground">Sem vendas registradas hoje.</div>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto custom-scroll-thin">
            <AnimatePresence>
              {unidade.ultimasVendas.map((v, i) => (
                <VendaItem key={v.id} venda={v} indice={i} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────
// STREAM GLOBAL — todas vendas das 3 unidades em sequência
// ────────────────────────────────────────────────────────────
function StreamGlobal({ unidades }: { unidades: UnidadePainelAoVivo[] }) {
  type Item = VendaLiveItem & { unidade: string };
  const todas: Item[] = unidades
    .flatMap((u) => u.ultimasVendas.map((v) => ({ ...v, unidade: u.unidade_nome })))
    .sort((a, b) => +new Date(b.data_venda) - +new Date(a.data_venda))
    .slice(0, 20);

  if (todas.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="font-display font-bold text-sm flex items-center gap-2">
          <Zap className="w-4 h-4 text-brand-cyan" /> Stream global · todas as unidades
        </div>
        <span className="text-[10px] text-muted-foreground">{todas.length} vendas mais recentes</span>
      </div>
      <div className="divide-y divide-border/40 max-h-[420px] overflow-y-auto custom-scroll-thin">
        {todas.map((v, i) => (
          <motion.div
            key={v.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.02 }}
            className="px-4 py-2.5 flex items-center gap-3 hover:bg-secondary/30"
          >
            <div className="text-[10px] font-mono text-muted-foreground tabular-nums w-14 shrink-0">
              {fmtHoraMin(v.data_venda)}
            </div>
            <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-[11px] font-semibold text-foreground w-20 truncate shrink-0">{v.unidade}</span>
            <ServicoIcon servico={v.tipo_servico} />
            <span className="text-[11px] flex-1 truncate text-muted-foreground">
              {v.nome_cliente ?? "Cliente avulso"}
            </span>
            <span className="text-[11px] font-mono text-muted-foreground uppercase">{v.tipo_pagamento}</span>
            <span className="text-[12px] font-mono font-bold text-success tabular-nums w-20 text-right shrink-0">
              {fmtBRL(v.valor)}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function VendaItem({ venda, indice }: { venda: VendaLiveItem; indice: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: indice * 0.03 }}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px]",
        indice === 0 ? "bg-brand-cyan/10 border border-brand-cyan/25" : "",
      )}
    >
      <div className="text-[10px] font-mono text-muted-foreground tabular-nums w-10 shrink-0">
        {fmtHoraMin(venda.data_venda)}
      </div>
      <ServicoIcon servico={venda.tipo_servico} />
      <span className="flex-1 truncate text-foreground/80">
        {venda.nome_cliente ?? "—"}
      </span>
      <span className="font-mono font-bold text-success tabular-nums shrink-0">
        {fmtBRL(venda.valor)}
      </span>
    </motion.div>
  );
}

function ServicoIcon({ servico }: { servico: string }) {
  if (servico === "lavagem")
    return <Droplet className="w-3 h-3 text-brand-cyan shrink-0" />;
  if (servico === "secagem")
    return <Wind className="w-3 h-3 text-brand-purple shrink-0" />;
  return <RefreshCw className="w-3 h-3 text-muted-foreground shrink-0" />;
}

function BigNumberRede({
  icon: Icon, label, value, hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-semibold text-white/60">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="font-display text-2xl md:text-3xl font-bold text-white mt-1 tabular-nums">
        {value}
      </div>
      <div className="text-[10px] text-white/50 mt-0.5">{hint}</div>
    </div>
  );
}

function KpiMassivo({
  label, valor, icon: Icon, highlight = false, tone = "default",
}: {
  label: string;
  valor: string;
  icon: React.ElementType;
  highlight?: boolean;
  tone?: "default" | "cyan" | "purple";
}) {
  const toneColor = {
    default: "text-foreground",
    cyan: "text-brand-cyan",
    purple: "text-brand-purple",
  }[tone];

  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        highlight
          ? "border-brand-cyan/30 bg-brand-cyan/5"
          : "border-border bg-muted/20",
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={cn("font-display text-2xl font-bold mt-1 tabular-nums", highlight ? "text-brand-cyan" : toneColor)}>
        {valor}
      </div>
    </div>
  );
}

function VariacaoBadge({ valor }: { valor: number }) {
  if (Math.abs(valor) < 0.5) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md bg-muted text-muted-foreground">
        — estável
      </span>
    );
  }
  const subiu = valor > 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md",
      subiu ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
    )}>
      {subiu ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {subiu ? "+" : ""}{valor.toFixed(1).replace(".", ",")}% vs ontem
    </span>
  );
}

function fmtHoraMin(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function pct(num: number, den: number): number {
  if (!den) return 0;
  return Math.round((num / den) * 100);
}

// Re-exports não usados pra silenciar linter
void AlertTriangle; void CheckCircle2; void Users;

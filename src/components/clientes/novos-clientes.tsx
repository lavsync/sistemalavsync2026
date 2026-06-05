"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus, TrendingUp, TrendingDown, Minus, Calendar, Sparkles, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartCard } from "@/components/ui/chart-card";
import type { NovosResumo, PeriodoNovos, NovoCliente } from "@/lib/clientes-queries";

const PERIODOS: Array<{ key: PeriodoNovos; label: string; subtitle: string }> = [
  { key: "hoje",  label: "Hoje",     subtitle: "Cadastros hoje" },
  { key: "7d",    label: "7 dias",   subtitle: "Última semana" },
  { key: "30d",   label: "30 dias",  subtitle: "Último mês" },
  { key: "180d",  label: "6 meses",  subtitle: "Último semestre" },
  { key: "1y",    label: "1 ano",    subtitle: "Últimos 12 meses" },
];

export function NovosClientes({ resumo }: { resumo: NovosResumo }) {
  const router = useRouter();
  const sp = useSearchParams();
  const periodoAtivo = (sp.get("novos") as PeriodoNovos) || "30d";

  function trocarPeriodo(p: PeriodoNovos) {
    const next = new URLSearchParams(sp.toString());
    if (p === "30d") next.delete("novos");
    else next.set("novos", p);
    router.push(`/clientes?${next.toString()}`);
  }

  const periodoMeta = PERIODOS.find((p) => p.key === periodoAtivo) ?? PERIODOS[2];

  return (
    <ChartCard
      title="Novos clientes"
      subtitle={`${periodoMeta.subtitle} · cadastros via totem MAXPAN/VM`}
      actions={
        <div className="hidden md:flex items-center gap-1 text-[10px] text-muted-foreground">
          <Calendar className="w-3 h-3" />
          {fmtPeriodo(resumo.inicioPeriodo, resumo.fimPeriodo)}
        </div>
      }
    >
      {/* Tabs de período */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {PERIODOS.map((p) => {
          const ativo = p.key === periodoAtivo;
          return (
            <button
              key={p.key}
              onClick={() => trocarPeriodo(p.key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[11px] font-semibold border transition-smooth",
                ativo
                  ? "bg-gradient-to-r from-brand-cyan to-brand-blue text-white border-transparent shadow"
                  : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:border-border-strong",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Hero: contagem + comparativo */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr] gap-3 mb-4">
        <HeroCount label="Novos no período" value={resumo.totalAtual} tone="cyan" icon={UserPlus} />
        <HeroCount label="Período anterior" value={resumo.totalAnterior} tone="muted" icon={Calendar} />
        <HeroVariation variacao={resumo.variacaoPercent} totalAtual={resumo.totalAtual} totalAnterior={resumo.totalAnterior} />
      </div>

      {/* Lista detalhada */}
      <ListaNovos clientes={resumo.clientes} totalAtual={resumo.totalAtual} />
    </ChartCard>
  );
}

function HeroCount({
  label, value, tone, icon: Icon,
}: {
  label: string;
  value: number;
  tone: "cyan" | "muted";
  icon: React.ElementType;
}) {
  const toneMap = {
    cyan:  "border-brand-cyan/25 bg-brand-cyan/8",
    muted: "border-border bg-muted/20",
  };
  const colorMap = { cyan: "text-brand-cyan", muted: "text-muted-foreground" };
  return (
    <div className={cn("rounded-xl border px-4 py-3 flex items-center gap-3", toneMap[tone])}>
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", `${colorMap[tone]}`)}
        style={{ background: tone === "cyan" ? "color-mix(in oklab, var(--brand-cyan) 15%, transparent)" : "var(--muted)" }}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</div>
        <div className={cn("font-display text-3xl font-bold tabular-nums", colorMap[tone])}>{value}</div>
      </div>
    </div>
  );
}

function HeroVariation({
  variacao, totalAtual, totalAnterior,
}: {
  variacao: number;
  totalAtual: number;
  totalAnterior: number;
}) {
  const sem = totalAtual === 0 && totalAnterior === 0;
  const subiu = variacao > 0;
  const desceu = variacao < 0;
  const tone = sem ? "muted" : subiu ? "success" : desceu ? "danger" : "muted";
  const toneClass = {
    success: "border-success/25 bg-success/8 text-success",
    danger: "border-danger/25 bg-danger/8 text-danger",
    muted: "border-border bg-muted/20 text-muted-foreground",
  }[tone];
  const Icon = subiu ? TrendingUp : desceu ? TrendingDown : Minus;
  return (
    <div className={cn("rounded-xl border px-4 py-3 flex items-center gap-3", toneClass)}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-card/60">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80">vs anterior</div>
        <div className="font-display text-3xl font-bold tabular-nums">
          {sem ? "—" : `${variacao > 0 ? "+" : ""}${variacao}%`}
        </div>
      </div>
    </div>
  );
}

function ListaNovos({ clientes, totalAtual }: { clientes: NovoCliente[]; totalAtual: number }) {
  if (clientes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/10 py-10 text-center">
        <Sparkles className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
        <div className="text-[13px] font-semibold">Nenhum cadastro neste período</div>
        <div className="text-[11px] text-muted-foreground mt-1">Tente um período maior.</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-3 py-2 bg-muted/30 border-b border-border flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
          Lista de novos · ordenado por cadastro mais recente
        </div>
        <div className="text-[11px] text-muted-foreground">
          Mostrando {clientes.length} de {totalAtual}
        </div>
      </div>
      <div className="overflow-x-auto max-h-[480px] custom-scroll-thin">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="text-[9px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/20">
              <th className="text-left font-semibold py-2 px-3">Cadastro</th>
              <th className="text-left font-semibold py-2 px-3">Nome</th>
              <th className="text-left font-semibold py-2 px-3">CPF</th>
              <th className="text-left font-semibold py-2 px-3">Telefone</th>
              <th className="text-left font-semibold py-2 px-3">E-mail</th>
              <th className="text-left font-semibold py-2 px-3">Gên.</th>
              <th className="text-right font-semibold py-2 px-3">Compras</th>
              <th className="text-right font-semibold py-2 px-3">LTV</th>
              <th className="text-left font-semibold py-2 px-3">Origem</th>
              <th className="text-right font-semibold py-2 px-3">WhatsApp</th>
            </tr>
          </thead>
          <AnimatePresence mode="wait">
            <motion.tbody
              key={clientes.length}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              {clientes.map((c, i) => (
                <tr
                  key={c.id}
                  className="border-b border-border/40 hover:bg-secondary/20 transition-smooth"
                >
                  <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                    {fmtDataHora(c.cadastrado_em)}
                  </td>
                  <td className="py-2 px-3 font-semibold truncate max-w-[220px]" title={c.nome}>
                    {i < 3 && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse mr-1.5" />
                    )}
                    {c.nome}
                  </td>
                  <td className="py-2 px-3 font-mono text-muted-foreground whitespace-nowrap">{c.cpf}</td>
                  <td className="py-2 px-3 font-mono text-muted-foreground whitespace-nowrap">
                    {c.telefone ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground truncate max-w-[180px]" title={c.email ?? ""}>
                    {c.email ?? "—"}
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">
                    {c.genero ? c.genero.slice(0, 1) : "—"}
                  </td>
                  <td className="py-2 px-3 text-right font-mono">{c.compras_total_qtd}</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold">
                    R$ {Number(c.compras_total_valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] font-semibold",
                        c.origem_sistema === "maxpan"
                          ? "bg-brand-cyan/10 text-brand-cyan"
                          : c.origem_sistema === "vm_tecnologia"
                          ? "bg-brand-purple/10 text-brand-purple"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {c.origem_sistema === "maxpan" ? "MAXPAN"
                        : c.origem_sistema === "vm_tecnologia" ? "VM"
                        : c.origem_sistema}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    {c.telefone ? (
                      <a
                        href={`https://wa.me/55${c.telefone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-success font-semibold text-[10px] hover:underline"
                      >
                        <MessageCircle className="w-3 h-3" /> WA
                      </a>
                    ) : <span className="text-muted-foreground/40">—</span>}
                  </td>
                </tr>
              ))}
            </motion.tbody>
          </AnimatePresence>
        </table>
      </div>
    </div>
  );
}

function fmtDataHora(iso: string): string {
  const d = new Date(iso);
  const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${data} · ${hora}`;
}

function fmtPeriodo(iniIso: string, fimIso: string): string {
  const i = new Date(iniIso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const f = new Date(fimIso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  return `${i} → ${f}`;
}

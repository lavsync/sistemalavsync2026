"use client";

// LavSync · Marketing · Uso de Cupons, Vouchers e Benefícios
//
// Relatório mensal: quem usa cupom/voucher/cortesia nas lojas, agrupado
// por código, com ALERTA quando o mesmo código foi usado por mais de um
// CPF (possível compartilhamento de benefício exclusivo). Export CSV.
import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Ticket, AlertTriangle, Users, Download, ChevronDown, ChevronRight, Search,
} from "lucide-react";
import { cn, buscaCliente } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { RelatorioCupons, CodigoCupom } from "@/lib/marketing/cupons";

const fmtBRL = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtData = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const fmtCPF = (d: string) =>
  d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d || "—";

export function CuponsView({ relatorio }: { relatorio: RelatorioCupons }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [busca, setBusca] = React.useState("");
  const [soCompartilhados, setSoCompartilhados] = React.useState(false);
  const [aberto, setAberto] = React.useState<string | null>(null);

  function trocarMes(m: string) {
    const next = new URLSearchParams(sp.toString());
    next.set("mes_cupons", m);
    router.push(`${pathname}?${next.toString()}`);
  }

  // últimos 12 meses pro seletor
  const meses = React.useMemo(() => {
    const out: string[] = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
      d.setMonth(d.getMonth() - 1);
    }
    return out;
  }, []);
  const nomeMes = (m: string) =>
    new Date(m + "T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const codigosFiltrados = relatorio.codigos.filter((c) => {
    if (soCompartilhados && !c.compartilhado) return false;
    if (!busca.trim()) return true;
    const b = busca.trim().toLowerCase();
    return c.codigo.toLowerCase().includes(b)
      || c.clientes.some((cl) => buscaCliente(busca, { nome: cl.nome, cpf: cl.cpf }));
  });

  function exportarCSV() {
    const cab = ["Data", "Codigo", "Origem", "Categoria", "Cliente", "CPF", "Unidade", "Valor", "Desconto"];
    const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cab.join(";")].concat(relatorio.usos.map((u) => [
      new Date(u.data).toLocaleString("pt-BR"), esc(u.codigo), u.origem, esc(u.categoria ?? ""),
      esc(u.cliente_nome), fmtCPF(u.cpf), esc(u.unidade_nome),
      String(u.valor.toFixed(2)).replace(".", ","), String(u.desconto.toFixed(2)).replace(".", ","),
    ].join(";"))).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `uso-cupons-${relatorio.mes.slice(0, 7)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-4">
      {/* Header + filtros */}
      <div className="rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <div className="font-display font-bold text-[15px] inline-flex items-center gap-2">
            <Ticket className="w-4 h-4 text-brand-cyan" />
            Uso de Cupons &amp; Benefícios
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Cupons, vouchers, cortesias, permutas e presentes usados nas lojas — direto da planilha de vendas.
            Código usado por 2+ CPFs acende alerta de compartilhamento.
          </p>
        </div>
        <select value={relatorio.mes} onChange={(e) => trocarMes(e.target.value)}
          className="form-input w-auto h-9 py-0 text-[12px]">
          {[...new Set([relatorio.mes, ...meses])].sort().reverse().map((m) => (
            <option key={m} value={m}>{nomeMes(m)}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={exportarCSV} disabled={relatorio.total_usos === 0}>
          <Download className="w-3.5 h-3.5" /><span className="ml-1.5">CSV do mês</span>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Usos no mês", valor: String(relatorio.total_usos), cor: "text-brand-cyan" },
          { label: "Códigos distintos", valor: String(relatorio.total_codigos), cor: "text-foreground" },
          { label: "⚠ Usados por 2+ CPFs", valor: String(relatorio.codigos_compartilhados), cor: relatorio.codigos_compartilhados > 0 ? "text-danger" : "text-success" },
          { label: "Valor movimentado", valor: fmtBRL(relatorio.valor_total), cor: "text-foreground" },
          { label: "Desconto concedido", valor: fmtBRL(relatorio.desconto_total), cor: "text-warning" },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-3.5">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{k.label}</div>
            <div className={cn("font-display font-bold text-xl mt-0.5 tabular-nums", k.cor)}>{k.valor}</div>
          </div>
        ))}
      </div>

      {/* Filtros da lista */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 px-3 h-9 rounded-lg border border-border bg-card flex-1 min-w-[220px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar código, cliente ou CPF..."
            className="bg-transparent text-[12px] flex-1 outline-none" />
        </div>
        <label className="inline-flex items-center gap-1.5 text-[12px] cursor-pointer select-none">
          <input type="checkbox" checked={soCompartilhados} onChange={(e) => setSoCompartilhados(e.target.checked)}
            className="accent-red-600" />
          Só suspeitos (2+ CPFs)
        </label>
      </div>

      {/* Lista por código */}
      {codigosFiltrados.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-muted/10 p-10 text-center text-[12px] text-muted-foreground">
          Nenhum uso de cupom/voucher encontrado em {nomeMes(relatorio.mes)} com esses filtros.
        </div>
      ) : (
        <div className="space-y-2">
          {codigosFiltrados.map((c) => (
            <CodigoCard key={c.codigo} c={c} aberto={aberto === c.codigo}
              onToggle={() => setAberto(aberto === c.codigo ? null : c.codigo)} />
          ))}
        </div>
      )}
    </div>
  );
}

function CodigoCard({ c, aberto, onToggle }: { c: CodigoCupom; aberto: boolean; onToggle: () => void }) {
  return (
    <div className={cn("rounded-xl border bg-card overflow-hidden",
      c.compartilhado ? "border-danger/40" : "border-border")}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/20 transition-smooth">
        {aberto ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
        <span className="font-mono font-bold text-[13px]">{c.codigo}</span>
        <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
          c.origem === "voucher" ? "bg-brand-cyan/15 text-brand-cyan" : "bg-brand-purple/15 text-brand-purple")}>
          {c.origem}{c.categoria ? ` · ${c.categoria}` : ""}
        </span>
        {c.compartilhado && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-danger bg-danger/10 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" /> {c.cpfs_distintos} CPFs diferentes
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Users className="w-3 h-3" /> {c.cpfs_distintos} {c.cpfs_distintos === 1 ? "CPF" : "CPFs"}
        </span>
        <span className="font-mono font-bold text-[13px]">{c.usos} usos</span>
        <span className="font-mono text-[11px] text-muted-foreground min-w-[80px] text-right">{fmtBRL(c.valor_total)}</span>
      </button>
      {aberto && (
        <div className="border-t border-border px-4 py-3 space-y-1.5 bg-secondary/10">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            Quem usou · {c.unidades.join(" · ")}
          </div>
          {c.clientes.map((cl) => (
            <div key={cl.cpf + cl.nome} className="flex items-center gap-3 text-[12px]">
              <span className="font-semibold flex-1 truncate">{cl.nome}</span>
              <span className="font-mono text-muted-foreground">{fmtCPF(cl.cpf)}</span>
              <span className="font-mono font-bold min-w-[56px] text-right">{cl.usos} {cl.usos === 1 ? "uso" : "usos"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

// LavSync · Fidelidade · Central de classificação (relatório gerencial)
//
// Visualiza, filtra (unidade/nível/gênero/faixa etária/data de cadastro),
// exporta CSV e imprime a classificação dos clientes do programa.
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Printer, Users, Coins, Repeat, Percent, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { LinhaRelatorio } from "@/lib/fidelidade/relatorio";

type Unidade = { id: string; nome: string };

const NIVEL_LABEL: Record<string, string> = {
  bronze: "Bronze", prata: "Prata", ouro: "Ouro", diamante: "Diamante",
};
const NIVEL_COR: Record<string, string> = {
  bronze: "bg-amber-100 text-amber-900",
  prata: "bg-slate-200 text-slate-800",
  ouro: "bg-yellow-100 text-yellow-900",
  diamante: "bg-cyan-100 text-cyan-900",
};
const FAIXAS = [
  { key: "todas", label: "Todas as idades", min: 0, max: 200 },
  { key: "18-24", label: "18–24", min: 18, max: 24 },
  { key: "25-34", label: "25–34", min: 25, max: 34 },
  { key: "35-44", label: "35–44", min: 35, max: 44 },
  { key: "45-59", label: "45–59", min: 45, max: 59 },
  { key: "60+", label: "60+", min: 60, max: 200 },
];

const fmtBRL = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtData = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

export function FidelidadeReportView({
  linhas, unidades, mesAplicacao, mesesDisponiveis,
}: {
  linhas: LinhaRelatorio[];
  unidades: Unidade[];
  mesAplicacao: string;
  mesesDisponiveis: string[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [unidade, setUnidade] = React.useState("todas");
  const [nivel, setNivel] = React.useState("todos");
  const [genero, setGenero] = React.useState("todos");
  const [faixa, setFaixa] = React.useState("todas");
  const [cadastroDesde, setCadastroDesde] = React.useState("");
  const [busca, setBusca] = React.useState("");

  const filtradas = React.useMemo(() => {
    const fx = FAIXAS.find((f) => f.key === faixa) ?? FAIXAS[0];
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (unidade !== "todas" && l.unidade_id !== unidade) return false;
      if (nivel !== "todos" && l.nivel !== nivel) return false;
      if (genero !== "todos" && (l.genero ?? "").toLowerCase() !== genero) return false;
      if (faixa !== "todas" && (l.idade === null || l.idade < fx.min || l.idade > fx.max)) return false;
      if (cadastroDesde && (!l.cadastrado_em || l.cadastrado_em.slice(0, 10) < cadastroDesde)) return false;
      if (q && !l.nome.toLowerCase().includes(q) && !l.cpf.includes(q)) return false;
      return true;
    });
  }, [linhas, unidade, nivel, genero, faixa, cadastroDesde, busca]);

  const totais = React.useMemo(() => ({
    clientes: filtradas.length,
    ciclos: filtradas.reduce((s, l) => s + l.ciclos_mes, 0),
    faturamento: filtradas.reduce((s, l) => s + l.faturamento_mes, 0),
    lavcoins: filtradas.reduce((s, l) => s + l.lavcoins_saldo, 0),
    porNivel: filtradas.reduce<Record<string, number>>((acc, l) => {
      acc[l.nivel] = (acc[l.nivel] ?? 0) + 1;
      return acc;
    }, {}),
  }), [filtradas]);

  function trocarMes(m: string) {
    const p = new URLSearchParams(sp?.toString());
    p.set("mes_aplic", m);
    router.push(`/publicidade/fidelidade?${p.toString()}`);
  }

  function exportarCSV() {
    const cab = [
      "Nome", "CPF", "Telefone", "Genero", "Idade", "Cadastro", "Unidade",
      "Nivel", "Desconto %", "Ciclos", "Lavagem", "Secagem", "Gasto no mes", "LavCoins", "Ultima compra",
    ];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [cab.join(";")].concat(filtradas.map((l) => [
      esc(l.nome), esc(l.cpf), esc(l.telefone ?? ""), esc(l.genero ?? ""),
      l.idade ?? "", fmtData(l.cadastrado_em), esc(l.unidade_nome),
      NIVEL_LABEL[l.nivel] ?? l.nivel, String(l.desconto_pct).replace(".", ","),
      l.ciclos_mes, l.ciclos_lavagem, l.ciclos_secagem,
      String(l.faturamento_mes.toFixed(2)).replace(".", ","), l.lavcoins_saldo,
      fmtData(l.ultima_compra_em),
    ].join(";"))).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fidelidade-${mesAplicacao.slice(0, 7)}${unidade !== "todas" ? "-" + (unidades.find((u) => u.id === unidade)?.nome ?? "") : ""}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const mesLabel = new Date(mesAplicacao + "T12:00:00")
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <PageHeader
          title="Fidelidade · Central de Classificação"
          subtitle="Classificação mensal do Clube Xô Varal — níveis, ciclos, gasto e LavCoins por cliente"
        />
      </div>

      {/* Cabeçalho de impressão */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">Xô Varal · Relatório de Fidelidade — {mesLabel}</h1>
        <p className="text-sm">
          {unidade === "todas" ? "Todas as unidades" : unidades.find((u) => u.id === unidade)?.nome}
          {" · "}{totais.clientes} clientes · gerado em {new Date().toLocaleString("pt-BR")}
        </p>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border bg-card p-4 print:hidden">
        <p className="text-sm font-semibold flex items-center gap-2 mb-3"><Filter className="h-4 w-4" /> Filtros</p>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm">
            <span className="block text-muted-foreground mb-1">Mês de aplicação</span>
            <select value={mesAplicacao} onChange={(e) => trocarMes(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
              {[...new Set([mesAplicacao, ...mesesDisponiveis])].sort().reverse().map((m) => (
                <option key={m} value={m}>
                  {new Date(m + "T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-muted-foreground mb-1">Unidade</span>
            <select value={unidade} onChange={(e) => setUnidade(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="todas">Todas</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-muted-foreground mb-1">Nível</span>
            <select value={nivel} onChange={(e) => setNivel(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="todos">Todos</option>
              {Object.entries(NIVEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-muted-foreground mb-1">Gênero</span>
            <select value={genero} onChange={(e) => setGenero(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="todos">Todos</option>
              <option value="feminino">Feminino</option>
              <option value="masculino">Masculino</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-muted-foreground mb-1">Faixa etária</span>
            <select value={faixa} onChange={(e) => setFaixa(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
              {FAIXAS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-muted-foreground mb-1">Cadastro a partir de</span>
            <input type="date" value={cadastroDesde} onChange={(e) => setCadastroDesde(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm" />
          </label>
          <label className="text-sm grow max-w-xs">
            <span className="block text-muted-foreground mb-1">Buscar (nome ou CPF)</span>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou CPF" className="h-9 w-full rounded-md border bg-background px-3 text-sm" />
          </label>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={exportarCSV}>
              <Download className="h-4 w-4" /><span className="ml-2">CSV</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /><span className="ml-2">Imprimir</span>
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Users, label: "Clientes classificados", valor: String(totais.clientes) },
          { icon: Repeat, label: "Ciclos no mês", valor: totais.ciclos.toLocaleString("pt-BR") },
          { icon: Percent, label: "Gasto no mês", valor: fmtBRL(totais.faturamento) },
          { icon: Coins, label: "LavCoins em circulação", valor: totais.lavcoins.toLocaleString("pt-BR") },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><k.icon className="h-3.5 w-3.5" /> {k.label}</p>
            <p className="text-xl font-bold mt-1">{k.valor}</p>
          </div>
        ))}
      </div>

      {/* Distribuição por nível */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(NIVEL_LABEL).map(([k, v]) => (
          <span key={k} className={cn("rounded-full px-3 py-1 text-xs font-medium", NIVEL_COR[k])}>
            {v}: {totais.porNivel[k] ?? 0}
          </span>
        ))}
      </div>

      {/* Tabela */}
      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">CPF</th>
              <th className="px-3 py-2">Gên.</th>
              <th className="px-3 py-2">Idade</th>
              <th className="px-3 py-2">Cadastro</th>
              <th className="px-3 py-2">Unidade</th>
              <th className="px-3 py-2">Nível</th>
              <th className="px-3 py-2 text-right">Desc.</th>
              <th className="px-3 py-2 text-right">Ciclos</th>
              <th className="px-3 py-2 text-right">Lav/Sec</th>
              <th className="px-3 py-2 text-right">Gasto</th>
              <th className="px-3 py-2 text-right">LavCoins</th>
              <th className="px-3 py-2">Últ. compra</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((l) => (
              <tr key={l.cliente_id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2 font-medium whitespace-nowrap">{l.nome}</td>
                <td className="px-3 py-2 whitespace-nowrap">{l.cpf}</td>
                <td className="px-3 py-2">{l.genero ? l.genero[0].toUpperCase() : "—"}</td>
                <td className="px-3 py-2">{l.idade ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtData(l.cadastrado_em)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{l.unidade_nome}</td>
                <td className="px-3 py-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", NIVEL_COR[l.nivel] ?? "bg-muted")}>
                    {NIVEL_LABEL[l.nivel] ?? l.nivel}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">{l.desconto_pct}%</td>
                <td className="px-3 py-2 text-right font-medium">{l.ciclos_mes}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{l.ciclos_lavagem}/{l.ciclos_secagem}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{fmtBRL(l.faturamento_mes)}</td>
                <td className="px-3 py-2 text-right">{l.lavcoins_saldo}</td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtData(l.ultima_compra_em)}</td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr><td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">
                Nenhum cliente classificado com os filtros atuais.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

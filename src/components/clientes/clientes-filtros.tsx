"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search, X, SlidersHorizontal, Heart, AlertTriangle, Moon, UserMinus, Users, ArrowDownUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AtividadeKey = "todos" | "ativos90d" | "emrisco" | "dormentes" | "semcompra";
type OrigemKey = "todos" | "maxpan" | "vm_tecnologia" | "manual" | "api";
type GeneroKey = "todos" | "Masculino" | "Feminino" | "Outro";
type OrdenacaoKey =
  | "ltv_desc" | "ltv_asc" | "compras_desc"
  | "ultima_desc" | "ultima_asc"
  | "cadastro_desc" | "cadastro_asc" | "nome_asc";

const ATIVIDADE_OPCOES: Array<{ key: AtividadeKey; label: string; icon: React.ElementType; tone: string }> = [
  { key: "todos",     label: "Todos",          icon: Users,       tone: "text-foreground" },
  { key: "ativos90d", label: "Ativos 90d",     icon: Heart,       tone: "text-success" },
  { key: "emrisco",   label: "Em risco",       icon: AlertTriangle, tone: "text-warning" },
  { key: "dormentes", label: "Dormentes",      icon: Moon,        tone: "text-danger" },
  { key: "semcompra", label: "Sem compra",     icon: UserMinus,   tone: "text-muted-foreground" },
];

const ORIGEM_OPCOES: Array<{ key: OrigemKey; label: string }> = [
  { key: "todos",          label: "Toda origem" },
  { key: "maxpan",         label: "MAXPAN" },
  { key: "vm_tecnologia",  label: "VM Tecnologia" },
  { key: "manual",         label: "Manual" },
  { key: "api",            label: "API" },
];

const GENERO_OPCOES: Array<{ key: GeneroKey; label: string }> = [
  { key: "todos",     label: "Todos" },
  { key: "Masculino", label: "Masculino" },
  { key: "Feminino",  label: "Feminino" },
  { key: "Outro",     label: "Outro" },
];

const ORDENACAO_OPCOES: Array<{ key: OrdenacaoKey; label: string }> = [
  { key: "ltv_desc",      label: "LTV ↓" },
  { key: "ltv_asc",       label: "LTV ↑" },
  { key: "compras_desc",  label: "Mais visitas" },
  { key: "ultima_desc",   label: "Compra mais recente" },
  { key: "ultima_asc",    label: "Compra mais antiga" },
  { key: "cadastro_desc", label: "Cadastro mais recente" },
  { key: "cadastro_asc",  label: "Cadastro mais antigo" },
  { key: "nome_asc",      label: "Nome (A-Z)" },
];

export function ClientesFiltros({
  totalFiltrado,
  totalBase,
}: {
  totalFiltrado: number;
  totalBase: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const q = sp.get("q") ?? "";
  const atividade = (sp.get("ativ") as AtividadeKey) || "todos";
  const origem = (sp.get("ori") as OrigemKey) || "todos";
  const genero = (sp.get("gen") as GeneroKey) || "todos";
  const ordenacao = (sp.get("ord") as OrdenacaoKey) || "ltv_desc";

  const [buscaLocal, setBuscaLocal] = React.useState(q);
  React.useEffect(() => setBuscaLocal(q), [q]);

  function setParam(name: string, value: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (value && value !== "todos" && value !== "ltv_desc") next.set(name, value);
    else next.delete(name);
    // Reset paginação ao mudar qualquer filtro
    if (name !== "page") next.delete("page");
    router.push(`/clientes?${next.toString()}`);
  }

  function onSubmitBusca(e: React.FormEvent) {
    e.preventDefault();
    setParam("q", buscaLocal.trim() || null);
  }

  function limparTudo() {
    router.push("/clientes");
  }

  const algumFiltroAtivo =
    q || atividade !== "todos" || origem !== "todos" || genero !== "todos" || ordenacao !== "ltv_desc";

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Topo: contagem + ordenação + clear */}
      <div className="px-4 py-3 flex flex-wrap items-center gap-3 border-b border-border/60 bg-muted/20">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-brand-cyan" />
          <div className="text-[12px]">
            <span className="font-bold tabular-nums">{totalFiltrado.toLocaleString("pt-BR")}</span>
            <span className="text-muted-foreground">
              {totalFiltrado === totalBase
                ? ` cliente${totalBase === 1 ? "" : "s"}`
                : ` de ${totalBase.toLocaleString("pt-BR")}`}
            </span>
          </div>
        </div>

        <div className="flex-1" />

        <label className="flex items-center gap-2 text-[11px]">
          <ArrowDownUp className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Ordenar:</span>
          <select
            value={ordenacao}
            onChange={(e) => setParam("ord", e.target.value)}
            className="form-input h-8 text-[12px] py-0"
          >
            {ORDENACAO_OPCOES.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </label>

        {algumFiltroAtivo && (
          <button
            onClick={limparTudo}
            className="text-[11px] text-danger hover:underline font-semibold inline-flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Limpar filtros
          </button>
        )}
      </div>

      {/* Corpo: busca + chips de atividade + selects origem/gênero */}
      <div className="p-4 space-y-3">
        {/* Busca */}
        <form onSubmit={onSubmitBusca} className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md bg-surface-glass border border-border focus-within:border-brand-cyan/50 transition-smooth">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={buscaLocal}
              onChange={(e) => setBuscaLocal(e.target.value)}
              placeholder="Buscar por nome, CPF, telefone ou e-mail..."
              className="bg-transparent text-[12px] outline-none flex-1"
            />
            {buscaLocal && (
              <button
                type="button"
                onClick={() => { setBuscaLocal(""); setParam("q", null); }}
                className="text-muted-foreground hover:text-danger"
                aria-label="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </form>

        {/* Chips de atividade */}
        <div className="flex flex-wrap items-center gap-1.5">
          {ATIVIDADE_OPCOES.map((o) => {
            const Icon = o.icon;
            const selected = atividade === o.key;
            return (
              <button
                key={o.key}
                onClick={() => setParam("ativ", o.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold border transition-smooth",
                  selected
                    ? "bg-brand-cyan/15 border-brand-cyan/40 text-brand-cyan"
                    : "bg-secondary/40 border-border hover:border-border-strong text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("w-3 h-3", selected ? "" : o.tone)} />
                {o.label}
              </button>
            );
          })}
        </div>

        {/* Selects secundários */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px]">
            <span className="text-muted-foreground">Origem:</span>
            <select
              value={origem}
              onChange={(e) => setParam("ori", e.target.value)}
              className="form-input h-8 text-[12px] py-0"
            >
              {ORIGEM_OPCOES.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-[11px]">
            <span className="text-muted-foreground">Gênero:</span>
            <select
              value={genero}
              onChange={(e) => setParam("gen", e.target.value)}
              className="form-input h-8 text-[12px] py-0"
            >
              {GENERO_OPCOES.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

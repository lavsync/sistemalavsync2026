"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, Power, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudShell, Field, EstadoVazio, BusyButton } from "./crud-shell";
import { criarCadastro, atualizarCadastro, deletarCadastro, alternarAtivoCadastro } from "@/lib/cadastros/actions";
import type { CategoriaFinanceira } from "@/lib/cadastros/queries";
import { cn } from "@/lib/utils";

const TIPOS = [
  { value: "receita", label: "Receita" },
  { value: "despesa", label: "Despesa" },
  { value: "ambos",   label: "Ambos" },
] as const;

const CORES = [
  "#19C7CB", "#0F859A", "#01385B", "#0FABB7", "#73D8D8",
  "#22C55E", "#F59E0B", "#EF4444", "#3B82F6", "#8B5CF6", "#EC4899", "#64748B",
];

export function CategoriasFinanceirasView({ categorias }: { categorias: CategoriaFinanceira[] }) {
  const [busca, setBusca] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [editando, setEditando] = React.useState<CategoriaFinanceira | null>(null);

  const [nome, setNome] = React.useState("");
  const [tipo, setTipo] = React.useState<"receita" | "despesa" | "ambos">("despesa");
  const [cor, setCor] = React.useState(CORES[0]);
  const [descricao, setDescricao] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  function abrir(c?: CategoriaFinanceira) {
    setEditando(c ?? null);
    setNome(c?.nome ?? "");
    setTipo((c?.tipo as typeof tipo) ?? "despesa");
    setCor(c?.cor ?? CORES[0]);
    setDescricao(c?.descricao ?? "");
    setErro(null);
    setOpen(true);
  }

  async function salvar() {
    setBusy(true); setErro(null);
    try {
      const payload = { nome: nome.trim(), tipo, cor, descricao: descricao || null };
      if (editando) await atualizarCadastro("categorias_financeiras", editando.id, payload);
      else await criarCadastro("categorias_financeiras", payload);
      setOpen(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally { setBusy(false); }
  }

  const filtradas = categorias.filter((c) => !busca || c.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <CrudShell
      eyebrow="Cadastros · Financeiro"
      title="Categorias financeiras"
      subtitle={`categoria${categorias.length === 1 ? "" : "s"} pra organizar receitas e despesas`}
      total={categorias.length}
      novoLabel="Nova categoria"
      busca={busca}
      onBuscaChange={setBusca}
      dialog={{
        open, setOpen,
        titulo: editando ? "Editar categoria" : "Nova categoria",
        descricao: "Categorias são etiquetas pra classificar lançamentos financeiros.",
        children: (
          <>
            <Field label="Nome" required><input value={nome} onChange={(e) => setNome(e.target.value)} className="form-input" autoFocus /></Field>
            <Field label="Tipo" required>
              <div className="grid grid-cols-3 gap-2">
                {TIPOS.map((t) => (
                  <button key={t.value} onClick={() => setTipo(t.value)}
                    className={cn("py-2 rounded-md border text-[12px] font-semibold transition-smooth",
                      tipo === t.value ? "border-brand-cyan bg-brand-cyan/10 text-brand-cyan" : "border-border bg-card hover:border-border-strong")}>
                    {t.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Cor">
              <div className="flex flex-wrap gap-2">
                {CORES.map((c) => (
                  <button key={c} onClick={() => setCor(c)}
                    className={cn("w-7 h-7 rounded-md border-2 transition-smooth",
                      cor === c ? "border-foreground scale-110" : "border-transparent")}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
              </div>
            </Field>
            <Field label="Descrição (opcional)">
              <textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} className="form-input resize-none" />
            </Field>
            {erro && <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{erro}</div>}
          </>
        ),
        footer: (
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <BusyButton busy={busy} onClick={salvar} disabled={nome.trim().length < 2}>
              {editando ? "Salvar" : "Criar categoria"}
            </BusyButton>
          </>
        ),
      }}
    >
      {filtradas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma categoria encontrada"
          descricao={busca ? "Tente outra busca." : "Crie categorias pra classificar suas receitas e despesas."}
          onAcao={() => abrir()}
          labelAcao="Nova categoria"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtradas.map((c) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={cn("rounded-xl border bg-card p-3 transition-smooth", c.ativa ? "border-border" : "border-border opacity-60")}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in oklab, ${c.cor ?? "#19C7CB"} 18%, transparent)`, color: c.cor ?? "#19C7CB" }}>
                  <FolderTree className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13px] truncate">{c.nome}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">{c.tipo}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => abrir(c)} className="w-7 h-7 rounded-md hover:bg-secondary flex items-center justify-center" aria-label="Editar">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={async () => { if (confirm(`Deletar "${c.nome}"?`)) await deletarCadastro("categorias_financeiras", c.id); }}
                    className="w-7 h-7 rounded-md hover:bg-danger/10 text-muted-foreground hover:text-danger flex items-center justify-center" aria-label="Deletar">
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <button onClick={() => alternarAtivoCadastro("categorias_financeiras", c.id, !c.ativa)}
                    className="w-7 h-7 rounded-md hover:bg-secondary flex items-center justify-center" aria-label="Alternar ativo">
                    <Power className={cn("w-3 h-3", c.ativa ? "text-success" : "text-muted-foreground")} />
                  </button>
                </div>
              </div>
              {c.descricao && <div className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{c.descricao}</div>}
            </motion.div>
          ))}
        </div>
      )}
    </CrudShell>
  );
}

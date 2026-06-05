"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, Power, BookOpenCheck, Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudShell, Field, EstadoVazio, BusyButton } from "./crud-shell";
import { criarCadastro, atualizarCadastro, deletarCadastro, alternarAtivoCadastro } from "@/lib/cadastros/actions";
import type { Plano, Servico } from "@/lib/cadastros/queries";
import { cn } from "@/lib/utils";

export function PlanosView({ planos, servicos }: { planos: Plano[]; servicos: Servico[] }) {
  const [busca, setBusca] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [editando, setEditando] = React.useState<Plano | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [p, setP] = React.useState({
    nome: "", descricao: "", preco: "", desconto_percentual: "",
    servicos_inclusos: [] as string[], cor: "#0F859A", destaque: false,
  });

  function abrir(x?: Plano) {
    setEditando(x ?? null);
    setP({
      nome: x?.nome ?? "",
      descricao: x?.descricao ?? "",
      preco: x?.preco?.toString().replace(".", ",") ?? "",
      desconto_percentual: x?.desconto_percentual?.toString() ?? "",
      servicos_inclusos: x?.servicos_inclusos ?? [],
      cor: x?.cor ?? "#0F859A",
      destaque: x?.destaque ?? false,
    });
    setErro(null);
    setOpen(true);
  }

  function toggleServico(id: string) {
    setP((s) => ({
      ...s,
      servicos_inclusos: s.servicos_inclusos.includes(id) ? s.servicos_inclusos.filter((x) => x !== id) : [...s.servicos_inclusos, id],
    }));
  }

  const precoAvulsoRef = p.servicos_inclusos
    .map((id) => Number(servicos.find((s) => s.id === id)?.preco ?? 0))
    .reduce((s, v) => s + v, 0);

  async function salvar() {
    setBusy(true); setErro(null);
    try {
      const preco = parseFloat(p.preco.replace(",", "."));
      if (isNaN(preco)) { setErro("Preço inválido"); setBusy(false); return; }
      const payload = {
        nome: p.nome.trim(),
        descricao: p.descricao || null,
        preco,
        preco_avulso_referencia: precoAvulsoRef || null,
        desconto_percentual: p.desconto_percentual ? parseFloat(p.desconto_percentual) : null,
        servicos_inclusos: p.servicos_inclusos,
        cor: p.cor,
        destaque: p.destaque,
      };
      if (editando) await atualizarCadastro("planos", editando.id, payload);
      else await criarCadastro("planos", payload);
      setOpen(false);
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  const filtrados = planos.filter((x) => !busca || x.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <CrudShell
      eyebrow="Cadastros · Operação"
      title="Planos"
      subtitle={`plano${planos.length === 1 ? "" : "s"} de combinação de serviços`}
      total={planos.length} novoLabel="Novo plano" busca={busca} onBuscaChange={setBusca}
      dialog={{
        open, setOpen, maxWidth: "max-w-2xl",
        titulo: editando ? "Editar plano" : "Novo plano",
        descricao: "Combine serviços em um pacote com preço promocional (ex: Lavar + Secar com desconto).",
        children: (
          <>
            <Field label="Nome" required><input value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} className="form-input" autoFocus placeholder="Combo Lavar + Secar" /></Field>
            <Field label="Descrição"><textarea rows={2} value={p.descricao} onChange={(e) => setP({ ...p, descricao: e.target.value })} className="form-input resize-none" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Preço do plano (R$)" required>
                <input value={p.preco} onChange={(e) => setP({ ...p, preco: e.target.value })} placeholder="30,00" className="form-input font-mono" />
              </Field>
              <Field label="Desconto (%)">
                <input value={p.desconto_percentual} onChange={(e) => setP({ ...p, desconto_percentual: e.target.value })} placeholder="12" className="form-input font-mono" />
              </Field>
            </div>
            <Field label="Serviços inclusos">
              <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scroll-thin">
                {servicos.map((s) => {
                  const ativo = p.servicos_inclusos.includes(s.id);
                  return (
                    <button key={s.id} onClick={() => toggleServico(s.id)}
                      className={cn("w-full text-left rounded-md border p-2 flex items-center gap-2 transition-smooth",
                        ativo ? "border-brand-cyan bg-brand-cyan/5" : "border-border hover:border-border-strong")}>
                      <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", ativo ? "bg-brand-cyan border-brand-cyan" : "border-border")}>
                        {ativo && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="flex-1 text-[12px] font-semibold">{s.nome}</span>
                      <span className="text-[11px] font-mono text-muted-foreground">R$ {Number(s.preco).toFixed(2).replace(".", ",")}</span>
                    </button>
                  );
                })}
              </div>
              {p.servicos_inclusos.length > 0 && (
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Avulso somaria <span className="font-mono font-bold">R$ {precoAvulsoRef.toFixed(2).replace(".", ",")}</span>
                </div>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cor"><input type="color" value={p.cor} onChange={(e) => setP({ ...p, cor: e.target.value })} className="form-input h-10 cursor-pointer" /></Field>
              <label className="flex items-center gap-2 mt-6">
                <input type="checkbox" checked={p.destaque} onChange={(e) => setP({ ...p, destaque: e.target.checked })} className="w-4 h-4" />
                <span className="text-[12px]">Plano em destaque</span>
              </label>
            </div>
            {erro && <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{erro}</div>}
          </>
        ),
        footer: (
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <BusyButton busy={busy} onClick={salvar} disabled={p.nome.trim().length < 2 || !p.preco}>{editando ? "Salvar" : "Criar plano"}</BusyButton>
          </>
        ),
      }}
    >
      {filtrados.length === 0 ? (
        <EstadoVazio titulo="Nenhum plano" descricao="Combine serviços em pacotes promocionais." onAcao={() => abrir()} labelAcao="Novo plano" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtrados.map((x) => (
            <motion.div key={x.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={cn("relative rounded-xl border bg-card p-4", x.destaque && "ring-2 ring-warning/40", x.ativo ? "border-border" : "border-border opacity-60")}>
              {x.destaque && (
                <div className="absolute -top-2 right-3 px-2 py-0.5 rounded bg-warning text-white text-[9px] uppercase tracking-wider font-bold inline-flex items-center gap-1">
                  <Star className="w-2.5 h-2.5" /> Destaque
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in oklab, ${x.cor ?? "#0F859A"} 18%, transparent)`, color: x.cor ?? "#0F859A" }}>
                  <BookOpenCheck className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-[13px] truncate">{x.nome}</div>
                  <div className="text-[11px] text-muted-foreground">{(x.servicos_inclusos ?? []).length} serviço(s) incluso(s)</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => abrir(x)} className="w-7 h-7 rounded-md hover:bg-secondary flex items-center justify-center"><Pencil className="w-3 h-3" /></button>
                  <button onClick={async () => { if (confirm(`Deletar "${x.nome}"?`)) await deletarCadastro("planos", x.id); }} className="w-7 h-7 rounded-md hover:bg-danger/10 text-muted-foreground hover:text-danger flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
                  <button onClick={() => alternarAtivoCadastro("planos", x.id, !x.ativo)} className="w-7 h-7 rounded-md hover:bg-secondary flex items-center justify-center"><Power className={cn("w-3 h-3", x.ativo ? "text-success" : "text-muted-foreground")} /></button>
                </div>
              </div>
              <div className="mt-3">
                <div className="font-display font-bold text-2xl tabular-nums" style={{ color: x.cor ?? "#0F859A" }}>R$ {Number(x.preco).toFixed(2).replace(".", ",")}</div>
                {x.preco_avulso_referencia && Number(x.preco_avulso_referencia) > Number(x.preco) && (
                  <div className="text-[10px] text-muted-foreground line-through">avulso R$ {Number(x.preco_avulso_referencia).toFixed(2).replace(".", ",")}</div>
                )}
              </div>
              {x.descricao && <div className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{x.descricao}</div>}
            </motion.div>
          ))}
        </div>
      )}
    </CrudShell>
  );
}

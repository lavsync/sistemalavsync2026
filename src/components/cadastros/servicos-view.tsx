"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, Power, Package, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudShell, Field, EstadoVazio, BusyButton } from "./crud-shell";
import { criarCadastro, atualizarCadastro, deletarCadastro, alternarAtivoCadastro } from "@/lib/cadastros/actions";
import type { Servico } from "@/lib/cadastros/queries";
import { cn } from "@/lib/utils";

const TIPOS = ["lavagem", "secagem", "dobra", "passadoria", "higienizacao", "extra", "outro"];

export function ServicosView({ servicos }: { servicos: Servico[] }) {
  const [busca, setBusca] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [editando, setEditando] = React.useState<Servico | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [s, setS] = React.useState({ nome: "", tipo: "lavagem", preco: "", duracao_minutos: "", descricao: "", cor: "#19C7CB" });

  function abrir(x?: Servico) {
    setEditando(x ?? null);
    setS({
      nome: x?.nome ?? "",
      tipo: x?.tipo ?? "lavagem",
      preco: x?.preco?.toString().replace(".", ",") ?? "",
      duracao_minutos: x?.duracao_minutos?.toString() ?? "",
      descricao: x?.descricao ?? "",
      cor: x?.cor ?? "#19C7CB",
    });
    setErro(null);
    setOpen(true);
  }

  async function salvar() {
    setBusy(true); setErro(null);
    try {
      const preco = parseFloat(s.preco.replace(",", "."));
      if (isNaN(preco) || preco < 0) { setErro("Preço inválido"); setBusy(false); return; }
      const payload = {
        nome: s.nome.trim(),
        tipo: s.tipo,
        preco,
        duracao_minutos: s.duracao_minutos ? parseInt(s.duracao_minutos, 10) : null,
        descricao: s.descricao || null,
        cor: s.cor,
      };
      if (editando) await atualizarCadastro("servicos", editando.id, payload);
      else await criarCadastro("servicos", payload);
      setOpen(false);
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  const filtrados = servicos.filter((x) => !busca || x.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <CrudShell
      eyebrow="Cadastros · Operação"
      title="Serviços"
      subtitle={`serviço${servicos.length === 1 ? "" : "s"} cadastrado${servicos.length === 1 ? "" : "s"} com preço unitário`}
      total={servicos.length} novoLabel="Novo serviço" busca={busca} onBuscaChange={setBusca}
      dialog={{
        open, setOpen,
        titulo: editando ? "Editar serviço" : "Novo serviço",
        descricao: "Serviços avulsos vendidos no totem (Lavagem R$17, Secagem R$16,99 etc).",
        children: (
          <>
            <Field label="Nome" required><input value={s.nome} onChange={(e) => setS({ ...s, nome: e.target.value })} className="form-input" autoFocus /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo" required>
                <select value={s.tipo} onChange={(e) => setS({ ...s, tipo: e.target.value })} className="form-input">
                  {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Preço (R$)" required>
                <input value={s.preco} onChange={(e) => setS({ ...s, preco: e.target.value })} placeholder="17,00" className="form-input font-mono" />
              </Field>
              <Field label="Duração (min)">
                <input type="number" value={s.duracao_minutos} onChange={(e) => setS({ ...s, duracao_minutos: e.target.value })} placeholder="35" className="form-input font-mono" />
              </Field>
              <Field label="Cor">
                <input type="color" value={s.cor} onChange={(e) => setS({ ...s, cor: e.target.value })} className="form-input h-10 cursor-pointer" />
              </Field>
            </div>
            <Field label="Descrição"><textarea rows={2} value={s.descricao} onChange={(e) => setS({ ...s, descricao: e.target.value })} className="form-input resize-none" /></Field>
            {erro && <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{erro}</div>}
          </>
        ),
        footer: (
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <BusyButton busy={busy} onClick={salvar} disabled={s.nome.trim().length < 2 || !s.preco}>
              {editando ? "Salvar" : "Criar serviço"}
            </BusyButton>
          </>
        ),
      }}
    >
      {filtrados.length === 0 ? (
        <EstadoVazio titulo="Nenhum serviço" descricao={busca ? "Tente outra busca." : "Cadastre lavagem, secagem e extras com preço."} onAcao={() => abrir()} labelAcao="Novo serviço" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtrados.map((x) => (
            <motion.div key={x.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={cn("rounded-xl border bg-card p-4", x.ativo ? "border-border" : "border-border opacity-60")}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in oklab, ${x.cor ?? "#19C7CB"} 18%, transparent)`, color: x.cor ?? "#19C7CB" }}>
                  <Package className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-[13px] truncate">{x.nome}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{x.tipo}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => abrir(x)} className="w-7 h-7 rounded-md hover:bg-secondary flex items-center justify-center"><Pencil className="w-3 h-3" /></button>
                  <button onClick={async () => { if (confirm(`Deletar "${x.nome}"?`)) await deletarCadastro("servicos", x.id); }} className="w-7 h-7 rounded-md hover:bg-danger/10 text-muted-foreground hover:text-danger flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
                  <button onClick={() => alternarAtivoCadastro("servicos", x.id, !x.ativo)} className="w-7 h-7 rounded-md hover:bg-secondary flex items-center justify-center"><Power className={cn("w-3 h-3", x.ativo ? "text-success" : "text-muted-foreground")} /></button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="font-display font-bold text-2xl tabular-nums" style={{ color: x.cor ?? "#19C7CB" }}>
                  R$ {Number(x.preco).toFixed(2).replace(".", ",")}
                </div>
                {x.duracao_minutos && <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Clock className="w-3 h-3" />{x.duracao_minutos}min</span>}
              </div>
              {x.descricao && <div className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{x.descricao}</div>}
            </motion.div>
          ))}
        </div>
      )}
    </CrudShell>
  );
}

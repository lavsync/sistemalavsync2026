"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, Power, Truck, Phone, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudShell, Field, EstadoVazio, BusyButton } from "./crud-shell";
import { criarCadastro, atualizarCadastro, deletarCadastro, alternarAtivoCadastro } from "@/lib/cadastros/actions";
import type { Fornecedor } from "@/lib/cadastros/queries";
import { cn } from "@/lib/utils";

export function FornecedoresView({ fornecedores }: { fornecedores: Fornecedor[] }) {
  const [busca, setBusca] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [editando, setEditando] = React.useState<Fornecedor | null>(null);

  const [f, setF] = React.useState({
    nome: "", razao_social: "", cnpj_cpf: "", email: "", telefone: "",
    whatsapp: "", endereco: "", contato_nome: "", servico_fornecido: "", observacoes: "",
  });
  const [busy, setBusy] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  function abrir(x?: Fornecedor) {
    setEditando(x ?? null);
    setF({
      nome: x?.nome ?? "",
      razao_social: x?.razao_social ?? "",
      cnpj_cpf: x?.cnpj_cpf ?? "",
      email: x?.email ?? "",
      telefone: x?.telefone ?? "",
      whatsapp: x?.whatsapp ?? "",
      endereco: x?.endereco ?? "",
      contato_nome: x?.contato_nome ?? "",
      servico_fornecido: x?.servico_fornecido ?? "",
      observacoes: x?.observacoes ?? "",
    });
    setErro(null);
    setOpen(true);
  }

  async function salvar() {
    setBusy(true); setErro(null);
    try {
      const payload = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v?.trim() || null]));
      payload.nome = f.nome.trim();
      if (editando) await atualizarCadastro("fornecedores", editando.id, payload);
      else await criarCadastro("fornecedores", payload);
      setOpen(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally { setBusy(false); }
  }

  const filtrados = fornecedores.filter((x) => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return x.nome.toLowerCase().includes(q) ||
      (x.cnpj_cpf ?? "").includes(q) ||
      (x.servico_fornecido ?? "").toLowerCase().includes(q);
  });

  return (
    <CrudShell
      eyebrow="Cadastros · Operação"
      title="Fornecedores"
      subtitle={`fornecedor${fornecedores.length === 1 ? "" : "es"} cadastrado${fornecedores.length === 1 ? "" : "s"}`}
      total={fornecedores.length}
      novoLabel="Novo fornecedor"
      busca={busca}
      onBuscaChange={setBusca}
      dialog={{
        open, setOpen,
        titulo: editando ? "Editar fornecedor" : "Novo fornecedor",
        descricao: "Cadastre quem fornece produtos ou serviços pra sua operação.",
        maxWidth: "max-w-2xl",
        children: (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nome fantasia" required>
                <input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} className="form-input" autoFocus />
              </Field>
              <Field label="Razão social">
                <input value={f.razao_social} onChange={(e) => setF({ ...f, razao_social: e.target.value })} className="form-input" />
              </Field>
              <Field label="CNPJ ou CPF">
                <input value={f.cnpj_cpf} onChange={(e) => setF({ ...f, cnpj_cpf: e.target.value })} className="form-input font-mono" />
              </Field>
              <Field label="Serviço fornecido">
                <input value={f.servico_fornecido} onChange={(e) => setF({ ...f, servico_fornecido: e.target.value })} placeholder="Produtos químicos, manutenção, ..." className="form-input" />
              </Field>
              <Field label="E-mail">
                <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="form-input" />
              </Field>
              <Field label="Telefone">
                <input value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} className="form-input font-mono" />
              </Field>
              <Field label="WhatsApp">
                <input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} className="form-input font-mono" />
              </Field>
              <Field label="Contato (nome)">
                <input value={f.contato_nome} onChange={(e) => setF({ ...f, contato_nome: e.target.value })} className="form-input" />
              </Field>
            </div>
            <Field label="Endereço">
              <input value={f.endereco} onChange={(e) => setF({ ...f, endereco: e.target.value })} className="form-input" />
            </Field>
            <Field label="Observações">
              <textarea rows={2} value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} className="form-input resize-none" />
            </Field>
            {erro && <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{erro}</div>}
          </>
        ),
        footer: (
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <BusyButton busy={busy} onClick={salvar} disabled={f.nome.trim().length < 2}>
              {editando ? "Salvar" : "Criar fornecedor"}
            </BusyButton>
          </>
        ),
      }}
    >
      {filtrados.length === 0 ? (
        <EstadoVazio titulo="Nenhum fornecedor" descricao={busca ? "Tente outra busca." : "Cadastre seus fornecedores pra organizar despesas e contatos."} onAcao={() => abrir()} labelAcao="Novo fornecedor" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtrados.map((x) => (
            <motion.div key={x.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={cn("rounded-xl border bg-card p-4 transition-smooth", x.ativo ? "border-border hover:border-border-strong" : "border-border opacity-60")}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-cyan/15 border border-brand-cyan/30 flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4 text-brand-cyan" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-[13px] truncate">{x.nome}</div>
                  {x.razao_social && <div className="text-[10px] text-muted-foreground truncate">{x.razao_social}</div>}
                  {x.servico_fornecido && <div className="text-[11px] text-brand-cyan font-semibold mt-1 truncate">{x.servico_fornecido}</div>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => abrir(x)} className="w-7 h-7 rounded-md hover:bg-secondary flex items-center justify-center"><Pencil className="w-3 h-3" /></button>
                  <button onClick={async () => { if (confirm(`Deletar "${x.nome}"?`)) await deletarCadastro("fornecedores", x.id); }} className="w-7 h-7 rounded-md hover:bg-danger/10 text-muted-foreground hover:text-danger flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
                  <button onClick={() => alternarAtivoCadastro("fornecedores", x.id, !x.ativo)} className="w-7 h-7 rounded-md hover:bg-secondary flex items-center justify-center"><Power className={cn("w-3 h-3", x.ativo ? "text-success" : "text-muted-foreground")} /></button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                {x.telefone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{x.telefone}</span>}
                {x.whatsapp && <a href={`https://wa.me/55${x.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-success hover:underline"><MessageCircle className="w-3 h-3" />WA</a>}
                {x.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{x.email}</span>}
                {x.cnpj_cpf && <span className="font-mono">{x.cnpj_cpf}</span>}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </CrudShell>
  );
}

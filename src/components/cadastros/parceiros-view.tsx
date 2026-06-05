"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, Power, Handshake, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudShell, Field, EstadoVazio, BusyButton } from "./crud-shell";
import { criarCadastro, atualizarCadastro, deletarCadastro, alternarAtivoCadastro } from "@/lib/cadastros/actions";
import type { Parceiro } from "@/lib/cadastros/queries";
import { cn } from "@/lib/utils";

const TIPOS = ["condominio", "hotel", "pousada", "oficina", "empresa", "influencer", "outro"];

export function ParceirosView({ parceiros }: { parceiros: Parceiro[] }) {
  const [busca, setBusca] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [editando, setEditando] = React.useState<Parceiro | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [p, setP] = React.useState({
    nome: "", tipo: "empresa", cnpj_cpf: "", responsavel_nome: "", email: "",
    telefone: "", whatsapp: "", endereco: "", comissao_percentual: "",
    acordo_descricao: "", inicio_parceria: "", fim_parceria: "", observacoes: "",
  });

  function abrir(x?: Parceiro) {
    setEditando(x ?? null);
    setP({
      nome: x?.nome ?? "",
      tipo: x?.tipo ?? "empresa",
      cnpj_cpf: x?.cnpj_cpf ?? "",
      responsavel_nome: x?.responsavel_nome ?? "",
      email: x?.email ?? "",
      telefone: x?.telefone ?? "",
      whatsapp: x?.whatsapp ?? "",
      endereco: x?.endereco ?? "",
      comissao_percentual: x?.comissao_percentual?.toString() ?? "",
      acordo_descricao: x?.acordo_descricao ?? "",
      inicio_parceria: x?.inicio_parceria ?? "",
      fim_parceria: x?.fim_parceria ?? "",
      observacoes: x?.observacoes ?? "",
    });
    setErro(null);
    setOpen(true);
  }

  async function salvar() {
    setBusy(true); setErro(null);
    try {
      const payload = {
        nome: p.nome.trim(),
        tipo: p.tipo,
        cnpj_cpf: p.cnpj_cpf || null,
        responsavel_nome: p.responsavel_nome || null,
        email: p.email || null,
        telefone: p.telefone || null,
        whatsapp: p.whatsapp || null,
        endereco: p.endereco || null,
        comissao_percentual: p.comissao_percentual ? parseFloat(p.comissao_percentual) : null,
        acordo_descricao: p.acordo_descricao || null,
        inicio_parceria: p.inicio_parceria || null,
        fim_parceria: p.fim_parceria || null,
        observacoes: p.observacoes || null,
      };
      if (editando) await atualizarCadastro("parceiros", editando.id, payload);
      else await criarCadastro("parceiros", payload);
      setOpen(false);
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  const filtrados = parceiros.filter((x) => !busca || x.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <CrudShell
      eyebrow="Cadastros · Comercial"
      title="Parceiros"
      subtitle={`parceiro${parceiros.length === 1 ? "" : "s"} comercial${parceiros.length === 1 ? "" : "s"} cadastrado${parceiros.length === 1 ? "" : "s"}`}
      total={parceiros.length} novoLabel="Novo parceiro" busca={busca} onBuscaChange={setBusca}
      dialog={{
        open, setOpen, maxWidth: "max-w-2xl",
        titulo: editando ? "Editar parceiro" : "Novo parceiro",
        descricao: "B2B · condomínios, hotéis, pousadas, oficinas, empresas com acordo de comissão.",
        children: (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nome" required><input value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} className="form-input" autoFocus /></Field>
              <Field label="Tipo">
                <select value={p.tipo} onChange={(e) => setP({ ...p, tipo: e.target.value })} className="form-input">
                  {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="CNPJ/CPF"><input value={p.cnpj_cpf} onChange={(e) => setP({ ...p, cnpj_cpf: e.target.value })} className="form-input font-mono" /></Field>
              <Field label="Responsável"><input value={p.responsavel_nome} onChange={(e) => setP({ ...p, responsavel_nome: e.target.value })} className="form-input" /></Field>
              <Field label="E-mail"><input type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} className="form-input" /></Field>
              <Field label="Telefone"><input value={p.telefone} onChange={(e) => setP({ ...p, telefone: e.target.value })} className="form-input font-mono" /></Field>
              <Field label="WhatsApp"><input value={p.whatsapp} onChange={(e) => setP({ ...p, whatsapp: e.target.value })} className="form-input font-mono" /></Field>
              <Field label="Comissão (%)"><input value={p.comissao_percentual} onChange={(e) => setP({ ...p, comissao_percentual: e.target.value })} placeholder="10" className="form-input font-mono" /></Field>
              <Field label="Início da parceria"><input type="date" value={p.inicio_parceria} onChange={(e) => setP({ ...p, inicio_parceria: e.target.value })} className="form-input font-mono" /></Field>
              <Field label="Fim da parceria"><input type="date" value={p.fim_parceria} onChange={(e) => setP({ ...p, fim_parceria: e.target.value })} className="form-input font-mono" /></Field>
            </div>
            <Field label="Endereço"><input value={p.endereco} onChange={(e) => setP({ ...p, endereco: e.target.value })} className="form-input" /></Field>
            <Field label="Descrição do acordo"><textarea rows={2} value={p.acordo_descricao} onChange={(e) => setP({ ...p, acordo_descricao: e.target.value })} className="form-input resize-none" /></Field>
            <Field label="Observações"><textarea rows={2} value={p.observacoes} onChange={(e) => setP({ ...p, observacoes: e.target.value })} className="form-input resize-none" /></Field>
            {erro && <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{erro}</div>}
          </>
        ),
        footer: (
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <BusyButton busy={busy} onClick={salvar} disabled={p.nome.trim().length < 2}>{editando ? "Salvar" : "Criar parceiro"}</BusyButton>
          </>
        ),
      }}
    >
      {filtrados.length === 0 ? (
        <EstadoVazio titulo="Nenhum parceiro" descricao="Cadastre B2B com acordo de comissão (condomínio, hotel)." onAcao={() => abrir()} labelAcao="Novo parceiro" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtrados.map((x) => (
            <motion.div key={x.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={cn("rounded-xl border bg-card p-4", x.ativo ? "border-border" : "border-border opacity-60")}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-purple/15 border border-brand-purple/30 flex items-center justify-center shrink-0">
                  <Handshake className="w-4 h-4 text-brand-purple" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-[13px] truncate">{x.nome}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{x.tipo}</div>
                  {x.responsavel_nome && <div className="text-[11px] text-muted-foreground mt-1">Contato: {x.responsavel_nome}</div>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => abrir(x)} className="w-7 h-7 rounded-md hover:bg-secondary flex items-center justify-center"><Pencil className="w-3 h-3" /></button>
                  <button onClick={async () => { if (confirm("Deletar?")) await deletarCadastro("parceiros", x.id); }} className="w-7 h-7 rounded-md hover:bg-danger/10 text-muted-foreground hover:text-danger flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
                  <button onClick={() => alternarAtivoCadastro("parceiros", x.id, !x.ativo)} className="w-7 h-7 rounded-md hover:bg-secondary flex items-center justify-center"><Power className={cn("w-3 h-3", x.ativo ? "text-success" : "text-muted-foreground")} /></button>
                </div>
              </div>
              {x.comissao_percentual && (
                <div className="mt-3 inline-flex items-center gap-1 px-2 py-1 rounded bg-warning/10 text-warning font-mono font-bold text-[12px]">
                  <Percent className="w-3 h-3" />{x.comissao_percentual}% comissão
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </CrudShell>
  );
}

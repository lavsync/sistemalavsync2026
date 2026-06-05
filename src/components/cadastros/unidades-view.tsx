"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Pencil, Building2, MapPin, Phone, Mail, User, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudShell, Field, BusyButton } from "./crud-shell";
import { atualizarCadastro } from "@/lib/cadastros/actions";
import type { UnidadeCompleta } from "@/lib/cadastros/queries";
import { cn } from "@/lib/utils";

export function UnidadesCadastroView({ unidades }: { unidades: UnidadeCompleta[] }) {
  const [busca, setBusca] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [editando, setEditando] = React.useState<UnidadeCompleta | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [u, setU] = React.useState<Partial<UnidadeCompleta>>({});

  function abrir(x: UnidadeCompleta) {
    setEditando(x);
    setU(x);
    setErro(null);
    setOpen(true);
  }

  async function salvar() {
    if (!editando) return;
    setBusy(true); setErro(null);
    try {
      const payload: Record<string, unknown> = {};
      const campos: Array<keyof UnidadeCompleta> = [
        "nome", "codigo_interno", "razao_social", "cnpj", "inscricao_estadual",
        "endereco_cep", "endereco_logradouro", "endereco_numero", "endereco_complemento",
        "endereco_bairro", "endereco_cidade", "endereco_uf",
        "telefone", "whatsapp", "email", "gestor_nome", "gestor_telefone",
        "status", "data_inauguracao", "foto_url", "meta_faturamento_mensal", "observacoes",
      ];
      for (const c of campos) {
        const v = u[c];
        payload[c] = v === "" ? null : v;
      }
      if (typeof u.meta_faturamento_mensal === "string") {
        payload.meta_faturamento_mensal = u.meta_faturamento_mensal
          ? parseFloat((u.meta_faturamento_mensal as string).replace(",", ".")) : null;
      }
      await atualizarCadastro("unidades", editando.id, payload);
      setOpen(false);
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  const filtradas = unidades.filter((x) => !busca || x.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <CrudShell
      eyebrow="Cadastros · Estrutura"
      title="Unidades"
      subtitle={`unidade${unidades.length === 1 ? "" : "s"} da rede · endereço, CNPJ e contatos`}
      total={unidades.length}
      novoLabel="Edição manual"
      busca={busca}
      onBuscaChange={setBusca}
      dialog={{
        open, setOpen, maxWidth: "max-w-3xl",
        titulo: editando ? `Editar ${editando.nome}` : "Editar unidade",
        descricao: "Complete os dados da unidade: endereço, CNPJ, contatos e meta.",
        children: editando && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nome" required><input value={u.nome ?? ""} onChange={(e) => setU({ ...u, nome: e.target.value })} className="form-input" /></Field>
              <Field label="Código interno"><input value={u.codigo_interno ?? ""} onChange={(e) => setU({ ...u, codigo_interno: e.target.value })} className="form-input font-mono" placeholder="UNI-001" /></Field>
              <Field label="Razão social"><input value={u.razao_social ?? ""} onChange={(e) => setU({ ...u, razao_social: e.target.value })} className="form-input" /></Field>
              <Field label="CNPJ"><input value={u.cnpj ?? ""} onChange={(e) => setU({ ...u, cnpj: e.target.value })} className="form-input font-mono" /></Field>
              <Field label="Inscrição estadual"><input value={u.inscricao_estadual ?? ""} onChange={(e) => setU({ ...u, inscricao_estadual: e.target.value })} className="form-input font-mono" /></Field>
              <Field label="Data inauguração"><input type="date" value={u.data_inauguracao ?? ""} onChange={(e) => setU({ ...u, data_inauguracao: e.target.value })} className="form-input font-mono" /></Field>
            </div>

            <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mt-2">Endereço</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="CEP"><input value={u.endereco_cep ?? ""} onChange={(e) => setU({ ...u, endereco_cep: e.target.value })} className="form-input font-mono" /></Field>
              <div className="md:col-span-2"><Field label="Logradouro"><input value={u.endereco_logradouro ?? ""} onChange={(e) => setU({ ...u, endereco_logradouro: e.target.value })} className="form-input" /></Field></div>
              <Field label="Número"><input value={u.endereco_numero ?? ""} onChange={(e) => setU({ ...u, endereco_numero: e.target.value })} className="form-input font-mono" /></Field>
              <Field label="Complemento"><input value={u.endereco_complemento ?? ""} onChange={(e) => setU({ ...u, endereco_complemento: e.target.value })} className="form-input" /></Field>
              <Field label="Bairro"><input value={u.endereco_bairro ?? ""} onChange={(e) => setU({ ...u, endereco_bairro: e.target.value })} className="form-input" /></Field>
              <Field label="Cidade"><input value={u.endereco_cidade ?? ""} onChange={(e) => setU({ ...u, endereco_cidade: e.target.value })} className="form-input" /></Field>
              <Field label="UF"><input value={u.endereco_uf ?? ""} onChange={(e) => setU({ ...u, endereco_uf: e.target.value.toUpperCase().slice(0, 2) })} className="form-input font-mono uppercase" maxLength={2} /></Field>
            </div>

            <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground mt-2">Contatos</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Telefone"><input value={u.telefone ?? ""} onChange={(e) => setU({ ...u, telefone: e.target.value })} className="form-input font-mono" /></Field>
              <Field label="WhatsApp"><input value={u.whatsapp ?? ""} onChange={(e) => setU({ ...u, whatsapp: e.target.value })} className="form-input font-mono" /></Field>
              <Field label="E-mail"><input type="email" value={u.email ?? ""} onChange={(e) => setU({ ...u, email: e.target.value })} className="form-input" /></Field>
              <Field label="Status">
                <select value={u.status ?? "ativa"} onChange={(e) => setU({ ...u, status: e.target.value })} className="form-input">
                  <option value="ativa">Ativa</option>
                  <option value="em_obra">Em obra</option>
                  <option value="pausada">Pausada</option>
                  <option value="encerrada">Encerrada</option>
                </select>
              </Field>
              <Field label="Gestor responsável"><input value={u.gestor_nome ?? ""} onChange={(e) => setU({ ...u, gestor_nome: e.target.value })} className="form-input" /></Field>
              <Field label="Telefone do gestor"><input value={u.gestor_telefone ?? ""} onChange={(e) => setU({ ...u, gestor_telefone: e.target.value })} className="form-input font-mono" /></Field>
            </div>

            <Field label="Meta de faturamento mensal (R$)"><input value={u.meta_faturamento_mensal?.toString() ?? ""} onChange={(e) => setU({ ...u, meta_faturamento_mensal: e.target.value as unknown as number })} placeholder="30000,00" className="form-input font-mono" /></Field>
            <Field label="Observações"><textarea rows={3} value={u.observacoes ?? ""} onChange={(e) => setU({ ...u, observacoes: e.target.value })} className="form-input resize-none" /></Field>

            {erro && <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{erro}</div>}
          </>
        ),
        footer: editando && (
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <BusyButton busy={busy} onClick={salvar}>Salvar unidade</BusyButton>
          </>
        ),
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {filtradas.map((x) => (
          <motion.div key={x.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className={cn("rounded-2xl border bg-card p-4", x.ativa ? "border-border hover:border-border-strong" : "border-border opacity-60")}>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-brand-cyan/15 border border-brand-cyan/30 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-brand-cyan" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-[15px]">{x.nome}</div>
                {x.codigo_interno && <div className="text-[10px] font-mono text-muted-foreground">{x.codigo_interno}</div>}
                {x.cnpj && <div className="text-[10px] font-mono text-muted-foreground mt-0.5">CNPJ {x.cnpj}</div>}
              </div>
              <button onClick={() => abrir(x)} className="w-8 h-8 rounded-md hover:bg-secondary flex items-center justify-center">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
              {(x.endereco_logradouro || x.endereco_cidade) && (
                <div className="inline-flex items-start gap-1.5"><MapPin className="w-3 h-3 mt-0.5 shrink-0" />{[x.endereco_logradouro, x.endereco_numero, x.endereco_bairro, x.endereco_cidade, x.endereco_uf].filter(Boolean).join(", ")}</div>
              )}
              {x.telefone && <div className="inline-flex items-center gap-1.5"><Phone className="w-3 h-3" />{x.telefone}</div>}
              {x.email && <div className="inline-flex items-center gap-1.5"><Mail className="w-3 h-3" />{x.email}</div>}
              {x.gestor_nome && <div className="inline-flex items-center gap-1.5"><User className="w-3 h-3" />Gestor: {x.gestor_nome}</div>}
              {x.meta_faturamento_mensal && <div className="inline-flex items-center gap-1.5 text-brand-cyan font-semibold"><Target className="w-3 h-3" />Meta R$ {Number(x.meta_faturamento_mensal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês</div>}
            </div>
          </motion.div>
        ))}
      </div>
    </CrudShell>
  );
}

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Send, Loader2, CheckCircle2, AlertTriangle, Copy, Check } from "lucide-react";
import { abrirSolicitacaoLgpd } from "@/lib/lgpd-actions";

const TIPOS = [
  { value: "acesso",        label: "Confirmação e acesso aos meus dados" },
  { value: "correcao",      label: "Correção de dados" },
  { value: "exclusao",      label: "Eliminação dos meus dados" },
  { value: "anonimizacao",  label: "Anonimização" },
  { value: "portabilidade", label: "Portabilidade (receber meus dados)" },
  { value: "revogacao",     label: "Revogar consentimento" },
  { value: "oposicao",      label: "Oposição ao tratamento" },
  { value: "informacao",    label: "Outras informações" },
] as const;

type Tipo = typeof TIPOS[number]["value"];

export function DireitosLgpdForm() {
  const [tipo, setTipo] = React.useState<Tipo>("acesso");
  const [nome, setNome] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [cpf, setCpf] = React.useState("");
  const [telefone, setTelefone] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [protocolo, setProtocolo] = React.useState<string | null>(null);
  const [copiou, setCopiou] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErro(null);
    try {
      const r = await abrirSolicitacaoLgpd({
        tipo, nome, email, cpf, telefone, descricao,
      });
      if (!r.ok) {
        setErro(r.motivo ?? "Erro");
      } else {
        setProtocolo(r.protocolo ?? null);
      }
    } finally {
      setBusy(false);
    }
  }

  if (protocolo) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-success/30 bg-success/8 p-6 not-prose my-6"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-success shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-display font-bold text-success text-lg">Solicitação registrada</div>
            <p className="text-[13px] text-success/85 mt-1">
              Recebemos sua solicitação e atenderemos no prazo legal de 15 dias corridos. Você
              receberá uma resposta no e-mail informado.
            </p>
            <div className="mt-4 rounded-lg bg-success/10 border border-success/20 p-3">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-success/70">Número do protocolo</div>
              <div className="font-mono text-[14px] font-bold text-success mt-1 select-all break-all">{protocolo}</div>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(protocolo); setCopiou(true); setTimeout(() => setCopiou(false), 2000); }}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success/15 hover:bg-success/25 text-success text-[12px] font-semibold"
            >
              {copiou ? <><Check className="w-3.5 h-3.5" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar protocolo</>}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="not-prose space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-6 my-6">
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55 mb-1.5">
          Tipo da solicitação *
        </label>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as Tipo)}
          className="form-input"
        >
          {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Campo label="Nome completo *">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="João Silva" className="form-input" required />
        </Campo>
        <Campo label="E-mail *">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" className="form-input" required />
        </Campo>
        <Campo label="CPF (opcional)">
          <input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" className="form-input font-mono" />
        </Campo>
        <Campo label="Telefone (opcional)">
          <input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(31) 99999-9999" className="form-input font-mono" />
        </Campo>
      </div>

      <Campo label="Descrição da solicitação *">
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descreva com detalhes o que você está solicitando. Ex: quero acessar todos os dados que vocês têm sobre mim..."
          rows={5}
          className="form-input resize-none"
          required
          minLength={20}
        />
        <div className="text-[10px] text-white/40 mt-1">
          Mínimo 20 caracteres. {descricao.length}/20
        </div>
      </Campo>

      {erro && (
        <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger inline-flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {erro}
        </div>
      )}

      <div className="rounded-lg border border-warning/30 bg-warning/8 px-3 py-2 text-[11px] text-warning">
        <strong>Atenção:</strong> Para sua segurança, podemos solicitar comprovação de identidade.
        Esta solicitação será tratada no prazo legal de 15 dias corridos.
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full h-11 rounded-xl font-display font-semibold text-[14px] text-white inline-flex items-center justify-center gap-2 disabled:opacity-60"
        style={{
          background: "linear-gradient(135deg, #01385B 0%, #0F859A 35%, #19C7CB 70%, #73D8D8 100%)",
          boxShadow: "0 12px 28px -10px rgba(25, 199, 203, 0.5)",
        }}
      >
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : <><Send className="w-4 h-4" /> Enviar solicitação</>}
      </button>
    </form>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55 mb-1.5">{label}</div>
      {children}
    </label>
  );
}

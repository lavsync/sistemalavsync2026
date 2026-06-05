"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, Sparkles, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudShell, Field, EstadoVazio, BusyButton } from "./crud-shell";
import { criarCadastro, atualizarCadastro, deletarCadastro } from "@/lib/cadastros/actions";
import type { Campanha } from "@/lib/cadastros/queries";
import { cn } from "@/lib/utils";

const STATUS_META = {
  rascunho: { label: "Rascunho", tone: "bg-muted text-muted-foreground" },
  ativa:    { label: "Ativa",    tone: "bg-success/15 text-success" },
  pausada:  { label: "Pausada",  tone: "bg-warning/15 text-warning" },
  encerrada:{ label: "Encerrada",tone: "bg-danger/15 text-danger" },
};

export function CampanhasView({ campanhas }: { campanhas: Campanha[] }) {
  const [busca, setBusca] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [editando, setEditando] = React.useState<Campanha | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [c, setC] = React.useState({
    nome: "", codigo_cupom: "", descricao: "", tipo_desconto: "percentual",
    valor_desconto: "", inicio_em: "", fim_em: "", max_usos: "", max_usos_por_cliente: "",
    status: "rascunho", observacoes: "",
  });

  function abrir(x?: Campanha) {
    setEditando(x ?? null);
    setC({
      nome: x?.nome ?? "",
      codigo_cupom: x?.codigo_cupom ?? "",
      descricao: x?.descricao ?? "",
      tipo_desconto: x?.tipo_desconto ?? "percentual",
      valor_desconto: x?.valor_desconto?.toString().replace(".", ",") ?? "",
      inicio_em: x?.inicio_em ?? new Date().toISOString().slice(0, 10),
      fim_em: x?.fim_em ?? "",
      max_usos: x?.max_usos?.toString() ?? "",
      max_usos_por_cliente: x?.max_usos_por_cliente?.toString() ?? "",
      status: x?.status ?? "rascunho",
      observacoes: x?.observacoes ?? "",
    });
    setErro(null);
    setOpen(true);
  }

  async function salvar() {
    setBusy(true); setErro(null);
    try {
      const valor = parseFloat(c.valor_desconto.replace(",", "."));
      if (isNaN(valor) || valor < 0) { setErro("Valor de desconto inválido"); setBusy(false); return; }
      const payload = {
        nome: c.nome.trim(),
        codigo_cupom: c.codigo_cupom?.trim().toUpperCase() || null,
        descricao: c.descricao || null,
        tipo_desconto: c.tipo_desconto,
        valor_desconto: valor,
        inicio_em: c.inicio_em,
        fim_em: c.fim_em || null,
        max_usos: c.max_usos ? parseInt(c.max_usos, 10) : null,
        max_usos_por_cliente: c.max_usos_por_cliente ? parseInt(c.max_usos_por_cliente, 10) : null,
        status: c.status,
        observacoes: c.observacoes || null,
      };
      if (editando) await atualizarCadastro("campanhas", editando.id, payload);
      else await criarCadastro("campanhas", payload);
      setOpen(false);
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  const filtrados = campanhas.filter((x) => !busca || x.nome.toLowerCase().includes(busca.toLowerCase()) || (x.codigo_cupom ?? "").includes(busca.toUpperCase()));

  return (
    <CrudShell
      eyebrow="Cadastros · Marketing"
      title="Campanhas"
      subtitle={`campanha${campanhas.length === 1 ? "" : "s"} promocional${campanhas.length === 1 ? "" : "s"}`}
      total={campanhas.length} novoLabel="Nova campanha" busca={busca} onBuscaChange={setBusca}
      dialog={{
        open, setOpen, maxWidth: "max-w-2xl",
        titulo: editando ? "Editar campanha" : "Nova campanha",
        descricao: "Cupons, vouchers e promoções com vigência e limite de uso.",
        children: (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nome da campanha" required><input value={c.nome} onChange={(e) => setC({ ...c, nome: e.target.value })} className="form-input" autoFocus placeholder="Inauguração 20% OFF" /></Field>
              <Field label="Código do cupom"><input value={c.codigo_cupom} onChange={(e) => setC({ ...c, codigo_cupom: e.target.value.toUpperCase() })} className="form-input font-mono uppercase" placeholder="INAUGURA20" /></Field>
              <Field label="Tipo de desconto" required>
                <select value={c.tipo_desconto} onChange={(e) => setC({ ...c, tipo_desconto: e.target.value })} className="form-input">
                  <option value="percentual">Percentual (%)</option>
                  <option value="valor_fixo">Valor fixo (R$)</option>
                  <option value="cortesia">Cortesia (100%)</option>
                </select>
              </Field>
              <Field label={c.tipo_desconto === "percentual" ? "Desconto (%)" : "Valor (R$)"} required>
                <input value={c.valor_desconto} onChange={(e) => setC({ ...c, valor_desconto: e.target.value })} className="form-input font-mono" />
              </Field>
              <Field label="Início" required><input type="date" value={c.inicio_em} onChange={(e) => setC({ ...c, inicio_em: e.target.value })} className="form-input font-mono" /></Field>
              <Field label="Fim"><input type="date" value={c.fim_em} onChange={(e) => setC({ ...c, fim_em: e.target.value })} className="form-input font-mono" /></Field>
              <Field label="Máx. usos totais"><input type="number" value={c.max_usos} onChange={(e) => setC({ ...c, max_usos: e.target.value })} className="form-input font-mono" /></Field>
              <Field label="Máx. por cliente"><input type="number" value={c.max_usos_por_cliente} onChange={(e) => setC({ ...c, max_usos_por_cliente: e.target.value })} className="form-input font-mono" /></Field>
              <Field label="Status">
                <select value={c.status} onChange={(e) => setC({ ...c, status: e.target.value })} className="form-input">
                  {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Descrição"><textarea rows={2} value={c.descricao} onChange={(e) => setC({ ...c, descricao: e.target.value })} className="form-input resize-none" /></Field>
            {erro && <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{erro}</div>}
          </>
        ),
        footer: (
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <BusyButton busy={busy} onClick={salvar} disabled={c.nome.trim().length < 2}>{editando ? "Salvar" : "Criar campanha"}</BusyButton>
          </>
        ),
      }}
    >
      {filtrados.length === 0 ? (
        <EstadoVazio titulo="Nenhuma campanha" descricao="Crie cupons promocionais com vigência e limite." onAcao={() => abrir()} labelAcao="Nova campanha" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtrados.map((x) => {
            const meta = STATUS_META[x.status];
            return (
              <motion.div key={x.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-warning/15 border border-warning/30 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-display font-bold text-[13px] truncate">{x.nome}</div>
                      <span className={cn("text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded", meta.tone)}>{meta.label}</span>
                    </div>
                    {x.codigo_cupom && <div className="font-mono text-[12px] font-bold text-warning mt-1">{x.codigo_cupom}</div>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => abrir(x)} className="w-7 h-7 rounded-md hover:bg-secondary flex items-center justify-center"><Pencil className="w-3 h-3" /></button>
                    <button onClick={async () => { if (confirm("Deletar?")) await deletarCadastro("campanhas", x.id); }} className="w-7 h-7 rounded-md hover:bg-danger/10 text-muted-foreground hover:text-danger flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="font-bold text-warning">{x.tipo_desconto === "percentual" ? `${x.valor_desconto}% OFF` : x.tipo_desconto === "valor_fixo" ? `R$ ${Number(x.valor_desconto).toFixed(2).replace(".", ",")} OFF` : "100% OFF"}</span>
                  <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(x.inicio_em).toLocaleDateString("pt-BR")}{x.fim_em ? ` → ${new Date(x.fim_em).toLocaleDateString("pt-BR")}` : " · sem fim"}</span>
                  {x.max_usos && <span>máx {x.max_usos} usos</span>}
                  <span className="font-mono">{x.total_usos} usados</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </CrudShell>
  );
}

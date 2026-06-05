"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Pencil, Trash2, Receipt, Calendar, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrudShell, Field, EstadoVazio, BusyButton } from "./crud-shell";
import { criarCadastro, atualizarCadastro, deletarCadastro } from "@/lib/cadastros/actions";
import type { Despesa, CategoriaFinanceira, Fornecedor } from "@/lib/cadastros/queries";
import { cn } from "@/lib/utils";

const PERIODICIDADES = [
  { value: "unica", label: "Única" },
  { value: "mensal", label: "Mensal" },
  { value: "bimestral", label: "Bimestral" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

const STATUS_TONE = {
  aberta:    { label: "Aberta",    tone: "bg-warning/15 text-warning border-warning/30" },
  paga:      { label: "Paga",      tone: "bg-success/15 text-success border-success/30" },
  vencida:   { label: "Vencida",   tone: "bg-danger/15 text-danger border-danger/30" },
  cancelada: { label: "Cancelada", tone: "bg-muted text-muted-foreground border-border" },
};

export function DespesasView({
  despesas, categorias, fornecedores, unidades,
}: {
  despesas: Despesa[];
  categorias: CategoriaFinanceira[];
  fornecedores: Fornecedor[];
  unidades: Array<{ id: string; nome: string }>;
}) {
  const [busca, setBusca] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [editando, setEditando] = React.useState<Despesa | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [d, setD] = React.useState({
    descricao: "", valor: "", vencimento: "", categoria_id: "", fornecedor_id: "",
    unidade_id: "", periodicidade: "unica", status: "aberta", pago_em: "", numero_documento: "", observacoes: "",
  });

  function abrir(x?: Despesa) {
    setEditando(x ?? null);
    setD({
      descricao: x?.descricao ?? "",
      valor: x?.valor?.toString() ?? "",
      vencimento: x?.vencimento ?? new Date().toISOString().slice(0, 10),
      categoria_id: x?.categoria_id ?? "",
      fornecedor_id: x?.fornecedor_id ?? "",
      unidade_id: x?.unidade_id ?? "",
      periodicidade: x?.periodicidade ?? "unica",
      status: x?.status ?? "aberta",
      pago_em: x?.pago_em ?? "",
      numero_documento: x?.numero_documento ?? "",
      observacoes: x?.observacoes ?? "",
    });
    setErro(null);
    setOpen(true);
  }

  async function salvar() {
    setBusy(true); setErro(null);
    try {
      const valor = parseFloat(d.valor.replace(",", "."));
      if (isNaN(valor) || valor <= 0) { setErro("Valor inválido"); setBusy(false); return; }
      const payload: Record<string, unknown> = {
        descricao: d.descricao.trim(),
        valor,
        vencimento: d.vencimento,
        categoria_id: d.categoria_id || null,
        fornecedor_id: d.fornecedor_id || null,
        unidade_id: d.unidade_id || null,
        periodicidade: d.periodicidade,
        status: d.status,
        pago_em: d.pago_em || null,
        numero_documento: d.numero_documento || null,
        observacoes: d.observacoes || null,
      };
      if (editando) await atualizarCadastro("despesas", editando.id, payload);
      else await criarCadastro("despesas", payload);
      setOpen(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally { setBusy(false); }
  }

  const catsDespesa = categorias.filter((c) => c.tipo === "despesa" || c.tipo === "ambos");
  const filtradas = despesas.filter((x) => !busca || x.descricao.toLowerCase().includes(busca.toLowerCase()));
  const totalAberto = despesas.filter((x) => x.status !== "paga" && x.status !== "cancelada").reduce((s, x) => s + Number(x.valor), 0);

  function nomeCategoria(id: string | null) { return categorias.find((c) => c.id === id)?.nome ?? "—"; }
  function nomeFornecedor(id: string | null) { return fornecedores.find((f) => f.id === id)?.nome ?? "—"; }

  return (
    <CrudShell
      eyebrow="Cadastros · Financeiro"
      title="Despesas"
      subtitle={`despesa${despesas.length === 1 ? "" : "s"} · R$ ${totalAberto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em aberto`}
      total={despesas.length}
      novoLabel="Nova despesa"
      busca={busca}
      onBuscaChange={setBusca}
      dialog={{
        open, setOpen,
        titulo: editando ? "Editar despesa" : "Nova despesa",
        descricao: "Cadastre uma conta a pagar — vencimento, categoria, fornecedor e unidade.",
        maxWidth: "max-w-2xl",
        children: (
          <>
            <Field label="Descrição" required>
              <input value={d.descricao} onChange={(e) => setD({ ...d, descricao: e.target.value })} className="form-input" autoFocus />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Valor (R$)" required>
                <input value={d.valor} onChange={(e) => setD({ ...d, valor: e.target.value })} placeholder="0,00" className="form-input font-mono" />
              </Field>
              <Field label="Vencimento" required>
                <input type="date" value={d.vencimento} onChange={(e) => setD({ ...d, vencimento: e.target.value })} className="form-input font-mono" />
              </Field>
              <Field label="Categoria">
                <select value={d.categoria_id} onChange={(e) => setD({ ...d, categoria_id: e.target.value })} className="form-input">
                  <option value="">— sem categoria —</option>
                  {catsDespesa.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Field>
              <Field label="Fornecedor">
                <select value={d.fornecedor_id} onChange={(e) => setD({ ...d, fornecedor_id: e.target.value })} className="form-input">
                  <option value="">— sem fornecedor —</option>
                  {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </Field>
              <Field label="Unidade">
                <select value={d.unidade_id} onChange={(e) => setD({ ...d, unidade_id: e.target.value })} className="form-input">
                  <option value="">— todas / rede —</option>
                  {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </Field>
              <Field label="Periodicidade">
                <select value={d.periodicidade} onChange={(e) => setD({ ...d, periodicidade: e.target.value })} className="form-input">
                  {PERIODICIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })} className="form-input">
                  <option value="aberta">Aberta</option>
                  <option value="paga">Paga</option>
                  <option value="vencida">Vencida</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </Field>
              <Field label="Data de pagamento">
                <input type="date" value={d.pago_em} onChange={(e) => setD({ ...d, pago_em: e.target.value })} className="form-input font-mono" />
              </Field>
              <Field label="Número documento">
                <input value={d.numero_documento} onChange={(e) => setD({ ...d, numero_documento: e.target.value })} placeholder="Boleto, NF..." className="form-input" />
              </Field>
            </div>
            <Field label="Observações">
              <textarea rows={2} value={d.observacoes} onChange={(e) => setD({ ...d, observacoes: e.target.value })} className="form-input resize-none" />
            </Field>
            {erro && <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{erro}</div>}
          </>
        ),
        footer: (
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <BusyButton busy={busy} onClick={salvar} disabled={d.descricao.trim().length < 2 || !d.valor || !d.vencimento}>
              {editando ? "Salvar" : "Criar despesa"}
            </BusyButton>
          </>
        ),
      }}
    >
      {filtradas.length === 0 ? (
        <EstadoVazio titulo="Nenhuma despesa" descricao={busca ? "Tente outra busca." : "Cadastre suas contas a pagar (aluguel, energia, fornecedores)."} onAcao={() => abrir()} labelAcao="Nova despesa" />
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border bg-muted/30">
                  <th className="text-left py-2 px-3 font-semibold">Descrição</th>
                  <th className="text-left py-2 px-3 font-semibold">Categoria</th>
                  <th className="text-left py-2 px-3 font-semibold">Fornecedor</th>
                  <th className="text-left py-2 px-3 font-semibold">Vencimento</th>
                  <th className="text-right py-2 px-3 font-semibold">Valor</th>
                  <th className="text-left py-2 px-3 font-semibold">Status</th>
                  <th className="text-right py-2 px-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((x) => {
                  const meta = STATUS_TONE[x.status as keyof typeof STATUS_TONE];
                  return (
                    <tr key={x.id} className="border-b border-border/40 hover:bg-secondary/20">
                      <td className="py-2 px-3 font-semibold">{x.descricao}</td>
                      <td className="py-2 px-3 text-muted-foreground">{nomeCategoria(x.categoria_id)}</td>
                      <td className="py-2 px-3 text-muted-foreground">{nomeFornecedor(x.fornecedor_id)}</td>
                      <td className="py-2 px-3 font-mono text-muted-foreground"><Calendar className="w-3 h-3 inline mr-1" />{new Date(x.vencimento).toLocaleDateString("pt-BR")}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">R$ {Number(x.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="py-2 px-3">
                        <span className={cn("inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border", meta.tone)}>
                          {x.status === "paga" ? <CheckCircle2 className="w-3 h-3" /> : x.status === "vencida" ? <AlertCircle className="w-3 h-3" /> : null}
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button onClick={() => abrir(x)} className="w-7 h-7 rounded-md hover:bg-secondary inline-flex items-center justify-center"><Pencil className="w-3 h-3" /></button>
                        <button onClick={async () => { if (confirm("Deletar?")) await deletarCadastro("despesas", x.id); }} className="w-7 h-7 rounded-md hover:bg-danger/10 text-muted-foreground hover:text-danger inline-flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </CrudShell>
  );
}

void Receipt;

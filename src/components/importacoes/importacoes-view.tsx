"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Database, Trash2, AlertTriangle, CheckCircle2, X, Loader2,
  FileSpreadsheet, Filter, Building2, ChevronDown, Eye,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import type { ImportacaoRow } from "@/lib/importacoes/queries";
import { excluirImportacao, zerarImportacoesUnidade } from "@/lib/importacoes/actions";

const fmtBR = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const fmtSize = (b: number | null) => {
  if (!b) return "—";
  if (b > 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
};

type Unidade = { id: string; nome: string };

export function ImportacoesView({ importacoes, unidades }: { importacoes: ImportacaoRow[]; unidades: Unidade[] }) {
  const [filtroUnidade, setFiltroUnidade] = React.useState<string>("todas");
  const [verErros, setVerErros] = React.useState<ImportacaoRow | null>(null);
  const [excluindo, setExcluindo] = React.useState<string | null>(null);
  const [zerandoUnid, setZerandoUnid] = React.useState<string | null>(null);

  const filtradas = filtroUnidade === "todas"
    ? importacoes
    : importacoes.filter((i) => i.unidade_id === filtroUnidade);

  const totalsByUnidade = React.useMemo(() => {
    const map = new Map<string, { qtd: number; vendas: number }>();
    for (const i of importacoes) {
      const cur = map.get(i.unidade_id) ?? { qtd: 0, vendas: 0 };
      cur.qtd += 1;
      cur.vendas += i.vendas_atualmente;
      map.set(i.unidade_id, cur);
    }
    return map;
  }, [importacoes]);

  async function onExcluir(imp: ImportacaoRow) {
    const txt = `Excluir esta importação?\n\nArquivo: ${imp.arquivo_nome}\nUnidade: ${imp.unidade_nome}\nVendas que serão APAGADAS: ${imp.vendas_atualmente}\n\nEsta ação é IRREVERSÍVEL.`;
    if (!confirm(txt)) return;
    setExcluindo(imp.id);
    try {
      const r = await excluirImportacao(imp.id);
      alert(`Removida. ${r.vendasRemovidas} vendas apagadas.`);
    } catch (e) {
      alert("Erro: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setExcluindo(null);
    }
  }

  async function onZerarUnidade(unidadeId: string, unidadeNome: string) {
    const stats = totalsByUnidade.get(unidadeId);
    const txt = `ZERAR TODAS as importações da unidade "${unidadeNome}"?\n\nIsto vai apagar:\n• ${stats?.qtd ?? 0} importações\n• ${stats?.vendas ?? 0} vendas relacionadas\n\nClientes serão preservados.\n\nDigite "ZERAR" pra confirmar.`;
    const r = prompt(txt);
    if (r !== "ZERAR") return;
    setZerandoUnid(unidadeId);
    try {
      const out = await zerarImportacoesUnidade(unidadeId);
      alert(`Zerado: ${out.imports} importações e ${out.vendas} vendas apagadas.`);
    } catch (e) {
      alert("Erro: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setZerandoUnid(null);
    }
  }

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6">
      <PageHeader
        eyebrow="Cadastros · Sistema"
        title="Gerenciar planilhas de vendas importadas"
        subtitle={`${importacoes.length} importações no histórico · pode excluir individualmente ou zerar tudo de uma unidade`}
      />

      {/* Filtros + ações por unidade */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Unidade</span>
          <select value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)}
            className="form-input h-7 py-0 text-[12px]">
            <option value="todas">Todas</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>{u.nome} ({totalsByUnidade.get(u.id)?.qtd ?? 0})</option>
            ))}
          </select>
        </div>
        {filtroUnidade !== "todas" && (() => {
          const u = unidades.find((x) => x.id === filtroUnidade);
          const s = totalsByUnidade.get(filtroUnidade);
          if (!u || !s || s.qtd === 0) return null;
          return (
            <Button variant="outline" onClick={() => onZerarUnidade(u.id, u.nome)}
              disabled={zerandoUnid === u.id}
              className="border-danger/40 text-danger hover:bg-danger/10">
              {zerandoUnid === u.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1" />}
              Zerar tudo de {u.nome} ({s.vendas} vendas)
            </Button>
          );
        })()}
      </div>

      {/* Tabela */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {filtradas.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <FileSpreadsheet className="w-10 h-10 mx-auto opacity-30 mb-2" />
            <div className="text-[13px] font-semibold">Nenhuma importação</div>
            <div className="text-[11px] mt-1">Faça uma importação em /performance pra começar.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary/30 border-b border-border">
                <tr className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left py-2.5 px-3 font-semibold">Data</th>
                  <th className="text-left py-2.5 px-3 font-semibold">Unidade</th>
                  <th className="text-left py-2.5 px-3 font-semibold">Arquivo</th>
                  <th className="text-left py-2.5 px-3 font-semibold">Origem</th>
                  <th className="text-right py-2.5 px-3 font-semibold">Linhas</th>
                  <th className="text-right py-2.5 px-3 font-semibold">Inseridas</th>
                  <th className="text-right py-2.5 px-3 font-semibold">Ainda no banco</th>
                  <th className="text-right py-2.5 px-3 font-semibold">Erros</th>
                  <th className="text-center py-2.5 px-3 font-semibold">Status</th>
                  <th className="text-right py-2.5 px-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtradas.map((imp) => (
                    <motion.tr key={imp.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }}
                      className="border-b border-border/40 hover:bg-secondary/20">
                      <td className="py-2 px-3 font-mono text-muted-foreground whitespace-nowrap">{fmtBR(imp.criado_em)}</td>
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold">
                          <Building2 className="w-3 h-3 text-muted-foreground" />
                          {imp.unidade_nome}
                        </span>
                      </td>
                      <td className="py-2 px-3 max-w-[280px] truncate" title={imp.arquivo_nome}>
                        <span className="font-medium">{imp.arquivo_nome}</span>
                        <span className="ml-2 text-[10px] text-muted-foreground">{fmtSize(imp.arquivo_tamanho)}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={cn("text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                          imp.origem_sistema === "vm_tecnologia" ? "bg-brand-purple/15 text-brand-purple"
                          : imp.origem_sistema === "maxpan" ? "bg-brand-cyan/15 text-brand-cyan"
                          : "bg-muted text-muted-foreground")}>
                          {imp.origem_sistema}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{imp.total_linhas}</td>
                      <td className={cn("py-2 px-3 text-right font-mono font-semibold",
                        imp.total_inseridos > 0 ? "text-success" : "text-muted-foreground")}>{imp.total_inseridos}</td>
                      <td className={cn("py-2 px-3 text-right font-mono font-semibold",
                        imp.vendas_atualmente === imp.total_inseridos && imp.total_inseridos > 0 ? "text-success"
                        : imp.vendas_atualmente > 0 ? "text-warning" : "text-muted-foreground")}>
                        {imp.vendas_atualmente}
                      </td>
                      <td className={cn("py-2 px-3 text-right font-mono", imp.total_erros > 0 ? "text-danger font-bold" : "text-muted-foreground")}>
                        {imp.total_erros}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {imp.status === "concluido" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-success uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3" /> ok
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-warning uppercase tracking-wider">
                            <AlertTriangle className="w-3 h-3" /> {imp.status}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        {imp.erros_json != null && Array.isArray(imp.erros_json) && (imp.erros_json as unknown[]).length > 0 && (
                          <button onClick={() => setVerErros(imp)}
                            className="px-2 py-1 rounded text-[10px] font-semibold text-muted-foreground hover:bg-secondary inline-flex items-center gap-1">
                            <Eye className="w-3 h-3" /> erros
                          </button>
                        )}
                        <button onClick={() => onExcluir(imp)} disabled={excluindo === imp.id}
                          className="px-2 py-1 rounded text-[10px] font-semibold text-danger hover:bg-danger/10 inline-flex items-center gap-1 disabled:opacity-50">
                          {excluindo === imp.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          excluir
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialog ver erros */}
      <Dialog.Root open={verErros != null} onOpenChange={(o) => !o && setVerErros(null)}>
        <Dialog.Portal>
          <AnimatePresence>
            {verErros && (
              <>
                <Dialog.Overlay asChild forceMount>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
                </Dialog.Overlay>
                <Dialog.Content asChild forceMount>
                  <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                    className="fixed left-[50%] top-[50%] z-50 w-[min(96vw,720px)] max-h-[80vh] translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-border bg-popover shadow-2xl flex flex-col overflow-hidden">
                    <header className="px-5 py-4 border-b border-border flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-danger/15 border border-danger/30 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-danger" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Dialog.Title className="font-display font-bold text-[15px]">Erros da importação</Dialog.Title>
                        <Dialog.Description className="text-[12px] text-muted-foreground truncate">{verErros.arquivo_nome}</Dialog.Description>
                      </div>
                      <Dialog.Close asChild>
                        <button className="w-8 h-8 rounded hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4" /></button>
                      </Dialog.Close>
                    </header>
                    <div className="flex-1 overflow-y-auto px-5 py-3">
                      <pre className="text-[11px] font-mono whitespace-pre-wrap break-all p-3 rounded bg-secondary/40 border border-border">
{JSON.stringify(verErros.erros_json, null, 2)}
                      </pre>
                    </div>
                  </motion.div>
                </Dialog.Content>
              </>
            )}
          </AnimatePresence>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="rounded-xl border border-border bg-muted/20 p-4 text-[11px] text-muted-foreground">
        <div className="inline-flex items-center gap-1.5 font-semibold text-foreground mb-1">
          <Database className="w-3.5 h-3.5 text-brand-cyan" /> Como funciona
        </div>
        <ul className="space-y-1 list-disc pl-4">
          <li>Cada importação cria N vendas com <code>importacao_id</code> igual ao ID dela.</li>
          <li>Ao excluir, todas as vendas vinculadas são apagadas (cascade automático).</li>
          <li>Coluna <strong>Ainda no banco</strong> mostra quantas dessas vendas existem hoje (pode ser menor que &quot;Inseridas&quot; se você apagou manualmente).</li>
          <li>Clientes NÃO são apagados ao excluir importação de vendas — eles vivem em /clientes.</li>
        </ul>
      </div>
    </div>
  );
}

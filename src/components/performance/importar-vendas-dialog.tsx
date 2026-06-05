"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileSpreadsheet, X, CheckCircle2, AlertTriangle, Loader2,
  Building2, Calendar, TrendingUp, Users, Receipt, FileWarning, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { importarVendas, type VendaPayload, type ImportVendasResult } from "@/lib/vendas-actions";

type PreviewResp = {
  sheet: string;
  headerLinha: number;
  snapshotEm: string | null;
  origemDetectada: "maxpan" | "vm_tecnologia" | "manual";
  modoSugerido: string;
  total: number;
  totalValor: number;
  porTipoPagamento: Record<string, { count: number; valor: number }>;
  porServico: Record<string, number>;
  comCpf: number;
  comCupom: number;
  comVoucher: number;
  cpfsUnicos: number;
  lavanderiasDetectadas: string[];
  preview: VendaPayload[];
  linhas: VendaPayload[];
  erros: Array<{ linha: number; motivo: string }>;
  error?: string;
};

export function ImportarVendasDialog({
  open, onOpenChange, unidadeId, unidadeNome,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  unidadeId: string;
  unidadeNome: string;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [preview, setPreview] = React.useState<PreviewResp | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [origem, setOrigem] = React.useState<"maxpan" | "vm_tecnologia" | "manual">("maxpan");
  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState<ImportVendasResult | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);

  function reset() {
    setFile(null); setPreview(null); setParseError(null); setImportError(null);
    setResult(null); setParsing(false); setImporting(false);
  }
  React.useEffect(() => { if (!open) reset(); }, [open]);

  async function onDropFile(f: File) {
    setFile(f); setParseError(null); setParsing(true); setPreview(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/vendas/import-preview", { method: "POST", body: fd });
      const data = (await res.json()) as PreviewResp;
      if (!res.ok || data.error) {
        setParseError(data.error || `HTTP ${res.status}`);
        return;
      }
      setPreview(data);
      if (data.origemDetectada !== "manual") setOrigem(data.origemDetectada);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : String(e));
    } finally {
      setParsing(false);
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: false,
    onDrop: (a) => a[0] && onDropFile(a[0]),
  });

  async function handleImport() {
    if (!preview) return;
    setImporting(true); setImportError(null);
    try {
      const r = await importarVendas(unidadeId, preview.linhas, {
        arquivoNome: file?.name ?? "vendas.xlsx",
        arquivoTamanho: file?.size,
        origemSistema: origem,
        snapshotEm: preview.snapshotEm,
      });
      setResult(r);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <AnimatePresence>
          {open && (
            <>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-50 grid place-items-center p-4 outline-none"
                >
                  <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl">
                    <div className="p-5 border-b border-border/60 flex items-start justify-between gap-4">
                      <div>
                        <Dialog.Title className="font-display text-lg font-bold flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-brand-cyan" /> Importar vendas
                        </Dialog.Title>
                        <Dialog.Description className="text-[12px] text-muted-foreground mt-1 flex items-center gap-2">
                          Destino: <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand-cyan/10 text-brand-cyan font-semibold"><Building2 className="w-3 h-3" /> {unidadeNome}</span>
                          <span>·</span>
                          <span>Suporta relatórios MAXPAN/VM (XLSX 27 colunas)</span>
                        </Dialog.Description>
                      </div>
                      <Dialog.Close asChild>
                        <button className="w-8 h-8 rounded-md hover:bg-secondary inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
                      </Dialog.Close>
                    </div>

                    <div className="p-5 space-y-4">
                      {result && <ResultadoCard result={result} onClose={() => onOpenChange(false)} onNovo={reset} />}

                      {!result && (
                        <div
                          {...getRootProps()}
                          className={cn(
                            "relative rounded-2xl border-2 border-dashed transition-all p-8 text-center cursor-pointer",
                            isDragActive ? "border-brand-cyan bg-brand-cyan/8 scale-[1.01]"
                              : "border-border hover:border-brand-cyan/40 hover:bg-secondary/30",
                            parsing && "opacity-60 pointer-events-none",
                          )}
                        >
                          <input {...getInputProps()} />
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-cyan/15 to-brand-purple/15 border border-brand-cyan/20 flex items-center justify-center">
                              {parsing ? <Loader2 className="w-6 h-6 text-brand-cyan animate-spin" />
                                : file ? <FileSpreadsheet className="w-6 h-6 text-brand-cyan" />
                                : <Upload className="w-6 h-6 text-brand-cyan" />}
                            </div>
                            <div>
                              <div className="font-semibold text-[14px]">
                                {parsing ? "Lendo relatório..." : file ? file.name : "Arraste o relatório de vendas"}
                              </div>
                              <div className="text-[12px] text-muted-foreground mt-1">
                                {file ? `${(file.size / 1024).toFixed(1)} KB · ${preview?.total ?? "?"} vendas detectadas`
                                  : "ou clique para escolher · XLSX MAXPAN/VM"}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {parseError && (
                        <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 flex items-start gap-2">
                          <FileWarning className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                          <div className="text-[12px] text-danger">{parseError}</div>
                        </div>
                      )}

                      {!result && preview && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <Pill icon={Receipt} label="Vendas" value={preview.total.toString()} tone="cyan" />
                            <Pill icon={TrendingUp} label="Faturamento total" value={`R$ ${preview.totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} tone="success" />
                            <Pill icon={Users} label="CPFs únicos" value={preview.cpfsUnicos.toString()} tone="purple" />
                            <Pill icon={Calendar} label="Snapshot" value={preview.snapshotEm ? new Date(preview.snapshotEm).toLocaleDateString("pt-BR") : "—"} tone="warning" />
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                            {Object.entries(preview.porTipoPagamento).slice(0, 4).map(([k, v]) => (
                              <div key={k} className="rounded-lg border border-border bg-muted/20 px-2.5 py-1.5">
                                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{k}</div>
                                <div className="font-mono font-bold">{v.count} · R$ {v.valor.toFixed(2)}</div>
                              </div>
                            ))}
                          </div>

                          {/* Preview table */}
                          <div className="rounded-xl border border-border overflow-hidden">
                            <div className="px-3 py-2 bg-muted/30 border-b border-border text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
                              Prévia · {preview.preview.length} de {preview.total}
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="text-[9px] uppercase tracking-wider text-muted-foreground bg-muted/20 border-b border-border">
                                    <th className="text-left font-semibold py-1.5 px-2">Data</th>
                                    <th className="text-left font-semibold py-1.5 px-2">Cliente</th>
                                    <th className="text-left font-semibold py-1.5 px-2">Pag.</th>
                                    <th className="text-right font-semibold py-1.5 px-2">Valor</th>
                                    <th className="text-left font-semibold py-1.5 px-2">Cupom</th>
                                    <th className="text-left font-semibold py-1.5 px-2">Serviço</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {preview.preview.map((p) => (
                                    <tr key={p._linha} className="border-b border-border/40 hover:bg-secondary/30">
                                      <td className="py-1.5 px-2 font-mono text-muted-foreground whitespace-nowrap">
                                        {new Date(p.data_venda).toLocaleDateString("pt-BR")} {new Date(p.data_venda).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                      </td>
                                      <td className="py-1.5 px-2 truncate max-w-[160px]">{p.nome_cliente ?? "—"}</td>
                                      <td className="py-1.5 px-2 text-[10px]">{p.tipo_pagamento}{p.tipo_cartao ? ` · ${p.tipo_cartao}` : ""}</td>
                                      <td className="py-1.5 px-2 text-right font-mono font-semibold">R$ {p.valor.toFixed(2)}</td>
                                      <td className="py-1.5 px-2 font-mono text-[10px] text-warning">{p.cupom_codigo ?? "—"}</td>
                                      <td className="py-1.5 px-2 text-[10px] uppercase">{p.tipo_servico}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Origem */}
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="text-muted-foreground">Origem:</span>
                            <select value={origem} onChange={(e) => setOrigem(e.target.value as typeof origem)} className="form-input h-8 text-[12px] py-0">
                              <option value="maxpan">MAXPAN</option>
                              <option value="vm_tecnologia">VM Tecnologia</option>
                              <option value="manual">Manual</option>
                            </select>
                            <span className="ml-auto text-[10px] text-muted-foreground inline-flex items-center gap-1">
                              <Link2 className="w-3 h-3" /> {preview.comCpf} com CPF · {preview.comCupom} com cupom · {preview.comVoucher} com voucher
                            </span>
                          </div>

                          {importError && (
                            <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{importError}</div>
                          )}
                        </div>
                      )}
                    </div>

                    {!result && (
                      <div className="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-between rounded-b-2xl">
                        <div className="text-[11px] text-muted-foreground">
                          {preview ? `Pronto pra importar ${preview.total} vendas. Dedupe por requisição.` : "Aguardando relatório..."}
                        </div>
                        <div className="flex items-center gap-2">
                          <Dialog.Close asChild><Button variant="ghost" disabled={importing}>Cancelar</Button></Dialog.Close>
                          <Button onClick={handleImport} disabled={!preview || importing} className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white">
                            {importing && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                            Importar vendas
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Pill({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string; tone: "cyan" | "purple" | "success" | "warning" }) {
  const map = {
    cyan: "border-brand-cyan/25 bg-brand-cyan/8 text-brand-cyan",
    purple: "border-brand-purple/25 bg-brand-purple/8 text-brand-purple",
    success: "border-success/25 bg-success/8 text-success",
    warning: "border-warning/25 bg-warning/8 text-warning",
  } as const;
  return (
    <div className={cn("rounded-lg border px-3 py-2 flex items-center gap-2.5", map[tone])}>
      <Icon className="w-4 h-4 shrink-0" />
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-wider font-semibold opacity-80">{label}</div>
        <div className="font-bold text-[13px] truncate">{value}</div>
      </div>
    </div>
  );
}

function ResultadoCard({ result, onClose, onNovo }: { result: ImportVendasResult; onClose: () => void; onNovo: () => void }) {
  const sucesso = result.erros.length === 0;
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className={cn("px-5 py-4 flex items-center gap-3", sucesso ? "bg-success/8 border-b border-success/20" : "bg-warning/8 border-b border-warning/20")}>
        {sucesso ? <CheckCircle2 className="w-6 h-6 text-success" /> : <AlertTriangle className="w-6 h-6 text-warning" />}
        <div>
          <div className="font-display font-bold">{sucesso ? "Importação concluída" : "Concluída com avisos"}</div>
          <div className="text-[12px] text-muted-foreground">{result.totalLinhas} vendas processadas</div>
        </div>
      </div>
      <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Inseridas" value={result.inseridos} tone="success" />
        <Stat label="Ignoradas (dup)" value={result.ignorados} tone="muted" />
        <Stat label="Clientes linkados" value={result.clientesLinkados} tone="cyan" />
        <Stat label="Erros" value={result.erros.length} tone={result.erros.length ? "danger" : "muted"} />
      </div>
      <div className="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-between">
        <Button variant="ghost" onClick={onNovo}>Importar outro</Button>
        <Button onClick={onClose} className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white">Concluir</Button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "success" | "cyan" | "danger" | "muted" }) {
  const map = {
    success: "border-success/25 bg-success/8 text-success",
    cyan: "border-brand-cyan/25 bg-brand-cyan/8 text-brand-cyan",
    danger: "border-danger/25 bg-danger/8 text-danger",
    muted: "border-border bg-muted/30 text-foreground",
  } as const;
  return (
    <div className={cn("rounded-lg border px-3 py-3 text-center", map[tone])}>
      <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1 font-mono">{value}</div>
    </div>
  );
}

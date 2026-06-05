"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileSpreadsheet, X, CheckCircle2, AlertTriangle, Loader2,
  Sparkles, FileWarning, Calendar, Building2, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { importarClientes, type ClientePayload, type ImportResult } from "@/lib/clientes-actions";

type PreviewLinha = ClientePayload & {
  _linha: number;
  lavanderia_origem?: string | null;
};

type PreviewResp = {
  sheet: string;
  headerLinha: number;
  snapshotEm: string | null;
  total: number;
  lavanderiasDetectadas: string[];
  preview: PreviewLinha[];
  linhas: PreviewLinha[];
  erros: Array<{ linha: number; motivo: string }>;
  error?: string;
};

export function ImportarClientesDialog({
  open,
  onOpenChange,
  unidadeId,
  unidadeNome,
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

  const [modo, setModo] = React.useState<"upsert" | "append" | "merge">("upsert");
  const [origem, setOrigem] = React.useState<"maxlav" | "vm_tecnologia" | "manual">("maxlav");

  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);

  function reset() {
    setFile(null);
    setPreview(null);
    setParseError(null);
    setImportError(null);
    setResult(null);
    setParsing(false);
    setImporting(false);
  }

  React.useEffect(() => {
    if (!open) reset();
  }, [open]);

  async function onDropFile(f: File) {
    setFile(f);
    setParseError(null);
    setParsing(true);
    setPreview(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/clientes/import-preview", { method: "POST", body: fd });
      const data = (await res.json()) as PreviewResp;
      if (!res.ok || data.error) {
        setParseError(data.error || `HTTP ${res.status}`);
        return;
      }
      setPreview(data);
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
      "text/csv": [".csv"],
    },
    multiple: false,
    onDrop: (accepted) => {
      if (accepted[0]) onDropFile(accepted[0]);
    },
  });

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    setImportError(null);
    try {
      const r = await importarClientes(
        unidadeId,
        preview.linhas.map((p) => ({ ...p, _linha: p._linha })),
        {
          arquivoNome: file?.name ?? "arquivo.xlsx",
          arquivoTamanho: file?.size,
          origemSistema: origem,
          modo,
          snapshotEm: preview.snapshotEm,
        },
      );
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
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.97 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="fixed inset-0 z-50 grid place-items-center p-4 outline-none"
                >
                  <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl">
                    {/* Header */}
                    <div className="p-5 border-b border-border/60 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Dialog.Title className="font-display text-lg font-bold flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-brand-cyan" />
                          Importar clientes
                        </Dialog.Title>
                        <Dialog.Description className="text-[12px] text-muted-foreground mt-1 flex items-center gap-2">
                          Destino: <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand-cyan/10 text-brand-cyan font-semibold"><Building2 className="w-3 h-3" /> {unidadeNome}</span>
                          <span>·</span>
                          <span>Suporta XLSX / XLS / CSV — formato MAXLAV ou VM Tecnologia</span>
                        </Dialog.Description>
                      </div>
                      <Dialog.Close asChild>
                        <button className="w-8 h-8 rounded-md hover:bg-secondary inline-flex items-center justify-center shrink-0" aria-label="Fechar">
                          <X className="w-4 h-4" />
                        </button>
                      </Dialog.Close>
                    </div>

                    {/* Body */}
                    <div className="p-5 space-y-4">
                      {/* Resultado final */}
                      {result && (
                        <ResultadoCard result={result} onClose={() => onOpenChange(false)} onNovo={() => reset()} />
                      )}

                      {/* Dropzone */}
                      {!result && (
                        <div
                          {...getRootProps()}
                          className={cn(
                            "relative rounded-2xl border-2 border-dashed transition-all p-8 text-center cursor-pointer",
                            isDragActive
                              ? "border-brand-cyan bg-brand-cyan/8 scale-[1.01]"
                              : "border-border hover:border-brand-cyan/40 hover:bg-secondary/30",
                            parsing && "opacity-60 pointer-events-none",
                          )}
                        >
                          <input {...getInputProps()} />
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-cyan/15 to-brand-purple/15 border border-brand-cyan/20 flex items-center justify-center">
                              {parsing ? (
                                <Loader2 className="w-6 h-6 text-brand-cyan animate-spin" />
                              ) : file ? (
                                <FileSpreadsheet className="w-6 h-6 text-brand-cyan" />
                              ) : (
                                <Upload className="w-6 h-6 text-brand-cyan" />
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-[14px]">
                                {parsing ? "Lendo planilha..." : file ? file.name : "Arraste a planilha aqui"}
                              </div>
                              <div className="text-[12px] text-muted-foreground mt-1">
                                {file
                                  ? `${(file.size / 1024).toFixed(1)} KB · ${preview?.total ?? "?"} linhas detectadas`
                                  : "ou clique para escolher · XLSX · XLS · CSV"}
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

                      {/* Preview */}
                      {!result && preview && (
                        <div className="space-y-3">
                          {/* Meta da planilha */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <MetaPill icon={Users} label="Clientes" value={preview.total.toString()} tone="cyan" />
                            <MetaPill
                              icon={Calendar}
                              label="Snapshot"
                              value={
                                preview.snapshotEm
                                  ? new Date(preview.snapshotEm).toLocaleDateString("pt-BR")
                                  : "—"
                              }
                              tone="purple"
                            />
                            <MetaPill
                              icon={Building2}
                              label="Lavanderia origem"
                              value={preview.lavanderiasDetectadas[0]?.trim() ?? "—"}
                              tone="success"
                            />
                            <MetaPill
                              icon={AlertTriangle}
                              label="Avisos parse"
                              value={preview.erros.length.toString()}
                              tone={preview.erros.length ? "warning" : "success"}
                            />
                          </div>

                          {/* Alerta se lavanderia origem diferente da unidade ativa */}
                          {preview.lavanderiasDetectadas.length > 0 &&
                            !preview.lavanderiasDetectadas[0]
                              ?.toUpperCase()
                              .includes(unidadeNome.toUpperCase()) && (
                              <div className="rounded-lg border border-warning/30 bg-warning/8 px-3 py-2 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                                <div className="text-[12px]">
                                  <div className="font-semibold text-warning">Confirme a unidade de destino</div>
                                  <div className="text-muted-foreground">
                                    A planilha menciona <strong>{preview.lavanderiasDetectadas[0]}</strong> mas
                                    você está importando para <strong>{unidadeNome}</strong>. Troque a unidade no
                                    topbar se necessário.
                                  </div>
                                </div>
                              </div>
                            )}

                          {/* Preview tabular */}
                          <div className="rounded-xl border border-border overflow-hidden">
                            <div className="px-3 py-2 bg-muted/30 border-b border-border text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
                              Prévia · primeiras {preview.preview.length} linhas
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className="text-[9px] uppercase tracking-wider text-muted-foreground bg-muted/20 border-b border-border">
                                    <th className="text-left font-semibold py-1.5 px-2">Nome</th>
                                    <th className="text-left font-semibold py-1.5 px-2">CPF</th>
                                    <th className="text-left font-semibold py-1.5 px-2">Telefone</th>
                                    <th className="text-right font-semibold py-1.5 px-2">Compras</th>
                                    <th className="text-right font-semibold py-1.5 px-2">LTV</th>
                                    <th className="text-left font-semibold py-1.5 px-2">Última</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {preview.preview.map((p) => (
                                    <tr key={p._linha} className="border-b border-border/40 hover:bg-secondary/30">
                                      <td className="py-1.5 px-2 font-semibold truncate max-w-[200px]">{p.nome}</td>
                                      <td className="py-1.5 px-2 font-mono text-muted-foreground">{p.cpf}</td>
                                      <td className="py-1.5 px-2 font-mono text-muted-foreground">{p.telefone}</td>
                                      <td className="py-1.5 px-2 text-right font-mono">{p.compras_total_qtd}</td>
                                      <td className="py-1.5 px-2 text-right font-mono font-semibold">
                                        R$ {Number(p.compras_total_valor ?? 0).toFixed(2).replace(".", ",")}
                                      </td>
                                      <td className="py-1.5 px-2 text-muted-foreground">
                                        {p.ultima_compra_em
                                          ? new Date(p.ultima_compra_em).toLocaleDateString("pt-BR")
                                          : "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Opções */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <FieldGroup label="Sistema de origem">
                              <select
                                value={origem}
                                onChange={(e) => setOrigem(e.target.value as typeof origem)}
                                className="form-input"
                              >
                                <option value="maxlav">MAXLAV (MAXPAN) — atual</option>
                                <option value="vm_tecnologia">VM Tecnologia (legado)</option>
                                <option value="manual">Manual / outro</option>
                              </select>
                            </FieldGroup>
                            <FieldGroup label="Modo de importação">
                              <select
                                value={modo}
                                onChange={(e) => setModo(e.target.value as typeof modo)}
                                className="form-input"
                              >
                                <option value="upsert">Upsert — sobrescreve dados se CPF já existe (novo é mais recente)</option>
                                <option value="merge">Merge — enriquece sem sobrescrever (backup/legado)</option>
                                <option value="append">Append — só insere novos, ignora duplicatas</option>
                              </select>
                            </FieldGroup>
                          </div>

                          {importError && (
                            <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">
                              {importError}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer */}
                    {!result && (
                      <div className="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-between rounded-b-2xl">
                        <div className="text-[11px] text-muted-foreground">
                          {preview ? `Pronto pra importar ${preview.total} clientes.` : "Aguardando planilha..."}
                        </div>
                        <div className="flex items-center gap-2">
                          <Dialog.Close asChild>
                            <Button variant="ghost" disabled={importing}>Cancelar</Button>
                          </Dialog.Close>
                          <Button
                            onClick={handleImport}
                            disabled={!preview || importing}
                            className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white hover:opacity-90"
                          >
                            {importing && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                            Importar
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

function MetaPill({
  icon: Icon, label, value, tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: "cyan" | "purple" | "success" | "warning";
}) {
  const toneMap = {
    cyan: "border-brand-cyan/25 bg-brand-cyan/8 text-brand-cyan",
    purple: "border-brand-purple/25 bg-brand-purple/8 text-brand-purple",
    success: "border-success/25 bg-success/8 text-success",
    warning: "border-warning/25 bg-warning/8 text-warning",
  } as const;
  return (
    <div className={cn("rounded-lg border px-3 py-2 flex items-center gap-2.5", toneMap[tone])}>
      <Icon className="w-4 h-4 shrink-0" />
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-wider font-semibold opacity-80">{label}</div>
        <div className="font-bold text-[13px] truncate">{value}</div>
      </div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1">
        {label}
      </div>
      {children}
    </label>
  );
}

function ResultadoCard({
  result, onClose, onNovo,
}: {
  result: ImportResult;
  onClose: () => void;
  onNovo: () => void;
}) {
  const sucesso = result.erros.length === 0;
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div
        className={cn(
          "px-5 py-4 flex items-center gap-3",
          sucesso ? "bg-success/8 border-b border-success/20" : "bg-warning/8 border-b border-warning/20",
        )}
      >
        {sucesso ? (
          <CheckCircle2 className="w-6 h-6 text-success" />
        ) : (
          <AlertTriangle className="w-6 h-6 text-warning" />
        )}
        <div>
          <div className="font-display font-bold">
            {sucesso ? "Importação concluída" : "Importação concluída com avisos"}
          </div>
          <div className="text-[12px] text-muted-foreground">
            {result.totalLinhas} linhas processadas
          </div>
        </div>
      </div>
      <div className="p-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatBlock label="Novos" value={result.inseridos} tone="success" />
        <StatBlock label="Atualizados" value={result.atualizados} tone="cyan" />
        <StatBlock label="Enriquecidos" value={result.enriquecidos} tone="cyan" />
        <StatBlock label="Sem mudança" value={result.semMudanca} tone="muted" />
        <StatBlock label="Ignorados" value={result.ignorados} tone="muted" />
        <StatBlock label="Erros" value={result.erros.length} tone={result.erros.length ? "danger" : "muted"} />
      </div>
      {result.erros.length > 0 && (
        <div className="px-5 pb-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Erros ({result.erros.length})
          </div>
          <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-muted/20 text-[11px] divide-y divide-border/40">
            {result.erros.slice(0, 50).map((e, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                <span className="font-mono text-muted-foreground shrink-0">L{e.linha}</span>
                <span className="text-danger">{e.motivo}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-between">
        <Button variant="ghost" onClick={onNovo}>Importar outra</Button>
        <Button onClick={onClose} className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white">
          Concluir
        </Button>
      </div>
    </div>
  );
}

function StatBlock({
  label, value, tone,
}: {
  label: string;
  value: number;
  tone: "success" | "cyan" | "danger" | "muted";
}) {
  const toneMap = {
    success: "border-success/25 bg-success/8 text-success",
    cyan: "border-brand-cyan/25 bg-brand-cyan/8 text-brand-cyan",
    danger: "border-danger/25 bg-danger/8 text-danger",
    muted: "border-border bg-muted/30 text-foreground",
  } as const;
  return (
    <div className={cn("rounded-lg border px-3 py-3 text-center", toneMap[tone])}>
      <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1 font-mono tabular-nums">{value}</div>
    </div>
  );
}

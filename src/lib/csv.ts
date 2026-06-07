// LavSync · CSV utilities
// Formato compatível com Excel BR (separador ; · BOM UTF-8 · datas locale)

export type CsvHeader = { key: string; label: string; transform?: (v: unknown, row: Record<string, unknown>) => string };

function escape(value: unknown): string {
  if (value == null) return "";
  let s = String(value);
  // Escape: aspas duplas → 2x · envolver em "" se contém ; " ou quebra de linha
  if (s.includes('"') || s.includes(";") || s.includes("\n") || s.includes("\r")) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function gerarCsv(headers: CsvHeader[], rows: Array<Record<string, unknown>>): string {
  const headerLine = headers.map((h) => escape(h.label)).join(";");
  const dataLines = rows.map((row) =>
    headers.map((h) => {
      const raw = row[h.key];
      const v = h.transform ? h.transform(raw, row) : raw;
      return escape(v);
    }).join(";")
  );
  // BOM UTF-8 pra Excel reconhecer acentos
  return "﻿" + headerLine + "\n" + dataLines.join("\n");
}

/** Helpers de formatação para usar no `transform` dos headers */
export const fmt = {
  brl: (v: unknown) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  numero: (v: unknown) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return n.toLocaleString("pt-BR");
  },
  dataBR: (v: unknown) => {
    if (!v) return "";
    const d = new Date(String(v));
    if (isNaN(d.getTime())) return String(v);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  },
  dataHoraBR: (v: unknown) => {
    if (!v) return "";
    const d = new Date(String(v));
    if (isNaN(d.getTime())) return String(v);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  },
  bool: (v: unknown) => (v ? "Sim" : "Não"),
};

/** Faz o download client-side de um conteúdo CSV (chame em "use client"). */
export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

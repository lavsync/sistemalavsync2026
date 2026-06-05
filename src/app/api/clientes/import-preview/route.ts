// POST multipart/form-data com `file` (XLSX/XLS/CSV)
// Parseia formatos:
//   - VM/MAXLAV (XLSX): header em PT-BR com "Nome", "CPF", "Data de Cadastro", "Última Compra",
//     "Quantidade Compras", "Valor Total das Compras", janelas 90d/30d/7d, "Lavanderia"
//   - MAXPAN (CSV ; ou ,): "Nome", "Documento", "Email", "Data_Cadastro", "Data_Ultima_Compra",
//     "Total_Compras", "Quantidade_Compras", "Saldo_Carteira"
// Retorna preview + origemDetectada + modoSugerido.
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

type ParsedRow = {
  _linha: number;
  nome: string;
  cpf: string;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  genero: string | null;
  cadastrado_em: string | null;
  ultima_compra_em: string | null;
  compras_total_qtd: number;
  compras_total_valor: number;
  compras_90d_qtd: number;
  compras_90d_valor: number;
  compras_30d_qtd: number;
  compras_30d_valor: number;
  compras_7d_qtd: number;
  compras_7d_valor: number;
  lavanderia_origem: string | null;
};

type OrigemDetectada = "maxpan" | "vm_tecnologia" | "manual";
type ModoSugerido = "sync" | "merge" | "upsert" | "append";

// Mapa unificado: chave = header (case-insensitive, espaços e _ normalizados),
// valor = campo lógico interno.
const HEADER_MAP: Record<string, keyof ParsedRow | "ignorar"> = {
  // VM/MAXLAV (XLSX PT-BR)
  "nome": "nome",
  "data de nascimento": "data_nascimento",
  "cpf": "cpf",
  "telefone": "telefone",
  "e-mail": "email",
  "email": "email",
  "gênero": "genero",
  "genero": "genero",
  "data de cadastro": "cadastrado_em",
  "última compra": "ultima_compra_em",
  "ultima compra": "ultima_compra_em",
  "quantidade compras": "compras_total_qtd",
  "valor total das compras": "compras_total_valor",
  "quantidade compras 90 dias": "compras_90d_qtd",
  "valor total das compras 90 dias": "compras_90d_valor",
  "quantidade compras 30 dias": "compras_30d_qtd",
  "valor total das compras 30 dias": "compras_30d_valor",
  "quantidade compras 7 dias": "compras_7d_qtd",
  "valor total das compras 7 dias": "compras_7d_valor",
  "lavanderia": "lavanderia_origem",
  // MAXPAN (CSV)
  "documento": "cpf",
  "data_cadastro": "cadastrado_em",
  "data_ultima_compra": "ultima_compra_em",
  "total_compras": "compras_total_valor",
  "quantidade_compras": "compras_total_qtd",
  "saldo_carteira": "ignorar",
};

function normalizeHeader(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

function toIsoDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H ?? 0, d.M ?? 0, d.S ?? 0)).toISOString();
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    // DD/MM/YYYY [HH:MM[:SS]]
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(t);
    if (m) {
      const [, dd, mm, yyyy, h = "0", mi = "0", se = "0"] = m;
      const year = Number(yyyy.length === 2 ? "20" + yyyy : yyyy);
      return new Date(Date.UTC(year, Number(mm) - 1, Number(dd), Number(h), Number(mi), Number(se))).toISOString();
    }
    const ts = Date.parse(t);
    if (!Number.isNaN(ts)) return new Date(ts).toISOString();
  }
  return null;
}

function toDateOnly(v: unknown): string | null {
  const iso = toIsoDate(v);
  return iso ? iso.slice(0, 10) : null;
}

function toNum(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    // "16,99" → 16.99 ; "1.234,56" → 1234.56
    const cleaned = v.replace(/\./g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

// CSV: detecta separador entre ; , \t
function detectarSepCSV(amostra: string): string {
  const linhas = amostra.split(/\r?\n/).slice(0, 5).filter(Boolean);
  if (linhas.length === 0) return ",";
  const candidatos = [";", ",", "\t", "|"];
  let melhor = ",";
  let maiorMediana = 0;
  for (const sep of candidatos) {
    const contagens = linhas.map((l) => l.split(sep).length);
    contagens.sort((a, b) => a - b);
    const med = contagens[Math.floor(contagens.length / 2)];
    if (med > maiorMediana) {
      maiorMediana = med;
      melhor = sep;
    }
  }
  return melhor;
}

function detectarOrigem(headers: string[]): OrigemDetectada {
  const norm = headers.map(normalizeHeader);
  const isMaxpan =
    norm.includes("documento") &&
    (norm.includes("data_cadastro") || norm.includes("data_ultima_compra"));
  if (isMaxpan) return "maxpan";
  // VM/MAXLAV legacy: tem "lavanderia" ou janelas 90 dias
  if (norm.includes("lavanderia") || norm.some((h) => h.includes("90 dias"))) {
    return "vm_tecnologia";
  }
  return "manual";
}

function modoSugeridoPara(origem: OrigemDetectada): ModoSugerido {
  if (origem === "maxpan") return "sync";           // alimentação diária
  if (origem === "vm_tecnologia") return "merge";   // backup/legado
  return "upsert";
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo ausente" }, { status: 400 });
  }

  const nomeLower = file.name.toLowerCase();
  const isCsv = nomeLower.endsWith(".csv");
  const buf = Buffer.from(await file.arrayBuffer());

  let raw: unknown[][] = [];
  let sheetName = "Clientes";

  try {
    if (isCsv) {
      // Parse manual pra pegar separador (XLSX.read CSV auto detecta mas falha em ; com aspas)
      const text = buf.toString("utf-8").replace(/^﻿/, ""); // BOM
      const sep = detectarSepCSV(text);
      const wb = XLSX.read(text, { type: "string", FS: sep, cellDates: true });
      sheetName = wb.SheetNames[0];
      raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
        header: 1,
        defval: null,
        raw: false,
      });
    } else {
      const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
      sheetName = wb.SheetNames[0];
      raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
        header: 1,
        defval: null,
        raw: true,
      });
    }
  } catch (e) {
    return NextResponse.json(
      { error: "Falha ao abrir arquivo: " + (e instanceof Error ? e.message : String(e)) },
      { status: 400 },
    );
  }

  // Encontrar linha de header — primeira linha com "Nome" e (CPF ou Documento)
  let headerIdx = -1;
  for (let i = 0; i < Math.min(raw.length, 50); i++) {
    const row = (raw[i] ?? []).map((c) => normalizeHeader(String(c ?? "")));
    if (row.includes("nome") && (row.includes("cpf") || row.includes("documento"))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    return NextResponse.json(
      { error: "Header não encontrado. A planilha precisa ter colunas 'Nome' e 'CPF'/'Documento'." },
      { status: 400 },
    );
  }

  // snapshot_em do header "Emitido em" (relatórios VM/MAXLAV)
  let snapshotEm: string | null = null;
  for (let i = 0; i < headerIdx; i++) {
    const row = raw[i] ?? [];
    const idx = row.findIndex((c) => normalizeHeader(String(c ?? "")) === "emitido em");
    if (idx >= 0) {
      const val = row[idx + 1] ?? row.find((_, j) => j > idx && row[j] != null);
      const iso = toIsoDate(val);
      if (iso) snapshotEm = iso;
      break;
    }
  }
  // Pra MAXPAN, snapshot_em vem do nome do arquivo (customerReport-DD_MM_YYYY.csv)
  if (!snapshotEm && isCsv) {
    const m = /(\d{2})[_-](\d{2})[_-](\d{4})/.exec(file.name);
    if (m) {
      const [, dd, mm, yyyy] = m;
      snapshotEm = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), 23, 59)).toISOString();
    }
  }

  const headerRowRaw = (raw[headerIdx] ?? []).map((c) => String(c ?? "").trim());
  const headerRow = headerRowRaw.map(normalizeHeader);
  const origem = detectarOrigem(headerRowRaw);
  const modo = modoSugeridoPara(origem);

  // Mapear índice → campo
  const colIdx: Partial<Record<keyof ParsedRow, number>> = {};
  for (let i = 0; i < headerRow.length; i++) {
    const mapped = HEADER_MAP[headerRow[i]];
    if (mapped && mapped !== "ignorar") colIdx[mapped] = i;
  }
  if (colIdx.nome == null || colIdx.cpf == null) {
    return NextResponse.json({ error: "Coluna Nome ou CPF/Documento não mapeada." }, { status: 400 });
  }

  const parsed: ParsedRow[] = [];
  const erros: Array<{ linha: number; motivo: string }> = [];

  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i] ?? [];
    if (row.every((c) => c == null || c === "")) continue;
    const get = (k: keyof ParsedRow) => (colIdx[k] != null ? row[colIdx[k]!] : null);

    const nome = toStr(get("nome"));
    const cpfBruto = toStr(get("cpf"));
    if (!nome && !cpfBruto) continue;

    // Pra MAXPAN o CPF vem sem máscara; vamos formatar consistente
    const cpfDig = cpfBruto.replace(/\D/g, "");
    const cpfFormatado =
      cpfDig.length === 11
        ? `${cpfDig.slice(0, 3)}.${cpfDig.slice(3, 6)}.${cpfDig.slice(6, 9)}-${cpfDig.slice(9)}`
        : cpfBruto;

    // Telefone idem
    const telBruto = toStr(get("telefone"));
    const telDig = telBruto.replace(/\D/g, "");
    const telefone =
      telDig.length === 11
        ? `(${telDig.slice(0, 2)}) ${telDig.slice(2, 7)}-${telDig.slice(7)}`
        : telDig.length === 10
        ? `(${telDig.slice(0, 2)}) ${telDig.slice(2, 6)}-${telDig.slice(6)}`
        : telBruto || null;

    parsed.push({
      _linha: i + 1,
      nome,
      cpf: cpfFormatado,
      email: toStr(get("email")) || null,
      telefone,
      data_nascimento: toDateOnly(get("data_nascimento")),
      genero: toStr(get("genero")) || null,
      cadastrado_em: toIsoDate(get("cadastrado_em")),
      ultima_compra_em: toIsoDate(get("ultima_compra_em")),
      compras_total_qtd: Math.round(toNum(get("compras_total_qtd"))),
      compras_total_valor: toNum(get("compras_total_valor")),
      compras_90d_qtd: Math.round(toNum(get("compras_90d_qtd"))),
      compras_90d_valor: toNum(get("compras_90d_valor")),
      compras_30d_qtd: Math.round(toNum(get("compras_30d_qtd"))),
      compras_30d_valor: toNum(get("compras_30d_valor")),
      compras_7d_qtd: Math.round(toNum(get("compras_7d_qtd"))),
      compras_7d_valor: toNum(get("compras_7d_valor")),
      lavanderia_origem: toStr(get("lavanderia_origem")) || null,
    });
  }

  return NextResponse.json({
    sheet: sheetName,
    headerLinha: headerIdx + 1,
    snapshotEm,
    origemDetectada: origem,
    modoSugerido: modo,
    total: parsed.length,
    lavanderiasDetectadas: Array.from(
      new Set(parsed.map((p) => p.lavanderia_origem).filter(Boolean)),
    ),
    preview: parsed.slice(0, 8),
    linhas: parsed,
    erros,
  });
}

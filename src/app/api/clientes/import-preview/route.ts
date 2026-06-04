// POST multipart/form-data com `file` (XLSX/CSV)
// Parseia, deduz colunas (formato MAXLAV), retorna preview JSON
// Não grava nada — gravação é feita por server action importarClientes()
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs"; // xlsx precisa de Node

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

const HEADER_MAP: Record<string, keyof ParsedRow> = {
  Nome: "nome",
  "Data de Nascimento": "data_nascimento",
  CPF: "cpf",
  Telefone: "telefone",
  "E-mail": "email",
  Email: "email",
  Gênero: "genero",
  Genero: "genero",
  "Data de Cadastro": "cadastrado_em",
  "Última Compra": "ultima_compra_em",
  "Ultima Compra": "ultima_compra_em",
  "Quantidade Compras": "compras_total_qtd",
  "Valor Total das Compras": "compras_total_valor",
  "Quantidade Compras 90 dias": "compras_90d_qtd",
  "Valor Total das Compras 90 dias": "compras_90d_valor",
  "Quantidade Compras 30 dias": "compras_30d_qtd",
  "Valor Total das Compras 30 dias": "compras_30d_valor",
  "Quantidade Compras 7 dias": "compras_7d_qtd",
  "Valor Total das Compras 7 dias": "compras_7d_valor",
  Lavanderia: "lavanderia_origem",
};

function toIsoDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number") {
    // Serial Excel
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const js = new Date(Date.UTC(d.y, d.m - 1, d.d, d.H ?? 0, d.M ?? 0, d.S ?? 0));
    return js.toISOString();
  }
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (!trimmed) return null;
    const t = Date.parse(trimmed);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
    // DD/MM/YYYY
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(trimmed);
    if (m) {
      const [, dd, mm, yyyy] = m;
      const year = Number(yyyy.length === 2 ? "20" + yyyy : yyyy);
      const d = new Date(Date.UTC(year, Number(mm) - 1, Number(dd)));
      return d.toISOString();
    }
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

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo ausente" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Falha ao abrir planilha: " + (e instanceof Error ? e.message : String(e)) },
      { status: 400 },
    );
  }

  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  // Pega tudo como array de arrays
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  // Detectar linha de header: a primeira linha que contenha "CPF" e "Nome"
  let headerIdx = -1;
  for (let i = 0; i < Math.min(raw.length, 50); i++) {
    const row = raw[i] ?? [];
    const cells = row.map((c) => String(c ?? "").trim());
    if (cells.includes("Nome") && cells.includes("CPF")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    return NextResponse.json(
      { error: "Header não encontrado. A planilha precisa ter colunas 'Nome' e 'CPF'." },
      { status: 400 },
    );
  }

  // Tentar capturar "Emitido em" (snapshot da planilha) acima do header
  let snapshotEm: string | null = null;
  for (let i = 0; i < headerIdx; i++) {
    const row = raw[i] ?? [];
    const idx = row.findIndex((c) => String(c ?? "").trim().toLowerCase() === "emitido em");
    if (idx >= 0) {
      const val = row[idx + 1] ?? row.find((_, j) => j > idx && row[j] != null);
      const iso = toIsoDate(val);
      if (iso) snapshotEm = iso;
      break;
    }
  }

  const headerRow = (raw[headerIdx] ?? []).map((c) => String(c ?? "").trim());
  const mapColIdx: Partial<Record<keyof ParsedRow, number>> = {};
  for (let i = 0; i < headerRow.length; i++) {
    const key = HEADER_MAP[headerRow[i]];
    if (key) mapColIdx[key] = i;
  }
  if (mapColIdx.nome == null || mapColIdx.cpf == null) {
    return NextResponse.json({ error: "Coluna Nome ou CPF não mapeada." }, { status: 400 });
  }

  const parsed: ParsedRow[] = [];
  const erros: Array<{ linha: number; motivo: string }> = [];

  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i] ?? [];
    const get = (k: keyof ParsedRow) => (mapColIdx[k] != null ? row[mapColIdx[k]!] : null);

    const nome = toStr(get("nome"));
    const cpf = toStr(get("cpf"));
    if (!nome && !cpf) continue; // linha vazia

    parsed.push({
      _linha: i + 1, // 1-indexed
      nome,
      cpf,
      email: toStr(get("email")) || null,
      telefone: toStr(get("telefone")) || null,
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
    total: parsed.length,
    lavanderiasDetectadas: Array.from(
      new Set(parsed.map((p) => p.lavanderia_origem).filter(Boolean)),
    ),
    preview: parsed.slice(0, 8),
    linhas: parsed,
    erros,
  });
}

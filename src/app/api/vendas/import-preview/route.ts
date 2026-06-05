// POST multipart com `file` (XLSX) — relatório de vendas MAXPAN/VM
// 27 colunas idênticas em ambos sistemas. Header dinâmico (com ou sem preâmbulo).
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

type TipoPagamento = "tef" | "qrcode" | "voucher" | "dinheiro" | "outro";
type TipoCartao = "credito" | "debito" | "nao_se_aplica";
type Situacao = "sucesso" | "falha" | "pendente" | "cancelada";
type TipoServico = "lavagem" | "secagem" | "combo" | "indefinido";

export type VendaParsed = {
  _linha: number;
  data_venda: string;                    // ISO
  equipamento: string | null;
  pdv: string | null;
  situacao: Situacao;
  tipo_pagamento: TipoPagamento;
  valor: number;
  valor_sem_desconto: number | null;
  bandeira_cartao: string | null;
  tipo_cartao: TipoCartao | null;
  numero_cartao: string | null;
  autorizador: string | null;
  voucher_codigo: string | null;
  voucher_categoria: string | null;
  cupom_codigo: string | null;
  cupom_requisicao: string | null;
  cpf: string | null;
  nome_cliente: string | null;
  telefone_cliente: string | null;
  requisicao: string | null;
  cod_autorizacao: string | null;
  erro: string | null;
  detalhes_erro: string | null;
  provedor: string | null;
  adquirente: string | null;
  tipo_servico: TipoServico;
  quantidade_ciclos: number;
  lavanderia_origem: string | null;
};

// Preços oficiais (atualizar quando mudar):
const PRECO_LAVAGEM_ATUAL = 17.00;
const PRECO_SECAGEM_ATUAL = 16.99;
const PRECO_LAVAGEM_ANTIGO = 15.00;
const PRECO_SECAGEM_ANTIGO = 14.99;

// Detecta múltiplo exato (até 10 ciclos, tolerância R$ 0,01)
function detectarMultiplo(valor: number, preco: number, max: number = 10): number {
  for (let n = 1; n <= max; n++) {
    if (Math.abs(valor - n * preco) < 0.005) return n;
  }
  return 0;
}

// Exceções específicas (faixas promocionais/combos identificadas em produção)
const EXCECOES: Array<{ valor: number; tipo: TipoServico; ciclos: number }> = [
  { valor: 8.49,  tipo: "secagem", ciclos: 1 },  // 50% off de R$ 16,99
  { valor: 16.98, tipo: "secagem", ciclos: 1 },  // centavo a menos por arredondamento
  { valor: 25.47, tipo: "secagem", ciclos: 2 },  // combo R$ 16,99 + meia R$ 8,49
];

// Inferência (definida pelo Daniel 2026-06-05):
// - Lavagem: R$ 17,00 (e múltiplos: 34, 51, ...) — também R$ 15,00 (preço antigo)
// - Secagem: R$ 16,99 (e múltiplos: 33,98, 50,97, ...) — também R$ 14,99 (antigo)
// - Cupom LAVAR* ou INAUGURA20 → lavagem (1 ciclo)
// - Cupom SECAR* → secagem (1 ciclo)
// - Exceções específicas (R$ 8,49 / R$ 16,98 / R$ 25,47) tratadas antes da regra geral
function inferirServicoECiclos(valor: number, cupom: string | null): { tipo: TipoServico; ciclos: number } {
  const c = (cupom ?? "").toUpperCase();
  if (c.startsWith("LAVAR") || c === "INAUGURA20") return { tipo: "lavagem", ciclos: 1 };
  if (c.startsWith("SECAR")) return { tipo: "secagem", ciclos: 1 };

  for (const e of EXCECOES) {
    if (Math.abs(valor - e.valor) < 0.005) return { tipo: e.tipo, ciclos: e.ciclos };
  }

  let n = detectarMultiplo(valor, PRECO_LAVAGEM_ATUAL);
  if (n > 0) return { tipo: "lavagem", ciclos: n };
  n = detectarMultiplo(valor, PRECO_SECAGEM_ATUAL);
  if (n > 0) return { tipo: "secagem", ciclos: n };
  n = detectarMultiplo(valor, PRECO_LAVAGEM_ANTIGO);
  if (n > 0) return { tipo: "lavagem", ciclos: n };
  n = detectarMultiplo(valor, PRECO_SECAGEM_ANTIGO);
  if (n > 0) return { tipo: "secagem", ciclos: n };

  return { tipo: "indefinido", ciclos: 1 };
}

function normalizeHeader(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

const HEADER_MAP: Record<string, keyof VendaParsed | "ignorar"> = {
  "lavanderia": "lavanderia_origem",
  "data da venda": "data_venda",
  "empresa": "ignorar",
  "documento da empresa": "ignorar",
  "equipamento": "equipamento",
  "pdv": "pdv",
  "situação": "situacao",
  "situacao": "situacao",
  "tipo pagamento": "tipo_pagamento",
  "valor": "valor",
  "valor sem desconto": "valor_sem_desconto",
  "provedor": "provedor",
  "adquirente": "adquirente",
  "bandeira do cartão": "bandeira_cartao",
  "bandeira do cartao": "bandeira_cartao",
  "tipo de cartão": "tipo_cartao",
  "tipo de cartao": "tipo_cartao",
  "número do cartão": "numero_cartao",
  "numero do cartao": "numero_cartao",
  "autorizador": "autorizador",
  "voucher": "voucher_codigo",
  "categoria do voucher": "voucher_categoria",
  "cupom": "cupom_codigo",
  "cpf do cliente": "cpf",
  "nome do cliente": "nome_cliente",
  "telefone do cliente": "telefone_cliente",
  "requisição": "requisicao",
  "requisicao": "requisicao",
  "requisição do cupom": "cupom_requisicao",
  "requisicao do cupom": "cupom_requisicao",
  "código de autorização do emissor": "cod_autorizacao",
  "codigo de autorizacao do emissor": "cod_autorizacao",
  "erro": "erro",
  "detalhes do erro": "detalhes_erro",
};

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
    // "2025-10-22 18:56:06.265000"
    const iso = t.replace(" ", "T").replace(/(\.\d{3})\d*$/, "$1");
    const ts = Date.parse(iso);
    if (!Number.isNaN(ts)) return new Date(ts).toISOString();
    // DD/MM/YYYY HH:MM
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(t);
    if (m) {
      const [, dd, mm, yyyy, h = "0", mi = "0", se = "0"] = m;
      const year = Number(yyyy.length === 2 ? "20" + yyyy : yyyy);
      return new Date(Date.UTC(year, Number(mm) - 1, Number(dd), Number(h), Number(mi), Number(se))).toISOString();
    }
  }
  return null;
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

function normalizarTipoPagamento(s: string): TipoPagamento {
  const t = s.toLowerCase();
  if (t === "tef") return "tef";
  if (t === "qrcode" || t === "qr code" || t === "pix") return "qrcode";
  if (t === "voucher") return "voucher";
  if (t === "dinheiro") return "dinheiro";
  return "outro";
}

function normalizarTipoCartao(s: string | null): TipoCartao | null {
  if (!s) return null;
  const t = s.toLowerCase();
  if (t.startsWith("créd") || t.startsWith("cred")) return "credito";
  if (t.startsWith("déb") || t.startsWith("deb")) return "debito";
  return "nao_se_aplica";
}

function normalizarSituacao(s: string): Situacao {
  const t = s.toLowerCase();
  if (t === "sucesso") return "sucesso";
  if (t === "falha" || t === "erro") return "falha";
  if (t === "pendente") return "pendente";
  if (t === "cancelada" || t === "cancelado") return "cancelada";
  return "sucesso";
}

function detectarOrigem(arquivo: string): "maxpan" | "vm_tecnologia" | "manual" {
  const n = arquivo.toLowerCase();
  if (n.includes("vm")) return "vm_tecnologia";
  // padrões MAXPAN: "relat_rio", "1778..._relat", "customerreport"
  return "maxpan";
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
      { error: "Falha ao abrir arquivo: " + (e instanceof Error ? e.message : String(e)) },
      { status: 400 },
    );
  }

  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  // Encontrar header — primeira linha com "Data da Venda" e "Valor"
  let headerIdx = -1;
  for (let i = 0; i < Math.min(raw.length, 50); i++) {
    const row = (raw[i] ?? []).map((c) => normalizeHeader(String(c ?? "")));
    if (row.includes("data da venda") && row.includes("valor")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    return NextResponse.json(
      { error: "Header não encontrado. Esperado colunas 'Data da Venda' e 'Valor'." },
      { status: 400 },
    );
  }

  // snapshot_em do "Emitido em"
  let snapshotEm: string | null = null;
  for (let i = 0; i < headerIdx; i++) {
    const row = raw[i] ?? [];
    const idx = row.findIndex((c) => normalizeHeader(String(c ?? "")) === "emitido em");
    if (idx >= 0) {
      const iso = toIsoDate(row[idx + 1] ?? row.find((_, j) => j > idx && row[j] != null));
      if (iso) snapshotEm = iso;
      break;
    }
  }

  const headerRow = (raw[headerIdx] ?? []).map((c) => normalizeHeader(String(c ?? "")));
  const colIdx: Partial<Record<keyof VendaParsed, number>> = {};
  for (let i = 0; i < headerRow.length; i++) {
    const k = HEADER_MAP[headerRow[i]];
    if (k && k !== "ignorar") colIdx[k] = i;
  }
  if (colIdx.data_venda == null || colIdx.valor == null) {
    return NextResponse.json({ error: "Coluna Data da Venda ou Valor não mapeada." }, { status: 400 });
  }

  const origemDetectada = detectarOrigem(file.name);
  const parsed: VendaParsed[] = [];
  const erros: Array<{ linha: number; motivo: string }> = [];

  // Stats agregadas pro preview
  let totalValor = 0;
  const porTipoPag: Record<string, { count: number; valor: number }> = {};
  const porServico: Record<string, number> = {};
  let comCpf = 0;
  let comCupom = 0;
  let comVoucher = 0;
  const cpfsUnicos = new Set<string>();

  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i] ?? [];
    if (row.every((c) => c == null || c === "")) continue;
    const get = (k: keyof VendaParsed) => (colIdx[k] != null ? row[colIdx[k]!] : null);

    const dataIso = toIsoDate(get("data_venda"));
    const valorN = toNum(get("valor"));
    if (!dataIso) {
      erros.push({ linha: i + 1, motivo: "Data da venda inválida" });
      continue;
    }
    if (valorN <= 0) {
      erros.push({ linha: i + 1, motivo: `Valor inválido (${get("valor")})` });
      continue;
    }

    const tipoPag = normalizarTipoPagamento(toStr(get("tipo_pagamento")) || "outro");
    const tipoCart = normalizarTipoCartao(toStr(get("tipo_cartao")) || null);
    const sit = normalizarSituacao(toStr(get("situacao")) || "sucesso");
    const cupom = toStr(get("cupom_codigo")) || null;
    const voucher = toStr(get("voucher_codigo")) || null;
    const cpfRaw = toStr(get("cpf"));
    const cpfDig = cpfRaw.replace(/\D/g, "");
    const cpfFormatado =
      cpfDig.length === 11
        ? `${cpfDig.slice(0, 3)}.${cpfDig.slice(3, 6)}.${cpfDig.slice(6, 9)}-${cpfDig.slice(9)}`
        : cpfRaw || null;

    const telBruto = toStr(get("telefone_cliente"));
    const telDig = telBruto.replace(/\D/g, "");
    const telefone =
      telDig.length === 11
        ? `(${telDig.slice(0, 2)}) ${telDig.slice(2, 7)}-${telDig.slice(7)}`
        : telDig.length === 10
        ? `(${telDig.slice(0, 2)}) ${telDig.slice(2, 6)}-${telDig.slice(6)}`
        : telBruto || null;

    const valorBase = Number(get("valor_sem_desconto")) || valorN;
    const { tipo: servico, ciclos } = inferirServicoECiclos(valorBase, cupom);

    parsed.push({
      _linha: i + 1,
      data_venda: dataIso,
      equipamento: toStr(get("equipamento")) || null,
      pdv: toStr(get("pdv")) || null,
      situacao: sit,
      tipo_pagamento: tipoPag,
      valor: valorN,
      valor_sem_desconto: toNum(get("valor_sem_desconto")) || null,
      bandeira_cartao: toStr(get("bandeira_cartao")) || null,
      tipo_cartao: tipoCart,
      numero_cartao: toStr(get("numero_cartao")) || null,
      autorizador: toStr(get("autorizador")) || null,
      voucher_codigo: voucher,
      voucher_categoria: toStr(get("voucher_categoria")) || null,
      cupom_codigo: cupom,
      cupom_requisicao: toStr(get("cupom_requisicao")) || null,
      cpf: cpfFormatado,
      nome_cliente: toStr(get("nome_cliente")) || null,
      telefone_cliente: telefone,
      requisicao: toStr(get("requisicao")) || null,
      cod_autorizacao: toStr(get("cod_autorizacao")) || null,
      erro: toStr(get("erro")) || null,
      detalhes_erro: toStr(get("detalhes_erro")) || null,
      provedor: toStr(get("provedor")) || null,
      adquirente: toStr(get("adquirente")) || null,
      tipo_servico: servico,
      quantidade_ciclos: ciclos,
      lavanderia_origem: toStr(get("lavanderia_origem")) || null,
    });

    totalValor += valorN;
    const tagPag = tipoPag === "tef" ? `tef-${tipoCart ?? "?"}` : tipoPag;
    porTipoPag[tagPag] = porTipoPag[tagPag] ?? { count: 0, valor: 0 };
    porTipoPag[tagPag].count += 1;
    porTipoPag[tagPag].valor += valorN;
    porServico[servico] = (porServico[servico] ?? 0) + 1;
    if (cpfFormatado) {
      comCpf += 1;
      cpfsUnicos.add(cpfFormatado);
    }
    if (cupom) comCupom += 1;
    if (voucher) comVoucher += 1;
  }

  // Snapshot do arquivo (data emitida ou data da última venda)
  if (!snapshotEm && parsed.length > 0) {
    const datas = parsed.map((p) => p.data_venda).sort();
    snapshotEm = datas[datas.length - 1];
  }

  return NextResponse.json({
    sheet: sheetName,
    headerLinha: headerIdx + 1,
    snapshotEm,
    origemDetectada,
    modoSugerido: "append" as const, // vendas sempre append (cada linha é um evento único)
    total: parsed.length,
    totalValor: Math.round(totalValor * 100) / 100,
    porTipoPagamento: porTipoPag,
    porServico,
    comCpf,
    comCupom,
    comVoucher,
    cpfsUnicos: cpfsUnicos.size,
    lavanderiasDetectadas: Array.from(
      new Set(parsed.map((p) => p.lavanderia_origem).filter(Boolean)),
    ),
    preview: parsed.slice(0, 8),
    linhas: parsed,
    erros,
  });
}

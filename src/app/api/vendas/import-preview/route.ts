// POST multipart com `file` (XLSX/CSV) — relatório de vendas
//   Formato A — VM/MAXLAV (XLSX, 27 colunas): "Data da Venda", "Valor", etc
//   Formato B — MAXPAN novo (CSV, 14 colunas): "Data_Hora", "Valor_Venda", "Maquinas", etc
// Header dinâmico (com ou sem preâmbulo) + detecção automática do formato.
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

type TipoPagamento = "tef" | "qrcode" | "voucher" | "dinheiro" | "carteira" | "outro";
type TipoCartao = "credito" | "debito" | "nao_se_aplica";
type Situacao = "sucesso" | "falha" | "pendente" | "cancelada";
type TipoServico = "lavagem" | "secagem" | "combo" | "recarga" | "indefinido";

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
  // Novo MAXPAN — agregado de LTV usado no upsert de clientes
  total_compras_cliente: number | null;
};

// ============================================================
// FORMATO A — VM/MAXLAV (antigo) · 27 colunas XLSX em PT-BR
// ============================================================

const PRECO_LAVAGEM_ATUAL = 17.00;
const PRECO_SECAGEM_ATUAL = 16.99;
const PRECO_LAVAGEM_ANTIGO = 15.00;
const PRECO_SECAGEM_ANTIGO = 14.99;

function detectarMultiplo(valor: number, preco: number, max: number = 10): number {
  for (let n = 1; n <= max; n++) {
    if (Math.abs(valor - n * preco) < 0.005) return n;
  }
  return 0;
}

const EXCECOES: Array<{ valor: number; tipo: TipoServico; ciclos: number }> = [
  { valor: 8.49,  tipo: "secagem", ciclos: 1 },
  { valor: 16.98, tipo: "secagem", ciclos: 1 },
  { valor: 25.47, tipo: "secagem", ciclos: 2 },
];

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

const HEADER_MAP_VM: Record<string, keyof VendaParsed | "ignorar"> = {
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

// ============================================================
// FORMATO B — MAXPAN salesReport (novo) · 14 colunas CSV
// ============================================================

const HEADER_MAP_MAXPAN: Record<string, keyof VendaParsed | "ignorar"> = {
  "data_hora": "data_venda",
  "valor_venda": "valor",
  "valor_pago": "valor_sem_desconto",  // valor antes do desconto (quando há)
  "meio_de_pagamento": "tipo_pagamento",
  // Comprovante_cartao é o ID único da transação MAXPAN (ex: A2596pGd5r3UyRNU8ejVxZDpeoS).
  // Usado como requisicao pra dedupe ao re-importar a mesma janela várias vezes no dia.
  "comprovante_cartao": "requisicao",
  "bandeira_cartao": "bandeira_cartao",
  "loja": "lavanderia_origem",
  "nome_cliente": "nome_cliente",
  "doc_cliente": "cpf",
  "total_compras_cliente": "total_compras_cliente",
  "telefone": "telefone_cliente",
  "maquinas": "equipamento",
  "usou_cupom": "ignorar",
  "codigo_cupom": "cupom_codigo",
};

function normalizarMeioPagamentoMaxpan(s: string): { pag: TipoPagamento; cartao: TipoCartao | null } {
  const t = s.toLowerCase().trim();
  if (t === "pix") return { pag: "qrcode", cartao: null };
  if (t.includes("crédito") || t === "cartão de credito" || t === "cartao de credito") {
    return { pag: "tef", cartao: "credito" };
  }
  if (t.includes("débito") || t === "cartão de debito" || t === "cartao de debito") {
    return { pag: "tef", cartao: "debito" };
  }
  if (t === "saldo da carteira" || t === "carteira") return { pag: "carteira", cartao: null };
  if (t.startsWith("cupom") || t === "permuta") return { pag: "voucher", cartao: null };
  if (t === "dinheiro") return { pag: "dinheiro", cartao: null };
  return { pag: "outro", cartao: null };
}

// Preços oficiais sem desconto (Daniel 2026-06-08):
//   Lavagem = R$ 17,00 · Secagem = R$ 16,99
// Combinações esperadas: 1L=17 · 2L=34 · 3L=51 · 1S=16,99 · 2S=33,98 · 3S=50,97
//   1L+1S=33,99 · 2L+1S=50,99 · 1L+2S=50,98 etc

/** Inferir tipo+ciclos a partir de VALOR (fonte primária) com fallback na coluna Maquinas.
 *  Estratégia: enumera combinações (lav, sec) até 4+4 e escolhe a que bate exatamente com o valor.
 *  Se valor não bate (cliente pagou com desconto/promo ou foi recarga), usa contagem de máquinas. */
function inferirServicoMaxpan(
  valor: number,
  maquinas: string,
  cupom: string | null,
): { tipo: TipoServico; ciclos: number; equipamentos: string; origem: "valor" | "maquinas" | "fallback" } {
  const txt = maquinas.trim();

  // 1) Recarga — sempre identificada pela coluna Maquinas (valor varia)
  if (/^recarga$/i.test(txt)) {
    return { tipo: "recarga", ciclos: 0, equipamentos: "Recarga", origem: "maquinas" };
  }

  // 2) Contagem na coluna Maquinas — pra cross-check
  const partes = txt.split(",").map((p) => p.trim()).filter(Boolean);
  let lavMaq = 0, secMaq = 0;
  for (const p of partes) {
    if (/^lavadora/i.test(p)) lavMaq += 1;
    else if (/^secadora/i.test(p)) secMaq += 1;
  }

  // 3) Inferência por valor (R$17 lav, R$16,99 sec) — testa combinações 0..4 de cada
  //    Escolhe a combinação com TOTAL de ciclos mínimo (a mais simples) que bate exato.
  let bestLav = -1, bestSec = -1;
  for (let l = 0; l <= 4; l++) {
    for (let s = 0; s <= 4; s++) {
      if (l === 0 && s === 0) continue;
      const esperado = l * PRECO_LAVAGEM_ATUAL + s * PRECO_SECAGEM_ATUAL;
      if (Math.abs(valor - esperado) < 0.005) {
        if (bestLav < 0 || (l + s) < (bestLav + bestSec)) {
          bestLav = l;
          bestSec = s;
        }
      }
    }
  }

  if (bestLav >= 0) {
    const ciclos = bestLav + bestSec;
    const tipo: TipoServico = bestLav > 0 && bestSec > 0 ? "combo"
      : bestLav > 0 ? "lavagem" : "secagem";
    // Cross-check: se contagem da coluna Maquinas bate, ótimo. Senão, prevalece o valor.
    return { tipo, ciclos, equipamentos: txt || `${bestLav}L+${bestSec}S`, origem: "valor" };
  }

  // 4) Valor não bate combinação padrão — fallback pra contagem de máquinas
  if (lavMaq > 0 || secMaq > 0) {
    if (lavMaq > 0 && secMaq > 0) {
      return { tipo: "combo", ciclos: lavMaq + secMaq, equipamentos: txt, origem: "maquinas" };
    }
    if (lavMaq > 0) return { tipo: "lavagem", ciclos: lavMaq, equipamentos: txt, origem: "maquinas" };
    return { tipo: "secagem", ciclos: secMaq, equipamentos: txt, origem: "maquinas" };
  }

  // 5) Último recurso: cupom indica serviço, conta como 1 ciclo (vendas promo de R$ 0,10 etc)
  const c = (cupom ?? "").toUpperCase();
  if (c.startsWith("LAVAR")) return { tipo: "lavagem", ciclos: 1, equipamentos: txt, origem: "fallback" };
  if (c.startsWith("SECAR")) return { tipo: "secagem", ciclos: 1, equipamentos: txt, origem: "fallback" };

  return { tipo: "indefinido", ciclos: 1, equipamentos: txt, origem: "fallback" };
}

/** Normaliza o nome da loja MAXPAN pra um rótulo curto.
 *  "XO VARAL CASTELO LTDA" → "Castelo"  ·  "XÔ VARAL CABRAL" → "Cabral" */
function normalizarLojaMaxpan(loja: string): string {
  if (!loja) return "";
  return loja
    .replace(/^X[ÔO]\s+VARAL\s+/i, "")
    .replace(/\s+LTDA$/i, "")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// ============================================================
// HELPERS COMUNS
// ============================================================

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
    // Prioridade: formato BR DD/MM/YYYY (NUNCA delegar pra Date.parse que interpreta como US MM/DD)
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(t);
    if (m) {
      const [, dd, mm, yyyy, h = "0", mi = "0", se = "0"] = m;
      const year = Number(yyyy.length === 2 ? "20" + yyyy : yyyy);
      // -03:00 (Brasília) — converte pra UTC somando 3h
      return new Date(Date.UTC(year, Number(mm) - 1, Number(dd), Number(h) + 3, Number(mi), Number(se))).toISOString();
    }
    // Fallback ISO (2025-10-22 18:56:06)
    const iso = t.replace(" ", "T").replace(/(\.\d{3})\d*$/, "$1");
    const ts = Date.parse(iso);
    if (!Number.isNaN(ts)) return new Date(ts).toISOString();
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

function valorNd(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  if (!t || t.toLowerCase() === "n/d" || t.toLowerCase() === "n.d." || t === "—") return null;
  return t;
}

function normalizarTipoPagamentoVM(s: string): TipoPagamento {
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

function formatarCpf(cpfBruto: string): string | null {
  const d = cpfBruto.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 9 || d.length === 10) {
    const p = d.padStart(11, "0");
    return `${p.slice(0, 3)}.${p.slice(3, 6)}.${p.slice(6, 9)}-${p.slice(9)}`;
  }
  return cpfBruto || null;
}

function formatarTelefone(telBruto: string): string | null {
  const d = telBruto.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return telBruto || null;
}

function detectarSeparador(texto: string): string {
  const linhas = texto.split(/\r?\n/).slice(0, 20).filter((l) => l.trim());
  const cont = { ";": 0, ",": 0, "\t": 0, "|": 0 };
  for (const l of linhas) {
    for (const c of [";", ",", "\t", "|"] as const) {
      cont[c] += (l.match(new RegExp(`\\${c === "\t" ? "t" : c}`, "g")) ?? []).length;
    }
  }
  if (cont[";"] >= cont[","] && cont[";"] >= cont["\t"]) return ";";
  if (cont["\t"] > cont[","]) return "\t";
  return ",";
}

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/** Parser CSV manual — preserva tudo como string e evita as coerções do SheetJS
 *  que quebram pt-BR (vírgula decimal vira separador de milhar, DD/MM vira MM/DD,
 *  CPF/telefone numéricos perdem zeros à esquerda). */
function parseCSVManual(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"' && field === "") {
        inQuotes = true;
      } else if (c === sep) {
        row.push(field); field = "";
      } else if (c === "\n") {
        row.push(field); field = "";
        rows.push(row); row = [];
      } else if (c === "\r") {
        // ignora — quebra é \n
      } else {
        field += c;
      }
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Filtra linhas totalmente vazias
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

function detectarFormato(headerRow: string[]): "vm" | "maxpan_sales" | "desconhecido" {
  const norm = headerRow.map(normalizeHeader);
  if (norm.includes("data_hora") && norm.includes("valor_venda")) return "maxpan_sales";
  if (norm.includes("data da venda") && norm.includes("valor")) return "vm";
  return "desconhecido";
}

function detectarOrigem(formato: "vm" | "maxpan_sales" | "desconhecido"): "maxpan" | "vm_tecnologia" | "manual" {
  if (formato === "maxpan_sales") return "maxpan";
  if (formato === "vm") return "vm_tecnologia";
  return "manual";
}

// ============================================================
// HANDLER
// ============================================================

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo ausente" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv" || file.type === "application/csv";

  let raw: unknown[][];
  let sheetName: string;
  try {
    if (isCsv) {
      // Parser próprio — preserva valores como string (evita coerções SheetJS que quebram pt-BR)
      const txt = stripBom(buf.toString("utf-8"));
      const sep = detectarSeparador(txt);
      raw = parseCSVManual(txt, sep);
      sheetName = "CSV";
    } else {
      // XLSX/XLS: SheetJS está OK (Excel preserva tipos corretamente)
      const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
      sheetName = wb.SheetNames[0];
      raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null, raw: true });
    }
  } catch (e) {
    return NextResponse.json(
      { error: "Falha ao abrir arquivo: " + (e instanceof Error ? e.message : String(e)) },
      { status: 400 },
    );
  }

  // Procurar header em até 50 linhas (formato MAXPAN tem header na linha 1)
  let headerIdx = -1;
  let formato: "vm" | "maxpan_sales" | "desconhecido" = "desconhecido";
  for (let i = 0; i < Math.min(raw.length, 50); i++) {
    const row = (raw[i] ?? []).map((c) => String(c ?? ""));
    const f = detectarFormato(row);
    if (f !== "desconhecido") {
      headerIdx = i;
      formato = f;
      break;
    }
  }
  if (headerIdx < 0 || formato === "desconhecido") {
    return NextResponse.json(
      { error: "Formato não reconhecido. Esperado VM ('Data da Venda' + 'Valor') ou MAXPAN ('Data_Hora' + 'Valor_Venda')." },
      { status: 400 },
    );
  }

  const headerMap = formato === "maxpan_sales" ? HEADER_MAP_MAXPAN : HEADER_MAP_VM;
  const headerRow = (raw[headerIdx] ?? []).map((c) => normalizeHeader(String(c ?? "")));
  const colIdx: Partial<Record<keyof VendaParsed, number>> = {};
  for (let i = 0; i < headerRow.length; i++) {
    const k = headerMap[headerRow[i]];
    if (k && k !== "ignorar") colIdx[k] = i;
  }
  if (colIdx.data_venda == null || colIdx.valor == null) {
    return NextResponse.json({ error: "Coluna de data ou valor não mapeada." }, { status: 400 });
  }

  // snapshot_em — VM tem "Emitido em" / MAXPAN extrai do nome do arquivo
  let snapshotEm: string | null = null;
  if (formato === "vm") {
    for (let i = 0; i < headerIdx; i++) {
      const row = raw[i] ?? [];
      const idx = row.findIndex((c) => normalizeHeader(String(c ?? "")) === "emitido em");
      if (idx >= 0) {
        const iso = toIsoDate(row[idx + 1] ?? row.find((_, j) => j > idx && row[j] != null));
        if (iso) snapshotEm = iso;
        break;
      }
    }
  } else if (formato === "maxpan_sales") {
    const m = /salesreport[-_](\d{2})[_-](\d{2})[_-](\d{4})/i.exec(file.name);
    if (m) {
      const [, dd, mm, yyyy] = m;
      snapshotEm = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), 23, 59)).toISOString();
    }
  }

  const origemDetectada = detectarOrigem(formato);
  const parsed: VendaParsed[] = [];
  const erros: Array<{ linha: number; motivo: string }> = [];

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
      erros.push({ linha: i + 1, motivo: "Data inválida" });
      continue;
    }
    // MAXPAN: valor pode ser 0 quando é "Saldo da carteira" sem cobrança extra — pular silencioso
    if (valorN <= 0) {
      if (formato === "maxpan_sales") continue;
      erros.push({ linha: i + 1, motivo: `Valor inválido (${get("valor")})` });
      continue;
    }

    // ─── Decodificação específica por formato ─────────────────────
    let tipoPag: TipoPagamento;
    let tipoCart: TipoCartao | null;
    let servico: TipoServico;
    let ciclos: number;
    let equipamento: string | null;
    let bandeira: string | null;
    let cupom: string | null;
    let voucher: string | null;
    let codAutoriza: string | null;
    let totalComprasCli: number | null = null;

    if (formato === "maxpan_sales") {
      const meio = toStr(get("tipo_pagamento"));
      const np = normalizarMeioPagamentoMaxpan(meio);
      tipoPag = np.pag;
      tipoCart = np.cartao;
      bandeira = valorNd(toStr(get("bandeira_cartao")));
      cupom = valorNd(toStr(get("cupom_codigo")));
      // MAXPAN não tem voucher_codigo separado — "Cupom parceria" vira voucher
      voucher = (meio.toLowerCase().startsWith("cupom") || meio.toLowerCase() === "permuta") ? meio : null;
      codAutoriza = null; // Comprovante_cartao agora vai pra requisicao (dedupe)
      const maqs = toStr(get("equipamento"));
      const inf = inferirServicoMaxpan(valorN, maqs, cupom);
      servico = inf.tipo;
      ciclos = inf.ciclos;
      equipamento = inf.equipamentos || null;
      totalComprasCli = toNum(get("total_compras_cliente")) || null;
    } else {
      tipoPag = normalizarTipoPagamentoVM(toStr(get("tipo_pagamento")) || "outro");
      tipoCart = normalizarTipoCartao(toStr(get("tipo_cartao")) || null);
      bandeira = toStr(get("bandeira_cartao")) || null;
      cupom = toStr(get("cupom_codigo")) || null;
      voucher = toStr(get("voucher_codigo")) || null;
      codAutoriza = toStr(get("cod_autorizacao")) || null;
      equipamento = toStr(get("equipamento")) || null;
      const valorBase = Number(get("valor_sem_desconto")) || valorN;
      const inf = inferirServicoECiclos(valorBase, cupom);
      servico = inf.tipo;
      ciclos = inf.ciclos;
    }

    const sit = normalizarSituacao(toStr(get("situacao")) || "sucesso");
    const cpfRaw = toStr(get("cpf"));
    const cpfFormatado = cpfRaw ? formatarCpf(cpfRaw) : null;
    const telefone = formatarTelefone(toStr(get("telefone_cliente")));

    // Requisição — chave de dedupe pra re-importações no mesmo dia.
    // MAXPAN: Comprovante_cartao é único por transação. Quando ausente (recargas via Permuta),
    // sintetiza chave estável a partir de data + cpf + valor + cnpj_loja.
    let requisicao = valorNd(toStr(get("requisicao")));
    if (!requisicao && formato === "maxpan_sales") {
      const lojaTag = toStr(get("lavanderia_origem")).replace(/\W+/g, "").slice(0, 8) || "X";
      const cpfTag = (cpfFormatado ?? "anon").replace(/\D/g, "").slice(0, 11);
      requisicao = `MAXPAN-${dataIso.replace(/\W/g, "").slice(0, 14)}-${lojaTag}-${cpfTag}-${Math.round(valorN * 100)}`;
    }

    parsed.push({
      _linha: i + 1,
      data_venda: dataIso,
      equipamento,
      pdv: toStr(get("pdv")) || null,
      situacao: sit,
      tipo_pagamento: tipoPag,
      valor: valorN,
      valor_sem_desconto: toNum(get("valor_sem_desconto")) || null,
      bandeira_cartao: bandeira,
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
      requisicao,
      cod_autorizacao: codAutoriza,
      erro: toStr(get("erro")) || null,
      detalhes_erro: toStr(get("detalhes_erro")) || null,
      provedor: toStr(get("provedor")) || null,
      adquirente: toStr(get("adquirente")) || null,
      tipo_servico: servico,
      quantidade_ciclos: ciclos,
      lavanderia_origem:
        formato === "maxpan_sales"
          ? normalizarLojaMaxpan(toStr(get("lavanderia_origem"))) || null
          : toStr(get("lavanderia_origem")) || null,
      total_compras_cliente: totalComprasCli,
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

  if (!snapshotEm && parsed.length > 0) {
    const datas = parsed.map((p) => p.data_venda).sort();
    snapshotEm = datas[datas.length - 1];
  }

  return NextResponse.json({
    sheet: sheetName,
    headerLinha: headerIdx + 1,
    formato,
    snapshotEm,
    origemDetectada,
    modoSugerido: "append" as const,
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

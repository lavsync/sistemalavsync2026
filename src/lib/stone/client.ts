// LavSync · Stone Open Banking · HTTP client autenticado
// Spec: https://docs.openbank.stone.com.br/docs/referencia-da-api/dados-da-conta/consultar-extrato/
import "server-only";
import { getAccessToken, type StoneCredencial, USER_AGENT } from "./auth";

const BASE_URL_PROD = "https://api.openbank.stone.com.br";
const BASE_URL_SANDBOX = "https://sandbox-api.openbank.stone.com.br";

// ─── Tipos das transações conforme Stone Statement API ─────────────
export type StoneTransactionType =
  | "internal" | "external" | "external_refund"
  | "payment" | "payment_refund"
  | "balance_block"
  | "card_payment"
  | "salary_portability" | "salary_portability_refund" | "salary_portability_employer_refund"
  | "instant_payment";   // Pix

export type StoneTransactionStatus = "FINISHED" | "PENDING" | "CANCELED" | "FAILED";

export type StoneCounterParty = {
  entity?: {
    name?: string;
    document?: string;
    document_type?: "cpf" | "cnpj";
  };
  account?: {
    account_code?: string;
    branch_code?: string;
    institution?: string;
    institution_name?: string;
  };
};

export type StoneStatementEntry = {
  id: string;
  type: StoneTransactionType;
  operation: "credit" | "debit";
  status: StoneTransactionStatus;
  created_at: string;                    // ISO 8601
  amount: number;                        // líquido em centavos
  operation_amount: number;              // bruto em centavos
  fee_amount: number;                    // taxa em centavos
  balance_before: number;
  balance_after: number;
  operation_id?: string;
  scheduled_at?: string | null;
  scheduled_to?: string | null;
  description?: string;
  counter_party?: StoneCounterParty;
  barcode?: string;
  details?: Record<string, unknown>;
};

export type StoneStatementCursor = {
  before: string | null;
  after: string | null;
  limit: number;
};

export type StoneStatementResposta = {
  cursor: StoneStatementCursor;
  data: StoneStatementEntry[];
};

export type ListarExtratoOpts = {
  account_id: string;
  start_datetime?: Date;
  end_datetime?: Date;
  limit?: number;
  after?: string;
  before?: string;
  type?: StoneTransactionType[];
  idempotencyKey?: string;
};

export class StoneClient {
  private accessToken: string | null = null;
  private tokenExpiraEm: number = 0;
  private baseUrl: string;

  constructor(private cred: StoneCredencial) {
    this.baseUrl = cred.ambiente === "sandbox" ? BASE_URL_SANDBOX : BASE_URL_PROD;
  }

  /**
   * Retorna access_token válido. Mantém em cache até 30s antes de expirar.
   * Stone exige reusar o mesmo token durante seus 15min de validade.
   */
  private async getToken(): Promise<string> {
    const agora = Math.floor(Date.now() / 1000);
    if (this.accessToken && this.tokenExpiraEm > agora + 30) {
      return this.accessToken;
    }
    const tok = await getAccessToken(this.cred);
    this.accessToken = tok.access_token;
    this.tokenExpiraEm = agora + tok.expires_in;
    return this.accessToken;
  }

  /** Wrapper fetch com Authorization Bearer + User-Agent (ambos obrigatórios). */
  private async fetchAuth(
    path: string,
    init?: RequestInit & { idempotencyKey?: string },
  ): Promise<Response> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      ...(init?.headers as Record<string, string> | undefined ?? {}),
    };
    if (init?.idempotencyKey) {
      if (init.idempotencyKey.length > 72) {
        throw new Error("idempotency_key máx 72 caracteres");
      }
      headers["x-stone-idempotency-key"] = init.idempotencyKey;
    }
    return fetch(`${this.baseUrl}${path}`, { ...init, headers });
  }

  /** Health check — consulta dados da conta. Sucesso = credenciais OK. */
  async getAccount(accountId: string): Promise<Record<string, unknown>> {
    const resp = await this.fetchAuth(`/api/v1/accounts/${accountId}`);
    const text = await resp.text();
    if (!resp.ok) throw new Error(`getAccount HTTP ${resp.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
  }

  /** Consulta saldo da conta. */
  async getSaldo(accountId: string): Promise<{ amount: number; currency: string }> {
    const resp = await this.fetchAuth(`/api/v1/accounts/${accountId}/balance`);
    const text = await resp.text();
    if (!resp.ok) throw new Error(`getSaldo HTTP ${resp.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
  }

  /**
   * GET /api/v1/accounts/{id}/statement
   * Query params oficiais: start_datetime, end_datetime, limit, after, before, type
   */
  async listarExtrato(opts: ListarExtratoOpts): Promise<StoneStatementResposta> {
    const params = new URLSearchParams();
    if (opts.start_datetime) params.set("start_datetime", opts.start_datetime.toISOString());
    if (opts.end_datetime) params.set("end_datetime", opts.end_datetime.toISOString());
    params.set("limit", String(opts.limit ?? 100));
    if (opts.after) params.set("after", opts.after);
    if (opts.before) params.set("before", opts.before);
    if (opts.type && opts.type.length > 0) {
      // Stone aceita type como query repetido ou csv. Usamos repetido (mais explícito).
      for (const t of opts.type) params.append("type", t);
    }

    const resp = await this.fetchAuth(
      `/api/v1/accounts/${opts.account_id}/statement?${params.toString()}`,
      { idempotencyKey: opts.idempotencyKey },
    );
    const text = await resp.text();
    if (!resp.ok) throw new Error(`listarExtrato HTTP ${resp.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text) as StoneStatementResposta;
  }

  /** Lista TODAS as transações da janela paginando até esgotar. */
  async listarExtratoTodos(opts: ListarExtratoOpts): Promise<StoneStatementEntry[]> {
    const todos: StoneStatementEntry[] = [];
    let cursor: string | undefined = opts.after;
    let pagina = 0;
    while (true) {
      const r = await this.listarExtrato({ ...opts, after: cursor });
      todos.push(...r.data);
      pagina += 1;
      if (!r.cursor?.after || pagina >= 50) break;          // safety cap 50 páginas
      cursor = r.cursor.after;
    }
    return todos;
  }

  /** Consulta uma única entrada do extrato pelo ID. */
  async getStatementEntry(accountId: string, entryId: string): Promise<StoneStatementEntry> {
    const resp = await this.fetchAuth(`/api/v1/accounts/${accountId}/statement/${entryId}`);
    const text = await resp.text();
    if (!resp.ok) throw new Error(`getStatementEntry HTTP ${resp.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
  }
}

/** Detecta meio de pagamento (PIX, cartão, transferência) a partir do entry. */
export function detectarMeioPagamento(e: StoneStatementEntry): "pix" | "credit_card" | "debit_card" | "transfer" | "boleto" | "outro" {
  if (e.type === "instant_payment") return "pix";
  if (e.type === "card_payment") {
    const desc = (e.description ?? "").toLowerCase();
    if (desc.includes("débit") || desc.includes("debit")) return "debit_card";
    return "credit_card";   // default cartão crédito
  }
  if (e.type === "internal" || e.type === "external") return "transfer";
  if (e.type === "payment") {
    const desc = (e.description ?? "").toLowerCase();
    if (desc.includes("boleto")) return "boleto";
    return "outro";
  }
  return "outro";
}

/** Filtra apenas transações de RECEITA (créditos relevantes pra vendas). */
export function ehReceitaVenda(e: StoneStatementEntry): boolean {
  if (e.operation !== "credit") return false;
  if (e.status !== "FINISHED") return false;
  // PIX recebido, cartão recebido, transferência recebida
  return e.type === "instant_payment"
      || e.type === "card_payment"
      || e.type === "external"
      || e.type === "internal";
}

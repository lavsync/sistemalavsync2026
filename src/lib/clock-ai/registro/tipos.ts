// LavSync · CLOCK v2 · Tipos do registro (consultas, ações e rotas)
//
// Ficam aqui, separados do gateway, para que cada módulo do registro
// importe só tipos — sem dependência circular em tempo de execução.
// O gateway re-exporta tudo (contrato do Orion).
import type { SupabaseClient } from "@supabase/supabase-js";

/** Contexto da requisição: sessão do usuário (RLS) + permissões + unidades permitidas. */
export type CtxClock = {
  sb: SupabaseClient;               // sessão do usuário (cookies) — nunca service role
  userId: string;
  nome: string;
  papel: string;
  permissoes: Set<string>;
  unidades: Array<{ id: string; nome: string }>;   // só as permitidas ao usuário
  tenantId: string;
};

/** JSON Schema (subconjunto) usado nos params das consultas/ações. */
export type JSONSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type Params = Record<string, unknown>;

export type DefConsulta = {
  id: string;
  modulo: string;
  descricao: string;
  permissao: string | null;
  params: JSONSchema;
  executar(ctx: CtxClock, params: Params): Promise<unknown>;
};

export type Risco = "baixo" | "medio" | "alto";

export type DefAcao = {
  id: string;
  modulo: string;
  descricao: string;
  permissao: string;
  risco: Risco;
  params: JSONSchema;
  /** Frase de confirmação com o impacto ("Vou ... Isso ... Confirma?"). Pode lançar ErroClock. */
  resumir(ctx: CtxClock, params: Params): Promise<string>;
  executar(ctx: CtxClock, params: Params): Promise<unknown>;
};

export type DefRota = {
  href: string;
  rotulo: string;
  permissao: string | null;
  abas?: string[];
  /** Nome do parâmetro de aba na URL (padrão "aba"; /configuracoes lê "tab"). */
  paramAba?: string;
  /**
   * Filtros que a tela REALMENTE lê da URL. abrir_tela só grava estes;
   * o resto volta como aviso para o CLOCK não dizer que filtrou.
   */
  filtros?: {
    /** Parâmetro com o id da unidade (ex.: "unidade", "unidadeA"). */
    unidade?: string;
    /** Parâmetro do período e os valores que a tela aceita. */
    periodo?: { param: string; valores: readonly string[] };
  };
};

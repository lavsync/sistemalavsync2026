// LavSync · Cadastros · Server queries de cada bloco
import "server-only";
import { createClient } from "@/lib/supabase/server";

async function safe<T>(p: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  try {
    const { data, error } = await p;
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

// ─── Categorias Financeiras ─────────────────────────────────────────────
export type CategoriaFinanceira = {
  id: string;
  nome: string;
  tipo: "receita" | "despesa" | "ambos";
  cor: string | null;
  icone: string | null;
  descricao: string | null;
  ativa: boolean;
  ordem: number;
};

export async function listarCategoriasFinanceiras() {
  const supabase = await createClient();
  return safe<CategoriaFinanceira>(
    supabase.from("categorias_financeiras").select("*").order("ordem").order("nome")
  );
}

// ─── Fornecedores ──────────────────────────────────────────────────────
export type Fornecedor = {
  id: string;
  nome: string;
  razao_social: string | null;
  cnpj_cpf: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  endereco: string | null;
  contato_nome: string | null;
  servico_fornecido: string | null;
  observacoes: string | null;
  ativo: boolean;
};

export async function listarFornecedores() {
  const supabase = await createClient();
  return safe<Fornecedor>(
    supabase.from("fornecedores").select("*").order("ativo", { ascending: false }).order("nome")
  );
}

// ─── Despesas ──────────────────────────────────────────────────────────
export type Despesa = {
  id: string;
  unidade_id: string | null;
  categoria_id: string | null;
  fornecedor_id: string | null;
  descricao: string;
  valor: number;
  vencimento: string;
  pago_em: string | null;
  periodicidade: string;
  status: "aberta" | "paga" | "vencida" | "cancelada";
  numero_documento: string | null;
  observacoes: string | null;
};

export async function listarDespesas() {
  const supabase = await createClient();
  return safe<Despesa>(
    supabase.from("despesas").select("*").order("vencimento", { ascending: false })
  );
}

// ─── Serviços ──────────────────────────────────────────────────────────
export type Servico = {
  id: string;
  nome: string;
  tipo: string;
  preco: number;
  duracao_minutos: number | null;
  descricao: string | null;
  cor: string | null;
  ativo: boolean;
  ordem: number;
};

export async function listarServicos() {
  const supabase = await createClient();
  return safe<Servico>(
    supabase.from("servicos").select("*").order("ordem").order("nome")
  );
}

// ─── Planos ────────────────────────────────────────────────────────────
export type Plano = {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  preco_avulso_referencia: number | null;
  desconto_percentual: number | null;
  servicos_inclusos: string[];
  cor: string | null;
  ativo: boolean;
  destaque: boolean;
  ordem: number;
};

export async function listarPlanos() {
  const supabase = await createClient();
  return safe<Plano>(
    supabase.from("planos").select("*").order("ordem").order("nome")
  );
}

// ─── Campanhas ─────────────────────────────────────────────────────────
export type Campanha = {
  id: string;
  nome: string;
  codigo_cupom: string | null;
  descricao: string | null;
  tipo_desconto: "percentual" | "valor_fixo" | "cortesia";
  valor_desconto: number;
  inicio_em: string;
  fim_em: string | null;
  max_usos: number | null;
  max_usos_por_cliente: number | null;
  total_usos: number;
  status: "rascunho" | "ativa" | "pausada" | "encerrada";
  observacoes: string | null;
};

export async function listarCampanhas() {
  const supabase = await createClient();
  return safe<Campanha>(
    supabase.from("campanhas").select("*").order("inicio_em", { ascending: false })
  );
}

// ─── Parceiros ─────────────────────────────────────────────────────────
export type Parceiro = {
  id: string;
  nome: string;
  tipo: string;
  cnpj_cpf: string | null;
  responsavel_nome: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  endereco: string | null;
  comissao_percentual: number | null;
  acordo_descricao: string | null;
  inicio_parceria: string | null;
  fim_parceria: string | null;
  observacoes: string | null;
  ativo: boolean;
};

export async function listarParceiros() {
  const supabase = await createClient();
  return safe<Parceiro>(
    supabase.from("parceiros").select("*").order("ativo", { ascending: false }).order("nome")
  );
}

// ─── Unidades (cadastro completo) ──────────────────────────────────────
export type UnidadeCompleta = {
  id: string;
  tenant_id: string;
  nome: string;
  codigo_interno: string | null;
  razao_social: string | null;
  cnpj: string | null;
  inscricao_estadual: string | null;
  endereco_cep: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  gestor_nome: string | null;
  gestor_telefone: string | null;
  status: string | null;
  ativa: boolean;
  data_inauguracao: string | null;
  foto_url: string | null;
  meta_faturamento_mensal: number | null;
  observacoes: string | null;
};

export async function listarUnidadesCompletas() {
  const supabase = await createClient();
  return safe<UnidadeCompleta>(
    supabase.from("unidades").select("*").order("nome")
  );
}

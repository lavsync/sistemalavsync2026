// LavSync · Financeiro · Montagem do relatório DRE (PDF) — server
// Usado pela rota de visualização, pela action de salvar e pelo CLOCK.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { carregarDadosDRE } from "./dre-dados";
import {
  calcularDREPeriodo, periodoAnterior, serieMensal, mesesAte,
  type Periodo, type TipoPeriodo, type DREPeriodoResultado, type DadosDREUnidade,
} from "./dre-periodo";
import { analisarDRE } from "./dre-analise";
import { gerarDREPdf, type ProjetadoPdf } from "./pdf/dre-pdf";
import { getProjecaoAtiva } from "./projecao/queries";
import { montarComparativo } from "./projecao/comparativo";
import { nowBR } from "@/lib/timezone-br";

export const BUCKET_DRE = "dre-relatorios";
export const ESCOPO_CONSOLIDADO = "consolidado";

const TIPOS: TipoPeriodo[] = ["mensal", "trimestral", "semestral", "anual"];
const MAX_NUM: Record<TipoPeriodo, number> = { mensal: 12, trimestral: 4, semestral: 2, anual: 1 };

/** Valida e normaliza o período vindo de URL/form/ferramenta. */
export function lerPeriodo(tipo: unknown, ano: unknown, numero: unknown): Periodo | null {
  const t = String(tipo) as TipoPeriodo;
  const a = Number(ano), n = t === "anual" ? 1 : Number(numero);
  if (!TIPOS.includes(t) || !Number.isInteger(a) || a < 2020 || a > 2100) return null;
  if (!Number.isInteger(n) || n < 1 || n > MAX_NUM[t]) return null;
  return { tipo: t, ano: a, numero: n };
}

/** Unidades do escopo: "consolidado" = todas que o client enxerga; senão o id. */
async function resolverEscopo(sb: SupabaseClient, escopo: string): Promise<{ ids: string[]; nomes: string[]; rotulo: string; slug: string } | null> {
  const { data } = await sb.from("unidades").select("id, nome").order("nome");
  const todas = (data ?? []) as Array<{ id: string; nome: string }>;
  if (escopo === ESCOPO_CONSOLIDADO) {
    if (todas.length === 0) return null;
    return { ids: todas.map((u) => u.id), nomes: todas.map((u) => u.nome),
      rotulo: `Consolidado · ${todas.map((u) => u.nome).join(", ")}`, slug: "Consolidado" };
  }
  const u = todas.find((x) => x.id === escopo);
  if (!u) return null;
  return { ids: [u.id], nomes: [u.nome], rotulo: `Unidade ${u.nome}`, slug: slugify(u.nome) };
}

export function slugify(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export type DREMontado = {
  atual: DREPeriodoResultado;
  anterior: DREPeriodoResultado;
  escopoRotulo: string;
  escopoSlug: string;
};

/** Só os números (tela e CLOCK). */
export async function montarDRE(sb: SupabaseClient, escopo: string, periodo: Periodo): Promise<DREMontado | null> {
  const esc = await resolverEscopo(sb, escopo);
  if (!esc) return null;
  const dados = await carregarDadosDRE(sb, esc.ids);
  return {
    atual: calcularDREPeriodo(dados, periodo),
    anterior: calcularDREPeriodo(dados, periodoAnterior(periodo)),
    escopoRotulo: esc.rotulo,
    escopoSlug: esc.slug,
  };
}

/**
 * Projetado da franqueadora × real nos meses FECHADOS do período (mesmo
 * comparativo da aba Projetado × Real). Só entra quando TODAS as unidades do
 * escopo têm projeção ativa (mesma regra do Painel). Qualquer falha (ex.:
 * migration 0052 ainda não aplicada) = PDF sem o bloco, nunca PDF quebrado.
 */
async function projetadoDoPeriodo(sb: SupabaseClient, dados: DadosDREUnidade[], meses: string[]): Promise<ProjetadoPdf | null> {
  try {
    if (dados.length === 0) return null;
    const projecoes = await Promise.all(dados.map((d) => getProjecaoAtiva(sb, d.unidade_id)));
    if (projecoes.some((p) => p == null)) return null;
    const h = nowBR();
    const c = montarComparativo(dados.length === 1 ? dados[0].unidade_id : "consolidado",
      projecoes.map((projecao, i) => ({ projecao: projecao!, dados: dados[i] })), { ano: h.ano, mes: h.mes });
    if (!c) return null;
    const noPeriodo = new Set(meses);
    const ms = c.meses.filter((m) => m.real && noPeriodo.has(m.chave_mes));
    if (ms.length === 0) return null;
    const soma = (f: (m: (typeof ms)[number]) => number) => ms.reduce((s, m) => s + f(m), 0);
    return {
      nome: projecoes.length === 1 ? projecoes[0]!.nome : "Projeções da franqueadora",
      meses: ms.length,
      fat_proj: soma((m) => m.projetado.faturamento), fat_real: soma((m) => m.real!.faturamento),
      res_proj: soma((m) => m.projetado.resultado), res_real: soma((m) => m.real!.resultado),
      estimado: ms.some((m) => m.real!.estimado),
    };
  } catch (e) {
    console.error("[dre-pdf] projetado:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** PDF completo + nome de arquivo sugerido. */
export async function montarDREPdf(sb: SupabaseClient, escopo: string, periodo: Periodo, geradoPor: string): Promise<{ pdf: Buffer; arquivo: string; titulo: string } | null> {
  const esc = await resolverEscopo(sb, escopo);
  if (!esc) return null;
  const dados = await carregarDadosDRE(sb, esc.ids);
  const atual = calcularDREPeriodo(dados, periodo);
  const anterior = calcularDREPeriodo(dados, periodoAnterior(periodo));
  const projetado = await projetadoDoPeriodo(sb, dados, atual.meses);
  const agora = new Date();
  const geradoEm = agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const pdf = await gerarDREPdf({
    atual, anterior,
    tendencia: serieMensal(dados, mesesAte(atual.meses[atual.meses.length - 1], 12)),
    destaques: analisarDRE(atual, anterior.meses_com_dados.length > 0 ? anterior : null),
    escopo: esc.rotulo, geradoPor, geradoEm, projetado,
  });
  const carimbo = new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const arquivo = `DRE_${esc.slug}_${periodo.tipo}_${periodo.ano}-${String(periodo.numero).padStart(2, "0")}__${carimbo}__${slugify(geradoPor) || "usuario"}.pdf`;
  return { pdf, arquivo, titulo: `DRE ${atual.titulo} · ${esc.rotulo}` };
}

/** Nome de quem gera, para o cabeçalho do PDF. */
export async function nomeDoUsuario(sb: SupabaseClient, userId: string, email?: string | null): Promise<string> {
  const { data } = await sb.from("usuarios").select("nome").eq("id", userId).maybeSingle();
  return (data as { nome?: string } | null)?.nome ?? email ?? "LavSync";
}

/** Metadados a partir do nome do arquivo salvo. */
export type RelatorioSalvo = {
  path: string; arquivo: string; escopo: string; tipo: TipoPeriodo; ano: number; numero: number;
  gerado_em: string; gerado_por: string; tamanho: number | null;
};

export function lerNomeArquivo(path: string, tamanho: number | null): RelatorioSalvo | null {
  const arquivo = path.split("/").pop() ?? path;
  const m = arquivo.match(/^DRE_(.+?)_(mensal|trimestral|semestral|anual)_(\d{4})-(\d{2})__(\d{12})__(.*)\.pdf$/);
  if (!m) return null;
  const c = m[5];
  return {
    path, arquivo, escopo: m[1].replace(/-/g, " "), tipo: m[2] as TipoPeriodo, ano: Number(m[3]), numero: Number(m[4]),
    gerado_em: `${c.slice(6, 8)}/${c.slice(4, 6)}/${c.slice(0, 4)} ${c.slice(8, 10)}:${c.slice(10, 12)}`,
    gerado_por: m[6].replace(/-/g, " "), tamanho,
  };
}

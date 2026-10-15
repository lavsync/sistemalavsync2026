// LavSync · Financeiro · Painel Geral inteligente — tipos compartilhados
//
// Contrato entre o loader do servidor (carregar-painel.ts), o motor de
// insights (painel-insights.ts, puro) e os componentes do painel. Tudo
// serializável (vai do Server Component para o cliente como prop).
// Valores monetários em R$; percentuais em pontos (12,5 = 12,5%).

export type EscopoPainel =
  | { tipo: "unidade"; unidade_id: string; rotulo: string }
  | { tipo: "consolidado"; unidade_id: null; rotulo: string };

/** Totais do DRE de um mês (motor único: calcularDREPeriodo). */
export type TotaisMesPainel = {
  mes: string;               // "AAAA-MM"
  tem: boolean;              // há faturamento real no mês
  faturamento: number;
  simples: number;
  csp: number;
  royalties: number;
  fixos: number;
  variaveis: number;
  despesas: number;          // royalties + fixos + variáveis
  resultado: number;
  margem: number | null;     // % s/ faturamento (null sem faturamento)
};

/** Um mês da série de 12 meses (evolução + sparklines). */
export type MesSeriePainel = {
  mes: string;               // "AAAA-MM"
  rotulo: string;            // "out/26"
  tem: boolean;
  faturamento: number;
  resultado: number;
  margem: number | null;
  despesas_pct: number | null;          // despesas operacionais / faturamento
  ponto_equilibrio: number | null;      // faturamento necessário para resultado 0
  ciclos: number | null;                // vendas (null = sem vendas no mês)
  ticket_ciclo: number | null;          // faturamento das vendas / ciclos
  projetado_faturamento: number | null; // franqueadora (null sem projeção)
  projetado_resultado: number | null;
};

/** Linha de custo do mês (para donut, cascata e drill). */
export type LinhaCustoPainel = {
  chave: string;             // chave da linha no DRE (ex.: "fixo:Aluguel")
  descricao: string;
  grupo: "simples" | "csp" | "royalties" | "fixo" | "variavel";
  valor: number;             // positivo
  anterior: number | null;   // mesmo item no mês anterior (null = não existia)
  origem: "real" | "parcial" | "estimado" | "calculado";
};

export type DiaPainel = {
  dia: number;               // 1..31
  data: string;              // "AAAA-MM-DD"
  dow: number;               // 0 = domingo
  faturamento: number;
  ciclos: number;
  futuro: boolean;           // dia ainda não chegou (mês corrente)
  parcial: boolean;          // hoje (mês corrente): dia em andamento, fora de média e comparações
};

export type DiaSemanaPainel = {
  dow: number;
  rotulo: string;            // "Seg"
  total: number;
  ocorrencias: number;       // quantos desses dias já passaram no mês
  media: number;             // total / ocorrências
};

export type MixPainel = {
  lavagem: { ciclos: number; faturamento: number };
  secagem: { ciclos: number; faturamento: number };
  /** Vendas sem tipo de serviço (tipo_servico 'indefinido' ou vazio): fora do mix. */
  indefinido: { ciclos: number; faturamento: number };
  combo_rateado: boolean;    // houve venda "combo" rateada 50/50
};

export type UnidadeComparativo = {
  unidade_id: string;
  nome: string;
  tem: boolean;
  faturamento: number;
  resultado: number;
  margem: number | null;
  ponto_equilibrio: number | null;
  pct_equilibrio: number | null;   // faturamento / ponto de equilíbrio × 100
};

export type CiclosPainel = {
  total: number;
  lavagem: number;
  secagem: number;
  indefinido: number;               // ciclos sem tipo de serviço (total = lav + sec + indefinido)
  faturamento_vendas: number;
  ticket_ciclo: number | null;
  /** Insumos por ciclo (margem-engine) — null sem engenharia de custos cadastrada. */
  custo_ciclo: number | null;
  mc_ciclo: number | null;          // margem de contribuição por ciclo
  mc_pct: number | null;
  unidades_sem_engenharia: string[];
};

export type PaybackPainel = {
  investimento: number;
  acumulado: number;          // resultado real somado até o mês filtrado (só meses fechados)
  pct: number;                // % recuperado
  falta: number;
  ritmo_3m: number | null;    // média do resultado dos últimos 3 meses fechados
  meses_ritmo: number;        // quantos meses entraram na média
  meses_restantes: number | null;
  mes_estimado: string | null;      // "AAAA-MM" no ritmo atual
  projetado_mes: string | null;     // "AAAA-MM" pela projeção da franqueadora
};

export type QualidadePainel = {
  total: number;              // custos do mês sujeitos a lançamento (CSP + fixos + variáveis)
  pago: number;
  parcial: number;
  estimado: number;
  pct_pago: number;           // pago / total × 100
  linhas_estimadas: string[]; // descrições ainda estimadas
};

export type ProjecaoFechamento = {
  dias_decorridos: number;
  dias_mes: number;
  ritmo_diario: number;
  faturamento_previsto: number;
};

export type PainelDados = {
  mes: string;                  // mês filtrado "AAAA-MM"
  titulo: string;               // "Outubro de 2026"
  mes_atual: string;            // mês corrente BR
  ultimo_fechado: string;       // mês anterior ao corrente
  hoje: string;                 // "AAAA-MM-DD" BR
  mes_corrente: boolean;        // o mês filtrado é o corrente (em aberto)
  primeiro_mes: string | null;  // mês de inauguração mais antigo do escopo
  escopo: EscopoPainel;
  unidades: Array<{ id: string; nome: string }>;

  atual: TotaisMesPainel;
  anterior: TotaisMesPainel;
  ano_anterior: TotaisMesPainel;

  linhas: LinhaCustoPainel[];
  serie: MesSeriePainel[];      // 12 meses terminando no mês filtrado

  ponto_equilibrio: number | null;   // do mês filtrado
  ciclos: CiclosPainel | null;       // null = sem vendas no mês
  ciclos_anterior: { total: number; ticket_ciclo: number | null } | null;
  payback: PaybackPainel;
  qualidade: QualidadePainel;

  dias: DiaPainel[];
  dias_semana: DiaSemanaPainel[];
  mix: MixPainel | null;

  projetado: { faturamento: number; resultado: number } | null;   // mês filtrado
  projecao_nome: string | null;
  comparativo: UnidadeComparativo[] | null;   // só no consolidado
  fechamento: ProjecaoFechamento | null;      // só no mês corrente
};

export type TomInsight = "positivo" | "negativo" | "neutro";

export type InsightPainel = {
  id: string;
  tom: TomInsight;
  titulo: string;
  texto: string;                 // frase com número e base de comparação
  acao?: { rotulo: string; href: string };
  peso: number;                  // ordenação (maior = mais importante)
};

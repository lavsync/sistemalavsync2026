// LavSync · CLOCK Relacionamento · Catálogo de variáveis de template
//
// Padrão {{snake_case}} (alinhado ao MaxLav) + compat retroativa com o
// padrão antigo {nome}, {primeiro_nome}, {cpf}, {ultima_compra}.
// Doc: docs/CLOCK-RELACIONAMENTO.md §5.

export type CategoriaVar = "autoatendimento" | "maxcontrole" | "campanha" | "clock";

export type VariavelDef = {
  chave: string;          // sem chaves, ex: "nome_cliente"
  rotulo: string;
  descricao: string;
  categorias: CategoriaVar[];
  exemplo: string;        // valor fictício p/ pré-visualização
};

export const VARIAVEIS: VariavelDef[] = [
  // — base / autoatendimento (espelha MaxLav) —
  { chave: "nome_cliente", rotulo: "Nome do cliente", descricao: "Nome completo", categorias: ["autoatendimento", "maxcontrole", "campanha"], exemplo: "Maria Silva" },
  { chave: "telefone_cliente", rotulo: "Telefone", descricao: "Telefone do cliente", categorias: ["autoatendimento", "campanha"], exemplo: "(31) 99999-0000" },
  { chave: "apelido_loja", rotulo: "Nome da loja", descricao: "Apelido da unidade", categorias: ["autoatendimento", "maxcontrole", "campanha", "clock"], exemplo: "Xô Varal Buritis" },
  { chave: "tipo_ciclo", rotulo: "Tipo do ciclo", descricao: "lavagem ou secagem", categorias: ["autoatendimento"], exemplo: "lavagem" },
  { chave: "id_maquina", rotulo: "ID da máquina", descricao: "Identificador da máquina", categorias: ["autoatendimento", "maxcontrole"], exemplo: "L03" },
  { chave: "valor_compra", rotulo: "Valor da compra", descricao: "Valor pago na compra", categorias: ["autoatendimento"], exemplo: "R$ 33,90" },
  { chave: "minutos_aviso", rotulo: "Minutos de aviso", descricao: "Antecedência do aviso", categorias: ["autoatendimento"], exemplo: "5" },
  { chave: "minutos_restantes", rotulo: "Minutos restantes", descricao: "Tempo restante do ciclo", categorias: ["autoatendimento"], exemplo: "8" },
  { chave: "cupom_percentual", rotulo: "Percentual do cupom", descricao: "Desconto do cupom", categorias: ["autoatendimento", "campanha"], exemplo: "20%" },
  { chave: "cupom_codigo", rotulo: "Código do cupom", descricao: "Código a informar no caixa", categorias: ["autoatendimento", "campanha"], exemplo: "VOLTA20" },
  { chave: "cupom_validade", rotulo: "Validade do cupom", descricao: "Data limite", categorias: ["autoatendimento", "campanha"], exemplo: "30/06/2026" },
  { chave: "valor_cashback", rotulo: "Cashback ganho", descricao: "Cashback desta compra", categorias: ["autoatendimento"], exemplo: "R$ 3,40" },
  { chave: "saldo_cashback", rotulo: "Saldo de cashback", descricao: "Cashback acumulado", categorias: ["autoatendimento"], exemplo: "R$ 12,80" },
  { chave: "quantidade_vendas", rotulo: "Qtde de vendas", descricao: "Vendas no resumo", categorias: ["autoatendimento"], exemplo: "47" },
  { chave: "total_vendas", rotulo: "Total em R$", descricao: "Faturamento no resumo", categorias: ["autoatendimento"], exemplo: "R$ 1.594,00" },
  { chave: "valor_recarga", rotulo: "Valor da recarga", descricao: "Recarga feita", categorias: ["autoatendimento"], exemplo: "R$ 50,00" },
  { chave: "saldo_atual", rotulo: "Saldo atual", descricao: "Saldo do cliente", categorias: ["autoatendimento"], exemplo: "R$ 65,00" },

  // — exclusivos CLOCK (vão além do MaxLav) —
  { chave: "primeiro_nome", rotulo: "Primeiro nome", descricao: "Só o primeiro nome", categorias: ["clock", "campanha"], exemplo: "Maria" },
  { chave: "dias_desde_ultima", rotulo: "Dias desde a última compra", descricao: "Recência individual", categorias: ["clock", "campanha"], exemplo: "34" },
  { chave: "ciclo_medio_dias", rotulo: "Ciclo médio de retorno", descricao: "Frequência típica do cliente", categorias: ["clock"], exemplo: "21" },
  { chave: "segmento_rfm", rotulo: "Segmento RFM", descricao: "Campeão, fiel, em risco...", categorias: ["clock"], exemplo: "Em risco" },
  { chave: "nivel_clube", rotulo: "Nível no Clube", descricao: "Bronze/Prata/Ouro/Diamante", categorias: ["clock"], exemplo: "Prata" },
  { chave: "saldo_xc", rotulo: "Saldo XÔ Club", descricao: "Pontos XC acumulados", categorias: ["clock"], exemplo: "320" },
  { chave: "melhor_horario", rotulo: "Melhor horário", descricao: "Horário com maior chance de retorno", categorias: ["clock"], exemplo: "19h" },
];

/** Mapa exemplo -> usado na pré-visualização com dados fictícios (regra MaxLav). */
export const EXEMPLOS_FICTICIOS: Record<string, string> = Object.fromEntries(
  VARIAVEIS.map((v) => [v.chave, v.exemplo]),
);

export function variaveisPorCategoria(cat: CategoriaVar): VariavelDef[] {
  return VARIAVEIS.filter((v) => v.categorias.includes(cat));
}

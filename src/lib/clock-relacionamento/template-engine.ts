// LavSync · CLOCK Relacionamento · Motor de templates
//
// Renderiza {{snake_case}} (e compat {chave} antiga), injeta o bloco de
// opt-out e gera pré-visualização com dados fictícios.
// Doc: docs/CLOCK-RELACIONAMENTO.md §5, §10.
import { EXEMPLOS_FICTICIOS } from "./variaveis";

export type DadosTemplate = Record<string, string | number | null | undefined>;

// Bloco de opt-out injetado pelo BACKEND — nunca editável pelo dono (regra MaxLav).
// 'promo' recebe as duas opções; 'operacional' não leva rodapé promocional.
const OPTOUT_PROMO =
  "\n\n_Para parar de receber promoções, responda SAIRPROMO. Para cancelar todas as mensagens, responda SAIR._";

/**
 * Substitui as variáveis no corpo do template.
 * Aceita {{variavel}} (padrão novo) e {variavel} (compat com campanhas antigas).
 * Tokens sem valor viram string vazia (nunca deixa "{{x}}" cru pro cliente).
 */
export function renderizarTemplate(corpo: string, dados: DadosTemplate): string {
  const valor = (chave: string): string => {
    const v = dados[chave];
    if (v === null || v === undefined) {
      // compat: {primeiro_nome} cai pra 1ª palavra de {nome_cliente}/{nome}
      if (chave === "primeiro_nome") {
        const nome = (dados.nome_cliente ?? dados.nome) as string | undefined;
        if (nome) return nome.split(" ")[0];
      }
      return "";
    }
    return String(v);
  };
  return corpo
    .replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, k) => valor(String(k).toLowerCase()))
    .replace(/\{\s*([a-z0-9_]+)\s*\}/gi, (_m, k) => valor(String(k).toLowerCase()));
}

/** Anexa o bloco de opt-out conforme o escopo do template. */
export function comOptOut(corpo: string, escopo: "promo" | "operacional"): string {
  if (escopo !== "promo") return corpo;
  if (/\bSAIR\b/i.test(corpo)) return corpo; // já tem instrução, não duplica
  return corpo + OPTOUT_PROMO;
}

/** Render final para fila: variáveis + opt-out. */
export function renderizarParaEnvio(
  corpo: string,
  dados: DadosTemplate,
  escopo: "promo" | "operacional",
): string {
  return comOptOut(renderizarTemplate(corpo, dados), escopo);
}

/** Pré-visualização com valores fictícios (nunca dados reais — regra MaxLav §8). */
export function previewTemplate(corpo: string, escopo: "promo" | "operacional" = "promo"): string {
  return renderizarParaEnvio(corpo, EXEMPLOS_FICTICIOS, escopo);
}

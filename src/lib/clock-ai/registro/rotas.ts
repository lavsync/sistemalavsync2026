// LavSync · CLOCK v2 · Registro · Rotas navegáveis (abrir_tela)
//
// Whitelist do que o CLOCK pode abrir, com a permissão exigida e as abas
// aceitas em ?aba= (confirmadas nos views: financeiro-view, marketing-view,
// manutencao-view, tarefas-view, rotinas-view). /configuracoes usa ?tab=.
// `filtros` lista só o que a page.tsx de cada tela lê de searchParams
// (conferido em src/app/**/page.tsx). Só telas: rota de API (ex.: o PDF do
// DRE) derrubaria o app numa navegação de documento inteiro.
// Ordem FIXA: o enum gerado daqui entra no prefixo cacheado do modelo.
import type { DefRota } from "./tipos";

/** Valores de ?periodo= da Visão Geral (src/app/page.tsx, sem "custom"). */
const PERIODOS_VISAO_GERAL = ["hoje", "ontem", "7d", "30d", "mes", "90d", "ano"] as const;
/** Valores de ?periodoA= do Comparativo (src/app/comparativo/page.tsx, sem "custom"). */
const PERIODOS_COMPARATIVO = ["hoje", "ontem", "7d", "30d", "mes", "mes_anterior", "90d", "ano", "ano_anterior"] as const;

export const ROTAS: DefRota[] = [
  // Núcleo
  { href: "/", rotulo: "Visão Geral", permissao: "dashboard.view", filtros: { unidade: "unidade", periodo: { param: "periodo", valores: PERIODOS_VISAO_GERAL } } },
  { href: "/painel-ao-vivo", rotulo: "Painel ao Vivo", permissao: "painel_vivo.view" },
  { href: "/manutencao", rotulo: "Máquinas e Manutenção", permissao: "manutencao.view", abas: ["maquinas", "ordens"] },
  { href: "/cadastros", rotulo: "Cadastros", permissao: "cadastros.view" },
  { href: "/cadastros/unidades", rotulo: "Cadastro de Unidades", permissao: "cadastros.view" },
  { href: "/cadastros/categorias-financeiras", rotulo: "Categorias Financeiras", permissao: "cadastros.view" },
  { href: "/cadastros/fornecedores", rotulo: "Fornecedores", permissao: "cadastros.view" },
  { href: "/cadastros/despesas", rotulo: "Cadastro de Despesas", permissao: "cadastros.view" },
  { href: "/cadastros/servicos", rotulo: "Serviços", permissao: "cadastros.view" },
  { href: "/cadastros/planos", rotulo: "Planos", permissao: "cadastros.view" },
  { href: "/cadastros/campanhas", rotulo: "Cadastro de Campanhas", permissao: "cadastros.view" },
  { href: "/cadastros/parceiros", rotulo: "Parceiros", permissao: "cadastros.view" },
  { href: "/cadastros/importacoes", rotulo: "Importações", permissao: "cadastros.importacoes.view" },

  // Operacional
  { href: "/financeiro", rotulo: "Financeiro", permissao: "financeiro.view", abas: ["painel", "invest", "dre", "relatorios", "config"], filtros: { unidade: "unidade" } },
  { href: "/clientes", rotulo: "Clientes", permissao: "clientes.view" },
  { href: "/publicidade", rotulo: "Marketing", permissao: "marketing.view", abas: ["campanhas", "clube", "xoclub", "cupons"] },
  { href: "/publicidade/fidelidade", rotulo: "Fidelidade · Relatório", permissao: "marketing.clube.view" },
  { href: "/publicidade/midia-indoor", rotulo: "Mídia Indoor", permissao: "midia_indoor.view" },
  { href: "/publicidade/midia-indoor/campanhas", rotulo: "Mídia Indoor · Campanhas", permissao: "midia_indoor.view" },
  { href: "/publicidade/midia-indoor/metricas", rotulo: "Mídia Indoor · Métricas", permissao: "midia_indoor.view" },
  { href: "/publicidade/midia-indoor/parceiros", rotulo: "Mídia Indoor · Parceiros", permissao: "midia_indoor.view" },
  { href: "/publicidade/midia-indoor/leads", rotulo: "Mídia Indoor · Leads", permissao: "midia_indoor.view" },
  { href: "/publicidade/midia-indoor/ofertas", rotulo: "Mídia Indoor · Ofertas", permissao: "midia_indoor.view" },
  { href: "/publicidade/midia-indoor/templates", rotulo: "Mídia Indoor · Templates", permissao: "midia_indoor.view" },
  { href: "/publicidade/midia-indoor/qr-codes", rotulo: "Mídia Indoor · QR Codes", permissao: "midia_indoor.view" },
  { href: "/publicidade/midia-indoor/clube", rotulo: "Mídia Indoor · Clube", permissao: "midia_indoor.view" },
  { href: "/publicidade/midia-indoor/unidades", rotulo: "Mídia Indoor · TVs", permissao: "midia_indoor.view" },
  { href: "/tarefas", rotulo: "Tarefas", permissao: "tarefas.view", abas: ["kanban", "lista", "calendario", "gantt", "observador"] },
  { href: "/rotinas-corporativas", rotulo: "Rotinas Corporativas", permissao: "rotinas.view", abas: ["hoje", "dashboard", "organograma", "biblioteca", "rotinas"] },
  { href: "/agenda", rotulo: "Agenda", permissao: "agenda.view" },
  { href: "/suporte", rotulo: "Suporte", permissao: "suporte.view" },

  // Inteligência
  { href: "/metas", rotulo: "Metas", permissao: "metas.view", filtros: { unidade: "unidade" } },
  { href: "/metricas", rotulo: "Analytics", permissao: "dashboard.view" },
  { href: "/performance", rotulo: "Performance", permissao: "performance.view", filtros: { unidade: "unidade" } },
  { href: "/comparativo", rotulo: "Comparativo", permissao: "comparativo.view", filtros: { unidade: "unidadeA", periodo: { param: "periodoA", valores: PERIODOS_COMPARATIVO } } },
  { href: "/dados", rotulo: "Dados e Exportações", permissao: "dados.exportar" },
  { href: "/clock", rotulo: "IA e Insights", permissao: "clock.usar" },

  // Sistema
  { href: "/integracoes", rotulo: "Automações", permissao: "integracoes.view" },
  { href: "/integracoes/stone", rotulo: "Stone Open Banking", permissao: "integracoes.view" },
  { href: "/integracoes/whatsapp", rotulo: "WhatsApp Cloud API", permissao: "integracoes.view" },
  { href: "/configuracoes", rotulo: "Configurações", permissao: "configuracoes.view", abas: ["perfil", "usuarios", "permissoes"], paramAba: "tab" },
];

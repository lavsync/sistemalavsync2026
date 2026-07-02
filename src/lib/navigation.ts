// LavSync — navigation map (Sidebar Gradiente Dinâmico v2)
// Sem ícones renderizados. Hierarquia 100% tipográfica.
// As rotas existentes ficam preservadas; os labels seguem o novo padrão executivo.

export type NavItem = {
  label: string;
  href: string;
  group: "core" | "operacional" | "inteligencia" | "sistema";
  badge?: string;
  accent?: boolean;
};

export const NAVIGATION: NavItem[] = [
  // CORE
  { label: "Visão Geral", href: "/", group: "core" },
  { label: "Cadastros", href: "/cadastros", group: "core" },
  { label: "Máquinas", href: "/manutencao", group: "core", badge: "3" },

  // OPERACIONAL
  { label: "Painel ao Vivo", href: "/painel-ao-vivo", group: "operacional", badge: "LIVE", accent: true },
  { label: "Financeiro", href: "/financeiro", group: "operacional" },
  { label: "Clientes", href: "/clientes", group: "operacional" },
  { label: "Marketing", href: "/publicidade", group: "operacional" },
  { label: "Mídia Indoor", href: "/publicidade/midia-indoor", group: "operacional", badge: "NOVO", accent: true },
  { label: "Tarefas", href: "/tarefas", group: "operacional" },
  { label: "Rotinas Corporativas", href: "/rotinas-corporativas", group: "operacional" },
  { label: "Agenda", href: "/agenda", group: "operacional" },

  // INTELIGÊNCIA
  { label: "Metas", href: "/metas", group: "inteligencia" },
  { label: "Analytics", href: "/metricas", group: "inteligencia" },
  { label: "Performance", href: "/performance", group: "inteligencia" },
  { label: "Comparativo", href: "/comparativo", group: "inteligencia" },
  { label: "Importações", href: "/cadastros/importacoes", group: "inteligencia" },
  { label: "IA & Insights", href: "/clock", group: "inteligencia", accent: true },

  // SISTEMA
  { label: "Automações", href: "/integracoes", group: "sistema" },
  { label: "Stone Open Banking", href: "/integracoes/stone", group: "sistema", badge: "NOVO", accent: true },
  { label: "WhatsApp Cloud API", href: "/integracoes/whatsapp", group: "sistema", badge: "NOVO", accent: true },
  { label: "Configurações", href: "/configuracoes", group: "sistema" },
];

export const NAV_GROUPS: { key: NavItem["group"]; label: string }[] = [
  { key: "core", label: "Núcleo" },
  { key: "operacional", label: "Operacional" },
  { key: "inteligencia", label: "Inteligência" },
  { key: "sistema", label: "Sistema" },
];

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
  { label: "Agenda", href: "/agenda", group: "operacional" },

  // INTELIGÊNCIA
  { label: "Analytics", href: "/metricas", group: "inteligencia" },
  { label: "Performance", href: "/performance", group: "inteligencia" },
  { label: "Comparativo", href: "/comparativo", group: "inteligencia" },
  { label: "Importações", href: "/cadastros/importacoes", group: "inteligencia" },
  { label: "IA & Insights", href: "/clock", group: "inteligencia", accent: true },

  // SISTEMA
  { label: "Automações", href: "/integracoes", group: "sistema" },
  { label: "Configurações", href: "/configuracoes", group: "sistema" },
];

export const NAV_GROUPS: { key: NavItem["group"]; label: string }[] = [
  { key: "core", label: "Núcleo" },
  { key: "operacional", label: "Operacional" },
  { key: "inteligencia", label: "Inteligência" },
  { key: "sistema", label: "Sistema" },
];

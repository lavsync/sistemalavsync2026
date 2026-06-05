// LavSync · Dados centralizados pra páginas legais.
// Edite aqui pra atualizar CNPJ, DPO, versão dos documentos etc.

export const LEGAL_CONFIG = {
  empresa: {
    nomeFantasia: "LavSync",
    razaoSocial: "LavSync Tecnologia",
    cnpj: "CNPJ a definir",
    endereco: "Endereço a definir",
    site: "https://www.lavsync.com.br",
    sistema: "https://sistema.lavsync.com.br",
    email: "contato@lavsync.com.br",
  },
  dpo: {
    nome: "Encarregado de Proteção de Dados (DPO) — LavSync",
    email: "dpo@lavsync.com.br",
    horario: "Segunda a sexta, 9h às 18h (horário de Brasília)",
    prazoResposta: "15 dias corridos (Art. 19 LGPD)",
  },
  versoes: {
    termosUso:           "1.0",
    politicaPrivacidade: "1.0",
    politicaCookies:     "1.0",
    vigenteDesde:        "2026-06-05",
  },
} as const;

export const LEGAL_LINKS = [
  { label: "Termos de Uso",        href: "/termos-de-uso" },
  { label: "Política de Privacidade", href: "/politica-de-privacidade" },
  { label: "Política de Cookies",  href: "/politica-de-cookies" },
  { label: "Direitos LGPD",        href: "/direitos-lgpd" },
] as const;

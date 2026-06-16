import type { QrSource } from "@mi/types/editor";

/**
 * Resolve o valor cru de um QR Code (número, handle, etc) em uma URL final
 * com UTMs prontas para tracking.
 */
export function resolveQrUrl(source: QrSource, value: string, utmCampaign?: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";

  let url: string;

  switch (source) {
    case "whatsapp": {
      const clean = trimmed.replace(/\D/g, "");
      const withCountry = clean.startsWith("55") ? clean : `55${clean}`;
      url = `https://wa.me/${withCountry}`;
      break;
    }
    case "instagram": {
      const handle = trimmed.replace(/^@mi/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "");
      url = `https://instagram.com/${handle}`;
      break;
    }
    case "website":
    case "landing": {
      url = /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
      break;
    }
    case "custom":
    default: {
      url = trimmed;
    }
  }

  if (utmCampaign) {
    try {
      const u = new URL(url);
      if (!u.searchParams.has("utm_source")) u.searchParams.set("utm_source", "totem");
      if (!u.searchParams.has("utm_medium")) u.searchParams.set("utm_medium", "tv");
      if (!u.searchParams.has("utm_campaign")) u.searchParams.set("utm_campaign", utmCampaign);
      return u.toString();
    } catch {
      return url;
    }
  }

  return url;
}

export const QR_SOURCE_LABELS: Record<QrSource, { label: string; placeholder: string; example: string; helper: string }> = {
  whatsapp: {
    label: "WhatsApp",
    placeholder: "31999999999",
    example: "31999999999 ou +5531999999999",
    helper: "Só o número (com ou sem DDI). Gera wa.me automaticamente.",
  },
  website: {
    label: "Website",
    placeholder: "meusite.com.br/promo",
    example: "https://meusite.com.br",
    helper: "URL completa ou só domínio. Adiciona https automaticamente.",
  },
  instagram: {
    label: "Instagram",
    placeholder: "@ecommclaude",
    example: "@ecommclaude ou ecommclaude",
    helper: "@ é opcional. Gera link instagram.com/handle.",
  },
  landing: {
    label: "Landing Page",
    placeholder: "lp.minhamarca.com/oferta",
    example: "https://lp.minhamarca.com",
    helper: "URL de qualquer landing. UTMs anexadas pra tracking.",
  },
  custom: {
    label: "URL Personalizada",
    placeholder: "https://qualquer-url.com",
    example: "https://qualquer-url.com",
    helper: "Qualquer URL ou texto livre (vCard, deeplink etc).",
  },
};

import type { EditorElement, TemplatePreset } from "@mi/types/editor";

let _id = 0;
const id = () => `el-${++_id}-${Math.random().toString(36).slice(2, 6)}`;

function reset() {
  _id = 0;
}

// ─── 1. Oferta Relâmpago ─────────────────────────────────────────────────────
const ofertaRelampago: TemplatePreset = {
  slug: "oferta-relampago",
  name: "Oferta Relâmpago",
  description: "Vermelho + cupom + QR. Ideal para promoções por tempo limitado.",
  category: "ofertas",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "gradient", value: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)" },
      elements: [
        {
          id: id(),
          type: "heading",
          x: 100, y: 140, width: 980, height: 200, rotation: 0, opacity: 1, zIndex: 5,
          text: "OFERTA RELÂMPAGO ⚡",
          fontFamily: "Arial Black", fontSize: 120, fontWeight: 900,
          color: "#facc15", align: "left", lineHeight: 1.1, letterSpacing: -2,
          textShadow: "0 4px 20px rgba(0,0,0,0.4)",
          motion: { preset: "slide-right", delay: 0, duration: 600 },
        },
        {
          id: id(),
          type: "subtitle",
          x: 100, y: 380, width: 980, height: 100, rotation: 0, opacity: 1, zIndex: 5,
          text: "Apresente este QR e ganhe desconto exclusivo",
          fontFamily: "Inter", fontSize: 44, fontWeight: 400,
          color: "#fee2e2", align: "left", lineHeight: 1.3, letterSpacing: 0,
          motion: { preset: "fade-in", delay: 200, duration: 600 },
        },
        {
          id: id(),
          type: "price",
          x: 100, y: 540, width: 700, height: 280, rotation: 0, opacity: 1, zIndex: 5,
          fromLabel: "De", fromValue: 197, byLabel: "Por", byValue: 97,
          currency: "R$",
          fontFamily: "Arial Black", color: "#ffffff", highlightColor: "#facc15", size: 1.0,
          motion: { preset: "zoom-in", delay: 400, duration: 700 },
        },
        {
          id: id(),
          type: "qrcode",
          x: 1280, y: 360, width: 520, height: 520, rotation: 0, opacity: 1, zIndex: 5,
          source: "whatsapp", value: "5531999999999",
          utmCampaign: "oferta-relampago",
          fgColor: "#0f1720", bgColor: "#ffffff", level: "M", margin: 4,
          label: "Aponte a câmera", labelColor: "#0f1720", labelSize: 28,
          pulse: true,
          motion: { preset: "pulse", delay: 0, duration: 2000 },
        },
      ] as EditorElement[],
    };
  },
};

// ─── 2. Video Hero ───────────────────────────────────────────────────────────
const videoHero: TemplatePreset = {
  slug: "video-hero",
  name: "Video Hero",
  description: "Vídeo full-bleed + overlay com CTA grande. Cinematográfico.",
  category: "premium",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "color", value: "#000000" },
      elements: [
        {
          id: id(),
          type: "shape",
          x: 0, y: 0, width: 1920, height: 1080, rotation: 0, opacity: 0.55, zIndex: 1,
          shape: "rect",
          fill: "linear-gradient(180deg, transparent 40%, #000000 100%)",
        },
        {
          id: id(),
          type: "heading",
          x: 100, y: 560, width: 1300, height: 220, rotation: 0, opacity: 1, zIndex: 5,
          text: "Sua marca em destaque",
          fontFamily: "Inter", fontSize: 120, fontWeight: 900,
          color: "#ffffff", align: "left", lineHeight: 1, letterSpacing: -3,
          motion: { preset: "slide-up", delay: 200, duration: 800 },
        },
        {
          id: id(),
          type: "subtitle",
          x: 100, y: 810, width: 1200, height: 80, rotation: 0, opacity: 1, zIndex: 5,
          text: "Conexão Local · Lavanderia · Bairro",
          fontFamily: "Inter", fontSize: 36, fontWeight: 400,
          color: "#a7f3d0", align: "left", lineHeight: 1.2, letterSpacing: 4,
          motion: { preset: "fade-in", delay: 600, duration: 600 },
        },
        {
          id: id(),
          type: "qrcode",
          x: 1500, y: 660, width: 300, height: 380, rotation: 0, opacity: 1, zIndex: 5,
          source: "website", value: "https://sistema.lavsync.com.br/m/xo-varal-buritis/clube-de-beneficios",
          fgColor: "#ffffff", bgColor: "#0f1720", level: "M", margin: 2,
          label: "Saiba mais", labelColor: "#a7f3d0", labelSize: 22,
          motion: { preset: "fade-in", delay: 1000, duration: 600 },
        },
      ] as EditorElement[],
    };
  },
};

// ─── 3. Evento ───────────────────────────────────────────────────────────────
const evento: TemplatePreset = {
  slug: "evento",
  name: "Evento",
  description: "Layout pra divulgar eventos do bairro com data e local.",
  category: "eventos",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "gradient", value: "linear-gradient(135deg, #6d28d9 0%, #4c1d95 50%, #0f1720 100%)" },
      elements: [
        {
          id: id(),
          type: "subtitle",
          x: 100, y: 120, width: 800, height: 60, rotation: 0, opacity: 1, zIndex: 5,
          text: "EVENTO EXCLUSIVO",
          fontFamily: "Inter", fontSize: 32, fontWeight: 700,
          color: "#a78bfa", align: "left", lineHeight: 1, letterSpacing: 8,
          motion: { preset: "slide-right", delay: 0, duration: 500 },
        },
        {
          id: id(),
          type: "heading",
          x: 100, y: 200, width: 1300, height: 360, rotation: 0, opacity: 1, zIndex: 5,
          text: "Inauguração\nXô Varal\nBuritis",
          fontFamily: "Arial Black", fontSize: 130, fontWeight: 900,
          color: "#ffffff", align: "left", lineHeight: 0.95, letterSpacing: -3,
          motion: { preset: "slide-up", delay: 200, duration: 700 },
        },
        {
          id: id(),
          type: "text",
          x: 100, y: 660, width: 700, height: 50, rotation: 0, opacity: 1, zIndex: 5,
          text: "📅  20 de junho · sábado",
          fontFamily: "Inter", fontSize: 32, fontWeight: 500,
          color: "#fef3c7", align: "left", lineHeight: 1, letterSpacing: 0,
          motion: { preset: "fade-in", delay: 600, duration: 500 },
        },
        {
          id: id(),
          type: "text",
          x: 100, y: 730, width: 800, height: 50, rotation: 0, opacity: 1, zIndex: 5,
          text: "📍  Av. Buritis, 1234 · BH/MG",
          fontFamily: "Inter", fontSize: 32, fontWeight: 500,
          color: "#fef3c7", align: "left", lineHeight: 1, letterSpacing: 0,
          motion: { preset: "fade-in", delay: 800, duration: 500 },
        },
        {
          id: id(),
          type: "text",
          x: 100, y: 800, width: 800, height: 50, rotation: 0, opacity: 1, zIndex: 5,
          text: "🎁  Coffee break · Sorteios · Brindes",
          fontFamily: "Inter", fontSize: 32, fontWeight: 500,
          color: "#fef3c7", align: "left", lineHeight: 1, letterSpacing: 0,
          motion: { preset: "fade-in", delay: 1000, duration: 500 },
        },
        {
          id: id(),
          type: "qrcode",
          x: 1380, y: 460, width: 420, height: 480, rotation: 0, opacity: 1, zIndex: 5,
          source: "whatsapp", value: "5531999999999",
          utmCampaign: "evento-inauguracao",
          fgColor: "#0f1720", bgColor: "#ffffff", level: "M", margin: 3,
          label: "Confirmar presença", labelColor: "#0f1720", labelSize: 26,
          motion: { preset: "zoom-in", delay: 400, duration: 800 },
        },
      ] as EditorElement[],
    };
  },
};

// ─── 4. Premium ──────────────────────────────────────────────────────────────
const premium: TemplatePreset = {
  slug: "premium",
  name: "Premium",
  description: "Sofisticado dourado + preto. Para serviços de alto ticket.",
  category: "premium",
  format: ["horizontal"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "gradient", value: "linear-gradient(135deg, #0a0a0a 0%, #1c1917 50%, #0a0a0a 100%)" },
      elements: [
        {
          id: id(),
          type: "subtitle",
          x: 100, y: 200, width: 700, height: 60, rotation: 0, opacity: 1, zIndex: 5,
          text: "⸻⸻ EXCLUSIVO ⸻⸻",
          fontFamily: "Inter", fontSize: 28, fontWeight: 600,
          color: "#fbbf24", align: "left", lineHeight: 1, letterSpacing: 12,
          motion: { preset: "fade-in", delay: 0, duration: 600 },
        },
        {
          id: id(),
          type: "heading",
          x: 100, y: 320, width: 1100, height: 280, rotation: 0, opacity: 1, zIndex: 5,
          text: "Atendimento\nVIP do bairro",
          fontFamily: "Georgia", fontSize: 110, fontWeight: 400,
          fontStyle: "italic",
          color: "#fff7ed", align: "left", lineHeight: 1, letterSpacing: -1,
          motion: { preset: "slide-up", delay: 300, duration: 800 },
        },
        {
          id: id(),
          type: "subtitle",
          x: 100, y: 680, width: 900, height: 80, rotation: 0, opacity: 1, zIndex: 5,
          text: "Apenas 30 vagas por mês",
          fontFamily: "Inter", fontSize: 36, fontWeight: 300,
          color: "#fbbf24", align: "left", lineHeight: 1.2, letterSpacing: 1,
          motion: { preset: "fade-in", delay: 700, duration: 600 },
        },
        {
          id: id(),
          type: "qrcode",
          x: 1400, y: 320, width: 420, height: 480, rotation: 0, opacity: 1, zIndex: 5,
          source: "whatsapp", value: "5531999999999",
          fgColor: "#fbbf24", bgColor: "#0a0a0a", level: "H", margin: 3,
          label: "Reservar agora", labelColor: "#fbbf24", labelSize: 24,
          motion: { preset: "fade-in", delay: 500, duration: 700 },
        },
      ] as EditorElement[],
    };
  },
};

// ─── 5. Social Proof ─────────────────────────────────────────────────────────
const socialProof: TemplatePreset = {
  slug: "social-proof",
  name: "Social Proof",
  description: "Depoimento + avaliação 5 estrelas. Constrói confiança.",
  category: "social",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "gradient", value: "linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%)" },
      elements: [
        {
          id: id(),
          type: "heading",
          x: 100, y: 140, width: 1300, height: 140, rotation: 0, opacity: 1, zIndex: 5,
          text: "⭐ ⭐ ⭐ ⭐ ⭐",
          fontFamily: "Inter", fontSize: 110, fontWeight: 400,
          color: "#f59e0b", align: "left", lineHeight: 1, letterSpacing: 8,
          motion: { preset: "zoom-in", delay: 0, duration: 600 },
        },
        {
          id: id(),
          type: "heading",
          x: 100, y: 300, width: 1300, height: 360, rotation: 0, opacity: 1, zIndex: 5,
          text: '"Atendimento incrível,\nvolto sempre!"',
          fontFamily: "Georgia", fontSize: 92, fontWeight: 400, fontStyle: "italic",
          color: "#451a03", align: "left", lineHeight: 1.05, letterSpacing: -1,
          motion: { preset: "slide-right", delay: 300, duration: 700 },
        },
        {
          id: id(),
          type: "text",
          x: 100, y: 740, width: 800, height: 50, rotation: 0, opacity: 1, zIndex: 5,
          text: "— Maria Silva, cliente desde 2024",
          fontFamily: "Inter", fontSize: 32, fontWeight: 500,
          color: "#92400e", align: "left", lineHeight: 1, letterSpacing: 0,
          motion: { preset: "fade-in", delay: 700, duration: 500 },
        },
        {
          id: id(),
          type: "qrcode",
          x: 1380, y: 420, width: 420, height: 480, rotation: 0, opacity: 1, zIndex: 5,
          source: "instagram", value: "ecommclaude",
          fgColor: "#451a03", bgColor: "#fef9c3", level: "M", margin: 3,
          label: "Veja mais depoimentos", labelColor: "#451a03", labelSize: 24,
          motion: { preset: "zoom-in", delay: 500, duration: 700 },
        },
      ] as EditorElement[],
    };
  },
};

// ─── 6. De/Por ───────────────────────────────────────────────────────────────
const dePor: TemplatePreset = {
  slug: "de-por",
  name: "De / Por (mega oferta)",
  description: "Preço riscado + preço novo gigante. Conversão alta.",
  category: "ofertas",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "gradient", value: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)" },
      elements: [
        {
          id: id(),
          type: "heading",
          x: 100, y: 100, width: 1300, height: 120, rotation: 0, opacity: 1, zIndex: 5,
          text: "OFERTA DA SEMANA",
          fontFamily: "Arial Black", fontSize: 80, fontWeight: 900,
          color: "#ffffff", align: "left", lineHeight: 1, letterSpacing: 2,
          motion: { preset: "slide-right", delay: 0, duration: 600 },
        },
        {
          id: id(),
          type: "text",
          x: 100, y: 280, width: 1300, height: 100, rotation: 0, opacity: 1, zIndex: 5,
          text: "Lavar + secar + dobrar (até 5kg)",
          fontFamily: "Inter", fontSize: 48, fontWeight: 500,
          color: "#ccfbf1", align: "left", lineHeight: 1, letterSpacing: 0,
          motion: { preset: "fade-in", delay: 300, duration: 500 },
        },
        {
          id: id(),
          type: "price",
          x: 100, y: 460, width: 1000, height: 400, rotation: 0, opacity: 1, zIndex: 5,
          fromLabel: "DE", fromValue: 39.9, byLabel: "POR APENAS", byValue: 24.9,
          currency: "R$",
          fontFamily: "Arial Black", color: "#ffffff", highlightColor: "#facc15", size: 1.4,
          motion: { preset: "zoom-in", delay: 600, duration: 800 },
        },
        {
          id: id(),
          type: "qrcode",
          x: 1380, y: 380, width: 420, height: 480, rotation: 0, opacity: 1, zIndex: 5,
          source: "whatsapp", value: "5531999999999",
          utmCampaign: "de-por",
          fgColor: "#0f1720", bgColor: "#ffffff", level: "M", margin: 3,
          label: "Aproveitar agora", labelColor: "#0f1720", labelSize: 26,
          pulse: true,
          motion: { preset: "pulse", delay: 0, duration: 1800 },
        },
      ] as EditorElement[],
    };
  },
};

// ─── 7. Cardápio ─────────────────────────────────────────────────────────────
const cardapio: TemplatePreset = {
  slug: "cardapio",
  name: "Cardápio",
  description: "Lista de itens + preços. Ideal pra restaurantes e cafés.",
  category: "menu",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "color", value: "#1c1917" },
      elements: [
        {
          id: id(),
          type: "heading",
          x: 100, y: 80, width: 1300, height: 140, rotation: 0, opacity: 1, zIndex: 5,
          text: "Cardápio do dia",
          fontFamily: "Georgia", fontSize: 92, fontWeight: 400, fontStyle: "italic",
          color: "#fbbf24", align: "left", lineHeight: 1, letterSpacing: -1,
          motion: { preset: "fade-in", delay: 0, duration: 600 },
        },
        {
          id: id(),
          type: "text",
          x: 100, y: 260, width: 1200, height: 80, rotation: 0, opacity: 1, zIndex: 5,
          text: "Café especial ........................ R$ 8,00",
          fontFamily: "Georgia", fontSize: 42, fontWeight: 400,
          color: "#fef3c7", align: "left", lineHeight: 1, letterSpacing: 0,
          motion: { preset: "slide-right", delay: 200, duration: 500 },
        },
        {
          id: id(),
          type: "text",
          x: 100, y: 360, width: 1200, height: 80, rotation: 0, opacity: 1, zIndex: 5,
          text: "Pão na chapa ........................ R$ 6,00",
          fontFamily: "Georgia", fontSize: 42, fontWeight: 400,
          color: "#fef3c7", align: "left", lineHeight: 1, letterSpacing: 0,
          motion: { preset: "slide-right", delay: 350, duration: 500 },
        },
        {
          id: id(),
          type: "text",
          x: 100, y: 460, width: 1200, height: 80, rotation: 0, opacity: 1, zIndex: 5,
          text: "Tapioca recheada .................. R$ 12,00",
          fontFamily: "Georgia", fontSize: 42, fontWeight: 400,
          color: "#fef3c7", align: "left", lineHeight: 1, letterSpacing: 0,
          motion: { preset: "slide-right", delay: 500, duration: 500 },
        },
        {
          id: id(),
          type: "text",
          x: 100, y: 560, width: 1200, height: 80, rotation: 0, opacity: 1, zIndex: 5,
          text: "Suco natural ........................ R$ 9,00",
          fontFamily: "Georgia", fontSize: 42, fontWeight: 400,
          color: "#fef3c7", align: "left", lineHeight: 1, letterSpacing: 0,
          motion: { preset: "slide-right", delay: 650, duration: 500 },
        },
        {
          id: id(),
          type: "text",
          x: 100, y: 760, width: 1200, height: 60, rotation: 0, opacity: 1, zIndex: 5,
          text: "Aceitamos PIX, cartão e dinheiro",
          fontFamily: "Inter", fontSize: 28, fontWeight: 300,
          color: "#a8a29e", align: "left", lineHeight: 1, letterSpacing: 2,
          motion: { preset: "fade-in", delay: 900, duration: 500 },
        },
        {
          id: id(),
          type: "qrcode",
          x: 1380, y: 400, width: 420, height: 480, rotation: 0, opacity: 1, zIndex: 5,
          source: "website", value: "https://meu-cardapio.com.br",
          fgColor: "#fbbf24", bgColor: "#1c1917", level: "M", margin: 3,
          label: "Ver cardápio completo", labelColor: "#fbbf24", labelSize: 22,
          motion: { preset: "fade-in", delay: 800, duration: 600 },
        },
      ] as EditorElement[],
    };
  },
};

// ─── 8. WhatsApp CTA ─────────────────────────────────────────────────────────
const whatsappCta: TemplatePreset = {
  slug: "whatsapp-cta",
  name: "WhatsApp CTA",
  description: "Verde WhatsApp, foco total em fazer a pessoa abrir conversa.",
  category: "promo",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "gradient", value: "linear-gradient(135deg, #25d366 0%, #128c7e 100%)" },
      elements: [
        {
          id: id(),
          type: "heading",
          x: 100, y: 240, width: 1100, height: 240, rotation: 0, opacity: 1, zIndex: 5,
          text: "Fale com a gente\nno WhatsApp",
          fontFamily: "Arial Black", fontSize: 100, fontWeight: 900,
          color: "#ffffff", align: "left", lineHeight: 1.05, letterSpacing: -2,
          textShadow: "0 4px 20px rgba(0,0,0,0.3)",
          motion: { preset: "slide-up", delay: 0, duration: 700 },
        },
        {
          id: id(),
          type: "subtitle",
          x: 100, y: 540, width: 1000, height: 80, rotation: 0, opacity: 1, zIndex: 5,
          text: "Atendimento rápido · Resposta em minutos",
          fontFamily: "Inter", fontSize: 40, fontWeight: 400,
          color: "#dcfce7", align: "left", lineHeight: 1.2, letterSpacing: 0,
          motion: { preset: "fade-in", delay: 400, duration: 600 },
        },
        {
          id: id(),
          type: "phone",
          x: 100, y: 700, width: 800, height: 90, rotation: 0, opacity: 1, zIndex: 5,
          number: "(31) 99999-9999", icon: "whatsapp", label: "WhatsApp",
          fontFamily: "Arial Black", fontSize: 60, fontWeight: 900,
          color: "#ffffff",
          motion: { preset: "fade-in", delay: 700, duration: 600 },
        },
        {
          id: id(),
          type: "qrcode",
          x: 1300, y: 320, width: 500, height: 540, rotation: 0, opacity: 1, zIndex: 5,
          source: "whatsapp", value: "5531999999999",
          utmCampaign: "whatsapp-cta",
          fgColor: "#0f1720", bgColor: "#ffffff", level: "M", margin: 3,
          label: "Aponte aqui agora", labelColor: "#0f1720", labelSize: 28,
          pulse: true,
          motion: { preset: "pulse", delay: 0, duration: 2000 },
        },
      ] as EditorElement[],
    };
  },
};

import { NICHO_TEMPLATES } from "./nicho-templates";
import { SAZONAL_TEMPLATES } from "./sazonal-templates";

const BASE_PRESETS: TemplatePreset[] = [
  ofertaRelampago,
  videoHero,
  evento,
  premium,
  socialProof,
  dePor,
  cardapio,
  whatsappCta,
];

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  ...BASE_PRESETS,
  ...NICHO_TEMPLATES,
  ...SAZONAL_TEMPLATES,
];

export function findPreset(slug: string) {
  return TEMPLATE_PRESETS.find((p) => p.slug === slug);
}

import type { TemplatePreset } from "@mi/types/editor";
import {
  reset, heading, subtitle, text, cta, priceFromTo, qr, shape,
} from "./template-helpers";

// ─── 1. Dia das Mães ─────────────────────────────────────────────────────────
const diaDasMaes: TemplatePreset = {
  slug: "sazonal-maes",
  name: "Dia das Mães",
  description: "Layout floral elegante. Ative em maio.",
  category: "sazonal",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "gradient", value: "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #ec4899 100%)" },
      elements: [
        text({ x: 100, y: 140, w: 700, h: 60, text: "🌸  DIA DAS MÃES", color: "#831843", size: 32, weight: 800, spacing: 8 }),
        heading({ x: 100, y: 240, w: 1200, h: 360, text: "Para a mulher\nmais especial", color: "#831843", size: 92, weight: 400, italic: true, family: "Georgia", motion: { preset: "slide-up", delay: 200 } }),
        text({ x: 100, y: 620, w: 1000, h: 60, text: "💝  Presentes especiais com desconto exclusivo", color: "#9d174d", size: 32, weight: 500, motion: { preset: "fade-in", delay: 500 } }),
        priceFromTo({ x: 100, y: 750, w: 800, h: 260, fromLabel: "A partir de", fromValue: 89, byLabel: "Por apenas", byValue: 49, color: "#831843", highlight: "#ec4899", motion: { preset: "zoom-in", delay: 700 } }),
        qr({ x: 1380, y: 360, w: 420, h: 480, source: "whatsapp", value: "5531973603600", utm: "dia-das-maes", fg: "#831843", bg: "#fdf2f8", label: "Surpreender a mãe", labelColor: "#831843", motion: { preset: "pulse" } }),
      ],
    };
  },
};

// ─── 2. Dia dos Pais ─────────────────────────────────────────────────────────
const diaDosPais: TemplatePreset = {
  slug: "sazonal-pais",
  name: "Dia dos Pais",
  description: "Layout sóbrio masculino. Ative em agosto.",
  category: "sazonal",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "gradient", value: "linear-gradient(135deg, #0c0a09 0%, #1c1917 100%)" },
      elements: [
        shape({ x: 100, y: 130, w: 8, h: 60, fill: "#fbbf24" }),
        text({ x: 130, y: 145, w: 700, h: 40, text: "DIA DOS PAIS", color: "#fbbf24", size: 28, weight: 800, spacing: 10 }),
        heading({ x: 100, y: 240, w: 1200, h: 360, text: "Para o homem\nque você admira.", color: "#fff7ed", size: 88, weight: 400, italic: true, family: "Georgia", motion: { preset: "slide-up", delay: 200 } }),
        text({ x: 100, y: 660, w: 1000, h: 60, text: "👔 Presentes que ele vai usar todo dia", color: "#fbbf24", size: 30, weight: 500, motion: { preset: "fade-in", delay: 500 } }),
        priceFromTo({ x: 100, y: 760, w: 800, h: 260, fromValue: 199, byValue: 129, color: "#fff7ed", highlight: "#fbbf24", motion: { preset: "zoom-in", delay: 700 } }),
        qr({ x: 1380, y: 360, w: 420, h: 480, source: "whatsapp", value: "5531973603600", utm: "dia-dos-pais", fg: "#fbbf24", bg: "#0c0a09", label: "Reservar presente", labelColor: "#fbbf24", motion: { preset: "pulse" } }),
      ],
    };
  },
};

// ─── 3. Black Friday ─────────────────────────────────────────────────────────
const blackFriday: TemplatePreset = {
  slug: "sazonal-black-friday",
  name: "Black Friday",
  description: "Preto e amarelo agressivo. Ative em novembro.",
  category: "sazonal",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "color", value: "#000000" },
      elements: [
        shape({ x: 0, y: 0, w: 1920, h: 8, fill: "#facc15" }),
        shape({ x: 0, y: 1072, w: 1920, h: 8, fill: "#facc15" }),
        text({ x: 100, y: 130, w: 1300, h: 60, text: "🔥  PROMOÇÃO POR TEMPO LIMITADO", color: "#facc15", size: 32, weight: 800, spacing: 6, motion: { preset: "neon", duration: 1500 } }),
        heading({ x: 100, y: 230, w: 1400, h: 460, text: "BLACK\nFRIDAY", color: "#facc15", size: 280, weight: 900, lineHeight: 0.85, motion: { preset: "slide-up", delay: 100 } }),
        heading({ x: 100, y: 720, w: 900, h: 200, text: "Até 70% OFF", color: "#ffffff", size: 100, motion: { preset: "zoom-in", delay: 400 } }),
        cta({ x: 100, y: 940, w: 1100, h: 80, text: "⚡  Só hoje! Aponte e aproveite agora", color: "#facc15", size: 38, motion: { preset: "neon", duration: 1200 } }),
        qr({ x: 1380, y: 360, w: 460, h: 580, source: "whatsapp", value: "5531973603600", utm: "black-friday", fg: "#000000", bg: "#facc15", label: "Aproveitar agora", labelColor: "#000000", motion: { preset: "pulse" } }),
      ],
    };
  },
};

// ─── 4. Natal ────────────────────────────────────────────────────────────────
const natal: TemplatePreset = {
  slug: "sazonal-natal",
  name: "Natal",
  description: "Vermelho clássico de fim de ano.",
  category: "sazonal",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "gradient", value: "linear-gradient(135deg, #7f1d1d 0%, #b91c1c 50%, #16a34a 100%)" },
      elements: [
        text({ x: 100, y: 130, w: 700, h: 60, text: "🎄  FELIZ NATAL", color: "#fef3c7", size: 32, weight: 800, spacing: 8 }),
        heading({ x: 100, y: 220, w: 1300, h: 380, text: "Presenteie\nquem você ama.", color: "#fef9c3", size: 96, weight: 400, italic: true, family: "Georgia", motion: { preset: "slide-up", delay: 200 } }),
        text({ x: 100, y: 660, w: 1000, h: 60, text: "🎁 Embalagem grátis · 🚚 Entrega em 24h", color: "#fbbf24", size: 32, weight: 600, motion: { preset: "fade-in", delay: 500 } }),
        priceFromTo({ x: 100, y: 760, w: 800, h: 260, fromLabel: "A partir de", fromValue: 50, byLabel: "Por", byValue: 29.9, color: "#fef9c3", highlight: "#facc15", motion: { preset: "zoom-in", delay: 700 } }),
        qr({ x: 1380, y: 360, w: 420, h: 480, source: "whatsapp", value: "5531973603600", utm: "natal", fg: "#7f1d1d", bg: "#fef3c7", label: "Pedir presente", labelColor: "#7f1d1d", motion: { preset: "pulse" } }),
      ],
    };
  },
};

// ─── 5. Volta às Aulas ───────────────────────────────────────────────────────
const voltaAulas: TemplatePreset = {
  slug: "sazonal-volta-aulas",
  name: "Volta às Aulas",
  description: "Material escolar e cursos em janeiro/fevereiro.",
  category: "sazonal",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "gradient", value: "linear-gradient(135deg, #fef3c7 0%, #06b6d4 100%)" },
      elements: [
        text({ x: 100, y: 130, w: 700, h: 60, text: "🎒  VOLTA ÀS AULAS", color: "#0e7490", size: 32, weight: 800, spacing: 8 }),
        heading({ x: 100, y: 220, w: 1200, h: 280, text: "Tudo pronto\npra começar.", color: "#164e63", size: 100, motion: { preset: "slide-up", delay: 200 } }),
        text({ x: 100, y: 540, w: 1000, h: 60, text: "📚 Mochilas · ✏️ Material escolar · 📓 Cadernos", color: "#0e7490", size: 32, weight: 600, motion: { preset: "fade-in", delay: 500 } }),
        priceFromTo({ x: 100, y: 660, w: 800, h: 280, fromLabel: "Combo a partir de", fromValue: 199, byLabel: "Por", byValue: 99, color: "#164e63", highlight: "#dc2626", motion: { preset: "zoom-in", delay: 700 } }),
        qr({ x: 1380, y: 360, w: 420, h: 480, source: "whatsapp", value: "5531973603600", utm: "volta-aulas", fg: "#164e63", bg: "#ffffff", label: "Ver combos", labelColor: "#164e63", motion: { preset: "pulse" } }),
      ],
    };
  },
};

// ─── 6. Dia dos Namorados ────────────────────────────────────────────────────
const namorados: TemplatePreset = {
  slug: "sazonal-namorados",
  name: "Dia dos Namorados",
  description: "Romântico em vermelho/rosa pra junho.",
  category: "sazonal",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "gradient", value: "linear-gradient(135deg, #fecdd3 0%, #f43f5e 100%)" },
      elements: [
        text({ x: 100, y: 130, w: 700, h: 60, text: "💕  DIA DOS NAMORADOS", color: "#881337", size: 32, weight: 800, spacing: 8 }),
        heading({ x: 100, y: 230, w: 1300, h: 360, text: "Surpreenda\nquem você ama.", color: "#881337", size: 96, weight: 400, italic: true, family: "Georgia", motion: { preset: "slide-up", delay: 200 } }),
        text({ x: 100, y: 640, w: 1000, h: 60, text: "❤️ Presentes especiais · 🎁 Embalagem para presente grátis", color: "#9f1239", size: 30, weight: 500, motion: { preset: "fade-in", delay: 500 } }),
        priceFromTo({ x: 100, y: 770, w: 800, h: 260, fromValue: 149, byValue: 89, color: "#881337", highlight: "#f43f5e", motion: { preset: "zoom-in", delay: 700 } }),
        qr({ x: 1380, y: 360, w: 420, h: 480, source: "whatsapp", value: "5531973603600", utm: "dia-namorados", fg: "#881337", bg: "#ffffff", label: "Reservar surpresa", labelColor: "#881337", motion: { preset: "pulse" } }),
      ],
    };
  },
};

export const SAZONAL_TEMPLATES: TemplatePreset[] = [
  diaDasMaes,
  diaDosPais,
  blackFriday,
  natal,
  voltaAulas,
  namorados,
];

import type { TemplatePreset } from "@mi/types/editor";
import {
  reset, heading, subtitle, text, cta, priceFromTo, qr, phone, shape,
} from "./template-helpers";

// ─── 1. PET SHOP — Banho & Tosa ──────────────────────────────────────────────
const petShop: TemplatePreset = {
  slug: "pet-banho-tosa",
  name: "Pet Shop — Banho & Tosa",
  description: "Combo banho + tosa com QR direto pra agendamento.",
  category: "pet",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "gradient", value: "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)" },
      elements: [
        text({ x: 100, y: 140, w: 600, h: 60, text: "🐾  PET SHOP DO BAIRRO", color: "#fef3c7", size: 28, weight: 700, spacing: 6 }),
        heading({ x: 100, y: 230, w: 1200, h: 280, text: "Banho + Tosa\nCompleta", color: "#ffffff", size: 110, motion: { preset: "slide-up", delay: 200 } }),
        text({ x: 100, y: 580, w: 900, h: 60, text: "✓  Hidratação · ✓  Corte de unhas · ✓  Perfume", color: "#e0f2fe", size: 32, weight: 500, motion: { preset: "fade-in", delay: 500 } }),
        priceFromTo({ x: 100, y: 680, w: 700, h: 280, fromValue: 89, byValue: 59, color: "#ffffff", highlight: "#facc15", motion: { preset: "zoom-in", delay: 700 } }),
        qr({ x: 1380, y: 360, w: 420, h: 480, source: "whatsapp", value: "5531973603600", utm: "pet-banho-tosa", label: "Agendar agora", labelColor: "#0f1720", motion: { preset: "pulse" } }),
      ],
    };
  },
};

// ─── 2. PADARIA — Café da Manhã ──────────────────────────────────────────────
const padaria: TemplatePreset = {
  slug: "padaria-cafe-manha",
  name: "Padaria — Café da Manhã",
  description: "Combo café + pão + suco com preço chamativo.",
  category: "alimentacao",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "gradient", value: "linear-gradient(135deg, #fef3c7 0%, #fde047 50%, #ca8a04 100%)" },
      elements: [
        text({ x: 100, y: 140, w: 800, h: 60, text: "☕  CAFÉ DA MANHÃ COMPLETO", color: "#7c2d12", size: 28, weight: 700, spacing: 6 }),
        heading({ x: 100, y: 230, w: 1200, h: 240, text: "Comece o dia\nbem alimentado", color: "#7c2d12", size: 100, weight: 900, family: "Georgia", italic: true, motion: { preset: "slide-up", delay: 200 } }),
        text({ x: 100, y: 530, w: 900, h: 80, text: "🥐 Pão na chapa  ☕ Café com leite  🍊 Suco natural", color: "#854d0e", size: 32, weight: 600, motion: { preset: "fade-in", delay: 500 } }),
        priceFromTo({ x: 100, y: 660, w: 800, h: 280, fromValue: 18, byValue: 12.9, color: "#7c2d12", highlight: "#dc2626", motion: { preset: "zoom-in", delay: 700 } }),
        qr({ x: 1380, y: 360, w: 420, h: 480, source: "whatsapp", value: "5531973603600", utm: "padaria-cafe", fg: "#7c2d12", bg: "#fef9c3", label: "Pedir agora", labelColor: "#7c2d12", motion: { preset: "pulse" } }),
      ],
    };
  },
};

// ─── 3. ACADEMIA — Matrícula Zero ────────────────────────────────────────────
const academia: TemplatePreset = {
  slug: "academia-matricula-zero",
  name: "Academia — Matrícula Zero",
  description: "Promoção de matrícula sem taxa, foco em conversão.",
  category: "academia",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "gradient", value: "linear-gradient(135deg, #0a0a0a 0%, #1e293b 100%)" },
      elements: [
        shape({ x: 0, y: 0, w: 1920, h: 8, fill: "#facc15", zIndex: 1 }),
        shape({ x: 0, y: 1072, w: 1920, h: 8, fill: "#facc15", zIndex: 1 }),
        text({ x: 100, y: 130, w: 800, h: 60, text: "💪  ACADEMIA DO BAIRRO", color: "#facc15", size: 28, weight: 800, spacing: 8 }),
        heading({ x: 100, y: 220, w: 1200, h: 380, text: "MATRÍCULA\nZERO", color: "#ffffff", size: 180, weight: 900, lineHeight: 0.95, motion: { preset: "slide-up", delay: 100 } }),
        subtitle({ x: 100, y: 640, w: 1100, h: 80, text: "Pague só a 1ª mensalidade e treine hoje", color: "#cbd5e1", size: 42, motion: { preset: "fade-in", delay: 400 } }),
        text({ x: 100, y: 760, w: 900, h: 60, text: "🔥 Promoção válida até dia 30", color: "#fbbf24", size: 32, weight: 700, motion: { preset: "neon", delay: 0, duration: 1200 } }),
        cta({ x: 100, y: 900, w: 800, h: 80, text: "👉 Aponte o QR e garanta sua vaga", size: 38, motion: { preset: "float", delay: 0, duration: 1500 } }),
        qr({ x: 1380, y: 360, w: 420, h: 540, source: "whatsapp", value: "5531973603600", utm: "academia-matricula-zero", fg: "#facc15", bg: "#0a0a0a", label: "Matricular", labelColor: "#facc15", motion: { preset: "pulse" } }),
      ],
    };
  },
};

// ─── 4. SALÃO DE BELEZA — Combo Cabelo + Unha ────────────────────────────────
const salao: TemplatePreset = {
  slug: "salao-combo-cabelo-unha",
  name: "Salão — Combo Cabelo + Unha",
  description: "Layout feminino sofisticado com combo de serviços.",
  category: "beleza",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "gradient", value: "linear-gradient(135deg, #fdf2f8 0%, #fbcfe8 50%, #ec4899 100%)" },
      elements: [
        text({ x: 100, y: 140, w: 600, h: 60, text: "💅  SALÃO DE BELEZA", color: "#831843", size: 26, weight: 700, spacing: 8 }),
        heading({ x: 100, y: 220, w: 1200, h: 360, text: "Linda dos pés\nà cabeça.", color: "#831843", size: 110, weight: 400, italic: true, family: "Georgia", motion: { preset: "slide-up", delay: 200 } }),
        text({ x: 100, y: 620, w: 900, h: 60, text: "💆‍♀️ Corte + escova  💅 Mão e pé  ✨ Hidratação", color: "#9d174d", size: 30, weight: 600, motion: { preset: "fade-in", delay: 500 } }),
        priceFromTo({ x: 100, y: 720, w: 800, h: 280, fromValue: 180, byValue: 119, color: "#831843", highlight: "#ec4899", motion: { preset: "zoom-in", delay: 700 } }),
        qr({ x: 1380, y: 360, w: 420, h: 480, source: "whatsapp", value: "5531973603600", utm: "salao-combo", fg: "#831843", bg: "#fdf2f8", label: "Agendar horário", labelColor: "#831843", motion: { preset: "pulse" } }),
      ],
    };
  },
};

// ─── 5. RESTAURANTE — Almoço Executivo ───────────────────────────────────────
const restaurante: TemplatePreset = {
  slug: "restaurante-almoco",
  name: "Restaurante — Almoço Executivo",
  description: "Self-service ou prato feito com preço fixo do dia.",
  category: "alimentacao",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "gradient", value: "linear-gradient(135deg, #422006 0%, #78350f 100%)" },
      elements: [
        text({ x: 100, y: 130, w: 700, h: 60, text: "🍽️  ALMOÇO EXECUTIVO", color: "#fbbf24", size: 32, weight: 800, spacing: 8 }),
        heading({ x: 100, y: 220, w: 1200, h: 280, text: "Almoço completo\nda casa", color: "#fef3c7", size: 92, weight: 400, italic: true, family: "Georgia", motion: { preset: "slide-up", delay: 200 } }),
        text({ x: 100, y: 530, w: 1000, h: 60, text: "Prato principal + acompanhamento + bebida + sobremesa", color: "#fed7aa", size: 28, weight: 500, motion: { preset: "fade-in", delay: 500 } }),
        shape({ x: 100, y: 650, w: 700, h: 280, fill: "#fbbf24", radius: 24, motion: { preset: "zoom-in", delay: 600 } }),
        text({ x: 130, y: 690, w: 600, h: 80, text: "PRATO DO DIA", color: "#78350f", size: 38, weight: 800, spacing: 4, zIndex: 6 }),
        heading({ x: 130, y: 760, w: 600, h: 140, text: "R$ 29,90", color: "#7c2d12", size: 120, weight: 900, zIndex: 6 }),
        qr({ x: 1380, y: 360, w: 420, h: 480, source: "whatsapp", value: "5531973603600", utm: "almoco-executivo", fg: "#78350f", bg: "#fef3c7", label: "Ver cardápio", labelColor: "#78350f", motion: { preset: "pulse" } }),
      ],
    };
  },
};

// ─── 6. FARMÁCIA — Desconto Genéricos ────────────────────────────────────────
const farmacia: TemplatePreset = {
  slug: "farmacia-genericos",
  name: "Farmácia — Genéricos com Desconto",
  description: "Layout limpo + confiável com foco em economia.",
  category: "saude",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "color", value: "#ffffff" },
      elements: [
        shape({ x: 0, y: 0, w: 1920, h: 200, fill: "#16a34a", zIndex: 1 }),
        text({ x: 100, y: 80, w: 700, h: 50, text: "💊  FARMÁCIA DO BAIRRO", color: "#ffffff", size: 30, weight: 800, spacing: 6, zIndex: 2 }),
        heading({ x: 100, y: 280, w: 1200, h: 240, text: "Até 70% OFF\nem genéricos", color: "#15803d", size: 100, weight: 900, motion: { preset: "slide-up", delay: 200 } }),
        text({ x: 100, y: 560, w: 1000, h: 60, text: "✅ Estoque completo  ✅ Apresentando receita  ✅ Atendimento 24h", color: "#166534", size: 28, weight: 500, motion: { preset: "fade-in", delay: 500 } }),
        priceFromTo({ x: 100, y: 660, w: 800, h: 280, fromLabel: "Até", fromValue: 80, byLabel: "Por apenas", byValue: 24, color: "#15803d", highlight: "#16a34a", motion: { preset: "zoom-in", delay: 700 } }),
        shape({ x: 0, y: 1010, w: 1920, h: 70, fill: "#16a34a", zIndex: 1 }),
        text({ x: 100, y: 1030, w: 800, h: 30, text: "Aberta 24h · Tele-entrega grátis", color: "#ffffff", size: 24, weight: 600, zIndex: 2 }),
        qr({ x: 1380, y: 320, w: 420, h: 540, source: "whatsapp", value: "5531973603600", utm: "farmacia-genericos", fg: "#15803d", bg: "#ffffff", label: "Pedir pelo WhatsApp", labelColor: "#15803d", motion: { preset: "pulse" } }),
      ],
    };
  },
};

// ─── 7. HORTIFRUTI — Cestas Frescas ──────────────────────────────────────────
const hortifruti: TemplatePreset = {
  slug: "hortifruti-cestas",
  name: "Hortifruti — Cestas Frescas",
  description: "Verdes vibrantes pra hortifrutis de bairro.",
  category: "alimentacao",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "gradient", value: "linear-gradient(135deg, #ecfccb 0%, #84cc16 100%)" },
      elements: [
        text({ x: 100, y: 130, w: 600, h: 60, text: "🥬  HORTIFRUTI", color: "#365314", size: 32, weight: 800, spacing: 6 }),
        heading({ x: 100, y: 220, w: 1200, h: 280, text: "Cesta de\nverduras frescas", color: "#365314", size: 96, weight: 900, motion: { preset: "slide-up", delay: 200 } }),
        text({ x: 100, y: 540, w: 1000, h: 80, text: "🥕 Cenoura · 🥦 Brócolis · 🥒 Pepino · 🌽 Milho + 10 itens", color: "#4d7c0f", size: 30, weight: 500, motion: { preset: "fade-in", delay: 500 } }),
        priceFromTo({ x: 100, y: 680, w: 800, h: 280, fromValue: 49, byValue: 29.9, color: "#365314", highlight: "#ca8a04", motion: { preset: "zoom-in", delay: 700 } }),
        qr({ x: 1380, y: 360, w: 420, h: 480, source: "whatsapp", value: "5531973603600", utm: "hortifruti-cesta", fg: "#365314", bg: "#ecfccb", label: "Encomendar", labelColor: "#365314", motion: { preset: "pulse" } }),
      ],
    };
  },
};

// ─── 8. PIZZARIA ─────────────────────────────────────────────────────────────
const pizzaria: TemplatePreset = {
  slug: "pizzaria-combo",
  name: "Pizzaria — Pizza + Refri",
  description: "Combo grande + refrigerante 2L.",
  category: "alimentacao",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "gradient", value: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #fb923c 100%)" },
      elements: [
        text({ x: 100, y: 130, w: 600, h: 60, text: "🍕  PIZZARIA DO BAIRRO", color: "#fed7aa", size: 28, weight: 800, spacing: 6 }),
        heading({ x: 100, y: 220, w: 1200, h: 240, text: "COMBO DA CASA", color: "#fbbf24", size: 88, weight: 900, shadow: "0 4px 16px rgba(0,0,0,0.4)" }),
        text({ x: 100, y: 480, w: 1100, h: 90, text: "🍕 1 Pizza grande (até 2 sabores) + 🥤 Refri 2L", color: "#fef3c7", size: 36, weight: 500, motion: { preset: "fade-in", delay: 400 } }),
        priceFromTo({ x: 100, y: 620, w: 800, h: 360, fromValue: 89.9, byValue: 64.9, color: "#ffffff", highlight: "#fbbf24", size: 1.1, motion: { preset: "zoom-in", delay: 600 } }),
        qr({ x: 1380, y: 320, w: 420, h: 540, source: "whatsapp", value: "5531973603600", utm: "pizza-combo", fg: "#7f1d1d", bg: "#ffffff", label: "Pedir delivery", labelColor: "#7f1d1d", motion: { preset: "pulse" } }),
      ],
    };
  },
};

// ─── 9. LAVA RÁPIDO ──────────────────────────────────────────────────────────
const lavaRapido: TemplatePreset = {
  slug: "lava-rapido-cera",
  name: "Lava Rápido — Lavagem + Cera",
  description: "Combo carro brilhando, parceria automotiva.",
  category: "automotivo",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "gradient", value: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)" },
      elements: [
        text({ x: 100, y: 130, w: 600, h: 60, text: "🚗  LAVA RÁPIDO", color: "#bfdbfe", size: 30, weight: 800, spacing: 6 }),
        heading({ x: 100, y: 220, w: 1200, h: 280, text: "Carro brilhando\nem 30 minutos", color: "#ffffff", size: 92, motion: { preset: "slide-up", delay: 200 } }),
        text({ x: 100, y: 540, w: 1000, h: 60, text: "🧽 Lavagem completa · ✨ Cera de proteção · 🚿 Interior aspirado", color: "#dbeafe", size: 28, weight: 500, motion: { preset: "fade-in", delay: 500 } }),
        priceFromTo({ x: 100, y: 660, w: 800, h: 280, fromValue: 89, byValue: 59, color: "#ffffff", highlight: "#facc15", motion: { preset: "zoom-in", delay: 700 } }),
        qr({ x: 1380, y: 360, w: 420, h: 480, source: "whatsapp", value: "5531973603600", utm: "lava-rapido", fg: "#1e3a8a", bg: "#ffffff", label: "Agendar", labelColor: "#1e3a8a", motion: { preset: "pulse" } }),
      ],
    };
  },
};

// ─── 10. CLÍNICA SAÚDE — Consulta ───────────────────────────────────────────
const clinica: TemplatePreset = {
  slug: "clinica-consulta",
  name: "Clínica — Consulta Acessível",
  description: "Tom profissional + confiável pra serviços de saúde.",
  category: "saude",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "color", value: "#f0f9ff" },
      elements: [
        shape({ x: 0, y: 0, w: 600, h: 1080, fill: "#0c4a6e", zIndex: 1 }),
        text({ x: 60, y: 140, w: 480, h: 60, text: "❤️  CLÍNICA DE SAÚDE", color: "#bae6fd", size: 24, weight: 700, spacing: 6, zIndex: 2 }),
        heading({ x: 60, y: 240, w: 480, h: 300, text: "Cuide da sua saúde", color: "#ffffff", size: 64, motion: { preset: "slide-right", delay: 200 }, zIndex: 2 }),
        subtitle({ x: 60, y: 580, w: 480, h: 100, text: "Atendimento humanizado e acessível para o bairro", color: "#bae6fd", size: 24, motion: { preset: "fade-in", delay: 500 }, zIndex: 2 }),
        text({ x: 60, y: 750, w: 480, h: 50, text: "🩺  Clínico geral", color: "#e0f2fe", size: 22, weight: 500, zIndex: 2 }),
        text({ x: 60, y: 800, w: 480, h: 50, text: "👨‍⚕️  Cardiologia", color: "#e0f2fe", size: 22, weight: 500, zIndex: 2 }),
        text({ x: 60, y: 850, w: 480, h: 50, text: "🧠  Psicologia", color: "#e0f2fe", size: 22, weight: 500, zIndex: 2 }),
        text({ x: 60, y: 900, w: 480, h: 50, text: "🦷  Odontologia", color: "#e0f2fe", size: 22, weight: 500, zIndex: 2 }),
        heading({ x: 700, y: 240, w: 1100, h: 200, text: "Consulta\na partir de R$ 80", color: "#0c4a6e", size: 72, motion: { preset: "slide-left", delay: 300 } }),
        text({ x: 700, y: 480, w: 1000, h: 60, text: "Atendimento por ordem de chegada · Receba a receita digital", color: "#075985", size: 28, weight: 500, motion: { preset: "fade-in", delay: 500 } }),
        qr({ x: 720, y: 600, w: 420, h: 460, source: "whatsapp", value: "5531973603600", utm: "clinica-consulta", fg: "#0c4a6e", bg: "#ffffff", label: "Marcar consulta", labelColor: "#0c4a6e", motion: { preset: "pulse" } }),
      ],
    };
  },
};

// ─── 11. ESCOLA / CURSO ──────────────────────────────────────────────────────
const escola: TemplatePreset = {
  slug: "escola-inscricoes",
  name: "Escola — Inscrições Abertas",
  description: "Cursos de idiomas, profissionalizantes, reforço.",
  category: "educacao",
  format: ["horizontal", "vertical"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "gradient", value: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4c1d95 100%)" },
      elements: [
        text({ x: 100, y: 130, w: 700, h: 60, text: "🎓  CURSO DE IDIOMAS", color: "#ddd6fe", size: 28, weight: 800, spacing: 6 }),
        heading({ x: 100, y: 220, w: 1200, h: 320, text: "Inscrições\nabertas", color: "#ffffff", size: 130, lineHeight: 0.95, motion: { preset: "slide-up", delay: 200 } }),
        subtitle({ x: 100, y: 580, w: 1000, h: 80, text: "Inglês · Espanhol · Francês", color: "#e9d5ff", size: 42, motion: { preset: "fade-in", delay: 500 } }),
        text({ x: 100, y: 700, w: 900, h: 60, text: "🏆 Professores nativos · 👥 Turmas reduzidas", color: "#ddd6fe", size: 26, weight: 600, motion: { preset: "fade-in", delay: 700 } }),
        cta({ x: 100, y: 820, w: 800, h: 80, text: "💡  Aula experimental GRÁTIS", color: "#facc15", size: 40, motion: { preset: "float", duration: 1800 } }),
        qr({ x: 1380, y: 360, w: 420, h: 480, source: "whatsapp", value: "5531973603600", utm: "curso-idiomas", fg: "#4c1d95", bg: "#ffffff", label: "Garantir vaga", labelColor: "#4c1d95", motion: { preset: "pulse" } }),
      ],
    };
  },
};

// ─── 12. IMOBILIÁRIA — Imóvel destaque ──────────────────────────────────────
const imobiliaria: TemplatePreset = {
  slug: "imobiliaria-destaque",
  name: "Imobiliária — Imóvel do Mês",
  description: "Anúncio premium pra captação de leads imobiliários.",
  category: "imobiliaria",
  format: ["horizontal"],
  buildHorizontal: () => {
    reset();
    return {
      background: { type: "color", value: "#0a0a0a" },
      elements: [
        text({ x: 100, y: 130, w: 600, h: 60, text: "🏠  IMÓVEL DESTAQUE", color: "#fbbf24", size: 28, weight: 800, spacing: 8 }),
        heading({ x: 100, y: 220, w: 1300, h: 280, text: "Apartamento\n3 quartos no Buritis", color: "#ffffff", size: 80, motion: { preset: "slide-up", delay: 200 } }),
        text({ x: 100, y: 540, w: 800, h: 50, text: "📐 95m²", color: "#fbbf24", size: 32, weight: 700 }),
        text({ x: 100, y: 600, w: 800, h: 50, text: "🛏️  3 quartos · 2 banheiros · 2 vagas", color: "#e2e8f0", size: 28, weight: 500 }),
        text({ x: 100, y: 660, w: 800, h: 50, text: "🏊  Lazer completo no condomínio", color: "#e2e8f0", size: 28, weight: 500 }),
        shape({ x: 100, y: 780, w: 800, h: 4, fill: "#fbbf24" }),
        text({ x: 100, y: 820, w: 600, h: 50, text: "VALOR", color: "#fbbf24", size: 24, weight: 700, spacing: 6 }),
        heading({ x: 100, y: 870, w: 900, h: 140, text: "R$ 750.000", color: "#ffffff", size: 92, motion: { preset: "zoom-in", delay: 500 } }),
        qr({ x: 1380, y: 320, w: 420, h: 540, source: "whatsapp", value: "5531973603600", utm: "imovel-destaque", fg: "#fbbf24", bg: "#0a0a0a", label: "Falar com corretor", labelColor: "#fbbf24", motion: { preset: "pulse" } }),
      ],
    };
  },
};

export const NICHO_TEMPLATES: TemplatePreset[] = [
  petShop,
  padaria,
  academia,
  salao,
  restaurante,
  farmacia,
  hortifruti,
  pizzaria,
  lavaRapido,
  clinica,
  escola,
  imobiliaria,
];

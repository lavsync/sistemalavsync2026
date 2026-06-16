"use client";

import { Check } from "lucide-react";

const BRAND_COLORS = [
  { name: "Turquesa", value: "#14b8a6" },
  { name: "Turquesa escuro", value: "#0d9488" },
  { name: "Amarelo Xô", value: "#facc15" },
  { name: "Laranja", value: "#f97316" },
  { name: "Vermelho", value: "#dc2626" },
  { name: "Verde WA", value: "#25d366" },
  { name: "Roxo", value: "#7c3aed" },
  { name: "Rosa", value: "#ec4899" },
];

const NEUTRAL_COLORS = [
  { name: "Branco", value: "#ffffff" },
  { name: "Cinza claro", value: "#e2e8f0" },
  { name: "Cinza", value: "#64748b" },
  { name: "Cinza escuro", value: "#1c1917" },
  { name: "Preto", value: "#0a0a0a" },
  { name: "Preto puro", value: "#000000" },
];

const GRADIENTS = [
  { name: "Xô Varal", value: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)" },
  { name: "Premium", value: "linear-gradient(135deg, #0a0a0a 0%, #1c1917 50%, #0a0a0a 100%)" },
  { name: "Fogo", value: "linear-gradient(135deg, #dc2626 0%, #991b1b 100%)" },
  { name: "Pôr do sol", value: "linear-gradient(135deg, #f97316 0%, #dc2626 100%)" },
  { name: "Roxo neon", value: "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)" },
  { name: "WhatsApp", value: "linear-gradient(135deg, #25d366 0%, #128c7e 100%)" },
  { name: "Dourado", value: "linear-gradient(135deg, #facc15 0%, #ca8a04 100%)" },
];

interface BrandPaletteProps {
  selectedColor?: string;
  onColorSelect: (color: string) => void;
  onGradientSelect?: (gradient: string) => void;
  showGradients?: boolean;
}

export function BrandPalette({
  selectedColor,
  onColorSelect,
  onGradientSelect,
  showGradients = false,
}: BrandPaletteProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
          Cores da marca
        </p>
        <div className="grid grid-cols-8 gap-1.5">
          {BRAND_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => onColorSelect(c.value)}
              title={c.name}
              className="group relative h-6 w-full rounded-md border border-white/10 transition-transform hover:scale-110"
              style={{ background: c.value }}
            >
              {selectedColor?.toLowerCase() === c.value.toLowerCase() && (
                <Check className="absolute inset-0 m-auto h-3 w-3 text-white drop-shadow" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
          Neutras
        </p>
        <div className="grid grid-cols-6 gap-1.5">
          {NEUTRAL_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => onColorSelect(c.value)}
              title={c.name}
              className="group relative h-6 w-full rounded-md border border-white/10 transition-transform hover:scale-110"
              style={{ background: c.value }}
            >
              {selectedColor?.toLowerCase() === c.value.toLowerCase() && (
                <Check className="absolute inset-0 m-auto h-3 w-3 text-white drop-shadow" />
              )}
            </button>
          ))}
        </div>
      </div>

      {showGradients && onGradientSelect && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
            Gradientes
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {GRADIENTS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => onGradientSelect(g.value)}
                title={g.name}
                className="h-8 w-full rounded-md border border-white/10 transition-transform hover:scale-105"
                style={{ background: g.value }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import type { MotionPreset } from "@mi/types/editor";

interface MotionDef {
  slug: MotionPreset;
  label: string;
  description: string;
  /** Variants Framer Motion */
  variants: {
    initial: Record<string, unknown>;
    animate: Record<string, unknown>;
  };
  /** Animation CSS keyframes (para uso em SSR / preview) */
  css?: string;
}

export const MOTION_PRESETS: MotionDef[] = [
  {
    slug: "none",
    label: "Sem animação",
    description: "Elemento aparece direto, sem movimento",
    variants: { initial: { opacity: 1 }, animate: { opacity: 1 } },
  },
  {
    slug: "fade-in",
    label: "Fade in",
    description: "Aparece suave (clássico)",
    variants: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  },
  {
    slug: "zoom-in",
    label: "Zoom in",
    description: "Cresce do centro com fade",
    variants: { initial: { opacity: 0, scale: 0.6 }, animate: { opacity: 1, scale: 1 } },
  },
  {
    slug: "slide-left",
    label: "Slide ←",
    description: "Entra deslizando da direita",
    variants: { initial: { opacity: 0, x: 80 }, animate: { opacity: 1, x: 0 } },
  },
  {
    slug: "slide-right",
    label: "Slide →",
    description: "Entra deslizando da esquerda",
    variants: { initial: { opacity: 0, x: -80 }, animate: { opacity: 1, x: 0 } },
  },
  {
    slug: "slide-up",
    label: "Slide ↑",
    description: "Entra deslizando de baixo",
    variants: { initial: { opacity: 0, y: 60 }, animate: { opacity: 1, y: 0 } },
  },
  {
    slug: "slide-down",
    label: "Slide ↓",
    description: "Entra deslizando de cima",
    variants: { initial: { opacity: 0, y: -60 }, animate: { opacity: 1, y: 0 } },
  },
  {
    slug: "pulse",
    label: "Pulse",
    description: "Pulsa continuamente (ideal pra QR Code)",
    variants: { initial: { scale: 1 }, animate: { scale: [1, 1.05, 1] } },
  },
  {
    slug: "glow",
    label: "Glow",
    description: "Brilho suave em loop",
    variants: { initial: { opacity: 1 }, animate: { opacity: [1, 0.85, 1] } },
  },
  {
    slug: "neon",
    label: "Neon",
    description: "Efeito neon piscando (atrai atenção)",
    variants: { initial: { opacity: 1 }, animate: { opacity: [1, 0.5, 1, 0.7, 1] } },
  },
  {
    slug: "float",
    label: "Float",
    description: "Flutua suavemente (botões)",
    variants: { initial: { y: 0 }, animate: { y: [0, -8, 0] } },
  },
];

export function getMotionPreset(slug: MotionPreset | undefined) {
  return MOTION_PRESETS.find((m) => m.slug === (slug ?? "none")) ?? MOTION_PRESETS[0];
}

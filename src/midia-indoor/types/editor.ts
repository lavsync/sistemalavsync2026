/**
 * Tipagem do editor visual (Canva-style) para o módulo de Templates.
 */

export type CanvasFormat = "horizontal" | "vertical";

export const CANVAS_PRESETS: Record<CanvasFormat, { width: number; height: number; label: string; icon: string }> = {
  horizontal: { width: 1920, height: 1080, label: "TV Horizontal (16:9)", icon: "Monitor" },
  vertical: { width: 1080, height: 1920, label: "TV Vertical (9:16)", icon: "Smartphone" },
};

export type ElementType =
  | "heading"
  | "subtitle"
  | "text"
  | "cta"
  | "button"
  | "qrcode"
  | "phone"
  | "url"
  | "logo"
  | "image"
  | "video"
  | "sticker"
  | "price"
  | "shape";

export type MotionPreset =
  | "none"
  | "fade-in"
  | "zoom-in"
  | "slide-left"
  | "slide-right"
  | "slide-up"
  | "slide-down"
  | "pulse"
  | "glow"
  | "neon"
  | "float";

export type QrSource = "whatsapp" | "website" | "instagram" | "landing" | "custom";

export interface ElementBase {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  locked?: boolean;
  hidden?: boolean;
  motion?: {
    preset: MotionPreset;
    delay: number;
    duration: number;
  };
}

export interface TextElement extends ElementBase {
  type: "heading" | "subtitle" | "text" | "cta";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline";
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number;
  textShadow?: string;
  background?: string;
  padding?: number;
  borderRadius?: number;
}

export interface ButtonElement extends ElementBase {
  type: "button";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  background: string;
  borderRadius: number;
  padding: number;
  shadow?: string;
}

export interface QrCodeElement extends ElementBase {
  type: "qrcode";
  source: QrSource;
  /** Valor cru: número WhatsApp, URL, @handle Instagram */
  value: string;
  /** UTM auto-anexada na URL final pro tracking */
  utmCampaign?: string;
  fgColor: string;
  bgColor: string;
  level: "L" | "M" | "Q" | "H";
  margin: number;
  label?: string;
  labelColor?: string;
  labelSize?: number;
  /** Pulse animation no QR */
  pulse?: boolean;
}

export interface ImageElement extends ElementBase {
  type: "image" | "logo" | "sticker";
  src: string;
  alt?: string;
  objectFit: "cover" | "contain" | "fill";
  filter?: string;
  borderRadius?: number;
  shadow?: string;
}

export interface VideoElement extends ElementBase {
  type: "video";
  src: string;
  poster?: string;
  loop: boolean;
  muted: boolean;
  objectFit: "cover" | "contain";
}

export interface PhoneElement extends ElementBase {
  type: "phone";
  /** Número completo +55 31 99999-9999 */
  number: string;
  /** Label personalizada (default: "WhatsApp") */
  label?: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  icon: "phone" | "whatsapp";
}

export interface UrlElement extends ElementBase {
  type: "url";
  url: string;
  label?: string;
  fontFamily: string;
  fontSize: number;
  color: string;
}

export interface PriceElement extends ElementBase {
  type: "price";
  fromLabel?: string;
  fromValue: number;
  byLabel?: string;
  byValue: number;
  currency: string;
  fontFamily: string;
  color: string;
  highlightColor: string;
  size: number;
}

export interface ShapeElement extends ElementBase {
  type: "shape";
  shape: "rect" | "circle" | "line";
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
}

export type EditorElement =
  | TextElement
  | ButtonElement
  | QrCodeElement
  | ImageElement
  | VideoElement
  | PhoneElement
  | UrlElement
  | PriceElement
  | ShapeElement;

export interface EditorBackground {
  type: "color" | "gradient" | "image";
  value: string;
}

export interface EditorTemplate {
  id: string;
  unitId?: string | null;
  name: string;
  format: CanvasFormat;
  width: number;
  height: number;
  background: EditorBackground;
  elements: EditorElement[];
  motion: {
    enterDuration: number;
    exitDuration: number;
  };
  durationSeconds: number;
  isPublished: boolean;
  thumbnailUrl?: string | null;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export type TemplateCategory =
  | "ofertas"
  | "eventos"
  | "premium"
  | "social"
  | "menu"
  | "promo"
  | "pet"
  | "academia"
  | "beleza"
  | "saude"
  | "alimentacao"
  | "moda"
  | "servicos"
  | "automotivo"
  | "educacao"
  | "imobiliaria"
  | "sazonal";

export interface TemplatePreset {
  slug: string;
  name: string;
  description: string;
  category: TemplateCategory;
  format: CanvasFormat[];
  thumbnail?: string;
  buildHorizontal: () => Pick<EditorTemplate, "background" | "elements">;
  buildVertical?: () => Pick<EditorTemplate, "background" | "elements">;
}

export const CATEGORY_LABELS: Record<TemplateCategory, { label: string; emoji: string }> = {
  ofertas: { label: "Ofertas", emoji: "🏷️" },
  eventos: { label: "Eventos", emoji: "🎉" },
  premium: { label: "Premium", emoji: "✨" },
  social: { label: "Social Proof", emoji: "⭐" },
  menu: { label: "Cardápio", emoji: "📖" },
  promo: { label: "Promo", emoji: "📣" },
  pet: { label: "Pet Shop", emoji: "🐾" },
  academia: { label: "Academia", emoji: "💪" },
  beleza: { label: "Beleza", emoji: "💇" },
  saude: { label: "Saúde", emoji: "❤️" },
  alimentacao: { label: "Alimentação", emoji: "🍽️" },
  moda: { label: "Moda", emoji: "👗" },
  servicos: { label: "Serviços", emoji: "🛠️" },
  automotivo: { label: "Automotivo", emoji: "🚗" },
  educacao: { label: "Educação", emoji: "🎓" },
  imobiliaria: { label: "Imobiliária", emoji: "🏠" },
  sazonal: { label: "Sazonal", emoji: "📅" },
};

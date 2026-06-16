import type {
  EditorElement,
  TextElement,
  PriceElement,
  QrCodeElement,
  PhoneElement,
  ShapeElement,
  ButtonElement,
  MotionPreset,
} from "@mi/types/editor";

let _i = 0;
export function id() {
  return `el-${++_i}-${Math.random().toString(36).slice(2, 6)}`;
}
export function reset() { _i = 0; }

// Defaults compartilhados (vira interface mais limpa)
interface BaseDef {
  x: number; y: number; w: number; h: number;
  rotation?: number;
  opacity?: number;
  zIndex?: number;
  motion?: { preset: MotionPreset; delay?: number; duration?: number };
}

function base(d: BaseDef) {
  return {
    id: id(),
    x: d.x, y: d.y,
    width: d.w, height: d.h,
    rotation: d.rotation ?? 0,
    opacity: d.opacity ?? 1,
    zIndex: d.zIndex ?? 5,
    motion: d.motion ? {
      preset: d.motion.preset,
      delay: d.motion.delay ?? 0,
      duration: d.motion.duration ?? 600,
    } : undefined,
  };
}

export function heading(d: BaseDef & {
  text: string; color?: string; size?: number; weight?: number; family?: string;
  align?: "left" | "center" | "right"; spacing?: number; lineHeight?: number; italic?: boolean;
  shadow?: string;
}): TextElement {
  return {
    ...base(d), type: "heading",
    text: d.text,
    fontFamily: d.family ?? "Arial Black",
    fontSize: d.size ?? 100,
    fontWeight: d.weight ?? 900,
    fontStyle: d.italic ? "italic" : "normal",
    color: d.color ?? "#ffffff",
    align: d.align ?? "left",
    lineHeight: d.lineHeight ?? 1.05,
    letterSpacing: d.spacing ?? -2,
    textShadow: d.shadow,
  };
}

export function subtitle(d: BaseDef & {
  text: string; color?: string; size?: number; weight?: number; family?: string;
  align?: "left" | "center" | "right"; spacing?: number;
}): TextElement {
  return {
    ...base(d), type: "subtitle",
    text: d.text,
    fontFamily: d.family ?? "Inter",
    fontSize: d.size ?? 40,
    fontWeight: d.weight ?? 400,
    color: d.color ?? "#e2e8f0",
    align: d.align ?? "left",
    lineHeight: 1.3,
    letterSpacing: d.spacing ?? 0,
  };
}

export function text(d: BaseDef & {
  text: string; color?: string; size?: number; weight?: number; family?: string;
  align?: "left" | "center" | "right"; spacing?: number;
}): TextElement {
  return {
    ...base(d), type: "text",
    text: d.text,
    fontFamily: d.family ?? "Inter",
    fontSize: d.size ?? 28,
    fontWeight: d.weight ?? 500,
    color: d.color ?? "#cbd5e1",
    align: d.align ?? "left",
    lineHeight: 1.4,
    letterSpacing: d.spacing ?? 0,
  };
}

export function cta(d: BaseDef & { text: string; color?: string; size?: number; }): TextElement {
  return {
    ...base(d), type: "cta",
    text: d.text,
    fontFamily: "Inter",
    fontSize: d.size ?? 36,
    fontWeight: 700,
    color: d.color ?? "#facc15",
    align: "left",
    lineHeight: 1,
    letterSpacing: 1,
  };
}

export function priceFromTo(d: BaseDef & {
  fromLabel?: string; fromValue: number; byLabel?: string; byValue: number;
  currency?: string; color?: string; highlight?: string; size?: number;
}): PriceElement {
  return {
    ...base(d), type: "price",
    fromLabel: d.fromLabel ?? "De", fromValue: d.fromValue,
    byLabel: d.byLabel ?? "Por", byValue: d.byValue,
    currency: d.currency ?? "R$",
    fontFamily: "Arial Black",
    color: d.color ?? "#ffffff",
    highlightColor: d.highlight ?? "#facc15",
    size: d.size ?? 1.0,
  };
}

export function qr(d: BaseDef & {
  source: "whatsapp" | "website" | "instagram" | "landing" | "custom";
  value: string;
  utm?: string;
  fg?: string; bg?: string;
  label?: string; labelColor?: string; labelSize?: number;
  pulse?: boolean;
}): QrCodeElement {
  return {
    ...base(d), type: "qrcode",
    source: d.source, value: d.value,
    utmCampaign: d.utm,
    fgColor: d.fg ?? "#0f1720",
    bgColor: d.bg ?? "#ffffff",
    level: "M", margin: 3,
    label: d.label, labelColor: d.labelColor, labelSize: d.labelSize ?? 24,
    pulse: d.pulse ?? true,
  };
}

export function phone(d: BaseDef & {
  number: string; label?: string; icon?: "phone" | "whatsapp";
  color?: string; size?: number;
}): PhoneElement {
  return {
    ...base(d), type: "phone",
    number: d.number, label: d.label, icon: d.icon ?? "whatsapp",
    fontFamily: "Arial Black",
    fontSize: d.size ?? 56,
    fontWeight: 900,
    color: d.color ?? "#ffffff",
  };
}

export function shape(d: BaseDef & {
  fill: string; shape?: "rect" | "circle" | "line"; radius?: number; stroke?: string; strokeWidth?: number;
}): ShapeElement {
  return {
    ...base(d), type: "shape",
    shape: d.shape ?? "rect",
    fill: d.fill,
    borderRadius: d.radius,
    stroke: d.stroke,
    strokeWidth: d.strokeWidth,
  };
}

export function button(d: BaseDef & {
  text: string; bg?: string; color?: string; size?: number; radius?: number;
}): ButtonElement {
  return {
    ...base(d), type: "button",
    text: d.text,
    fontFamily: "Inter",
    fontSize: d.size ?? 28,
    fontWeight: 700,
    color: d.color ?? "#0f1720",
    background: d.bg ?? "#facc15",
    borderRadius: d.radius ?? 12,
    padding: 14,
  };
}

/** Helper: gera array de EditorElement com tipagem segura */
export function elements(...els: EditorElement[]): EditorElement[] {
  return els;
}

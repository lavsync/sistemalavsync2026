"use client";

import {
  Type, Heading1, Heading2, MousePointerClick, Square,
  QrCode, Phone, Link2, Image as ImageIcon, Film, Smile, Tag, Star,
} from "lucide-react";
import { useEditorStore } from "@mi/stores/editor-store";
import { createElement } from "../element-factory";
import type { ElementType, TextElement } from "@mi/types/editor";
import { PanelHeader, SectionLabel } from "./shared";
import { cn } from "@mi/lib/utils";

const EMOJI_STICKERS = [
  "🔥", "⚡", "⭐", "🎁", "💰", "💎", "🎉", "✨",
  "👑", "❤️", "💯", "✅", "🚀", "💪", "🎯", "📣",
  "👀", "💬", "📞", "📍", "🕐", "⏰", "🎊", "🙌",
];

interface ElementBtn {
  type: ElementType;
  icon: typeof Type;
  label: string;
}

const TEXT_ELEMENTS: ElementBtn[] = [
  { type: "heading", icon: Heading1, label: "Título" },
  { type: "subtitle", icon: Heading2, label: "Subtítulo" },
  { type: "text", icon: Type, label: "Texto" },
  { type: "cta", icon: Star, label: "CTA" },
];

const ACTION_ELEMENTS: ElementBtn[] = [
  { type: "button", icon: MousePointerClick, label: "Botão" },
  { type: "qrcode", icon: QrCode, label: "QR Code" },
  { type: "phone", icon: Phone, label: "Telefone" },
  { type: "url", icon: Link2, label: "URL" },
];

const MEDIA_ELEMENTS: ElementBtn[] = [
  { type: "image", icon: ImageIcon, label: "Imagem" },
  { type: "video", icon: Film, label: "Vídeo" },
  { type: "logo", icon: ImageIcon, label: "Logo" },
  { type: "sticker", icon: Smile, label: "Sticker" },
];

const SPECIAL_ELEMENTS: ElementBtn[] = [
  { type: "price", icon: Tag, label: "Preço De/Por" },
  { type: "shape", icon: Square, label: "Forma" },
];

export function ElementsPanel() {
  const addElement = useEditorStore((s) => s.addElement);
  const canvasWidth = useEditorStore((s) => s.width);
  const canvasHeight = useEditorStore((s) => s.height);

  const add = (type: ElementType) => {
    addElement(createElement(type, { canvasWidth, canvasHeight }));
  };

  const addEmoji = (emoji: string) => {
    const base = createElement("text", { canvasWidth, canvasHeight }) as TextElement;
    addElement({
      ...base,
      text: emoji,
      fontSize: 220,
      width: 280,
      height: 280,
      align: "center",
      color: "#ffffff",
    });
  };

  return (
    <div>
      <PanelHeader title="Elementos" subtitle="Clique pra adicionar ao canvas" />

      <div className="px-3 pb-4">
        <SectionLabel>Texto</SectionLabel>
        <Grid items={TEXT_ELEMENTS} onAdd={add} />

        <SectionLabel>Ações (alta conversão)</SectionLabel>
        <Grid items={ACTION_ELEMENTS} onAdd={add} highlight />

        <SectionLabel>Mídia</SectionLabel>
        <Grid items={MEDIA_ELEMENTS} onAdd={add} />

        <SectionLabel>Especial</SectionLabel>
        <Grid items={SPECIAL_ELEMENTS} onAdd={add} />

        <SectionLabel>Stickers / Emojis</SectionLabel>
        <div className="grid grid-cols-6 gap-1.5">
          {EMOJI_STICKERS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => addEmoji(emoji)}
              className="flex h-9 items-center justify-center rounded-md bg-white/[0.03] text-xl transition-all hover:scale-110 hover:bg-white/10"
              title={`Adicionar ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Grid({ items, onAdd, highlight = false }: { items: ElementBtn[]; onAdd: (t: ElementType) => void; highlight?: boolean }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2">
      {items.map(({ type, icon: Icon, label }) => (
        <button
          key={type}
          onClick={() => onAdd(type)}
          className={cn(
            "group flex flex-col items-center gap-1.5 rounded-lg border bg-white/[0.03] p-3 text-center transition-all hover:scale-[1.03]",
            highlight
              ? "border-primary/30 hover:border-primary hover:bg-primary/15"
              : "border-white/10 hover:border-white/30 hover:bg-white/10",
          )}
        >
          <Icon className={cn("h-5 w-5 transition-transform", highlight ? "text-primary" : "text-white/70 group-hover:text-white")} />
          <span className={cn("text-[11px] font-medium", highlight ? "text-primary" : "text-white/70 group-hover:text-white")}>
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}

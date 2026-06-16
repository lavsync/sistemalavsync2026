"use client";

import { useEditorStore } from "@mi/stores/editor-store";
import { PanelHeader } from "./shared";
import { TextProperties } from "./properties/text-props";
import { QrProperties } from "./properties/qr-props";
import { ImageProperties } from "./properties/image-props";
import { VideoProperties } from "./properties/video-props";
import { PhoneProperties } from "./properties/phone-props";
import { PriceProperties } from "./properties/price-props";
import { ShapeProperties } from "./properties/shape-props";
import { ButtonProperties } from "./properties/button-props";
import { CommonProperties } from "./properties/common-props";
import { CanvasProperties } from "./properties/canvas-props";

export function RightSidebar() {
  const selectedId = useEditorStore((s) => s.selectedId);
  const elements = useEditorStore((s) => s.elements);

  const el = elements.find((e) => e.id === selectedId);

  if (!el) {
    return (
      <aside className="w-80 shrink-0 overflow-y-auto border-l border-white/10 bg-[#0a0f14]/80 backdrop-blur-xl scrollbar-thin">
        <PanelHeader title="Canvas" subtitle="Sem seleção · ajustes do canvas" />
        <CanvasProperties />
      </aside>
    );
  }

  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-l border-white/10 bg-[#0a0f14]/80 backdrop-blur-xl scrollbar-thin">
      <PanelHeader
        title={typeLabel(el.type)}
        subtitle="Propriedades do elemento"
      />

      <div className="px-3 pb-6 pt-2">
        {el.type === "qrcode" && <QrProperties element={el} />}
        {(el.type === "image" || el.type === "logo" || el.type === "sticker") && (
          <ImageProperties element={el} />
        )}
        {el.type === "video" && <VideoProperties element={el} />}
        {(el.type === "heading" || el.type === "subtitle" || el.type === "text" || el.type === "cta") && (
          <TextProperties element={el} />
        )}
        {el.type === "button" && <ButtonProperties element={el} />}
        {el.type === "phone" && <PhoneProperties element={el} />}
        {el.type === "price" && <PriceProperties element={el} />}
        {el.type === "shape" && <ShapeProperties element={el} />}

        <CommonProperties element={el} />
      </div>
    </aside>
  );
}

function typeLabel(t: string) {
  switch (t) {
    case "heading": return "Título";
    case "subtitle": return "Subtítulo";
    case "text": return "Texto";
    case "cta": return "CTA";
    case "button": return "Botão";
    case "qrcode": return "QR Code";
    case "phone": return "Telefone";
    case "url": return "URL";
    case "logo": return "Logo";
    case "image": return "Imagem";
    case "video": return "Vídeo";
    case "sticker": return "Sticker";
    case "price": return "Preço";
    case "shape": return "Forma";
    default: return "Elemento";
  }
}

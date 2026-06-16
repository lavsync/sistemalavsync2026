import type {
  EditorElement,
  ElementType,
  TextElement,
  ButtonElement,
  QrCodeElement,
  ImageElement,
  VideoElement,
  PhoneElement,
  PriceElement,
  ShapeElement,
  UrlElement,
} from "@mi/types/editor";

const newId = () => crypto.randomUUID();

interface CreateOpts {
  canvasWidth: number;
  canvasHeight: number;
}

/** Centro do canvas como ponto de inserção default. */
function center({ canvasWidth, canvasHeight }: CreateOpts, w: number, h: number) {
  return { x: Math.round((canvasWidth - w) / 2), y: Math.round((canvasHeight - h) / 2) };
}

export function createElement(type: ElementType, opts: CreateOpts): EditorElement {
  const base = {
    id: newId(),
    rotation: 0,
    opacity: 1,
    zIndex: 100,
    motion: { preset: "fade-in" as const, delay: 0, duration: 600 },
  };

  switch (type) {
    case "heading": {
      const w = 1200, h = 200;
      const { x, y } = center(opts, w, h);
      const el: TextElement = {
        ...base,
        type: "heading",
        x, y, width: w, height: h,
        text: "Seu título aqui",
        fontFamily: "Inter",
        fontSize: 96,
        fontWeight: 900,
        color: "#ffffff",
        align: "left",
        lineHeight: 1.1,
        letterSpacing: -2,
      };
      return el;
    }
    case "subtitle": {
      const w = 900, h = 90;
      const { x, y } = center(opts, w, h);
      const el: TextElement = {
        ...base,
        type: "subtitle",
        x, y, width: w, height: h,
        text: "Subtítulo de apoio",
        fontFamily: "Inter",
        fontSize: 48,
        fontWeight: 500,
        color: "#e2e8f0",
        align: "left",
        lineHeight: 1.2,
        letterSpacing: 0,
      };
      return el;
    }
    case "text": {
      const w = 700, h = 70;
      const { x, y } = center(opts, w, h);
      const el: TextElement = {
        ...base,
        type: "text",
        x, y, width: w, height: h,
        text: "Texto descritivo",
        fontFamily: "Inter",
        fontSize: 32,
        fontWeight: 400,
        color: "#cbd5e1",
        align: "left",
        lineHeight: 1.4,
        letterSpacing: 0,
      };
      return el;
    }
    case "cta": {
      const w = 700, h = 100;
      const { x, y } = center(opts, w, h);
      const el: TextElement = {
        ...base,
        type: "cta",
        x, y, width: w, height: h,
        text: "Aponte a câmera agora",
        fontFamily: "Inter",
        fontSize: 44,
        fontWeight: 700,
        color: "#facc15",
        align: "center",
        lineHeight: 1,
        letterSpacing: 1,
      };
      return el;
    }
    case "button": {
      const w = 360, h = 100;
      const { x, y } = center(opts, w, h);
      const el: ButtonElement = {
        ...base,
        type: "button",
        x, y, width: w, height: h,
        text: "Saiba mais",
        fontFamily: "Inter",
        fontSize: 32,
        fontWeight: 700,
        color: "#0f1720",
        background: "#facc15",
        borderRadius: 12,
        padding: 16,
        motion: { preset: "float", delay: 0, duration: 1500 },
      };
      return el;
    }
    case "qrcode": {
      const w = 380, h = 440;
      const { x, y } = center(opts, w, h);
      const el: QrCodeElement = {
        ...base,
        type: "qrcode",
        x, y, width: w, height: h,
        source: "whatsapp",
        value: "5531999999999",
        utmCampaign: "qr-custom",
        fgColor: "#0f1720",
        bgColor: "#ffffff",
        level: "M",
        margin: 3,
        label: "Aponte a câmera",
        labelColor: "#0f1720",
        labelSize: 22,
        pulse: true,
        motion: { preset: "pulse", delay: 0, duration: 1800 },
      };
      return el;
    }
    case "phone": {
      const w = 600, h = 90;
      const { x, y } = center(opts, w, h);
      const el: PhoneElement = {
        ...base,
        type: "phone",
        x, y, width: w, height: h,
        number: "(31) 99999-9999",
        icon: "whatsapp",
        label: "WhatsApp",
        fontFamily: "Arial Black",
        fontSize: 48,
        fontWeight: 900,
        color: "#ffffff",
      };
      return el;
    }
    case "url": {
      const w = 700, h = 70;
      const { x, y } = center(opts, w, h);
      const el: UrlElement = {
        ...base,
        type: "url",
        x, y, width: w, height: h,
        url: "https://sistema.lavsync.com.br",
        label: "sistema.lavsync.com.br",
        fontFamily: "Inter",
        fontSize: 32,
        color: "#a7f3d0",
      };
      return el;
    }
    case "logo": {
      const w = 240, h = 240;
      const { x, y } = center(opts, w, h);
      const el: ImageElement = {
        ...base,
        type: "logo",
        x, y, width: w, height: h,
        src: "",
        objectFit: "contain",
      };
      return el;
    }
    case "image": {
      const w = 800, h = 500;
      const { x, y } = center(opts, w, h);
      const el: ImageElement = {
        ...base,
        type: "image",
        x, y, width: w, height: h,
        src: "",
        objectFit: "cover",
        borderRadius: 16,
      };
      return el;
    }
    case "video": {
      const w = 960, h = 540;
      const { x, y } = center(opts, w, h);
      const el: VideoElement = {
        ...base,
        type: "video",
        x, y, width: w, height: h,
        src: "",
        loop: true,
        muted: true,
        objectFit: "cover",
      };
      return el;
    }
    case "sticker": {
      const w = 220, h = 220;
      const { x, y } = center(opts, w, h);
      const el: ImageElement = {
        ...base,
        type: "sticker",
        x, y, width: w, height: h,
        src: "",
        objectFit: "contain",
      };
      return el;
    }
    case "price": {
      const w = 900, h = 360;
      const { x, y } = center(opts, w, h);
      const el: PriceElement = {
        ...base,
        type: "price",
        x, y, width: w, height: h,
        fromLabel: "De",
        fromValue: 99.9,
        byLabel: "Por",
        byValue: 49.9,
        currency: "R$",
        fontFamily: "Arial Black",
        color: "#ffffff",
        highlightColor: "#facc15",
        size: 1.0,
      };
      return el;
    }
    case "shape": {
      const w = 400, h = 400;
      const { x, y } = center(opts, w, h);
      const el: ShapeElement = {
        ...base,
        type: "shape",
        x, y, width: w, height: h,
        shape: "rect",
        fill: "#14b8a6",
        borderRadius: 16,
      };
      return el;
    }
  }
}

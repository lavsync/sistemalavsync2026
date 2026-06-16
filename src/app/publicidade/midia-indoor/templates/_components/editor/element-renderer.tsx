"use client";

import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { motion } from "motion/react";
import type {
  EditorElement,
  TextElement,
  ButtonElement,
  QrCodeElement,
  ImageElement,
  VideoElement,
  PhoneElement,
  UrlElement,
  PriceElement,
  ShapeElement,
} from "@mi/types/editor";
import { resolveQrUrl } from "../qr-helpers";
import { getMotionPreset } from "../motion-presets";

interface ElementRendererProps {
  element: EditorElement;
  /** Modo: edit (mostra placeholders), preview (anima), thumb (estático) */
  mode?: "edit" | "preview" | "thumb";
}

export function ElementRenderer({ element, mode = "edit" }: ElementRendererProps) {
  const motionPreset = getMotionPreset(element.motion?.preset);
  const isAnimating = mode === "preview";

  const wrapperStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    overflow: "visible",
    display: "flex",
    alignItems: "stretch",
    justifyContent: "stretch",
  };

  const inner = (() => {
    switch (element.type) {
      case "heading":
      case "subtitle":
      case "text":
      case "cta":
        return <TextRender el={element as TextElement} />;
      case "button":
        return <ButtonRender el={element as ButtonElement} />;
      case "qrcode":
        return <QrRender el={element as QrCodeElement} mode={mode} />;
      case "image":
      case "logo":
      case "sticker":
        return <ImageRender el={element as ImageElement} mode={mode} />;
      case "video":
        return <VideoRender el={element as VideoElement} mode={mode} />;
      case "phone":
        return <PhoneRender el={element as PhoneElement} />;
      case "url":
        return <UrlRender el={element as UrlElement} />;
      case "price":
        return <PriceRender el={element as PriceElement} />;
      case "shape":
        return <ShapeRender el={element as ShapeElement} />;
      default:
        return null;
    }
  })();

  if (mode === "thumb") {
    return <div style={wrapperStyle}>{inner}</div>;
  }

  return (
    <motion.div
      style={wrapperStyle}
      initial={isAnimating ? (motionPreset.variants.initial as Record<string, number | number[]>) : false}
      animate={motionPreset.variants.animate as Record<string, number | number[]>}
      transition={{
        delay: (element.motion?.delay ?? 0) / 1000,
        duration: (element.motion?.duration ?? 600) / 1000,
        repeat: ["pulse", "glow", "neon", "float"].includes(element.motion?.preset ?? "") ? Infinity : 0,
        ease: "easeOut",
      }}
    >
      {inner}
    </motion.div>
  );
}

// ─── Renderers individuais ──────────────────────────────────────────────────

function TextRender({ el }: { el: TextElement }) {
  return (
    <div
      style={{
        width: "100%", height: "100%",
        fontFamily: el.fontFamily, fontSize: el.fontSize,
        fontWeight: el.fontWeight, fontStyle: el.fontStyle,
        textDecoration: el.textDecoration,
        color: el.color, textAlign: el.align,
        lineHeight: el.lineHeight,
        letterSpacing: `${el.letterSpacing}px`,
        whiteSpace: "pre-wrap", wordBreak: "break-word",
        textShadow: el.textShadow,
        background: el.background, padding: el.padding,
        borderRadius: el.borderRadius,
        display: "flex",
        alignItems: el.background ? "center" : "flex-start",
        justifyContent: el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start",
      }}
    >
      {el.text}
    </div>
  );
}

function ButtonRender({ el }: { el: ButtonElement }) {
  return (
    <div
      style={{
        width: "100%", height: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: el.background, color: el.color,
        fontFamily: el.fontFamily, fontSize: el.fontSize, fontWeight: el.fontWeight,
        borderRadius: el.borderRadius, padding: el.padding,
        boxShadow: el.shadow,
        textAlign: "center",
        lineHeight: 1,
      }}
    >
      {el.text}
    </div>
  );
}

function QrRender({ el, mode }: { el: QrCodeElement; mode: "edit" | "preview" | "thumb" }) {
  const url = resolveQrUrl(el.source, el.value, el.utmCampaign);
  const labelHeight = el.label ? (el.labelSize ?? 22) + 16 : 0;
  const qrSize = Math.min(el.width, el.height - labelHeight);
  const pulse = el.pulse && mode === "preview";

  return (
    <div
      style={{
        width: "100%", height: "100%",
        background: el.bgColor,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: el.margin * 4,
        borderRadius: 16,
        boxShadow: pulse ? `0 0 0 0 ${el.fgColor}66, 0 8px 32px rgba(0,0,0,0.2)` : "0 8px 32px rgba(0,0,0,0.2)",
      }}
    >
      {url ? (
        <QRCodeSVG
          value={url}
          size={qrSize}
          fgColor={el.fgColor}
          bgColor={el.bgColor}
          level={el.level}
          marginSize={0}
        />
      ) : (
        <div style={{ fontSize: 14, color: el.fgColor, opacity: 0.5 }}>
          Configure o QR Code
        </div>
      )}
      {el.label && (
        <div
          style={{
            marginTop: 10, color: el.labelColor ?? el.fgColor,
            fontSize: el.labelSize ?? 22, fontWeight: 700,
            fontFamily: "Inter", textAlign: "center", lineHeight: 1,
          }}
        >
          {el.label}
        </div>
      )}
    </div>
  );
}

function ImageRender({ el }: { el: ImageElement; mode: "edit" | "preview" | "thumb" }) {
  if (!el.src) {
    return (
      <div
        style={{
          width: "100%", height: "100%",
          display: "grid", placeItems: "center",
          background: "rgba(255,255,255,0.05)",
          border: "2px dashed rgba(255,255,255,0.2)",
          borderRadius: el.borderRadius ?? 8,
          color: "rgba(255,255,255,0.5)",
          fontSize: 14, fontWeight: 500,
        }}
      >
        Sem imagem
      </div>
    );
  }
  return (
    <Image
      src={el.src}
      alt={el.alt ?? ""}
      fill
      sizes={`${el.width}px`}
      style={{
        objectFit: el.objectFit,
        borderRadius: el.borderRadius,
        filter: el.filter,
        boxShadow: el.shadow,
      }}
      unoptimized
    />
  );
}

function VideoRender({ el, mode }: { el: VideoElement; mode: "edit" | "preview" | "thumb" }) {
  if (!el.src) {
    return (
      <div
        style={{
          width: "100%", height: "100%",
          display: "grid", placeItems: "center",
          background: "rgba(0,0,0,0.5)",
          border: "2px dashed rgba(255,255,255,0.2)",
          borderRadius: 8,
          color: "rgba(255,255,255,0.5)",
          fontSize: 14, fontWeight: 500,
        }}
      >
        Sem vídeo
      </div>
    );
  }
  return (
    <video
      src={el.src}
      poster={el.poster}
      autoPlay={mode === "preview"}
      muted={el.muted}
      loop={el.loop}
      playsInline
      style={{ width: "100%", height: "100%", objectFit: el.objectFit }}
    />
  );
}

function PhoneRender({ el }: { el: PhoneElement }) {
  const icon = el.icon === "whatsapp" ? "💬" : "📞";
  return (
    <div
      style={{
        width: "100%", height: "100%",
        display: "flex", alignItems: "center", gap: 16,
        fontFamily: el.fontFamily, fontSize: el.fontSize, fontWeight: el.fontWeight,
        color: el.color,
      }}
    >
      <span style={{ fontSize: el.fontSize * 0.9 }}>{icon}</span>
      <span>{el.number}</span>
    </div>
  );
}

function UrlRender({ el }: { el: UrlElement }) {
  return (
    <div
      style={{
        width: "100%", height: "100%",
        display: "flex", alignItems: "center", gap: 12,
        fontFamily: el.fontFamily, fontSize: el.fontSize,
        color: el.color,
      }}
    >
      <span style={{ opacity: 0.7 }}>🔗</span>
      <span style={{ textDecoration: "underline" }}>{el.label ?? el.url}</span>
    </div>
  );
}

function PriceRender({ el }: { el: PriceElement }) {
  const fromSize = 60 * el.size;
  const bySize = 180 * el.size;
  return (
    <div
      style={{
        width: "100%", height: "100%",
        display: "flex", flexDirection: "column", justifyContent: "center",
        fontFamily: el.fontFamily, color: el.color,
      }}
    >
      {(el.fromLabel || el.fromValue) && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, opacity: 0.8 }}>
          {el.fromLabel && (
            <span style={{ fontSize: fromSize * 0.5, fontWeight: 600, letterSpacing: 4 }}>
              {el.fromLabel.toUpperCase()}
            </span>
          )}
          <span
            style={{
              fontSize: fromSize, fontWeight: 700,
              textDecoration: "line-through", textDecorationThickness: 4,
            }}
          >
            {el.currency} {el.fromValue.toFixed(2).replace(".", ",")}
          </span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 8 }}>
        {el.byLabel && (
          <span style={{ fontSize: fromSize * 0.5, fontWeight: 700, letterSpacing: 4, color: el.highlightColor }}>
            {el.byLabel.toUpperCase()}
          </span>
        )}
        <span
          style={{
            fontSize: bySize, fontWeight: 900,
            color: el.highlightColor, lineHeight: 0.95,
            textShadow: `0 4px 20px ${el.highlightColor}33`,
          }}
        >
          {el.currency} {el.byValue.toFixed(2).replace(".", ",")}
        </span>
      </div>
    </div>
  );
}

function ShapeRender({ el }: { el: ShapeElement }) {
  if (el.shape === "circle") {
    return (
      <div
        style={{
          width: "100%", height: "100%", borderRadius: "50%",
          background: el.fill,
          border: el.stroke ? `${el.strokeWidth ?? 2}px solid ${el.stroke}` : undefined,
        }}
      />
    );
  }
  if (el.shape === "line") {
    return (
      <div
        style={{
          width: "100%", height: el.strokeWidth ?? 2,
          background: el.fill,
          alignSelf: "center",
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: "100%", height: "100%",
        background: el.fill,
        borderRadius: el.borderRadius,
        border: el.stroke ? `${el.strokeWidth ?? 2}px solid ${el.stroke}` : undefined,
      }}
    />
  );
}

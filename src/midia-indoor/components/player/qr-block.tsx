"use client";

import { QRCodeSVG } from "qrcode.react";

interface QrBlockProps {
  value: string;
  size?: number;
  label?: string;
}

export function QrBlock({ value, size = 220, label = "Aponte a câmera" }: QrBlockProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-5 shadow-xl">
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        marginSize={2}
        fgColor="#0f1720"
        bgColor="#ffffff"
      />
      <p className="text-center text-base font-semibold text-slate-900">{label}</p>
    </div>
  );
}

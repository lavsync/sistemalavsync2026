"use client";

import { useState, useRef } from "react";
import { QrCode, Download, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@mi/components/ui/button";
import { toast } from "sonner";

export function QrPreviewButton({ url, label }: { url: string; label: string }) {
  const [open, setOpen] = useState(false);
  const svgRef = useRef<HTMLDivElement>(null);

  const download = (format: "svg" | "png") => {
    const svg = svgRef.current?.querySelector("svg");
    if (!svg) return;

    if (format === "svg") {
      const data = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([data], { type: "image/svg+xml" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `qr-${label.toLowerCase().replace(/\s+/g, "-")}.svg`;
      link.click();
      URL.revokeObjectURL(link.href);
    } else {
      // PNG: render SVG em canvas
      const data = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, 1024, 1024);
        ctx.drawImage(img, 0, 0, 1024, 1024);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `qr-${label.toLowerCase().replace(/\s+/g, "-")}.png`;
          link.click();
          URL.revokeObjectURL(link.href);
        }, "image/png");
      };
      img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(data)))}`;
    }

    toast.success(`QR ${format.toUpperCase()} baixado`);
  };

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
        <QrCode className="h-4 w-4" />
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative max-w-md rounded-xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>

            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">QR Code</p>
            <h3 className="mb-4 font-semibold">{label}</h3>

            <div ref={svgRef} className="grid place-items-center rounded-lg border bg-white p-6">
              <QRCodeSVG value={url} size={280} level="M" marginSize={2} />
            </div>

            <p className="mt-3 break-all text-center font-mono text-[11px] text-muted-foreground">
              {url}
            </p>

            <div className="mt-4 flex gap-2">
              <Button onClick={() => download("png")} className="flex-1">
                <Download className="h-4 w-4" /> Baixar PNG
              </Button>
              <Button onClick={() => download("svg")} variant="outline" className="flex-1">
                <Download className="h-4 w-4" /> Baixar SVG
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

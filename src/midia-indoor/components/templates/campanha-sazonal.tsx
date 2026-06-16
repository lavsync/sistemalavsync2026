"use client";

import Image from "next/image";
import { QrBlock } from "@mi/components/player/qr-block";

interface CampanhaSazonalPayload {
  headline?: string | null;
  subheadline?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  media_url?: string | null;
  qr_codes?: { target_url: string } | null;
}

export function CampanhaSazonalTemplate({ payload }: { payload: Record<string, unknown> }) {
  const p = payload as CampanhaSazonalPayload;
  const qrUrl = p.qr_codes?.target_url ?? p.cta_url ?? "";

  return (
    <div className="player-screen relative overflow-hidden">
      {p.media_url && (
        <Image
          src={p.media_url}
          alt={p.headline ?? ""}
          fill
          className="object-cover"
          unoptimized
          priority
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />

      <div className="player-safe absolute inset-0 grid place-items-end justify-start text-white">
        <div className="max-w-3xl pb-16">
          <h1 className="text-balance text-6xl font-bold leading-tight tracking-tight drop-shadow-lg lg:text-7xl xl:text-8xl">
            {p.headline ?? "Aproveite agora"}
          </h1>
          {p.subheadline && (
            <p className="mt-4 text-balance text-2xl text-white/90 drop-shadow lg:text-3xl">
              {p.subheadline}
            </p>
          )}
          {qrUrl && (
            <div className="mt-8 inline-block">
              <QrBlock value={qrUrl} size={200} label={p.cta_label ?? "Aponte a câmera"} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

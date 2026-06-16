"use client";

import Image from "next/image";
import { QrBlock } from "@mi/components/player/qr-block";

interface OfertaPayload {
  headline?: string | null;
  subheadline?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  media_url?: string | null;
  partners?: { name: string; logo_url: string | null } | null;
  offers?: { title: string; coupon: string | null; banner_url: string | null } | null;
  qr_codes?: { short_code: string; target_url: string } | null;
}

export function OfertaParceiroTemplate({ payload }: { payload: Record<string, unknown> }) {
  const p = payload as unknown as OfertaPayload;
  const banner = p.media_url ?? p.offers?.banner_url ?? null;
  const qrUrl = p.qr_codes?.target_url ?? p.cta_url ?? "";

  return (
    <div className="player-screen relative grid grid-cols-[1.5fr_1fr] bg-gradient-to-br from-[var(--brand-turquoise)] via-[var(--brand-turquoise-light)] to-white">
      <div className="relative overflow-hidden">
        {banner ? (
          <Image src={banner} alt={p.offers?.title ?? p.headline ?? ""} fill className="object-cover" unoptimized priority />
        ) : (
          <div className="grid h-full place-items-center text-9xl text-white/30">🎁</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/15" />
      </div>

      <div className="player-safe relative flex flex-col justify-between bg-white">
        <div>
          {p.partners?.logo_url && (
            <div className="mb-6 grid h-20 w-20 place-items-center overflow-hidden rounded-xl border bg-background">
              <Image src={p.partners.logo_url} alt={p.partners.name} width={80} height={80} className="h-full w-full object-cover" unoptimized />
            </div>
          )}
          {p.partners?.name && (
            <p className="mb-2 text-xs uppercase tracking-widest text-[var(--brand-turquoise-dark)]">
              {p.partners.name}
            </p>
          )}
          <h1 className="text-balance text-5xl font-bold leading-tight tracking-tight text-slate-900 lg:text-6xl xl:text-7xl">
            {p.headline ?? p.offers?.title ?? "Oferta especial"}
          </h1>
          {p.subheadline && (
            <p className="mt-4 text-balance text-xl text-slate-600 lg:text-2xl xl:text-3xl">
              {p.subheadline}
            </p>
          )}
          {p.offers?.coupon && (
            <div className="mt-6 inline-block rounded-lg bg-[var(--brand-yellow)] px-5 py-3 font-mono text-2xl font-bold text-yellow-900 lg:text-3xl">
              {p.offers.coupon}
            </div>
          )}
        </div>

        {qrUrl && (
          <div className="flex justify-start">
            <QrBlock value={qrUrl} size={240} label={p.cta_label ?? "Aponte a câmera"} />
          </div>
        )}
      </div>
    </div>
  );
}

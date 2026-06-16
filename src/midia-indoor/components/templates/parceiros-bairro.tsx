"use client";

import Image from "next/image";
import { Store } from "lucide-react";

interface ParceiroItem {
  name?: string;
  logo_url?: string | null;
}

interface ParceirosBairroPayload {
  headline?: string | null;
  subheadline?: string | null;
  partners?: ParceiroItem | ParceiroItem[];
}

export function ParceirosBairroTemplate({ payload }: { payload: Record<string, unknown> }) {
  const p = payload as ParceirosBairroPayload;
  const partners = Array.isArray(p.partners) ? p.partners : p.partners ? [p.partners] : [];

  return (
    <div className="player-screen relative grid place-items-center bg-gradient-to-br from-slate-900 via-[var(--brand-turquoise-dark)] to-slate-900 text-white">
      <div className="player-safe text-center max-w-6xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold backdrop-blur-sm">
          <Store className="h-4 w-4" />
          Parceiros do bairro
        </div>
        <h1 className="text-balance text-5xl font-bold leading-tight tracking-tight lg:text-6xl xl:text-7xl">
          {p.headline ?? "Conheça quem faz parte da nossa rede local"}
        </h1>
        <p className="mt-3 text-balance text-xl text-white/80 lg:text-2xl">
          {p.subheadline ?? "Comerciantes do bairro com benefícios exclusivos pra você."}
        </p>

        {partners.length > 0 && (
          <div className="mt-10 grid grid-cols-3 gap-6 sm:grid-cols-4 md:grid-cols-5">
            {partners.slice(0, 10).map((partner, i) => (
              <div
                key={i}
                className="aspect-square overflow-hidden rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm"
              >
                {partner.logo_url ? (
                  <Image
                    src={partner.logo_url}
                    alt={partner.name ?? ""}
                    width={120}
                    height={120}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="grid h-full place-items-center text-2xl font-bold">
                    {(partner.name ?? "?").slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

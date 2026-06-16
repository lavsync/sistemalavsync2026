"use client";

import { Trophy, Star } from "lucide-react";

interface RankingPayload {
  headline?: string | null;
  subheadline?: string | null;
  cta_label?: string | null;
}

export function RankingClienteTemplate({ payload }: { payload: Record<string, unknown> }) {
  const p = payload as RankingPayload;

  return (
    <div className="player-screen relative grid place-items-center bg-gradient-to-br from-[var(--brand-yellow)] via-[#fdd835] to-[var(--brand-orange)] text-yellow-900">
      <div className="player-safe text-center max-w-5xl">
        <div className="mx-auto mb-8 grid h-28 w-28 place-items-center rounded-3xl bg-yellow-900 text-[var(--brand-yellow)] shadow-2xl">
          <Trophy className="h-14 w-14" />
        </div>
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-yellow-900/15 px-4 py-1.5 text-sm font-bold uppercase tracking-widest">
          <Star className="h-3.5 w-3.5 fill-current" />
          Cliente Destaque do Mês
        </p>
        <h1 className="text-balance text-6xl font-bold leading-tight lg:text-7xl xl:text-8xl">
          {p.headline ?? "Parabéns! 🎉"}
        </h1>
        <p className="mt-6 text-balance text-2xl lg:text-3xl">
          {p.subheadline ?? "Frequência, confiança e estilo. Você é Xô Varal."}
        </p>
        {p.cta_label && (
          <p className="mt-8 text-xl font-semibold lg:text-2xl">{p.cta_label}</p>
        )}
      </div>
    </div>
  );
}

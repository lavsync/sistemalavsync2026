"use client";

import { Sparkles, Shirt, Heart, Clock, Wind, Award } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles,
  Shirt,
  Heart,
  Clock,
  Wind,
  Award,
};

interface InstitucionalPayload {
  icon?: string;
  title?: string;
  subtitle?: string;
  headline?: string | null;
  subheadline?: string | null;
}

export function InstitucionalTemplate({ payload }: { payload: Record<string, unknown> }) {
  const p = payload as InstitucionalPayload;
  const Icon = ICON_MAP[p.icon ?? "Sparkles"] ?? Sparkles;
  const title = p.title ?? p.headline ?? "Xô Varal — sua lavanderia do bairro";
  const subtitle = p.subtitle ?? p.subheadline ?? "Praticidade, economia de tempo e parceiros locais que oferecem benefícios.";

  return (
    <div className="player-screen relative grid place-items-center overflow-hidden bg-gradient-to-br from-white via-[var(--brand-turquoise-light)]/30 to-white text-slate-900">
      <div className="player-safe text-center max-w-5xl">
        <div className="mx-auto mb-8 grid h-24 w-24 place-items-center rounded-2xl bg-[var(--brand-turquoise)] text-white shadow-xl">
          <Icon className="h-12 w-12" />
        </div>
        <h1 className="text-balance text-6xl font-bold leading-tight tracking-tight lg:text-7xl xl:text-8xl">
          {title}
        </h1>
        <p className="mt-6 text-balance text-2xl text-slate-600 lg:text-3xl xl:text-4xl">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

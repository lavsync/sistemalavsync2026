"use client";

import { QrBlock } from "@mi/components/player/qr-block";
import { Sparkles } from "lucide-react";

interface ClubePayload {
  clubeUrl?: string;
  clubeShortUrl?: string;
  unitName?: string;
}

export function ClubeBeneficiosTemplate({ payload }: { payload: Record<string, unknown> }) {
  const p = payload as ClubePayload;
  const url = p.clubeShortUrl ?? p.clubeUrl ?? "";

  return (
    <div className="player-screen relative grid place-items-center bg-gradient-to-br from-[var(--brand-turquoise)] via-[var(--brand-turquoise-dark)] to-[#072e2c] text-white">
      <div className="player-safe grid grid-cols-2 items-center gap-12 max-w-7xl">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold backdrop-blur-sm">
            <Sparkles className="h-4 w-4" />
            Clube de Benefícios
          </div>
          <h1 className="text-balance text-5xl font-bold leading-tight tracking-tight lg:text-6xl xl:text-7xl">
            Entre gratuitamente no clube
          </h1>
          <p className="mt-4 text-balance text-xl text-white/90 lg:text-2xl xl:text-3xl">
            Desbloqueie ofertas exclusivas dos parceiros do bairro.
          </p>
          <ul className="mt-8 space-y-2 text-lg text-white/90 lg:text-xl">
            <li>✓ Cadastro em 30 segundos</li>
            <li>✓ Sem mensalidade, sem fidelidade</li>
            <li>✓ Descontos só pra clientes Xô Varal</li>
          </ul>
        </div>

        <div className="flex justify-center">
          <QrBlock value={url} size={320} label="Cadastre-se agora" />
        </div>
      </div>
    </div>
  );
}

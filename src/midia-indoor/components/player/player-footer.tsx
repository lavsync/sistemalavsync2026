"use client";

import { Wifi, WifiOff } from "lucide-react";
import { PlayerClock } from "./player-clock";

interface PlayerFooterProps {
  unitName: string;
  whatsapp: string | null;
  online: boolean;
}

export function PlayerFooter({ unitName, whatsapp, online }: PlayerFooterProps) {
  return (
    <footer className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 bg-gradient-to-t from-black/60 via-black/30 to-transparent px-[clamp(2rem,4vw,4rem)] py-[clamp(1rem,2vw,2rem)] text-white">
      <div className="flex items-center gap-3 text-sm">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 backdrop-blur-sm font-bold">
          XV
        </div>
        <div className="leading-tight">
          <p className="text-xs uppercase tracking-wider text-white/70">Xô Varal</p>
          <p className="text-base font-semibold">{unitName.replace(/^Xô Varal\s+/i, "")}</p>
        </div>
      </div>

      <div className="flex items-center gap-5 text-sm text-white/90">
        {whatsapp && (
          <span className="hidden md:block">
            WhatsApp:{" "}
            <span className="font-semibold">
              {whatsapp.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, "+$1 ($2) $3-$4")}
            </span>
          </span>
        )}
        <span className="flex items-center gap-1.5">
          {online ? (
            <Wifi className="h-4 w-4 text-emerald-400" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-400" />
          )}
        </span>
        <PlayerClock />
      </div>
    </footer>
  );
}

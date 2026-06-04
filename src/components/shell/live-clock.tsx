"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

const TZ = "America/Sao_Paulo";

const dateFmtFull = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  weekday: "short",
  day: "2-digit",
  month: "short",
});

const dateFmtShort = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/**
 * LiveClock — exibe data + hora em tempo real (timezone São Paulo).
 *
 * Render server-side neutro (vazio) para evitar mismatch de hidratação;
 * inicia tick a cada 1s só após mount.
 *
 * - `compact` (mobile): só HH:MM (sem segundos, sem data — economia de espaço)
 * - default (desktop): "qua, 15 mai · 14:23:45"
 */
export function LiveClock({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!now) {
    // Placeholder com a mesma largura aproximada — evita layout shift.
    return (
      <div
        aria-hidden
        className={
          compact
            ? "h-7 w-[58px] rounded-md bg-surface-glass border border-border"
            : "h-7 w-[170px] rounded-md bg-surface-glass border border-border"
        }
      />
    );
  }

  if (compact) {
    const hhmm = timeFmt
      .format(now)
      .split(":")
      .slice(0, 2)
      .join(":");
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-glass border border-border text-[11px] font-mono font-semibold tabular-nums"
        title={`${dateFmtShort.format(now)} · ${timeFmt.format(now)}`}
      >
        <Clock className="w-3 h-3 text-brand-cyan" />
        {hhmm}
      </div>
    );
  }

  // Desktop: data curta + hora cheia
  const dateLabel = dateFmtFull.format(now).replace(/\.$/, "");
  const timeLabel = timeFmt.format(now);

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-surface-glass border border-border text-[11px] font-medium"
      role="timer"
      aria-label="Data e hora atual"
    >
      <Clock className="w-3 h-3 text-brand-cyan" />
      <span className="text-muted-foreground capitalize">{dateLabel}</span>
      <span className="font-mono font-semibold tabular-nums">{timeLabel}</span>
    </div>
  );
}

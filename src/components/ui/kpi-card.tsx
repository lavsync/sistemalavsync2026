"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type Trend = "up" | "down" | "neutral";

export type KpiCardProps = {
  label: string;
  value: React.ReactNode;
  prefix?: string;
  suffix?: string;
  delta?: { value: string; trend: Trend; vs?: string };
  icon?: LucideIcon;
  tone?: "cyan" | "purple" | "success" | "warning" | "danger";
  sparkline?: React.ReactNode;
  className?: string;
  index?: number;
};

const toneRing: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  cyan: "before:from-brand-cyan/15",
  purple: "before:from-brand-purple/15",
  success: "before:from-success/15",
  warning: "before:from-warning/15",
  danger: "before:from-danger/15",
};

const toneIcon: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  cyan: "bg-brand-cyan/12 text-brand-cyan",
  purple: "bg-brand-purple/12 text-brand-purple",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-danger/12 text-danger",
};

export function KpiCard({
  label,
  value,
  prefix,
  suffix,
  delta,
  icon: Icon,
  tone = "cyan",
  sparkline,
  className,
  index = 0,
}: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
      className={cn(
        "card-premium relative overflow-hidden rounded-xl p-5 transition-smooth",
        "before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity",
        "hover:border-border-strong hover:-translate-y-0.5",
        toneRing[tone],
        className
      )}
    >
      <div className="relative z-10 flex items-start justify-between mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", toneIcon[tone])}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="relative z-10 flex items-baseline gap-1.5">
        {prefix && <span className="text-sm text-muted-foreground font-mono">{prefix}</span>}
        <span className="font-mono font-bold text-[26px] leading-none tracking-tight">
          {value}
        </span>
        {suffix && <span className="text-sm text-muted-foreground font-mono">{suffix}</span>}
      </div>

      {delta && (
        <div className="relative z-10 mt-3 flex items-center gap-2 text-[11px]">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-mono font-semibold",
              delta.trend === "up" && "bg-success/15 text-success",
              delta.trend === "down" && "bg-danger/15 text-danger",
              delta.trend === "neutral" && "bg-muted text-muted-foreground"
            )}
          >
            {delta.trend === "up" && <ArrowUp className="w-2.5 h-2.5" />}
            {delta.trend === "down" && <ArrowDown className="w-2.5 h-2.5" />}
            {delta.value}
          </span>
          {delta.vs && <span className="text-muted-foreground/80">{delta.vs}</span>}
        </div>
      )}

      {sparkline && (
        <div className="relative z-10 mt-3 h-10 -mx-1">{sparkline}</div>
      )}
    </motion.div>
  );
}

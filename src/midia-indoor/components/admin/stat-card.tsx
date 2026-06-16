import { Card, CardContent } from "@mi/components/ui/card";
import { cn } from "@mi/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "brand";
}

const TONE_CLASSES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "bg-secondary text-secondary-foreground",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warning: "bg-[var(--brand-yellow)]/25 text-yellow-800 dark:text-yellow-300",
  danger: "bg-destructive/15 text-destructive",
  brand: "bg-primary/15 text-primary",
};

export function StatCard({ label, value, icon: Icon, hint, tone = "brand" }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("rounded-lg p-2.5", TONE_CLASSES[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

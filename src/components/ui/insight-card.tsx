import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Severity = "info" | "warn" | "danger" | "success";

const sevWrap: Record<Severity, string> = {
  info: "border-brand-cyan/30 bg-gradient-to-br from-brand-cyan/[0.06] to-transparent",
  warn: "border-warning/30 bg-gradient-to-br from-warning/[0.06] to-transparent",
  danger: "border-danger/30 bg-gradient-to-br from-danger/[0.06] to-transparent",
  success: "border-success/30 bg-gradient-to-br from-success/[0.06] to-transparent",
};

const sevIcon: Record<Severity, string> = {
  info: "bg-brand-cyan/15 text-brand-cyan",
  warn: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  success: "bg-success/15 text-success",
};

const sevAccent: Record<Severity, string> = {
  info: "text-brand-cyan",
  warn: "text-warning",
  danger: "text-danger",
  success: "text-success",
};

export function InsightCard({
  title,
  body,
  cta,
  severity = "info",
  icon: Icon,
  className,
}: {
  title: string;
  body: React.ReactNode;
  cta?: string;
  severity?: Severity;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group rounded-xl border p-4 transition-smooth hover:border-border-strong",
        sevWrap[severity],
        className
      )}
    >
      <div className="flex gap-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", sevIcon[severity])}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-[13px] leading-snug tracking-tight">{title}</h4>
          <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{body}</p>
          {cta && (
            <button
              className={cn(
                "mt-2.5 inline-flex items-center gap-0.5 text-[11px] font-semibold hover:gap-1 transition-all",
                sevAccent[severity]
              )}
            >
              {cta} <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

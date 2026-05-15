import { cn } from "@/lib/utils";

type Variant = "success" | "warning" | "danger" | "info" | "neutral";

const variants: Record<Variant, string> = {
  success: "bg-success/12 text-success border-success/20",
  warning: "bg-warning/12 text-warning border-warning/20",
  danger: "bg-danger/12 text-danger border-danger/20",
  info: "bg-brand-cyan/12 text-brand-cyan border-brand-cyan/20",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function StatusPill({
  children,
  variant = "neutral",
  pulse = false,
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border",
        variants[variant],
        className
      )}
    >
      {pulse && (
        <span className="relative flex w-1.5 h-1.5">
          <span className="absolute inset-0 rounded-full bg-current opacity-60 animate-ping" />
          <span className="relative rounded-full bg-current w-1.5 h-1.5" />
        </span>
      )}
      {children}
    </span>
  );
}

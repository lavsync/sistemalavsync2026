import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  subtitle,
  actions,
  legend,
  children,
  className,
  height = 280,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  legend?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  height?: number;
}) {
  return (
    <section
      className={cn(
        "card-premium rounded-xl p-5 flex flex-col",
        className
      )}
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-[15px] tracking-tight leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      </header>

      {legend && <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3">{legend}</div>}

      <div className="w-full" style={{ height }}>
        {children}
      </div>
    </section>
  );
}

export function LegendDot({
  color,
  label,
}: {
  color: string;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

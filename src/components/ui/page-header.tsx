import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-cyan mb-2">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-[26px] font-bold tracking-tight leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </header>
  );
}

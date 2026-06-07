"use client";
import * as React from "react";

export function Counter({
  value, duration = 1200, prefix = "", suffix = "", decimals = 0, className,
}: {
  value: number; duration?: number; prefix?: string; suffix?: string;
  decimals?: number; className?: string;
}) {
  const [display, setDisplay] = React.useState(0);
  const start = React.useRef<number | null>(null);
  const from = React.useRef(0);

  React.useEffect(() => {
    let raf = 0;
    from.current = display;
    start.current = null;
    const target = value;
    function tick(ts: number) {
      if (start.current == null) start.current = ts;
      const elapsed = ts - start.current;
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from.current + (target - from.current) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const formatted = display.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return <span className={className}>{prefix}{formatted}{suffix}</span>;
}

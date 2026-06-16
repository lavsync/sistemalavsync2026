"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE = "/publicidade/midia-indoor";

const TABS: { label: string; href: string }[] = [
  { label: "Visão Geral", href: `${BASE}/dashboard` },
  { label: "Templates", href: `${BASE}/templates` },
  { label: "Campanhas", href: `${BASE}/campanhas` },
  { label: "Ofertas", href: `${BASE}/ofertas` },
  { label: "Parceiros", href: `${BASE}/parceiros` },
  { label: "Unidades", href: `${BASE}/unidades` },
  { label: "Leads", href: `${BASE}/leads` },
  { label: "QR Codes", href: `${BASE}/qr-codes` },
  { label: "Métricas", href: `${BASE}/metricas` },
  { label: "Clube", href: `${BASE}/clube` },
];

export function ModuleNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="flex items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        <span className="mr-3 shrink-0 text-xs font-bold uppercase tracking-widest text-primary">
          Mídia Indoor
        </span>
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

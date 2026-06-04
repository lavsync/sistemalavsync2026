"use client";

import { Bell, Command, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { LiveClock } from "./live-clock";
import { MobileNavTrigger } from "./mobile-nav";
import { UnidadeSwitcher, type UnidadeOpt } from "./unidade-switcher";

export function Topbar({
  unidades,
  unidadeAtivaId,
}: {
  unidades: UnidadeOpt[];
  unidadeAtivaId: string;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="h-full flex items-center gap-2 px-3 md:gap-3 md:px-5">
        {/* Mobile menu trigger */}
        <MobileNavTrigger />

        {/* Search — hidden on smallest, expands on sm+ */}
        <div className="flex-1 max-w-md min-w-0">
          <div className="group relative flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-glass border border-border hover:border-border-strong transition-smooth">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Buscar..."
              className="bg-transparent text-xs flex-1 outline-none placeholder:text-muted-foreground/70 min-w-0"
            />
            <kbd className="hidden md:inline-flex items-center gap-0.5 text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
              <Command className="w-2.5 h-2.5" /> K
            </kbd>
          </div>
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-1.5">
          {/* Switcher de unidade — sempre visível, é a base do contexto */}
          <UnidadeSwitcher unidades={unidades} ativaId={unidadeAtivaId} />

          {/* Live clock — compact mobile, full desktop */}
          <div className="md:hidden">
            <LiveClock compact />
          </div>
          <div className="hidden md:block">
            <LiveClock />
          </div>

          {/* Status pill */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-success/10 border border-success/20 text-[11px] font-semibold text-success">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full bg-success/60 animate-ping" />
              <span className="relative rounded-full bg-success w-1.5 h-1.5" />
            </span>
            Operação ON
          </div>

          {/* Theme toggle */}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 hover:bg-secondary"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Alternar tema"
          >
            {mounted && theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </Button>

          {/* Notifications */}
          <Button size="icon" variant="ghost" className="h-8 w-8 relative hover:bg-secondary" aria-label="Notificações">
            <Bell className="w-3.5 h-3.5" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
          </Button>

          {/* User */}
          <button className="ml-1 flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-md hover:bg-secondary transition-smooth">
            <Avatar className="w-7 h-7 border border-border">
              <AvatarFallback className="bg-gradient-to-br from-brand-cyan to-brand-purple text-[10px] text-white font-bold">
                DQ
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-left">
              <div className="text-[11px] font-semibold leading-none">Daniel Queiroz</div>
              <div className="text-[9px] text-muted-foreground mt-0.5">Operador · Master</div>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}

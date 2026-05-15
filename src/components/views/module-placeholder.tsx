"use client";

import { PageHeader } from "@/components/ui/page-header";
import { ChartCard } from "@/components/ui/chart-card";
import {
  Calendar,
  ClipboardList,
  Database,
  LifeBuoy,
  Megaphone,
  Settings,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ICONS: Record<string, LucideIcon> = {
  calendar: Calendar,
  "clipboard-list": ClipboardList,
  database: Database,
  "life-buoy": LifeBuoy,
  megaphone: Megaphone,
  settings: Settings,
  wrench: Wrench,
};

export type ModuleIconName = keyof typeof ICONS;

export function ModulePlaceholder({
  eyebrow,
  title,
  subtitle,
  iconName,
  components,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  iconName: ModuleIconName;
  components: string[];
}) {
  const Icon = ICONS[iconName] ?? Sparkles;
  return (
    <div className="px-6 lg:px-8 py-6 space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        actions={
          <Button size="sm" className="text-xs h-8 bg-brand-cyan hover:bg-brand-cyan/90 text-primary-foreground">
            <Sparkles className="w-3 h-3 mr-1" />
            Pedir ao CLOCK
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          title="Em construção"
          subtitle="Esta tela está em scaffold — componentes planejados abaixo"
          height={240}
        >
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-cyan/20 via-brand-blue/20 to-brand-purple/20 flex items-center justify-center mb-4 glow-cyan">
              <Icon className="w-7 h-7 text-brand-cyan" />
            </div>
            <h3 className="font-display font-semibold text-base mb-2">{title}</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Estrutura de rota pronta · UI será construída na próxima sessão · CLOCK já está coletando dados deste módulo.
            </p>
          </div>
        </ChartCard>

        <ChartCard
          title="Componentes planejados"
          subtitle={`${components.length} blocos previstos para esta tela`}
          height={240}
        >
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {components.map((c, i) => (
              <li key={i} className="flex items-center gap-2 text-[12px] text-foreground/90 px-2.5 py-1.5 rounded-md bg-secondary/40 border border-border">
                <span className="w-1 h-1 rounded-full bg-brand-cyan shrink-0" />
                {c}
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>
    </div>
  );
}

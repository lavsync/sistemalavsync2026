"use client";

import { useState } from "react";
import {
  LayoutTemplate, Shapes, Upload, Sparkles,
  Send, ImagePlus,
} from "lucide-react";
import { cn } from "@mi/lib/utils";
import { TemplatesPanel } from "./templates-panel";
import { ElementsPanel } from "./elements-panel";
import { UploadsPanel } from "./uploads-panel";
import { StocksPanel } from "./stocks-panel";
import { MotionPanel } from "./motion-panel";
import { PublishPanel } from "./publish-panel";

type Tab = "templates" | "elements" | "stocks" | "uploads" | "motion" | "publish";

const TABS: { id: Tab; icon: typeof Shapes; label: string }[] = [
  { id: "templates", icon: LayoutTemplate, label: "Templates" },
  { id: "elements", icon: Shapes, label: "Elementos" },
  { id: "stocks", icon: ImagePlus, label: "Stocks" },
  { id: "uploads", icon: Upload, label: "Uploads" },
  { id: "motion", icon: Sparkles, label: "Motion" },
  { id: "publish", icon: Send, label: "Publicar" },
];

export function LeftSidebar() {
  const [active, setActive] = useState<Tab>("templates");

  return (
    <aside className="flex h-full">
      {/* Vertical tab rail */}
      <nav className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-white/10 bg-[#0a0f14]/95 py-3 backdrop-blur-xl">
        {TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={cn(
              "flex w-full flex-col items-center gap-1 px-2 py-2.5 text-[10px] font-medium transition-colors",
              active === id ? "bg-white/5 text-primary" : "text-white/50 hover:bg-white/5 hover:text-white",
            )}
            title={label}
          >
            <Icon className={cn("h-5 w-5 transition-transform", active === id && "scale-110")} />
            {label}
          </button>
        ))}
      </nav>

      {/* Panel content */}
      <div className="w-72 shrink-0 overflow-y-auto border-r border-white/10 bg-[#0a0f14]/80 backdrop-blur-xl scrollbar-thin">
        {active === "templates" && <TemplatesPanel />}
        {active === "elements" && <ElementsPanel />}
        {active === "stocks" && <StocksPanel />}
        {active === "uploads" && <UploadsPanel />}
        {active === "motion" && <MotionPanel />}
        {active === "publish" && <PublishPanel />}
      </div>
    </aside>
  );
}

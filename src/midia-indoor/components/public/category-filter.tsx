"use client";

import { useState } from "react";
import { cn } from "@mi/lib/utils";
import type { Tables } from "@mi/types/database";

interface CategoryFilterProps {
  categories: Tables<"partner_categories">[];
  onChange?: (slug: string | null) => void;
}

export function CategoryFilter({ categories, onChange }: CategoryFilterProps) {
  const [active, setActive] = useState<string | null>(null);

  const select = (slug: string | null) => {
    setActive(slug);
    onChange?.(slug);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => select(null)}
        className={cn(
          "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
          active === null
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        )}
      >
        Todas
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => select(cat.slug)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            active === cat.slug
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          )}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}

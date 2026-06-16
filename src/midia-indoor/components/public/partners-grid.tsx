"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Tag } from "lucide-react";
import { CategoryFilter } from "./category-filter";
import type { Tables } from "@mi/types/database";

interface PartnersGridProps {
  unitSlug: string;
  categories: Tables<"partner_categories">[];
  partners: Array<
    Tables<"partners"> & {
      partner_categories: { slug: string; label: string } | null;
      offers: { id: string; title: string; is_featured: boolean; status: string }[];
    }
  >;
}

export function PartnersGrid({ unitSlug, categories, partners }: PartnersGridProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      activeCategory
        ? partners.filter((p) => p.partner_categories?.slug === activeCategory)
        : partners,
    [partners, activeCategory],
  );

  return (
    <div>
      <CategoryFilter categories={categories} onChange={setActiveCategory} />

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Nenhum parceiro nessa categoria ainda.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const activeOffers = p.offers?.filter((o) => o.status === "ativa") ?? [];
            return (
              <Link
                key={p.id}
                href={`/${unitSlug}/parceiro/${p.slug}`}
                className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-video w-full bg-muted">
                  {p.cover_url ? (
                    <Image
                      src={p.cover_url}
                      alt={p.name}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                      unoptimized
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-muted-foreground">
                      <Tag className="h-8 w-8" />
                    </div>
                  )}
                  {activeOffers.length > 0 && (
                    <span className="absolute right-2 top-2 rounded-full bg-[var(--brand-yellow)] px-2 py-0.5 text-[11px] font-semibold text-yellow-900">
                      {activeOffers.length} oferta{activeOffers.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <div className="flex flex-1 items-start gap-3 p-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border bg-background">
                    {p.logo_url ? (
                      <Image
                        src={p.logo_url}
                        alt={`Logo ${p.name}`}
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground">
                        {p.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold leading-tight group-hover:text-primary">
                      {p.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {p.partner_categories?.label ?? "Parceiro"}
                      {p.neighborhood && ` · ${p.neighborhood}`}
                    </p>
                    {p.short_description && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {p.short_description}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

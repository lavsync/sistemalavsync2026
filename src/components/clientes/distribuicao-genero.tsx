"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { User, UserCircle2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartCard } from "@/components/ui/chart-card";
import type { GeneroSlice } from "@/lib/clientes-queries";

export function DistribuicaoGenero({ slices }: { slices: GeneroSlice[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const generoAtivo = sp.get("gen");
  const [hover, setHover] = React.useState<string | null>(null);

  const total = slices.reduce((s, x) => s + x.count, 0);
  const masc = slices.find((s) => s.key === "Masculino");
  const fem = slices.find((s) => s.key === "Feminino");

  function aplicarFiltro(key: string) {
    const next = new URLSearchParams(sp.toString());
    if (generoAtivo === key) next.delete("gen");
    else next.set("gen", key);
    next.delete("page");
    router.push(`/clientes?${next.toString()}`);
  }

  if (total === 0) {
    return (
      <ChartCard title="Gênero" subtitle="Distribuição da base" height={320}>
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-[13px]">
          <Users className="w-8 h-8 mb-2 opacity-30" />
          Sem dados de gênero ainda.
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Gênero"
      subtitle="Clique nos cards pra filtrar a base"
      height={320}
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] h-full gap-4">
        {/* Donut */}
        <div className="relative h-full min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={100}
                paddingAngle={2}
                strokeWidth={0}
                onMouseEnter={(d) => setHover((d as GeneroSlice).key)}
                onMouseLeave={() => setHover(null)}
              >
                {slices.map((s) => (
                  <Cell
                    key={s.key}
                    fill={s.color}
                    opacity={hover && hover !== s.key ? 0.4 : 1}
                    cursor="pointer"
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 12,
                  fontSize: 12,
                  padding: "6px 10px",
                }}
                formatter={(v: unknown, _n: unknown, item: { payload?: GeneroSlice }) => {
                  const p = item?.payload;
                  return [`${v} (${p?.percent}%)`, p?.label ?? ""];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Centro do donut */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Base</div>
            <div className="font-display text-3xl font-bold tabular-nums">{total}</div>
          </div>
        </div>

        {/* Cards Masc x Fem */}
        <div className="flex flex-col gap-2 justify-center">
          {masc && (
            <GenderCard
              icon={User}
              slice={masc}
              ativo={generoAtivo === "Masculino"}
              onClick={() => aplicarFiltro("Masculino")}
            />
          )}
          {fem && (
            <GenderCard
              icon={UserCircle2}
              slice={fem}
              ativo={generoAtivo === "Feminino"}
              onClick={() => aplicarFiltro("Feminino")}
            />
          )}
          {slices.filter((s) => s.key !== "Masculino" && s.key !== "Feminino").map((s) => (
            <GenderCard
              key={s.key}
              icon={Users}
              slice={s}
              ativo={generoAtivo === s.key}
              onClick={() => aplicarFiltro(s.key)}
            />
          ))}

          {/* Comparativo proporção */}
          {masc && fem && (
            <div className="mt-1 rounded-lg border border-border bg-muted/20 p-2.5">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                Proporção M : F
              </div>
              <div className="h-2 rounded-full overflow-hidden flex">
                <div className="h-full" style={{ width: `${masc.percent}%`, background: masc.color }} />
                <div className="h-full" style={{ width: `${fem.percent}%`, background: fem.color }} />
              </div>
              <div className="flex justify-between mt-1 text-[10px] font-mono">
                <span style={{ color: masc.color }}>{masc.percent}%</span>
                <span style={{ color: fem.color }}>{fem.percent}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </ChartCard>
  );
}

function GenderCard({
  icon: Icon,
  slice,
  ativo,
  onClick,
}: {
  icon: React.ElementType;
  slice: GeneroSlice;
  ativo: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "text-left rounded-xl border p-2.5 transition-smooth",
        ativo
          ? "border-2 shadow-md"
          : "border bg-card hover:border-border-strong",
      )}
      style={ativo ? { borderColor: slice.color, background: `color-mix(in oklab, ${slice.color} 10%, transparent)` } : undefined}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ background: `color-mix(in oklab, ${slice.color} 18%, transparent)`, color: slice.color }}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            {slice.label}
          </div>
          <div className="flex items-baseline gap-1.5">
            <div className="font-display font-bold text-lg tabular-nums" style={{ color: slice.color }}>
              {slice.count}
            </div>
            <div className="text-[11px] font-semibold text-muted-foreground tabular-nums">
              {slice.percent}%
            </div>
          </div>
        </div>
      </div>
      {ativo && (
        <div className="text-[9px] mt-1.5 uppercase tracking-wider font-semibold opacity-70" style={{ color: slice.color }}>
          ✓ filtrando base
        </div>
      )}
    </motion.button>
  );
}

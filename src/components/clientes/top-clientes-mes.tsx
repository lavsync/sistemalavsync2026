"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Crown, MessageCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartCard } from "@/components/ui/chart-card";
import type { TopClienteMes } from "@/lib/clientes-queries";

export function TopClientesMes({ clientes }: { clientes: TopClienteMes[] }) {
  if (clientes.length === 0) {
    return (
      <ChartCard
        title="Top do mês · valor"
        subtitle="Maior gasto nos últimos 30 dias (snapshot atual)"
        height="auto"
      >
        <div className="text-center py-10 text-muted-foreground">
          <Crown className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <div className="text-[13px]">Ninguém comprou nos últimos 30 dias ainda.</div>
        </div>
      </ChartCard>
    );
  }

  const totalMes = clientes.reduce((s, c) => s + c.valorMes, 0);
  const top1 = clientes[0];

  return (
    <ChartCard
      title="Top do mês · últimos 30 dias"
      subtitle={`R$ ${totalMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} dos 10 primeiros · snapshot mais recente`}
      height="auto"
      actions={
        <div className="hidden md:flex items-center gap-1.5 text-[10px] text-success font-mono">
          <TrendingUp className="w-3 h-3" />
          {top1 && `Líder R$ ${top1.valorMes.toFixed(2).replace(".", ",")}`}
        </div>
      }
    >
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="text-left font-semibold py-2 px-3">#</th>
              <th className="text-left font-semibold py-2 px-3">Cliente</th>
              <th className="text-left font-semibold py-2 px-3">Telefone</th>
              <th className="text-right font-semibold py-2 px-3">Compras / 30d</th>
              <th className="text-right font-semibold py-2 px-3">Valor / 30d</th>
              <th className="text-left font-semibold py-2 px-3">Última</th>
              <th className="text-left font-semibold py-2 px-3">Origem</th>
              <th className="text-right font-semibold py-2 px-3">WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c, i) => (
              <motion.tr
                key={c.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "border-b border-border/60 hover:bg-secondary/30 transition-smooth",
                  i === 0 && "bg-warning/5",
                )}
              >
                <td className="py-3 px-3 font-mono text-muted-foreground">
                  {i === 0 ? (
                    <span className="inline-flex items-center gap-1 text-warning font-semibold">
                      <Crown className="w-3 h-3" /> 1
                    </span>
                  ) : (
                    i + 1
                  )}
                </td>
                <td className="py-3 px-3 font-semibold">{c.nome}</td>
                <td className="py-3 px-3 font-mono text-muted-foreground">{c.phone}</td>
                <td className="py-3 px-3 text-right font-mono">{c.visitasMes}</td>
                <td className="py-3 px-3 text-right font-mono font-semibold text-success">
                  R$ {c.valorMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-3 text-muted-foreground text-[11px]">{c.ultimaCompra}</td>
                <td className="py-3 px-3">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-semibold",
                      c.origem === "maxpan"
                        ? "bg-brand-cyan/10 text-brand-cyan"
                        : c.origem === "vm_tecnologia"
                        ? "bg-brand-purple/10 text-brand-purple"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {c.origem === "maxpan" ? "MAXPAN"
                      : c.origem === "vm_tecnologia" ? "VM"
                      : c.origem}
                  </span>
                </td>
                <td className="py-3 px-3 text-right">
                  {c.phone && c.phone !== "—" ? (
                    <a
                      href={`https://wa.me/55${c.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-success font-semibold text-[11px] hover:underline"
                    >
                      <MessageCircle className="w-3 h-3" /> WA
                    </a>
                  ) : (
                    <span className="text-muted-foreground/40 text-[11px]">—</span>
                  )}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}

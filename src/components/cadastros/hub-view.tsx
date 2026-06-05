"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users, Truck, Receipt, FolderTree, Package, BookOpenCheck,
  Wrench, Sparkles, Handshake, Building2, UserCog, ChevronRight, Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import type { CadastroContadores } from "@/lib/cadastros-queries";

type Bloco = {
  key: keyof CadastroContadores;
  label: string;
  desc: string;
  href: string;
  icon: React.ElementType;
  tone: "cyan" | "purple" | "warning" | "success" | "danger" | "blue";
  novo?: boolean;
};

const BLOCOS: Bloco[] = [
  { key: "clientes",              label: "Clientes",                desc: "Base de consumidores · CPF, contato, histórico",     href: "/clientes",                 icon: Users,         tone: "cyan" },
  { key: "fornecedores",          label: "Fornecedores",            desc: "Quem te abastece · contatos e CNPJs",                href: "/cadastros/fornecedores",   icon: Truck,         tone: "blue", novo: true },
  { key: "despesas",              label: "Despesas",                desc: "Contas a pagar · vencimentos e status",              href: "/cadastros/despesas",       icon: Receipt,       tone: "danger", novo: true },
  { key: "categoriasFinanceiras", label: "Categorias financeiras",  desc: "Etiquetas pra receitas e despesas",                  href: "/cadastros/categorias-financeiras", icon: FolderTree, tone: "warning", novo: true },
  { key: "maquinas",              label: "Máquinas",                desc: "Lavadoras, secadoras, totem · por unidade",          href: "/manutencao",               icon: Wrench,        tone: "purple" },
  { key: "planos",                label: "Planos",                  desc: "Combos de serviços · preço promocional",             href: "/cadastros/planos",         icon: BookOpenCheck, tone: "success", novo: true },
  { key: "servicos",              label: "Serviços",                desc: "Lavagem, secagem, extras · preço unitário",          href: "/cadastros/servicos",       icon: Package,       tone: "cyan", novo: true },
  { key: "campanhas",             label: "Campanhas",               desc: "Cupons, vouchers, promoções · vigência",             href: "/cadastros/campanhas",      icon: Sparkles,      tone: "warning", novo: true },
  { key: "parceiros",             label: "Parceiros",               desc: "B2B · condomínios, hotéis, comissões",               href: "/cadastros/parceiros",      icon: Handshake,     tone: "purple", novo: true },
  { key: "unidades",              label: "Unidade",                 desc: "Endereço, CNPJ, horário · sua lavanderia",           href: "/cadastros/unidades",       icon: Building2,     tone: "cyan", novo: true },
  { key: "usuarios",              label: "Usuário / Franqueado",    desc: "Equipe e permissões · papel + unidades",             href: "/configuracoes",            icon: UserCog,       tone: "blue" },
];

const TONE_MAP: Record<Bloco["tone"], { border: string; bg: string; icon: string; iconBg: string }> = {
  cyan:    { border: "border-brand-cyan/30",   bg: "bg-brand-cyan/5",   icon: "text-brand-cyan",   iconBg: "bg-brand-cyan/15 border-brand-cyan/30" },
  purple:  { border: "border-brand-purple/30", bg: "bg-brand-purple/5", icon: "text-brand-purple", iconBg: "bg-brand-purple/15 border-brand-purple/30" },
  warning: { border: "border-warning/30",      bg: "bg-warning/5",      icon: "text-warning",      iconBg: "bg-warning/15 border-warning/30" },
  success: { border: "border-success/30",      bg: "bg-success/5",      icon: "text-success",      iconBg: "bg-success/15 border-success/30" },
  danger:  { border: "border-danger/30",       bg: "bg-danger/5",       icon: "text-danger",       iconBg: "bg-danger/15 border-danger/30" },
  blue:    { border: "border-brand-deep/30",   bg: "bg-brand-deep/5",   icon: "text-brand-deep",   iconBg: "bg-brand-deep/15 border-brand-deep/30" },
};

export function CadastrosHubView({ contadores }: { contadores: CadastroContadores }) {
  const total = Object.values(contadores).reduce((s, n) => s + n, 0);
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cadastros · 11 blocos de configuração"
        title="Alimente o sistema"
        subtitle={`${total.toLocaleString("pt-BR")} registro${total === 1 ? "" : "s"} cadastrado${total === 1 ? "" : "s"} no total · clique em qualquer bloco pra inserir ou editar.`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {BLOCOS.map((b, i) => {
          const Icon = b.icon;
          const tone = TONE_MAP[b.tone];
          const count = contadores[b.key];
          return (
            <motion.div
              key={b.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                href={b.href}
                className={cn(
                  "group block h-full rounded-2xl border bg-card p-4 transition-smooth hover:border-border-strong hover:shadow-lg relative overflow-hidden",
                  tone.border,
                )}
              >
                {b.novo && (
                  <span className="absolute top-2.5 right-2.5 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-success/15 text-success">
                    Novo
                  </span>
                )}
                <div className={cn("w-11 h-11 rounded-xl border flex items-center justify-center mb-3", tone.iconBg)}>
                  <Icon className={cn("w-5 h-5", tone.icon)} />
                </div>
                <div className="font-display font-bold text-[14px] text-foreground">{b.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{b.desc}</div>
                <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
                  <div className={cn("font-mono text-[18px] font-bold tabular-nums", tone.icon)}>
                    {count.toLocaleString("pt-BR")}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-start gap-3 text-[12px]">
        <Database className="w-4 h-4 text-brand-cyan mt-0.5 shrink-0" />
        <div className="text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Dica:</strong> esses 11 blocos formam a base operacional do sistema.
          Quanto mais completo seu cadastro, mais inteligente e útil ficam os dashboards, as automações e o IA Copilot.
        </div>
      </div>
    </div>
  );
}

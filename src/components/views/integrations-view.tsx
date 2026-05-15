"use client";

import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import {
  Activity,
  CreditCard,
  Database,
  Mail,
  MessageSquare,
  Plug,
  Radio,
  Webhook,
  BarChart3,
  Banknote,
  Megaphone,
  Cpu,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

type Integration = {
  name: string;
  category: string;
  description: string;
  icon: LucideIcon;
  status: "connected" | "warning" | "disconnected" | "soon";
  latency?: string;
  health?: number;
};

const INTEGRATIONS: Integration[] = [
  { name: "PDV / Pagamento", category: "Operação", description: "TEF, PIX, cartão · TOT10L sync", icon: CreditCard, status: "connected", latency: "62ms", health: 99 },
  { name: "WhatsApp Business", category: "Cliente", description: "Notificações, suporte e win-back", icon: MessageSquare, status: "connected", latency: "180ms", health: 96 },
  { name: "E-mail transacional", category: "Cliente", description: "SES · alertas e relatórios", icon: Mail, status: "connected", latency: "240ms", health: 100 },
  { name: "Power BI", category: "BI", description: "Export OData semanal", icon: BarChart3, status: "connected", latency: "—", health: 100 },
  { name: "Banco · Stone", category: "Financeiro", description: "Conciliação automática D+1", icon: Banknote, status: "warning", latency: "—", health: 78 },
  { name: "Marketing · Meta Ads", category: "Crescimento", description: "Pixel + sync de conversões", icon: Megaphone, status: "disconnected" },
  { name: "API REST · Webhooks", category: "Plataforma", description: "Eventos para terceiros", icon: Webhook, status: "connected", latency: "12ms", health: 100 },
  { name: "Telemetria IoT", category: "Operação", description: "Sensores de máquina · roadmap", icon: Cpu, status: "soon" },
  { name: "Backup · S3", category: "Plataforma", description: "Snapshots horários", icon: Database, status: "connected", latency: "—", health: 100 },
];

const statusMap = {
  connected: { label: "Conectado", variant: "success" as const, pulse: true },
  warning: { label: "Atenção", variant: "warning" as const, pulse: true },
  disconnected: { label: "Desconectado", variant: "danger" as const, pulse: false },
  soon: { label: "Em breve", variant: "info" as const, pulse: false },
};

export function IntegrationsView() {
  return (
    <div className="px-6 lg:px-8 py-6 space-y-6">
      <PageHeader
        eyebrow="Integrações · Central Neural"
        title="Sistemas conectados à LavSync"
        subtitle="Saúde de cada conexão · latência · status em tempo real · adicionar nova integração."
        actions={
          <Button size="sm" className="text-xs h-8 bg-brand-cyan hover:bg-brand-cyan/90 text-primary-foreground">
            <Plug className="w-3 h-3 mr-1" /> Conectar nova
          </Button>
        }
      />

      {/* Health overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <HealthStat label="Conectadas" value="6" tone="success" />
        <HealthStat label="Em alerta" value="1" tone="warning" />
        <HealthStat label="Desconectadas" value="1" tone="danger" />
        <HealthStat label="Latência média" value="86ms" tone="info" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {INTEGRATIONS.map(it => {
          const Icon = it.icon;
          const s = statusMap[it.status];
          return (
            <div
              key={it.name}
              className="card-premium rounded-xl p-5 transition-smooth hover:border-border-strong group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-cyan/15 to-brand-purple/15 border border-border flex items-center justify-center">
                    <Icon className="w-5 h-5 text-brand-cyan" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm leading-tight">{it.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">{it.category}</div>
                  </div>
                </div>
                <StatusPill variant={s.variant} pulse={s.pulse}>
                  {s.label}
                </StatusPill>
              </div>

              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{it.description}</p>

              <div className="flex items-center justify-between text-[11px] pt-3 border-t border-border">
                <div className="flex items-center gap-3">
                  {it.latency && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Activity className="w-3 h-3" /> {it.latency}
                    </span>
                  )}
                  {it.health !== undefined && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Radio className="w-3 h-3" /> {it.health}% health
                    </span>
                  )}
                </div>
                <button className="text-brand-cyan font-semibold opacity-0 group-hover:opacity-100 transition-smooth">
                  Configurar →
                </button>
              </div>
            </div>
          );
        })}

        {/* Add new */}
        <button className="rounded-xl border-2 border-dashed border-border hover:border-brand-cyan p-5 flex flex-col items-center justify-center text-center min-h-[180px] transition-smooth group">
          <div className="w-10 h-10 rounded-lg bg-secondary group-hover:bg-brand-cyan/15 flex items-center justify-center mb-3 transition-smooth">
            <Sparkles className="w-5 h-5 text-muted-foreground group-hover:text-brand-cyan transition-smooth" />
          </div>
          <div className="text-sm font-semibold">Adicionar integração</div>
          <div className="text-xs text-muted-foreground mt-1">+30 plataformas no marketplace</div>
        </button>
      </div>
    </div>
  );
}

function HealthStat({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "danger" | "info" }) {
  const toneClass = {
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
    info: "text-brand-cyan",
  }[tone];
  return (
    <div className="card-premium rounded-xl p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono font-bold text-2xl mt-2 ${toneClass}`}>{value}</div>
    </div>
  );
}

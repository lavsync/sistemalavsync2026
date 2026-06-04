"use client";

// LavSync · Central de integrações
// - lê o status real (.env.local) vindo do Server Component
// - cada card abre um wizard com link direto pro lugar onde gerar token + form pra colar
// - botão "Testar conexão" valida live (REST/HTTPS ping ao provider)
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import {
  ExternalLink, KeyRound, CheckCircle2, AlertTriangle, XCircle, Sparkles, Loader2, Eye, EyeOff,
  ArrowRight, Plug,
} from "lucide-react";
import {
  PROVIDERS, CATEGORY_META, type IntegrationProvider, type ProviderId,
} from "@/lib/integrations-config";
import {
  saveIntegrationCredentials, testIntegration,
  type ProviderStatus, type TestResult,
} from "@/lib/integrations-actions";

type Props = {
  status: ProviderStatus[];
};

export function IntegrationsView({ status }: Props) {
  const statusMap = useMemo(() => {
    const m = new Map<ProviderId, ProviderStatus>();
    for (const s of status) m.set(s.id, s);
    return m;
  }, [status]);

  const counts = useMemo(() => {
    let connected = 0, partial = 0, missing = 0;
    for (const s of status) {
      if (s.state === "connected") connected++;
      else if (s.state === "partial") partial++;
      else missing++;
    }
    return { connected, partial, missing, total: status.length };
  }, [status]);

  const [open, setOpen] = useState<ProviderId | null>(null);
  const openProvider = open ? PROVIDERS.find((p) => p.id === open) ?? null : null;
  const openStatus = open ? statusMap.get(open) ?? null : null;

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6">
      <PageHeader
        eyebrow="Integrações · Central de credenciais"
        title="Plug & play do LavSync"
        subtitle="Cada conexão tem o passo-a-passo + link direto pra gerar a chave + campo pra colar e testar agora."
        actions={
          <Button size="sm" className="text-xs h-8 bg-brand-cyan hover:bg-brand-cyan/90 text-primary-foreground">
            <Plug className="w-3 h-3 mr-1" /> Marketplace (em breve)
          </Button>
        }
      />

      {/* Health overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <HealthStat label="Conectadas" value={counts.connected.toString()} tone="success" />
        <HealthStat label="Parciais" value={counts.partial.toString()} tone="warning" />
        <HealthStat label="Pendentes" value={counts.missing.toString()} tone="danger" />
        <HealthStat label="Total catalogadas" value={counts.total.toString()} tone="info" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {PROVIDERS.map((p) => {
          const s = statusMap.get(p.id);
          return (
            <ProviderCard
              key={p.id}
              provider={p}
              status={s}
              onConfigure={() => setOpen(p.id)}
            />
          );
        })}
      </div>

      {/* Wizard modal */}
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {openProvider && (
            <WizardContent
              provider={openProvider}
              status={openStatus}
              onClose={() => setOpen(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────
function ProviderCard({
  provider, status, onConfigure,
}: { provider: IntegrationProvider; status?: ProviderStatus; onConfigure: () => void }) {
  const Icon = provider.icon;
  const cat = CATEGORY_META[provider.category];
  const state = status?.state ?? "missing";
  const pill = state === "connected"
    ? { label: "Conectado", variant: "success" as const, pulse: true }
    : state === "partial"
    ? { label: "Parcial", variant: "warning" as const, pulse: true }
    : { label: "Pendente", variant: "danger" as const, pulse: false };

  return (
    <div className="card-premium rounded-xl p-5 transition-smooth hover:border-border-strong group flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg border border-border flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${provider.color}22, ${provider.color}10)` }}
          >
            <Icon className="w-5 h-5" style={{ color: provider.color }} />
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight">{provider.name}</div>
            <div className={`text-[10px] mt-0.5 uppercase tracking-wider px-1.5 py-0.5 rounded inline-block ${cat.tone}`}>
              {cat.label}
            </div>
          </div>
        </div>
        <StatusPill variant={pill.variant} pulse={pill.pulse}>{pill.label}</StatusPill>
      </div>

      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{provider.description}</p>

      {provider.requiredFor && provider.requiredFor.length > 0 && (
        <div className="text-[10px] text-muted-foreground mb-3">
          Necessário para: <span className="text-foreground/80">{provider.requiredFor.join(" · ")}</span>
        </div>
      )}

      {status && (
        <div className="text-[11px] text-muted-foreground mb-3">
          {status.filledCount}/{status.totalCount} credenciais preenchidas
        </div>
      )}

      <div className="mt-auto pt-3 border-t border-border flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">
          {state === "connected" ? "Pronto" : state === "partial" ? "Faltam credenciais" : "Não configurada"}
        </span>
        <button
          onClick={onConfigure}
          className="text-brand-cyan font-semibold inline-flex items-center gap-1 hover:underline"
        >
          {state === "connected" ? "Reconfigurar" : "Configurar"} <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Wizard ──────────────────────────────────────────────────────────────────
function WizardContent({
  provider, status, onClose,
}: { provider: IntegrationProvider; status: ProviderStatus | null; onClose: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saveMsg, setSaveMsg] = useState<{ text: string; vercelUrl?: string; ok: boolean } | null>(null);
  const [testRes, setTestRes] = useState<TestResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [testing, setTesting] = useState(false);

  const Icon = provider.icon;

  function handleSave() {
    setSaveMsg(null);
    startTransition(async () => {
      const r = await saveIntegrationCredentials({ providerId: provider.id, values });
      if (r.ok) {
        setSaveMsg({ text: `Salvo: ${r.updated.join(", ")}`, ok: true });
        setValues({});
        router.refresh();
      } else {
        setSaveMsg({ text: r.error, vercelUrl: r.vercelEnvUrl, ok: false });
      }
    });
  }

  async function handleTest() {
    setTesting(true);
    setTestRes(null);
    try {
      const r = await testIntegration(provider.id);
      setTestRes(r);
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <div className="flex items-start gap-3">
          <div
            className="w-12 h-12 rounded-xl border border-border flex items-center justify-center shrink-0"
            style={{ background: `linear-gradient(135deg, ${provider.color}22, ${provider.color}10)` }}
          >
            <Icon className="w-6 h-6" style={{ color: provider.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-lg">{provider.name}</DialogTitle>
            <DialogDescription className="text-xs mt-1">{provider.description}</DialogDescription>
            {provider.docsUrl && (
              <a
                href={provider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-brand-cyan inline-flex items-center gap-1 mt-1 hover:underline"
              >
                Documentação oficial <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-5 mt-4">
        {/* Steps */}
        {provider.steps && provider.steps.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Passo a passo
            </h3>
            <ol className="space-y-3">
              {provider.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand-cyan/15 text-brand-cyan text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{step.title}</div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.body}</p>
                    {step.href && (
                      <a
                        href={step.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-brand-cyan border border-brand-cyan/30 bg-brand-cyan/8 px-2 py-1 rounded hover:bg-brand-cyan/15 transition-colors"
                      >
                        {step.hrefLabel ?? "Abrir"} <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Credenciais */}
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <KeyRound className="w-3 h-3" /> Credenciais
          </h3>
          <div className="space-y-3">
            {provider.fields.map((f) => {
              const fStatus = status?.fields.find((x) => x.envKey === f.envKey);
              const isFilled = !!fStatus?.filled;
              const showVal = !!showSecrets[f.envKey];
              return (
                <div key={f.envKey} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold">{f.label}</label>
                    <div className="flex items-center gap-2">
                      {isFilled && (
                        <span className="text-[10px] text-success inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {fStatus?.preview}
                        </span>
                      )}
                      <code className="text-[10px] bg-muted/40 px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                        {f.envKey}
                      </code>
                    </div>
                  </div>
                  <div className="relative">
                    <Input
                      type={f.secret && !showVal ? "password" : "text"}
                      placeholder={isFilled ? "Cole novo valor para sobrescrever…" : f.placeholder ?? ""}
                      value={values[f.envKey] ?? ""}
                      onChange={(e) => setValues((p) => ({ ...p, [f.envKey]: e.target.value }))}
                      className="font-mono text-xs pr-9"
                    />
                    {f.secret && (
                      <button
                        type="button"
                        onClick={() => setShowSecrets((p) => ({ ...p, [f.envKey]: !p[f.envKey] }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showVal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                  {f.hint && <p className="text-[10px] text-muted-foreground">{f.hint}</p>}
                </div>
              );
            })}
          </div>
        </section>

        {/* Resultado teste */}
        {testRes && (
          <div
            className={`rounded-lg border px-3 py-2 text-xs ${
              testRes.ok
                ? "border-success/40 bg-success/8 text-success"
                : "border-danger/40 bg-danger/8 text-danger"
            }`}
          >
            <div className="flex items-start gap-2">
              {testRes.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <div className="flex-1">
                <div className="font-semibold">{testRes.ok ? "Conexão OK" : "Falha no teste"}</div>
                <div className="opacity-90">{testRes.message}</div>
                {testRes.details && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[10px] opacity-70">Ver detalhes</summary>
                    <pre className="text-[10px] mt-1 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">{testRes.details}</pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        )}

        {saveMsg && (
          <div
            className={`rounded-lg border px-3 py-2 text-xs flex items-start gap-2 ${
              saveMsg.ok
                ? "border-brand-cyan/40 bg-brand-cyan/8 text-brand-cyan"
                : "border-warning/40 bg-warning/8 text-warning"
            }`}
          >
            {saveMsg.ok ? <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
            <div className="flex-1">
              <div>{saveMsg.text}</div>
              {saveMsg.vercelUrl && (
                <a
                  href={saveMsg.vercelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1 font-semibold underline"
                >
                  Abrir Environment Variables no Vercel <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      <DialogFooter className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
          Fechar
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing}
            className="text-xs"
          >
            {testing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
            Testar conexão
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={pending || Object.values(values).every((v) => !v?.trim())}
            className="text-xs bg-brand-cyan hover:bg-brand-cyan/90 text-primary-foreground"
          >
            {pending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <KeyRound className="w-3 h-3 mr-1" />}
            Salvar credenciais
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

// ─── Health stat ─────────────────────────────────────────────────────────────
function HealthStat({
  label, value, tone,
}: { label: string; value: string; tone: "success" | "warning" | "danger" | "info" }) {
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

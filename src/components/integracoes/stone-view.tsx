"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, Plug, Plus, Edit2, Trash2, X, Loader2, Save,
  CheckCircle2, AlertTriangle, RefreshCw, Activity, Building2,
  Eye, EyeOff, KeyRound, Hash, Clock, History, ExternalLink,
  ShieldCheck, ShieldQuestion, ShieldOff, Copy, QrCode, Mail, MessageCircle,
} from "lucide-react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { IntegracaoStone, SyncLog, CronStatusEntry, WebhookEventLog } from "@/lib/stone/queries";
import {
  salvarIntegracaoStone, excluirIntegracaoStone, testarConexao, sincronizarAgora,
  type IntegracaoStoneInput,
} from "@/lib/stone/actions";
import {
  solicitarConsentimentoStone, revogarConsentimentoStone,
} from "@/lib/stone/consent-actions";

type Unidade = { id: string; nome: string };

const fmtBRL = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function StoneIntegracoesView({
  integracoes, logs, unidades, cronStatus, webhookEvents,
}: {
  integracoes: IntegracaoStone[];
  logs: SyncLog[];
  unidades: Unidade[];
  cronStatus: CronStatusEntry[];
  webhookEvents: WebhookEventLog[];
}) {
  const [editando, setEditando] = React.useState<IntegracaoStone | "nova" | null>(null);
  const [showLogs, setShowLogs] = React.useState(false);
  const [showCron, setShowCron] = React.useState(false);
  const [showWebhooks, setShowWebhooks] = React.useState(false);

  const unidadesSemIntegracao = unidades.filter(
    (u) => !integracoes.some((i) => i.unidade_id === u.id)
  );

  return (
    <div className="px-6 lg:px-8 py-6 space-y-5">
      <PageHeader
        eyebrow="Sistema · Integrações"
        title="Stone Open Banking"
        subtitle="Sincroniza vendas diretamente da Conta Stone PJ. Cada unidade tem credencial própria."
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setShowCron(!showCron)} size="sm">
              <Clock className="w-3.5 h-3.5 mr-1" /> Cron
            </Button>
            <Button variant="outline" onClick={() => setShowWebhooks(!showWebhooks)} size="sm">
              <Activity className="w-3.5 h-3.5 mr-1" /> Webhooks
            </Button>
            <Button variant="outline" onClick={() => setShowLogs(!showLogs)} size="sm">
              <History className="w-3.5 h-3.5 mr-1" /> Sync logs
            </Button>
            <Button onClick={() => setEditando("nova")} className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white">
              <Plus className="w-3.5 h-3.5 mr-1" /> Nova integração
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Integrações ativas" valor={integracoes.filter((i) => i.ativo).length} tone="success" icon={Plug} />
        <KPI label="Total cadastradas"  valor={integracoes.length} tone="brand-cyan" icon={CreditCard} />
        <KPI label="Sem integração"     valor={unidadesSemIntegracao.length} tone="warning" icon={AlertTriangle} />
        <KPI label="Última sincronização"
          valor={(() => {
            const ult = integracoes
              .map((i) => i.ultimo_sync_em).filter(Boolean)
              .sort().reverse()[0];
            if (!ult) return "—";
            const min = Math.round((Date.now() - new Date(ult).getTime()) / 60000);
            return min < 60 ? `${min}min` : `${Math.floor(min / 60)}h`;
          })()}
          tone="brand-purple" icon={Clock} />
      </div>

      {/* Lista de integrações */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-brand-cyan" />
          <span className="font-display font-bold text-[14px]">Credenciais por unidade</span>
        </div>

        {integracoes.length === 0 ? (
          <div className="p-12 text-center">
            <Plug className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <div className="text-[13px] font-semibold">Nenhuma integração Stone configurada</div>
            <div className="text-[11px] text-muted-foreground mt-1 mb-4">
              Configure as credenciais Stone Open Banking pra começar a sincronizar vendas automaticamente.
            </div>
            <Button onClick={() => setEditando("nova")} className="bg-brand-cyan text-primary-foreground">
              <Plus className="w-3.5 h-3.5 mr-1" /> Configurar primeira unidade
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {integracoes.map((int) => (
              <IntegracaoRow key={int.id} int={int} onEditar={() => setEditando(int)} />
            ))}
          </div>
        )}
      </div>

      {/* Unidades sem integração */}
      {unidadesSemIntegracao.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="font-display font-bold text-[12px]">
              {unidadesSemIntegracao.length} unidade{unidadesSemIntegracao.length === 1 ? "" : "s"} sem integração Stone
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {unidadesSemIntegracao.map((u) => (
              <button key={u.id} onClick={() => setEditando("nova")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-[12px] hover:border-brand-cyan transition-colors">
                <Building2 className="w-3 h-3" /> {u.nome} <Plus className="w-3 h-3 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cron status */}
      {showCron && <CronStatusView entries={cronStatus} />}

      {/* Webhooks */}
      {showWebhooks && <WebhookEventsView events={webhookEvents} />}

      {/* Logs */}
      {showLogs && <LogsView logs={logs} />}

      {/* Doc/help — atualizado conforme Sprint 1 */}
      <div className="rounded-xl border border-border bg-muted/10 p-4 text-[12px]">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="w-4 h-4 text-brand-cyan" />
          <span className="font-display font-bold">Modelo Opção A · 1 aplicação parceira LavSync</span>
        </div>
        <p className="text-muted-foreground mb-3">
          Nessa arquitetura você (LavSync) é a aplicação parceira. <strong>UMA</strong> chave RSA 4096 atende todas as unidades.
          Cada unidade Xô Varal dará consentimento pra essa aplicação (Sprint 2).
        </p>
        <ol className="space-y-1.5 text-muted-foreground list-decimal pl-5">
          <li>Cadastre o parceiro LavSync no <a href="https://docs.openbank.stone.com.br/docs/guias/stone-open-banking/" target="_blank" rel="noreferrer" className="text-brand-cyan inline-flex items-center gap-0.5">portal Stone Open Banking <ExternalLink className="w-2.5 h-2.5" /></a></li>
          <li>Gere o par RSA <strong>4096</strong> (obrigatório): <code className="bg-card px-1 rounded">openssl genrsa -out lavsync-stone.pem 4096 &amp;&amp; openssl rsa -in lavsync-stone.pem -pubout &gt; lavsync-stone.pub</code></li>
          <li>Envie <strong>lavsync-stone.pub</strong> pra Stone via portal/email</li>
          <li>Stone retorna o <strong>Client ID</strong> da aplicação parceira (1 por ambiente: sandbox + produção)</li>
          <li>Cada unidade Xô Varal precisará dar <strong>consentimento</strong> (link gerado no Sprint 2)</li>
          <li>Stone retorna o <strong>account_id (UUID)</strong> da conta dessa unidade</li>
          <li>Cole tudo aqui — o LavSync gera o JWT RS256 (≤15min validade) automaticamente em cada chamada</li>
        </ol>
        <div className="mt-3 p-2 rounded border border-success/30 bg-success/8 text-success text-[11px]">
          <strong>✓ Sprint 1 + Sprint 2 concluídos:</strong> conformidade técnica (RS256, JWT 15min, /statement, User-Agent) + fluxo de consentimento (JWT type=consent, redirect_uri, callback, session_metadata, resource_id automático no account_id).
        </div>
        <div className="mt-2 p-2 rounded border border-brand-cyan/30 bg-brand-cyan/8 text-brand-cyan text-[11px]">
          <strong>URLs pra registrar com a Stone:</strong>
          <ul className="mt-1 space-y-0.5 list-none">
            <li>• redirect_uri: <code className="bg-card px-1 rounded text-[10px]">https://sistema.lavsync.com.br/integracoes/stone/callback</code></li>
            <li>• webhook (Sprint 3): <code className="bg-card px-1 rounded text-[10px]">https://sistema.lavsync.com.br/api/webhooks/stone</code></li>
          </ul>
        </div>
      </div>

      <IntegracaoDialog
        integracao={editando === "nova" ? null : editando}
        modoNovo={editando === "nova"}
        unidades={unidades}
        unidadesDisponiveis={editando === "nova" ? unidadesSemIntegracao : unidades}
        onClose={() => setEditando(null)}
      />
    </div>
  );
}

function KPI({ label, valor, tone, icon: Icon }: { label: string; valor: number | string; tone: string; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground">{label}</span>
        <Icon className={cn("w-3.5 h-3.5", `text-${tone}`)} />
      </div>
      <div className={cn("font-display font-bold text-2xl tabular-nums", `text-${tone}`)}>{valor}</div>
    </div>
  );
}

const CONSENT_META: Record<IntegracaoStone["consent_status"], { label: string; tone: string; icon: React.ElementType }> = {
  sem_consentimento: { label: "Sem consentimento",   tone: "warning",   icon: ShieldQuestion },
  pendente:          { label: "Aguardando aprovação",tone: "brand-cyan",icon: Clock },
  aprovado:          { label: "Aprovado",            tone: "success",   icon: ShieldCheck },
  rejeitado:         { label: "Rejeitado",           tone: "danger",    icon: ShieldOff },
  expirado:          { label: "Link expirado",       tone: "warning",   icon: AlertTriangle },
  revogado:          { label: "Revogado",            tone: "muted-foreground", icon: ShieldOff },
};

function IntegracaoRow({ int, onEditar }: { int: IntegracaoStone; onEditar: () => void }) {
  const [busy, setBusy] = React.useState<"" | "test" | "sync" | "consent">("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [consentOpen, setConsentOpen] = React.useState<{ url: string; expira_em: string } | null>(null);

  async function handleTest() {
    setBusy("test"); setMsg(null); setErro(null);
    try {
      const r = await testarConexao(int.unidade_id);
      if (r.ok) setMsg(r.mensagem);
      else setErro(r.mensagem);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setBusy(""); }
  }

  async function handleSync() {
    setBusy("sync"); setMsg(null); setErro(null);
    try {
      const r = await sincronizarAgora(int.unidade_id);
      setMsg(`Sync ${r.status}. ${r.transacoes_recebidas} recebidas · ${r.vendas_inseridas} inseridas · ${r.vendas_duplicadas} duplicadas`);
      if (r.erro) setErro(r.erro);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setBusy(""); }
  }

  async function handleConsent() {
    setBusy("consent"); setMsg(null); setErro(null);
    try {
      const r = await solicitarConsentimentoStone(int.unidade_id);
      setConsentOpen({ url: r.url, expira_em: r.expira_em });
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setBusy(""); }
  }

  async function handleRevogar() {
    const motivo = prompt("Motivo da revogação:");
    if (!motivo) return;
    setBusy("consent");
    try {
      await revogarConsentimentoStone(int.unidade_id, motivo);
      setMsg("Consentimento revogado.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setBusy(""); }
  }

  const ultimoSync = int.ultimo_sync_em
    ? new Date(int.ultimo_sync_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "nunca";

  const consentMeta = CONSENT_META[int.consent_status];
  const ConsentIcon = consentMeta.icon;
  const podeUsarApi = int.consent_status === "aprovado";

  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
          int.ativo ? "bg-brand-cyan/15 text-brand-cyan" : "bg-muted text-muted-foreground")}>
          <CreditCard className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <div className="font-display font-bold text-[14px]">{int.unidade_nome}</div>
            {!int.ativo && <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">INATIVA</span>}
            {int.ambiente === "sandbox" && <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-warning/15 text-warning">SANDBOX</span>}
            <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
              `bg-${consentMeta.tone}/15 text-${consentMeta.tone}`)}>
              <ConsentIcon className="w-2.5 h-2.5" /> {consentMeta.label}
            </span>
            {int.ultimo_sync_ok === true && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
            {int.ultimo_sync_ok === false && <AlertTriangle className="w-3.5 h-3.5 text-danger" />}
          </div>
          <div className="text-[11px] text-muted-foreground flex flex-wrap gap-3">
            <span><Hash className="w-2.5 h-2.5 inline mr-0.5" />CNPJ {int.cnpj}</span>
            <span>account_id: <code className="text-[10px]">{int.account_id ? int.account_id.slice(0, 8) + "…" : "—"}</code></span>
            <span>client_id: <code className="text-[10px]">{int.client_id.slice(0, 16)}…</code></span>
            <span>Último sync: {ultimoSync}</span>
          </div>
          {int.consent_aprovado_em && (
            <div className="text-[10px] text-success mt-0.5">
              Consentimento aprovado em {new Date(int.consent_aprovado_em).toLocaleDateString("pt-BR")}
            </div>
          )}
          {int.consent_status === "pendente" && int.consent_expira_em && (
            <div className="text-[10px] text-warning mt-0.5">
              Link pendente — expira em {new Date(int.consent_expira_em).toLocaleString("pt-BR")}
            </div>
          )}
          {int.ultimo_sync_erro && (
            <div className="mt-1.5 text-[11px] text-danger inline-flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {int.ultimo_sync_erro}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 min-w-[140px]">
          {!podeUsarApi ? (
            <Button onClick={handleConsent} size="sm" disabled={busy !== ""}
              className="bg-gradient-to-r from-brand-cyan to-brand-blue text-white">
              {busy === "consent" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1" />}
              {int.consent_status === "pendente" ? "Reabrir link" : "Solicitar consentimento"}
            </Button>
          ) : (
            <>
              <Button onClick={handleTest} size="sm" variant="outline" disabled={busy !== ""} className="border-brand-cyan text-brand-cyan">
                {busy === "test" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Activity className="w-3.5 h-3.5 mr-1" />}
                Testar
              </Button>
              <Button onClick={handleSync} size="sm" disabled={busy !== ""} className="bg-success text-white">
                {busy === "sync" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                Sincronizar
              </Button>
              <Button onClick={handleRevogar} size="sm" variant="outline" disabled={busy !== ""}
                className="text-warning border-warning/40 hover:bg-warning/10">
                <ShieldOff className="w-3.5 h-3.5 mr-1" /> Revogar
              </Button>
            </>
          )}
          <Button onClick={onEditar} size="sm" variant="outline">
            <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
          </Button>
        </div>
      </div>
      {msg && <div className="mt-3 rounded-lg border border-success/30 bg-success/8 px-3 py-2 text-[12px] text-success">{msg}</div>}
      {erro && <div className="mt-3 rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{erro}</div>}

      {consentOpen && (
        <ConsentLinkDialog
          url={consentOpen.url}
          expira_em={consentOpen.expira_em}
          unidadeNome={int.unidade_nome}
          onClose={() => setConsentOpen(null)}
        />
      )}
    </div>
  );
}

function ConsentLinkDialog({ url, expira_em, unidadeNome, onClose }: {
  url: string; expira_em: string; unidadeNome: string; onClose: () => void;
}) {
  const [qr, setQr] = React.useState<string | null>(null);
  const [copiou, setCopiou] = React.useState(false);

  React.useEffect(() => {
    QRCode.toDataURL(url, { width: 280, margin: 1 }).then(setQr).catch(() => setQr(null));
  }, [url]);

  function copiar() {
    navigator.clipboard.writeText(url);
    setCopiou(true);
    setTimeout(() => setCopiou(false), 2000);
  }

  const mensagemWhats = encodeURIComponent(
    `Olá! Aqui é o LavSync. Pra liberar a sincronização automática das vendas Stone da unidade ${unidadeNome}, acesse o link abaixo, faça login na sua conta Stone e aprove o acesso:\n\n${url}\n\nO link expira em 2 horas.`
  );

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-0 z-50 grid place-items-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-border/60 flex items-start justify-between">
              <div>
                <Dialog.Title className="font-display text-lg font-bold inline-flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-cyan" /> Link de consentimento
                </Dialog.Title>
                <div className="text-[11px] text-muted-foreground mt-0.5">Unidade {unidadeNome}</div>
              </div>
              <Dialog.Close asChild>
                <button className="w-8 h-8 rounded-md hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4" /></button>
              </Dialog.Close>
            </div>

            <div className="p-5 space-y-3">
              <div className="rounded-lg border border-warning/30 bg-warning/8 p-3 text-[11px] text-warning">
                Compartilhe esse link com o responsável da unidade. Ele precisa <strong>logar na conta Stone</strong> e aprovar o acesso. O link expira em <strong>{new Date(expira_em).toLocaleString("pt-BR")}</strong>.
              </div>

              {qr && (
                <div className="bg-white p-3 rounded-lg flex justify-center">
                  <img src={qr} alt="QR Code" className="w-56 h-56" />
                </div>
              )}

              <div className="rounded-lg border border-border bg-muted/30 p-2.5 break-all text-[10px] font-mono">
                {url}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button onClick={copiar}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-border bg-card hover:bg-secondary text-[11px] font-semibold transition-colors">
                  {copiou ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiou ? "Copiado" : "Copiar"}
                </button>
                <a href={`https://wa.me/?text=${mensagemWhats}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-success/30 bg-success/8 text-success text-[11px] font-semibold hover:bg-success/15 transition-colors">
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
                <a href={`mailto:?subject=${encodeURIComponent("Consentimento Stone — " + unidadeNome)}&body=${mensagemWhats}`}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-brand-cyan/30 bg-brand-cyan/8 text-brand-cyan text-[11px] font-semibold hover:bg-brand-cyan/15 transition-colors">
                  <Mail className="w-3.5 h-3.5" /> Email
                </a>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-end">
              <Dialog.Close asChild><Button>Fechar</Button></Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CronStatusView({ entries }: { entries: CronStatusEntry[] }) {
  const proximoCron = (() => {
    if (entries.length === 0) return "—";
    const ult = entries[0]?.iniciado_em;
    if (!ult) return "—";
    const ultMs = new Date(ult).getTime();
    const proxMs = ultMs + 5 * 60 * 1000;
    const restanteMin = Math.max(0, Math.round((proxMs - Date.now()) / 60000));
    return restanteMin === 0 ? "imediato" : `~${restanteMin}min`;
  })();

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-brand-cyan" />
          <span className="font-display font-bold text-[14px]">Cron de sincronização ({entries.length})</span>
        </div>
        <div className="text-[11px] text-muted-foreground">Próxima execução: <span className="font-mono font-bold text-brand-cyan">{proximoCron}</span></div>
      </div>
      <div className="divide-y divide-border/40 max-h-96 overflow-y-auto">
        {entries.map((e) => {
          const duracao = e.duracao_segundos ?? null;
          const status = e.erro_global ? "erro" : (e.concluido_em ? "sucesso" : "em_andamento");
          return (
            <div key={e.id} className="px-5 py-3">
              <div className="flex items-center gap-3">
                {status === "sucesso" && <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
                {status === "erro" && <AlertTriangle className="w-4 h-4 text-danger shrink-0" />}
                {status === "em_andamento" && <Loader2 className="w-4 h-4 text-brand-cyan animate-spin shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-mono">
                    {new Date(e.iniciado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {duracao !== null && <span className="text-muted-foreground"> · {duracao}s</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {e.unidades_processadas} processadas · <span className="text-success">{e.unidades_com_sucesso} ok</span>
                    {e.unidades_com_erro > 0 && <span className="text-danger"> · {e.unidades_com_erro} erro</span>}
                    {e.vendas_inseridas_total > 0 && <span className="text-brand-cyan"> · {e.vendas_inseridas_total} vendas inseridas</span>}
                  </div>
                  {e.erro_global && <div className="text-[11px] text-danger mt-1">{e.erro_global}</div>}
                </div>
              </div>
            </div>
          );
        })}
        {entries.length === 0 && (
          <div className="text-center text-[12px] text-muted-foreground py-8">
            Cron ainda não executou. Roda a cada 5 minutos automaticamente em produção.
          </div>
        )}
      </div>
    </div>
  );
}

function WebhookEventsView({ events }: { events: WebhookEventLog[] }) {
  const statusTone: Record<string, string> = {
    recebido: "muted-foreground",
    processado: "success",
    erro: "danger",
    ignorado: "warning",
  };
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center gap-2">
        <Activity className="w-4 h-4 text-brand-cyan" />
        <span className="font-display font-bold text-[14px]">Webhooks Stone ({events.length})</span>
      </div>
      <div className="divide-y divide-border/40 max-h-96 overflow-y-auto">
        {events.map((e) => {
          const tone = statusTone[e.status] ?? "muted-foreground";
          return (
            <div key={e.id} className="px-5 py-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                  `bg-${tone}/15 text-${tone}`)}>{e.status}</span>
                <span className="text-[11px] font-semibold">{e.event_type}</span>
                {e.signature_validated && <CheckCircle2 className="w-3 h-3 text-success" />}
                <span className="text-[10px] text-muted-foreground font-mono ml-auto">{new Date(e.recebido_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">id: {e.stone_event_id.slice(0, 24)}…</div>
              {e.erro && <div className="text-[11px] text-danger mt-1">{e.erro}</div>}
            </div>
          );
        })}
        {events.length === 0 && (
          <div className="text-center text-[12px] text-muted-foreground py-8">
            Nenhum webhook recebido ainda. Endpoint: <code className="text-[10px]">POST /api/webhooks/stone</code>
          </div>
        )}
      </div>
    </div>
  );
}

function LogsView({ logs }: { logs: SyncLog[] }) {
  const statusMeta: Record<SyncLog["status"], { label: string; tone: string; icon: React.ElementType }> = {
    em_andamento: { label: "Em andamento", tone: "brand-cyan", icon: Loader2 },
    sucesso:      { label: "Sucesso",      tone: "success",    icon: CheckCircle2 },
    erro:         { label: "Erro",         tone: "danger",     icon: AlertTriangle },
    parcial:      { label: "Parcial",      tone: "warning",    icon: AlertTriangle },
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center gap-2">
        <History className="w-4 h-4 text-brand-cyan" />
        <span className="font-display font-bold text-[14px]">Histórico de sincronizações ({logs.length})</span>
      </div>
      <div className="divide-y divide-border/40 max-h-96 overflow-y-auto">
        {logs.map((l) => {
          const meta = statusMeta[l.status];
          const Icon = meta.icon;
          const duracao = l.concluido_em && l.iniciado_em
            ? Math.round((new Date(l.concluido_em).getTime() - new Date(l.iniciado_em).getTime()) / 1000)
            : null;
          return (
            <div key={l.id} className="px-5 py-3 flex items-start gap-3">
              <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", `text-${meta.tone}`, l.status === "em_andamento" && "animate-spin")} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-semibold text-[12px]">{l.unidade_nome}</span>
                  <span className={cn("text-[9px] font-bold uppercase tracking-wider", `text-${meta.tone}`)}>{meta.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(l.iniciado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {duracao != null && ` · ${duracao}s`}
                    {l.disparado_por && ` · ${l.disparado_por}`}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {l.transacoes_recebidas} recebidas · {l.vendas_inseridas} inseridas · {l.vendas_duplicadas} duplicadas
                </div>
                {l.erro && <div className="text-[11px] text-danger mt-1">{l.erro}</div>}
              </div>
            </div>
          );
        })}
        {logs.length === 0 && (
          <div className="text-center text-[12px] text-muted-foreground py-8">Nenhum sync executado ainda</div>
        )}
      </div>
    </div>
  );
}

function IntegracaoDialog({ integracao, modoNovo, unidades, unidadesDisponiveis, onClose }: {
  integracao: IntegracaoStone | null | undefined;
  modoNovo: boolean;
  unidades: Unidade[];
  unidadesDisponiveis: Unidade[];
  onClose: () => void;
}) {
  const aberto = integracao !== null && integracao !== undefined || modoNovo;
  const [form, setForm] = React.useState<IntegracaoStoneInput>({
    unidade_id: "", cnpj: "", razao_social: "", account_id: "", client_id: "",
    private_key_pem: "", ambiente: "production", ativo: true,
    sync_automatico: false, sync_intervalo_minutos: 60, observacoes: "",
  });
  const [mostrarChave, setMostrarChave] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (modoNovo) {
      setForm({
        unidade_id: unidadesDisponiveis[0]?.id ?? "",
        cnpj: "", razao_social: "", account_id: "", client_id: "",
        private_key_pem: "", ambiente: "production", ativo: true,
        sync_automatico: false, sync_intervalo_minutos: 60, observacoes: "",
      });
    } else if (integracao) {
      setForm({
        unidade_id: integracao.unidade_id,
        cnpj: integracao.cnpj,
        razao_social: integracao.razao_social,
        account_id: integracao.account_id,
        client_id: integracao.client_id,
        private_key_pem: "",       // não exibe ao editar; só se quiser substituir
        ambiente: integracao.ambiente,
        ativo: integracao.ativo,
        sync_automatico: integracao.sync_automatico,
        sync_intervalo_minutos: integracao.sync_intervalo_minutos,
        observacoes: integracao.observacoes,
      });
    }
    setErro(null);
  }, [integracao, modoNovo, unidadesDisponiveis]);

  async function salvar() {
    setSaving(true); setErro(null);
    try {
      await salvarIntegracaoStone(integracao?.id ?? null, form);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally { setSaving(false); }
  }

  async function deletar() {
    if (!integracao) return;
    if (!confirm(`Excluir integração Stone da unidade ${integracao.unidade_nome}? Os dados sincronizados são preservados.`)) return;
    setSaving(true);
    try { await excluirIntegracaoStone(integracao.id); onClose(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Erro"); setSaving(false); }
  }

  return (
    <Dialog.Root open={aberto} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <AnimatePresence>
          {aberto && (
            <>
              <Dialog.Overlay asChild forceMount>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
                  className="fixed inset-0 z-50 grid place-items-center p-4">
                  <div className="w-full max-w-xl rounded-2xl bg-card border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
                    <div className="p-5 border-b border-border/60 flex items-start justify-between">
                      <Dialog.Title className="font-display text-lg font-bold inline-flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-brand-cyan" />
                        {modoNovo ? "Nova integração Stone" : "Editar integração"}
                      </Dialog.Title>
                      <Dialog.Close asChild>
                        <button className="w-8 h-8 rounded-md hover:bg-secondary flex items-center justify-center"><X className="w-4 h-4" /></button>
                      </Dialog.Close>
                    </div>

                    <div className="p-5 space-y-3">
                      <Campo label="Unidade">
                        <select value={form.unidade_id} onChange={(e) => setForm({ ...form, unidade_id: e.target.value })} className="form-input"
                          disabled={!modoNovo}>
                          <option value="">— Selecione —</option>
                          {(modoNovo ? unidadesDisponiveis : unidades).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                        </select>
                      </Campo>

                      <div className="grid grid-cols-2 gap-3">
                        <Campo label="CNPJ">
                          <input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" className="form-input font-mono" />
                        </Campo>
                        <Campo label="Razão Social">
                          <input value={form.razao_social ?? ""} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} className="form-input" />
                        </Campo>
                      </div>

                      <Campo label="account_id (UUID da conta Stone)">
                        <input value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} placeholder="00000000-0000-0000-0000-000000000000" className="form-input font-mono text-[11px]" />
                      </Campo>

                      <Campo label="client_id (aplicação parceira)">
                        <input value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className="form-input font-mono text-[11px]" />
                      </Campo>

                      <Campo label={modoNovo ? "Chave privada RSA 4096 (PEM)" : "Chave privada (deixe vazio pra manter)"}>
                        <div className="relative">
                          <textarea
                            value={form.private_key_pem}
                            onChange={(e) => setForm({ ...form, private_key_pem: e.target.value })}
                            rows={6}
                            placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIJQwIBADANBgkqhkiG9w0BAQEFAASCCS0wggkpAgEAAoICAQ...&#10;[chave RSA 4096 ~3300 caracteres]&#10;-----END PRIVATE KEY-----"
                            className="form-input font-mono text-[10px] resize-none"
                            style={{ filter: mostrarChave ? "none" : "blur(3px)" }}
                          />
                          <button type="button" onClick={() => setMostrarChave(!mostrarChave)}
                            className="absolute top-2 right-2 w-7 h-7 rounded hover:bg-secondary flex items-center justify-center" aria-label="Mostrar chave">
                            {mostrarChave ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          Stone exige RSA <strong>4096 bits</strong>. Gere com: <code>openssl genrsa -out chave.pem 4096</code>
                        </div>
                      </Campo>

                      <div className="grid grid-cols-2 gap-3">
                        <Campo label="Ambiente">
                          <select value={form.ambiente} onChange={(e) => setForm({ ...form, ambiente: e.target.value as IntegracaoStoneInput["ambiente"] })} className="form-input">
                            <option value="production">Produção</option>
                            <option value="sandbox">Sandbox</option>
                          </select>
                        </Campo>
                        <Campo label="Intervalo sync (min)">
                          <input type="number" value={form.sync_intervalo_minutos ?? 60} onChange={(e) => setForm({ ...form, sync_intervalo_minutos: Number(e.target.value) })} className="form-input font-mono" />
                        </Campo>
                      </div>

                      <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                        <input type="checkbox" checked={form.ativo ?? true} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
                        Integração ativa
                      </label>
                      <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                        <input type="checkbox" checked={form.sync_automatico ?? false} onChange={(e) => setForm({ ...form, sync_automatico: e.target.checked })} />
                        Sincronização automática (cron)
                      </label>

                      <Campo label="Observações">
                        <textarea value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} className="form-input resize-none" />
                      </Campo>

                      {erro && <div className="rounded-lg border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{erro}</div>}
                    </div>

                    <div className="px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-between">
                      {!modoNovo && integracao ? (
                        <Button variant="ghost" onClick={deletar} disabled={saving} className="text-danger">
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                        </Button>
                      ) : <span />}
                      <div className="flex gap-2">
                        <Dialog.Close asChild><Button variant="ghost" disabled={saving}>Cancelar</Button></Dialog.Close>
                        <Button onClick={salvar}
                          disabled={saving || !form.unidade_id || !form.account_id || !form.client_id || (modoNovo && !form.private_key_pem)}
                          className="bg-brand-cyan text-primary-foreground">
                          {saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                          <Save className="w-3.5 h-3.5 mr-1" /> Salvar
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

void fmtBRL;

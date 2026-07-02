"use client";

// LavSync · CLOCK Relacionamento · Tela de conexão WhatsApp (Embedded Signup)
//
// Coexistência: o número segue no app WhatsApp Business do celular da loja
// E ganha Cloud API. O botão abre o fluxo da Meta (FB.login com config_id);
// o QR é escaneado no celular; capturamos waba_id/phone_number_id via evento
// WA_EMBEDDED_SIGNUP e o code via callback, e fechamos no servidor.
import * as React from "react";
import {
  MessageCircle, CheckCircle2, AlertTriangle, Loader2, RefreshCw,
  Plug, QrCode, Send, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  concluirEmbeddedSignup, checarSaudeConexao, enviarMensagemTeste,
  type SaudeConexao,
} from "@/lib/clock-relacionamento/onboarding";

type Unidade = { id: string; nome: string };
export type ConexaoResumo = {
  unidade_id: string;
  numero_comercial: string | null;
  verified_name: string | null;
  waba_id: string | null;
  phone_number_id: string | null;
  status: string;
  ultimo_check_em: string | null;
  ultimo_erro: string | null;
};

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (cb: (resp: { authResponse?: { code?: string } }) => void, opts: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

const FB_VERSION = "v21.0";

export function WhatsAppIntegracaoView({
  unidades, conexoes, appId, configId,
}: {
  unidades: Unidade[];
  conexoes: ConexaoResumo[];
  appId: string | null;
  configId: string | null;
}) {
  const [sdkPronto, setSdkPronto] = React.useState(false);
  const [unidadeId, setUnidadeId] = React.useState(unidades[0]?.id ?? "");
  const [pin, setPin] = React.useState("");
  const [rodando, setRodando] = React.useState(false);
  const [msg, setMsg] = React.useState<{ tipo: "ok" | "erro" | "info"; texto: string } | null>(null);
  const [saude, setSaude] = React.useState<Record<string, SaudeConexao>>({});
  const [checando, setChecando] = React.useState<string | null>(null);
  const [testeTel, setTesteTel] = React.useState("");
  const [testando, setTestando] = React.useState(false);
  // ids capturados do evento WA_EMBEDDED_SIGNUP (chegam antes do code)
  const signupData = React.useRef<{ waba_id?: string; phone_number_id?: string }>({});

  // Carrega o SDK do Facebook uma vez
  React.useEffect(() => {
    if (!appId) return;
    if (window.FB) { setSdkPronto(true); return; }
    window.fbAsyncInit = () => {
      window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: FB_VERSION });
      setSdkPronto(true);
    };
    const s = document.createElement("script");
    s.src = "https://connect.facebook.net/pt_BR/sdk.js";
    s.async = true;
    s.defer = true;
    s.crossOrigin = "anonymous";
    document.body.appendChild(s);
  }, [appId]);

  // Captura waba_id/phone_number_id do postMessage do fluxo
  React.useEffect(() => {
    function onMessage(ev: MessageEvent) {
      if (!String(ev.origin).endsWith("facebook.com")) return;
      try {
        const data = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
        if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
        const d = data?.data ?? {};
        if (d.waba_id) signupData.current.waba_id = String(d.waba_id);
        if (d.phone_number_id) signupData.current.phone_number_id = String(d.phone_number_id);
      } catch { /* mensagens de outros widgets */ }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function conectar() {
    if (!window.FB || !configId) return;
    if (!/^\d{6}$/.test(pin)) {
      setMsg({ tipo: "erro", texto: "Defina um PIN de 6 dígitos antes de conectar (é a 2FA do número na Cloud API — anote!)." });
      return;
    }
    setMsg({ tipo: "info", texto: "Siga o fluxo da Meta na janela. Na etapa do QR, escaneie com o celular da loja (WhatsApp Business > Dispositivos conectados)." });
    signupData.current = {};
    setRodando(true);
    window.FB.login(
      (resp) => {
        const code = resp?.authResponse?.code;
        const { waba_id, phone_number_id } = signupData.current;
        if (!code || !waba_id || !phone_number_id) {
          setRodando(false);
          setMsg({ tipo: "erro", texto: "Fluxo não concluído (faltou code ou identificadores). Tente de novo." });
          return;
        }
        void (async () => {
          const r = await concluirEmbeddedSignup({ unidadeId, code, wabaId: waba_id, phoneNumberId: phone_number_id, pin });
          setRodando(false);
          setMsg(r.ok
            ? { tipo: "ok", texto: "Número conectado à Cloud API. Guarde o PIN — ele é a 2FA do registro." }
            : { tipo: "erro", texto: `Falha na etapa "${r.etapa}": ${r.erro}` });
        })();
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          sessionInfoVersion: "3",
          setup: {},
          // Coexistência: mantém o app do celular + habilita Cloud API
          featureType: "whatsapp_business_app_onboarding",
        },
      },
    );
  }

  async function checarSaude(uid: string) {
    setChecando(uid);
    const r = await checarSaudeConexao(uid);
    setSaude((s) => ({ ...s, [uid]: r }));
    setChecando(null);
  }

  async function enviarTeste() {
    if (!testeTel.trim()) return;
    setTestando(true);
    const r = await enviarMensagemTeste(
      unidadeId, testeTel,
      "Teste de conexão LavSync · CLOCK Relacionamento. Se você recebeu esta mensagem, a integração WhatsApp está no ar.",
    );
    setTestando(false);
    setMsg(r.ok
      ? { tipo: "ok", texto: `Mensagem de teste enviada (id ${r.messageId ?? "?"}). Confira o celular e o log de eventos.` }
      : { tipo: "erro", texto: `Envio falhou: ${r.erro}` });
  }

  const configurado = Boolean(appId && configId);
  const nomeUnidade = (id: string) => unidades.find((u) => u.id === id)?.nome ?? id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp Cloud API"
        subtitle="Conexão oficial Meta por unidade — motor do CLOCK Relacionamento"
      />

      {!configurado && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Configuração pendente</p>
          <p className="mt-1">
            Defina <code>META_APP_ID</code> e <code>META_ES_CONFIG_ID</code> na Vercel.
            O Config ID vem do App Dashboard da Meta (Facebook Login for Business → Configurações → Cadastro incorporado).
          </p>
        </div>
      )}

      {msg && (
        <div className={cn(
          "rounded-xl border p-4 text-sm",
          msg.tipo === "ok" && "border-emerald-300 bg-emerald-50 text-emerald-900",
          msg.tipo === "erro" && "border-red-300 bg-red-50 text-red-900",
          msg.tipo === "info" && "border-sky-300 bg-sky-50 text-sky-900",
        )}>
          {msg.texto}
        </div>
      )}

      {/* Conectar unidade */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><QrCode className="h-4 w-4" /> Conectar número (coexistência)</h3>
        <p className="text-sm text-muted-foreground">
          O número continua funcionando no app WhatsApp Business do celular da loja e passa a enviar também pela Cloud API.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-muted-foreground mb-1">Unidade</span>
            <select
              value={unidadeId}
              onChange={(e) => setUnidadeId(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-muted-foreground mb-1">PIN 2FA (6 dígitos — anote)</span>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="000000"
              className="h-9 w-32 rounded-md border bg-background px-3 text-sm tracking-widest"
            />
          </label>
          <Button onClick={conectar} disabled={!configurado || !sdkPronto || rodando}>
            {rodando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            <span className="ml-2">Conectar com a Meta</span>
          </Button>
        </div>
      </div>

      {/* Conexões existentes */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Conexões</h3>
        {conexoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conexão cadastrada.</p>}
        {conexoes.map((c) => {
          const h = saude[c.unidade_id];
          const okCloud = h?.platformType === "CLOUD_API";
          return (
            <div key={c.unidade_id} className="rounded-lg border p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                {c.status === "conectado"
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  : <AlertTriangle className="h-5 w-5 text-amber-600" />}
                <div className="min-w-0">
                  <p className="font-medium">{nomeUnidade(c.unidade_id)} · {c.verified_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.numero_comercial ? `+${c.numero_comercial}` : "sem número"} · WABA {c.waba_id ?? "—"} · status {c.status}
                    {c.ultimo_check_em ? ` · checado ${new Date(c.ultimo_check_em).toLocaleString("pt-BR")}` : ""}
                  </p>
                  {c.ultimo_erro && <p className="text-xs text-red-600">{c.ultimo_erro}</p>}
                </div>
                <div className="ml-auto">
                  <Button variant="outline" size="sm" onClick={() => checarSaude(c.unidade_id)} disabled={checando === c.unidade_id}>
                    {checando === c.unidade_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <span className="ml-2">Verificar saúde</span>
                  </Button>
                </div>
              </div>
              {h && (
                <div className="text-xs rounded-md bg-muted p-2 space-y-1">
                  <p className="flex items-center gap-1">
                    <ShieldCheck className={cn("h-3.5 w-3.5", okCloud ? "text-emerald-600" : "text-amber-600")} />
                    plataforma <b>{h.platformType}</b> · envio <b>{h.canSend}</b>
                  </p>
                  {(h.detalhes ?? []).map((d, i) => <p key={i}>· {d}</p>)}
                  {h.erro && <p className="text-red-600">{h.erro}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Teste real */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Send className="h-4 w-4" /> Mensagem de teste</h3>
        <p className="text-sm text-muted-foreground">
          Texto livre — o destinatário precisa ter falado com o número nas últimas 24h, ou use após conectar e responder do seu celular.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-muted-foreground mb-1">WhatsApp destino (DDD+número)</span>
            <input
              value={testeTel}
              onChange={(e) => setTesteTel(e.target.value)}
              placeholder="31999999999"
              className="h-9 w-48 rounded-md border bg-background px-3 text-sm"
            />
          </label>
          <Button variant="outline" onClick={enviarTeste} disabled={testando || !testeTel.trim()}>
            {testando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="ml-2">Enviar teste pela unidade selecionada</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

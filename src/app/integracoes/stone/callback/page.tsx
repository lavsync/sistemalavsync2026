// Stone Open Banking · Callback após o usuário aprovar/recusar consentimento.
// Stone redireciona pra esta URL com:
//   ?consent_result=approved|ignored|already_granted
//   &session_metadata=<o que enviamos>
//   &resource_id=<UUID da conta>     (só em approved)
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, XCircle, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

type SP = Promise<{
  consent_result?: string;
  session_metadata?: string;
  resource_id?: string;
  error?: string;
  error_description?: string;
}>;

export default async function CallbackPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const result = sp.consent_result ?? "";
  const session = sp.session_metadata ?? "";
  const resourceId = sp.resource_id ?? "";
  const erro = sp.error ?? sp.error_description ?? "";

  let estado: "sucesso" | "ignorado" | "erro" | "ja_concedido" | "desconhecido" = "desconhecido";
  let titulo = "Processando consentimento…";
  let mensagem = "";
  let unidadeNome = "";

  if (!session) {
    estado = "erro";
    titulo = "Parâmetro session_metadata ausente";
    mensagem = "Stone não retornou o identificador da sessão. Tente solicitar o consentimento novamente.";
  } else {
    const sb = await createClient();
    // Localiza integração pelo session_metadata
    const { data: int } = await sb.from("integracoes_stone")
      .select("id, tenant_id, unidade_id, consent_status, unidade:unidades(nome)")
      .eq("consent_session_metadata", session)
      .maybeSingle();

    type Raw = {
      id: string; tenant_id: string; unidade_id: string; consent_status: string;
      unidade: { nome: string } | Array<{ nome: string }> | null;
    };
    const cfg = int as unknown as Raw | null;
    unidadeNome = cfg
      ? (Array.isArray(cfg.unidade) ? cfg.unidade[0]?.nome : cfg.unidade?.nome) ?? "—"
      : "—";

    if (!cfg) {
      estado = "erro";
      titulo = "Sessão não encontrada";
      mensagem = "Não foi possível localizar a integração associada a esse callback. O link pode ter expirado.";
    } else if (erro) {
      await sb.from("integracoes_stone")
        .update({
          consent_status: "rejeitado",
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", cfg.id);
      await sb.from("stone_consent_logs").insert({
        tenant_id: cfg.tenant_id,
        unidade_id: cfg.unidade_id,
        integracao_id: cfg.id,
        evento: "callback_recebido",
        consent_result: "error",
        session_metadata: session,
        raw_data: { error: erro, params: sp as Record<string, unknown> },
      });
      estado = "erro";
      titulo = "Erro ao processar consentimento";
      mensagem = erro;
    } else if (result === "approved") {
      // Sucesso — salva resource_id
      await sb.from("integracoes_stone")
        .update({
          consent_status: "aprovado",
          consent_aprovado_em: new Date().toISOString(),
          resource_id: resourceId || cfg.id,
          // resource_id passa a ser o account_id usado nas chamadas. Mantém o account_id antigo só se já existir.
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", cfg.id);
      // Atualiza account_id pra usar o resource_id retornado pela Stone
      if (resourceId) {
        await sb.from("integracoes_stone")
          .update({ account_id: resourceId })
          .eq("id", cfg.id);
      }
      await sb.from("stone_consent_logs").insert({
        tenant_id: cfg.tenant_id,
        unidade_id: cfg.unidade_id,
        integracao_id: cfg.id,
        evento: "aprovado",
        consent_result: "approved",
        resource_id: resourceId,
        session_metadata: session,
        raw_data: sp as Record<string, unknown>,
      });
      estado = "sucesso";
      titulo = "Consentimento aprovado!";
      mensagem = `A unidade ${unidadeNome} liberou acesso. Você já pode sincronizar as vendas Stone automaticamente.`;
    } else if (result === "already_granted") {
      await sb.from("integracoes_stone")
        .update({
          consent_status: "aprovado",
          consent_aprovado_em: new Date().toISOString(),
          resource_id: resourceId || null,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", cfg.id);
      if (resourceId) {
        await sb.from("integracoes_stone").update({ account_id: resourceId }).eq("id", cfg.id);
      }
      await sb.from("stone_consent_logs").insert({
        tenant_id: cfg.tenant_id,
        unidade_id: cfg.unidade_id,
        integracao_id: cfg.id,
        evento: "aprovado",
        consent_result: "already_granted",
        resource_id: resourceId,
        session_metadata: session,
        raw_data: sp as Record<string, unknown>,
      });
      estado = "ja_concedido";
      titulo = "Consentimento já concedido";
      mensagem = `A unidade ${unidadeNome} já havia autorizado o acesso anteriormente. Tudo certo.`;
    } else if (result === "ignored") {
      await sb.from("integracoes_stone")
        .update({
          consent_status: "rejeitado",
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", cfg.id);
      await sb.from("stone_consent_logs").insert({
        tenant_id: cfg.tenant_id,
        unidade_id: cfg.unidade_id,
        integracao_id: cfg.id,
        evento: "rejeitado",
        consent_result: "ignored",
        session_metadata: session,
        raw_data: sp as Record<string, unknown>,
      });
      estado = "ignorado";
      titulo = "Consentimento não concedido";
      mensagem = `A unidade ${unidadeNome} não concluiu a autorização. Solicite novamente quando estiver pronta.`;
    } else {
      estado = "erro";
      titulo = "Resposta inesperada";
      mensagem = `Stone retornou consent_result="${result}". Verifique se o link está atualizado.`;
    }
  }

  const corHeader = estado === "sucesso" || estado === "ja_concedido"
    ? "from-success/20 to-card"
    : estado === "ignorado"
    ? "from-warning/20 to-card"
    : "from-danger/20 to-card";

  const Icon = estado === "sucesso" || estado === "ja_concedido" ? CheckCircle2
    : estado === "ignorado" ? AlertTriangle
    : XCircle;

  const tom = estado === "sucesso" || estado === "ja_concedido" ? "success"
    : estado === "ignorado" ? "warning"
    : "danger";

  return (
    <div className="min-h-screen flex items-center justify-center bg-mesh-dark p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className={`bg-gradient-to-br ${corHeader} p-6 text-center`}>
          <Icon className={`w-12 h-12 mx-auto mb-3 text-${tom}`} />
          <h1 className="font-display font-bold text-xl">{titulo}</h1>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-[13px] text-muted-foreground text-center">{mensagem}</p>

          {resourceId && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-[11px]">
              <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-0.5">Account ID Stone</div>
              <code className="font-mono break-all">{resourceId}</code>
            </div>
          )}

          <Link href="/integracoes/stone"
            className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-gradient-to-r from-brand-cyan to-brand-blue text-white font-bold text-[13px]">
            <ArrowLeft className="w-4 h-4" /> Voltar para integrações
          </Link>
        </div>
      </div>
    </div>
  );
}

import { AppShell } from "@/components/shell/app-shell";
import { WhatsAppIntegracaoView, type ConexaoResumo } from "@/components/integracoes/whatsapp-view";
import { listarUnidades } from "@/lib/unidade-ativa";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Page() {
  const sb = await createClient();
  const [unidades, { data: conexoes }] = await Promise.all([
    listarUnidades(),
    // RLS master-only em wa_conexoes; nunca selecionar segredos aqui
    sb.from("wa_conexoes")
      .select("unidade_id, numero_comercial, verified_name, waba_id, phone_number_id, status, ultimo_check_em, ultimo_erro, app_id")
      .eq("ativo", true)
      .order("criado_em"),
  ]);

  const rows = (conexoes ?? []) as (ConexaoResumo & { app_id: string | null })[];
  const appId = process.env.META_APP_ID ?? rows.find((c) => c.app_id)?.app_id ?? null;
  const configId = process.env.META_ES_CONFIG_ID ?? null;

  return (
    <AppShell>
      <WhatsAppIntegracaoView
        unidades={unidades.map((u) => ({ id: u.id, nome: u.nome }))}
        conexoes={rows.map(({ app_id: _omit, ...c }) => c)}
        appId={appId}
        configId={configId}
      />
    </AppShell>
  );
}

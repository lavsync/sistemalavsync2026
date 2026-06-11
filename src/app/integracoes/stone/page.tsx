import { AppShell } from "@/components/shell/app-shell";
import { StoneIntegracoesView } from "@/components/integracoes/stone-view";
import {
  listarIntegracoesStone, listarSyncLogs,
  listarCronStatus, listarWebhookEvents,
} from "@/lib/stone/queries";
import { listarUnidades } from "@/lib/unidade-ativa";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [integracoes, logs, unidades, cronStatus, webhookEvents] = await Promise.all([
    listarIntegracoesStone(),
    listarSyncLogs({ limit: 30 }),
    listarUnidades(),
    listarCronStatus(10),
    listarWebhookEvents(20),
  ]);

  return (
    <AppShell>
      <StoneIntegracoesView
        integracoes={integracoes}
        logs={logs}
        unidades={unidades.map((u) => ({ id: u.id, nome: u.nome }))}
        cronStatus={cronStatus}
        webhookEvents={webhookEvents}
      />
    </AppShell>
  );
}

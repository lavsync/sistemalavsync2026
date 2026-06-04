import { AppShell } from "@/components/shell/app-shell";
import { IntegrationsView } from "@/components/views/integrations-view";
import { getIntegrationStatus } from "@/lib/integrations-actions";

export const dynamic = "force-dynamic";

export default async function Page() {
  const status = await getIntegrationStatus();
  return (
    <AppShell>
      <IntegrationsView status={status} />
    </AppShell>
  );
}

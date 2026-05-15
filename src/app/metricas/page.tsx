import { AppShell } from "@/components/shell/app-shell";
import { MetricasView } from "@/components/views/metricas-view";
import {
  getMonthlyMetrics,
  getOperationalMetrics,
  getUnitCosts,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [metrics, history, unitCosts] = await Promise.all([
    getOperationalMetrics(),
    getMonthlyMetrics(),
    getUnitCosts(),
  ]);

  return (
    <AppShell>
      <MetricasView metrics={metrics} history={history} unitCosts={unitCosts} />
    </AppShell>
  );
}

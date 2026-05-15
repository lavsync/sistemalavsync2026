import { AppShell } from "@/components/shell/app-shell";
import { DashboardView } from "@/components/views/dashboard-view";
import {
  getDashboardKpis,
  getHourlyOccupation,
  getMachinesStatus,
  getRevenueSplit,
  getRevenueTimeseries,
} from "@/lib/queries";

// Sempre buscar dados frescos do Supabase (sem cache estático).
export const dynamic = "force-dynamic";

export default async function Page() {
  const [kpis, timeseries, split, hourly, machines] = await Promise.all([
    getDashboardKpis(),
    getRevenueTimeseries(undefined, 14),
    getRevenueSplit(undefined, 30),
    getHourlyOccupation(),
    getMachinesStatus(),
  ]);

  return (
    <AppShell>
      <DashboardView
        kpis={kpis}
        timeseries={timeseries}
        split={split}
        hourly={hourly}
        machines={machines}
      />
    </AppShell>
  );
}

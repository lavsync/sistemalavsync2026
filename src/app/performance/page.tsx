import { AppShell } from "@/components/shell/app-shell";
import { PerformanceView } from "@/components/views/performance-view";
import {
  getMonthlyMetrics,
  getPerformance30d,
  getPerformanceByMachine,
  getPerformanceHeatmap,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [perf30d, byMachine, heatmap, monthly] = await Promise.all([
    getPerformance30d(),
    getPerformanceByMachine(),
    getPerformanceHeatmap(),
    getMonthlyMetrics(undefined, 12),
  ]);

  return (
    <AppShell>
      <PerformanceView
        perf30d={perf30d}
        byMachine={byMachine}
        heatmap={heatmap}
        monthly={monthly}
      />
    </AppShell>
  );
}

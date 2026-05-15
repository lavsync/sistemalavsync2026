import { AppShell } from "@/components/shell/app-shell";
import { PerformanceView } from "@/components/views/performance-view";

export default function Page() {
  return (
    <AppShell>
      <PerformanceView />
    </AppShell>
  );
}

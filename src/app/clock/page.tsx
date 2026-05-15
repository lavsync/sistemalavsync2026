import { AppShell } from "@/components/shell/app-shell";
import { ClockView } from "@/components/views/clock-view";

export default function Page() {
  return (
    <AppShell hideClockRail>
      <ClockView />
    </AppShell>
  );
}

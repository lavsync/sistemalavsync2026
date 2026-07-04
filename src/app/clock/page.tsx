import { AppShell } from "@/components/shell/app-shell";
import { ClockView } from "@/components/views/clock-view";
import { ClockChat } from "@/components/clock/clock-chat";

export default function Page() {
  return (
    <AppShell hideClockRail>
      <div className="space-y-6">
        <ClockChat />
        <ClockView />
      </div>
    </AppShell>
  );
}

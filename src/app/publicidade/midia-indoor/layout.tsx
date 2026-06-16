import { AppShell } from "@/components/shell/app-shell";
import { ModuleNav } from "./_components/module-nav";

export default function MidiaIndoorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <ModuleNav />
      {children}
    </AppShell>
  );
}

import { AppShell } from "@/components/shell/app-shell";
import { ClientesView } from "@/components/views/clientes-view";

export default function Page() {
  return (
    <AppShell>
      <ClientesView />
    </AppShell>
  );
}

import { AppShell } from "@/components/shell/app-shell";
import { SuporteView } from "@/components/suporte/suporte-view";
import { listarTickets } from "@/lib/suporte/queries";
import { listarUnidades, getUnidadeAtiva } from "@/lib/unidade-ativa";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [tickets, unidades, unidadeAtiva] = await Promise.all([
    listarTickets(),
    listarUnidades(),
    getUnidadeAtiva(),
  ]);
  return (
    <AppShell>
      <SuporteView
        tickets={tickets}
        unidades={unidades}
        unidadeAtivaId={unidadeAtiva?.id ?? unidades[0]?.id ?? ""}
      />
    </AppShell>
  );
}

import { AppShell } from "@/components/shell/app-shell";
import { MarketingView } from "@/components/marketing/marketing-view";
import { listarCampanhas } from "@/lib/marketing/queries";
import { listarUnidades, getUnidadeAtiva } from "@/lib/unidade-ativa";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [campanhas, unidades, unidadeAtiva] = await Promise.all([
    listarCampanhas(),
    listarUnidades(),
    getUnidadeAtiva(),
  ]);

  return (
    <AppShell>
      <MarketingView
        campanhas={campanhas}
        unidades={unidades}
        unidadeAtivaId={unidadeAtiva?.id ?? unidades[0]?.id ?? ""}
      />
    </AppShell>
  );
}

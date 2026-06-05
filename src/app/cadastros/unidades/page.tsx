import { AppShell } from "@/components/shell/app-shell";
import { UnidadesCadastroView } from "@/components/cadastros/unidades-view";
import { listarUnidadesCompletas } from "@/lib/cadastros/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Unidades · LavSync" };

export default async function Page() {
  const unidades = await listarUnidadesCompletas();
  return (
    <AppShell>
      <div className="px-6 lg:px-8 py-6">
        <UnidadesCadastroView unidades={unidades} />
      </div>
    </AppShell>
  );
}

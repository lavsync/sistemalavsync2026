import { AppShell } from "@/components/shell/app-shell";
import { ImportacoesView } from "@/components/importacoes/importacoes-view";
import { listarImportacoesVendas } from "@/lib/importacoes/queries";
import { listarUnidades } from "@/lib/unidade-ativa";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [importacoes, unidades] = await Promise.all([
    listarImportacoesVendas(),
    listarUnidades(),
  ]);
  return (
    <AppShell>
      <ImportacoesView importacoes={importacoes} unidades={unidades} />
    </AppShell>
  );
}

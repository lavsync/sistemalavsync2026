import { AppShell } from "@/components/shell/app-shell";
import { ImportacoesView } from "@/components/importacoes/importacoes-view";
import { listarImportacoesVendas, listarImportacoesClientes } from "@/lib/importacoes/queries";
import { listarUnidades } from "@/lib/unidade-ativa";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [importacoesVendas, importacoesClientes, unidades] = await Promise.all([
    listarImportacoesVendas(),
    listarImportacoesClientes(),
    listarUnidades(),
  ]);
  return (
    <AppShell>
      <ImportacoesView
        importacoesVendas={importacoesVendas}
        importacoesClientes={importacoesClientes}
        unidades={unidades}
      />
    </AppShell>
  );
}

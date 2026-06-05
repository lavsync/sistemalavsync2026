import { AppShell } from "@/components/shell/app-shell";
import { CategoriasFinanceirasView } from "@/components/cadastros/categorias-financeiras-view";
import { listarCategoriasFinanceiras } from "@/lib/cadastros/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categorias Financeiras · LavSync" };

export default async function Page() {
  const categorias = await listarCategoriasFinanceiras();
  return (
    <AppShell>
      <div className="px-6 lg:px-8 py-6">
        <CategoriasFinanceirasView categorias={categorias} />
      </div>
    </AppShell>
  );
}

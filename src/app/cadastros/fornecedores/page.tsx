import { AppShell } from "@/components/shell/app-shell";
import { FornecedoresView } from "@/components/cadastros/fornecedores-view";
import { listarFornecedores } from "@/lib/cadastros/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fornecedores · LavSync" };

export default async function Page() {
  const fornecedores = await listarFornecedores();
  return (
    <AppShell>
      <div className="px-6 lg:px-8 py-6">
        <FornecedoresView fornecedores={fornecedores} />
      </div>
    </AppShell>
  );
}

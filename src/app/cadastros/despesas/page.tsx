import { AppShell } from "@/components/shell/app-shell";
import { DespesasView } from "@/components/cadastros/despesas-view";
import {
  listarDespesas, listarCategoriasFinanceiras, listarFornecedores,
} from "@/lib/cadastros/queries";
import { listarUnidades } from "@/lib/unidade-ativa";

export const dynamic = "force-dynamic";
export const metadata = { title: "Despesas · LavSync" };

export default async function Page() {
  const [despesas, categorias, fornecedores, unidades] = await Promise.all([
    listarDespesas(), listarCategoriasFinanceiras(), listarFornecedores(), listarUnidades(),
  ]);
  return (
    <AppShell>
      <div className="px-6 lg:px-8 py-6">
        <DespesasView
          despesas={despesas} categorias={categorias} fornecedores={fornecedores}
          unidades={unidades.map((u) => ({ id: u.id, nome: u.nome }))}
        />
      </div>
    </AppShell>
  );
}

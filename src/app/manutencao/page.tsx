import { AppShell } from "@/components/shell/app-shell";
import { ManutencaoView } from "@/components/manutencao/manutencao-view";
import { listarMaquinas, detectarEquipamentosNaoCadastrados, listarOrdensServico } from "@/lib/manutencao/queries";
import { listarUnidades, getUnidadeAtiva } from "@/lib/unidade-ativa";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [maquinas, unidades, unidadeAtiva, ordensServico] = await Promise.all([
    listarMaquinas(),
    listarUnidades(),
    getUnidadeAtiva(),
    listarOrdensServico(),
  ]);
  const equipamentosNaoCadastrados = unidadeAtiva
    ? await detectarEquipamentosNaoCadastrados(unidadeAtiva.id)
    : [];

  return (
    <AppShell>
      <ManutencaoView
        maquinas={maquinas}
        unidades={unidades}
        equipamentosNaoCadastrados={equipamentosNaoCadastrados}
        unidadeAtivaId={unidadeAtiva?.id ?? unidades[0]?.id ?? ""}
        ordensServico={ordensServico}
      />
    </AppShell>
  );
}

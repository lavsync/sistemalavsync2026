import { AppShell } from "@/components/shell/app-shell";
import { MarketingView } from "@/components/marketing/marketing-view";
import { listarCampanhas } from "@/lib/marketing/queries";
import { listarUnidades, getUnidadeAtiva } from "@/lib/unidade-ativa";
import {
  listarClassificacoes, resumoClube, listarMesesDisponiveis, listarTemplates,
  getSituacaoClientes,
} from "@/lib/clube/queries";
import { parseSelecaoUnidades } from "@/lib/unidade-multi";
import {
  getResumoXoClub, getSaldosClientes, getProdutos, getResgates, getConfigXoClub,
} from "@/lib/xoclub/queries";

export const dynamic = "force-dynamic";

type SP = Promise<{ mes_aplic?: string; unidade?: string }>;

function mesAtualStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [campanhas, unidades, unidadeAtiva] = await Promise.all([
    listarCampanhas(),
    listarUnidades(),
    getUnidadeAtiva(),
  ]);

  const mesAplic = sp?.mes_aplic ?? mesAtualStr();
  const selecao = parseSelecaoUnidades(sp?.unidade, unidades);
  // mes_ref = mes_aplic - 1 mês (situação ao vivo baseada no mês ref)
  const dAplic = new Date(mesAplic + "T12:00:00");
  const dRef = new Date(dAplic.getFullYear(), dAplic.getMonth() - 1, 1);
  const mesRef = `${dRef.getFullYear()}-${String(dRef.getMonth() + 1).padStart(2, "0")}-01`;

  const [
    classificacoes, resumo, mesesDisponiveis, templates, situacaoUnidades,
    xoclubResumo, xoclubSaldos, xoclubProdutos, xoclubResgates, xoclubConfig,
  ] = await Promise.all([
    listarClassificacoes(selecao.ids, mesAplic),
    resumoClube(selecao.ids, mesAplic),
    listarMesesDisponiveis(),
    listarTemplates(),
    getSituacaoClientes(selecao.ids, mesRef),
    getResumoXoClub(selecao.ids),
    getSaldosClientes(selecao.ids, { limit: 500 }),
    getProdutos(),
    getResgates({ limit: 200 }),
    getConfigXoClub(),
  ]);

  return (
    <AppShell>
      <MarketingView
        campanhas={campanhas}
        unidades={unidades}
        unidadeAtivaId={unidadeAtiva?.id ?? unidades[0]?.id ?? ""}
        clubeResumo={resumo}
        clubeClassificacoes={classificacoes}
        clubeMesAplicacao={mesAplic}
        clubeMesesDisponiveis={mesesDisponiveis}
        clubeTemplates={templates}
        clubeSituacao={situacaoUnidades}
        clubeSelecaoUnidades={selecao}
        xoclubResumo={xoclubResumo}
        xoclubSaldos={xoclubSaldos}
        xoclubProdutos={xoclubProdutos}
        xoclubResgates={xoclubResgates}
        xoclubConfig={xoclubConfig}
      />
    </AppShell>
  );
}

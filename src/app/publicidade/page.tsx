import { AppShell } from "@/components/shell/app-shell";
import { MarketingView } from "@/components/marketing/marketing-view";
import { listarCampanhas } from "@/lib/marketing/queries";
import { listarUnidades, getUnidadeAtiva } from "@/lib/unidade-ativa";
import {
  listarClassificacoes, resumoClube, listarMesesDisponiveis, listarTemplates,
  getSituacaoClientes, getAbaixoBronze,
} from "@/lib/clube/queries";
import { parseSelecaoUnidades } from "@/lib/unidade-multi";
import { listarEnviosManuais } from "@/lib/clube/envios-manuais";
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

  const mesAtual = mesAtualStr();
  const [
    classificacoes, resumo, mesesDisponiveis, templates, situacaoUnidades,
    xoclubResumo, xoclubSaldos, xoclubProdutos, xoclubResgates, xoclubConfig,
    enviosQualificacao, enviosXoclub,
  ] = await Promise.all([
    listarClassificacoes(selecao.ids, mesAplic),
    resumoClube(selecao.ids, mesAplic),
    listarMesesDisponiveis(),
    listarTemplates(),
    getSituacaoClientes(selecao.ids, mesAplic),
    getResumoXoClub(selecao.ids),
    getSaldosClientes(selecao.ids, { limit: 500 }),
    getProdutos(),
    getResgates({ limit: 200 }),
    getConfigXoClub(),
    listarEnviosManuais(mesRef, "qualificacao"),
    listarEnviosManuais(mesAtual, "xoclub"),
  ]);
  const abaixoBronze = await getAbaixoBronze(selecao.ids, mesRef);
  const templatePortal = templates.find((t) => t.tipo === "xoclub_portal")?.mensagem ?? null;

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
        clubeEnviosQualificacao={enviosQualificacao}
        clubeAbaixoBronze={abaixoBronze}
        xoclubResumo={xoclubResumo}
        xoclubSaldos={xoclubSaldos}
        xoclubProdutos={xoclubProdutos}
        xoclubResgates={xoclubResgates}
        xoclubConfig={xoclubConfig}
        xoclubTemplatePortal={templatePortal}
        xoclubEnviosPortal={enviosXoclub}
        xoclubMesAtual={mesAtual}
      />
    </AppShell>
  );
}

import { AppShell } from "@/components/shell/app-shell";
import { MarketingView } from "@/components/marketing/marketing-view";
import { listarCampanhas } from "@/lib/marketing/queries";
import { listarUnidades, getUnidadeAtiva } from "@/lib/unidade-ativa";
import {
  listarClassificacoes, resumoClube, listarMesesDisponiveis, listarTemplates,
} from "@/lib/clube/queries";

export const dynamic = "force-dynamic";

type SP = Promise<{ mes_aplic?: string }>;

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
  const todasUnidades = unidades.map((u) => u.id);

  const [classificacoes, resumo, mesesDisponiveis, templates] = await Promise.all([
    listarClassificacoes(todasUnidades, mesAplic),
    resumoClube(todasUnidades, mesAplic),
    listarMesesDisponiveis(),
    listarTemplates(),
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
      />
    </AppShell>
  );
}

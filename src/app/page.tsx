import { AppShell } from "@/components/shell/app-shell";
import { DashboardView } from "@/components/views/dashboard-view";
import {
  getDashboardKpis,
  getHourlyOccupation,
  getMachinesStatus,
  getRevenueSplit,
  getRevenueTimeseries,
  listarUnidades,
  resolverJanela,
  type Periodo,
} from "@/lib/dashboard/queries";
import { gerarInsightsUnidade } from "@/lib/insights/engine";
import { parseSelecaoUnidades } from "@/lib/unidade-multi";

export const dynamic = "force-dynamic";

type SP = Promise<{
  unidade?: string;
  periodo?: string;
  from?: string;
  to?: string;
}>;

const PERIODOS_VALIDOS: Periodo[] = ["hoje", "ontem", "7d", "30d", "mes", "90d", "ano", "custom"];

export default async function Page({ searchParams }: { searchParams: SP }) {
  const params = await searchParams;
  const unidades = await listarUnidades();
  const selecao = parseSelecaoUnidades(params.unidade, unidades);

  const periodo: Periodo = PERIODOS_VALIDOS.includes(params.periodo as Periodo)
    ? (params.periodo as Periodo)
    : "30d";

  const janela = resolverJanela(periodo, params.from, params.to);

  const [kpis, timeseries, split, hourly, machines, insights] = await Promise.all([
    getDashboardKpis(selecao.ids, janela),
    getRevenueTimeseries(selecao.ids, janela),
    getRevenueSplit(selecao.ids, janela),
    getHourlyOccupation(selecao.ids, janela),
    getMachinesStatus(selecao.ids, janela),
    // Insights só fazem sentido pra UMA unidade (heurísticas específicas)
    selecao.ids.length === 1
      ? gerarInsightsUnidade(selecao.ids[0]).catch(() => [])
      : Promise.resolve([]),
  ]);

  return (
    <AppShell>
      <DashboardView
        unidades={unidades}
        selecaoUnidades={selecao}
        periodo={periodo}
        from={params.from}
        to={params.to}
        labelJanela={janela.label}
        kpis={kpis}
        timeseries={timeseries}
        split={split}
        hourly={hourly}
        machines={machines}
        insights={insights}
      />
    </AppShell>
  );
}

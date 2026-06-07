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
  const unidadeAtiva =
    params.unidade && unidades.some((u) => u.id === params.unidade)
      ? params.unidade
      : unidades[0]?.id ?? "";

  const periodo: Periodo = PERIODOS_VALIDOS.includes(params.periodo as Periodo)
    ? (params.periodo as Periodo)
    : "30d";

  const janela = resolverJanela(periodo, params.from, params.to);

  const [kpis, timeseries, split, hourly, machines] = await Promise.all([
    getDashboardKpis(unidadeAtiva, janela),
    getRevenueTimeseries(unidadeAtiva, janela),
    getRevenueSplit(unidadeAtiva, janela),
    getHourlyOccupation(unidadeAtiva, janela),
    getMachinesStatus(unidadeAtiva, janela),
  ]);

  return (
    <AppShell>
      <DashboardView
        unidades={unidades}
        unidadeAtiva={unidadeAtiva}
        periodo={periodo}
        from={params.from}
        to={params.to}
        labelJanela={janela.label}
        kpis={kpis}
        timeseries={timeseries}
        split={split}
        hourly={hourly}
        machines={machines}
      />
    </AppShell>
  );
}

import { AppShell } from "@/components/shell/app-shell";
import { ComparativoView } from "@/components/comparativo/comparativo-view";
import { getAgregado, resolverPreset, type PeriodoComp } from "@/lib/comparativo/queries";
import { listarUnidades } from "@/lib/unidade-ativa";

export const dynamic = "force-dynamic";

type SP = Promise<{
  unidadeA?: string;
  unidadeB?: string;
  periodoA?: string;
  periodoB?: string;
  fromA?: string;
  toA?: string;
  fromB?: string;
  toB?: string;
}>;

const PERIODOS: PeriodoComp[] = [
  "hoje", "ontem", "7d", "30d", "mes", "mes_anterior", "90d", "ano", "ano_anterior", "custom",
];

export default async function Page({ searchParams }: { searchParams: SP }) {
  const params = await searchParams;
  const unidades = await listarUnidades();
  if (unidades.length === 0) {
    return (
      <AppShell>
        <div className="p-8 rounded-2xl border border-border bg-card text-center">
          <p className="text-sm text-muted-foreground">Nenhuma unidade cadastrada.</p>
        </div>
      </AppShell>
    );
  }

  // Defaults: Lado A = primeira unidade (mês atual), Lado B = mesma unidade (mês anterior)
  const unidadeA = params.unidadeA && unidades.some((u) => u.id === params.unidadeA)
    ? params.unidadeA
    : unidades[0].id;
  const unidadeB = params.unidadeB && unidades.some((u) => u.id === params.unidadeB)
    ? params.unidadeB
    : unidades[0].id;
  const periodoA: PeriodoComp = PERIODOS.includes(params.periodoA as PeriodoComp)
    ? (params.periodoA as PeriodoComp) : "mes";
  const periodoB: PeriodoComp = PERIODOS.includes(params.periodoB as PeriodoComp)
    ? (params.periodoB as PeriodoComp) : "mes_anterior";

  const janelaA = resolverPreset(periodoA, params.fromA, params.toA);
  const janelaB = resolverPreset(periodoB, params.fromB, params.toB);

  const [ladoA, ladoB] = await Promise.all([
    getAgregado(unidadeA, janelaA.from, janelaA.to, unidades.find((u) => u.id === unidadeA)!.nome),
    getAgregado(unidadeB, janelaB.from, janelaB.to, unidades.find((u) => u.id === unidadeB)!.nome),
  ]);

  return (
    <AppShell>
      <ComparativoView
        unidades={unidades}
        ladoA={ladoA}
        ladoB={ladoB}
        periodoA={periodoA}
        periodoB={periodoB}
        unidadeA={unidadeA}
        unidadeB={unidadeB}
        fromA={params.fromA}
        toA={params.toA}
        fromB={params.fromB}
        toB={params.toB}
      />
    </AppShell>
  );
}

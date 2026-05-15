import { AppShell } from "@/components/shell/app-shell";
import { ResultadosView } from "@/components/views/resultados-view";
import { getDREMesAtual, getMonthlyMetrics } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [dre, monthly] = await Promise.all([
    getDREMesAtual(),
    getMonthlyMetrics(undefined, 12),
  ]);

  return (
    <AppShell>
      <ResultadosView dre={dre} monthly={monthly} />
    </AppShell>
  );
}

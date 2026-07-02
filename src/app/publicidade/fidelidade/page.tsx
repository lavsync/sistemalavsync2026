import { AppShell } from "@/components/shell/app-shell";
import { FidelidadeReportView } from "@/components/marketing/fidelidade-report-view";
import { relatorioFidelidade } from "@/lib/fidelidade/relatorio";
import { listarMesesDisponiveis } from "@/lib/clube/queries";
import { listarUnidades } from "@/lib/unidade-ativa";

export const dynamic = "force-dynamic";

type SP = Promise<{ mes_aplic?: string }>;

function mesAtualStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const mesAplic = sp?.mes_aplic ?? mesAtualStr();

  const [linhas, unidades, meses] = await Promise.all([
    relatorioFidelidade(mesAplic),
    listarUnidades(),
    listarMesesDisponiveis(),
  ]);

  return (
    <AppShell>
      <FidelidadeReportView
        linhas={linhas}
        unidades={unidades.map((u) => ({ id: u.id, nome: u.nome }))}
        mesAplicacao={mesAplic}
        mesesDisponiveis={meses}
      />
    </AppShell>
  );
}

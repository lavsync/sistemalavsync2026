import { AppShell } from "@/components/shell/app-shell";
import { PerformanceView } from "@/components/views/performance-view";
import {
  getResumoPerformance,
  getFaturamentoPorPagamento,
  getPorDiaSemana,
  getEvolucaoMensal,
  getCuponsUsados,
  getVouchersUsados,
} from "@/lib/vendas-queries";
import { getUnidadeAtiva } from "@/lib/unidade-ativa";

export const dynamic = "force-dynamic";

export default async function Page() {
  const unidade = await getUnidadeAtiva();

  const [resumo, pagamentos, diaSemana, evolucao, cupons, vouchers] = await Promise.all([
    getResumoPerformance(unidade.id),
    getFaturamentoPorPagamento(unidade.id, false),
    getPorDiaSemana(unidade.id, 30),
    getEvolucaoMensal(unidade.id, 12),
    getCuponsUsados(unidade.id, true),
    getVouchersUsados(unidade.id, true),
  ]);

  return (
    <AppShell>
      <PerformanceView
        unidadeId={unidade.id}
        unidadeNome={unidade.nome}
        resumo={resumo}
        pagamentos={pagamentos}
        diaSemana={diaSemana}
        evolucao={evolucao}
        cupons={cupons}
        vouchers={vouchers}
      />
    </AppShell>
  );
}

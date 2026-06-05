import { AppShell } from "@/components/shell/app-shell";
import { PerformanceView } from "@/components/views/performance-view";
import {
  getResumoPerformance,
  getFaturamentoPorPagamento,
  getPorDiaSemana,
  getEvolucaoMensal,
  getCuponsUsados,
  getVouchersUsados,
  parseMesRef,
} from "@/lib/vendas-queries";
import { getUnidadeAtiva } from "@/lib/unidade-ativa";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const sp = await searchParams;
  const refMes = parseMesRef(sp?.mes);
  const unidade = await getUnidadeAtiva();

  const [resumo, pagamentos, diaSemana, evolucao, cupons, vouchers] = await Promise.all([
    getResumoPerformance(unidade.id, refMes),
    getFaturamentoPorPagamento(unidade.id, refMes),
    getPorDiaSemana(unidade.id, refMes),
    getEvolucaoMensal(unidade.id, 12),
    getCuponsUsados(unidade.id, refMes),
    getVouchersUsados(unidade.id, refMes),
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

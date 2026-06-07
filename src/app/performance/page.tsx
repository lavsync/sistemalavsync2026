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
  // refMes só é passado quando o usuário escolhe um mês específico via ?mes=YYYY-MM.
  // Senão, as queries ancoram no mês da última venda registrada (resolve unidades
  // com base "atrasada" — ex: vendas até 25/05 mas mês corrente é junho).
  const refMes = sp?.mes ? parseMesRef(sp.mes) : undefined;
  const unidade = await getUnidadeAtiva();

  const [resumo, pagamentos, diaSemana, evolucao, cupons, vouchers] = await Promise.all([
    getResumoPerformance(unidade.id, refMes ?? new Date()),
    getFaturamentoPorPagamento(unidade.id, refMes ?? new Date()),
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
        cupons={cupons.items}
        cuponsMesRef={cupons.mesRef}
        vouchers={vouchers.items}
        vouchersMesRef={vouchers.mesRef}
      />
    </AppShell>
  );
}

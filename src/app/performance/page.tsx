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
import { listarUnidades } from "@/lib/unidade-ativa";
import { parseSelecaoUnidades } from "@/lib/unidade-multi";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; unidade?: string }>;
}) {
  const sp = await searchParams;
  const refMes = sp?.mes ? parseMesRef(sp.mes) : undefined;
  const unidades = await listarUnidades();
  const selecao = parseSelecaoUnidades(sp?.unidade, unidades);

  const [resumo, pagamentos, diaSemana, evolucao, cupons, vouchers] = await Promise.all([
    getResumoPerformance(selecao.ids, refMes ?? new Date()),
    getFaturamentoPorPagamento(selecao.ids, refMes ?? new Date()),
    getPorDiaSemana(selecao.ids, refMes),
    getEvolucaoMensal(selecao.ids, 12),
    getCuponsUsados(selecao.ids, refMes),
    getVouchersUsados(selecao.ids, refMes),
  ]);

  return (
    <AppShell>
      <PerformanceView
        unidadeId={selecao.ids[0] ?? ""}
        unidadeNome={selecao.rotulo}
        unidades={unidades}
        selecaoUnidades={selecao}
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

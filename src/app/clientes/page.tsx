import { AppShell } from "@/components/shell/app-shell";
import { ClientesView } from "@/components/views/clientes-view";
import {
  getClientesKpis,
  getSegmentacaoRFM,
  getTopClientes,
  getCrescimentoSemanal,
  listarClientes,
} from "@/lib/clientes-queries";
import { getUnidadeAtiva } from "@/lib/unidade-ativa";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const unidade = await getUnidadeAtiva();

  const [kpis, rfm, top, crescimento, listagem] = await Promise.all([
    getClientesKpis(unidade.id),
    getSegmentacaoRFM(unidade.id),
    getTopClientes(unidade.id, 10),
    getCrescimentoSemanal(unidade.id, 12),
    listarClientes(unidade.id, { busca: sp?.q, limit: 50 }),
  ]);

  return (
    <AppShell>
      <ClientesView
        unidadeId={unidade.id}
        unidadeNome={unidade.nome}
        kpis={kpis}
        segmentos={rfm}
        topClientes={top}
        crescimento={crescimento}
        clientes={listagem.rows}
        totalClientes={listagem.total}
        busca={sp?.q ?? ""}
      />
    </AppShell>
  );
}

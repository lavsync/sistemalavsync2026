import { AppShell } from "@/components/shell/app-shell";
import { ClientesView } from "@/components/views/clientes-view";
import {
  getClientesKpis,
  getSegmentacaoRFM,
  getTopClientes,
  getCrescimentoSemanal,
  listarClientes,
  type AtividadeFiltro,
  type OrigemFiltro,
  type GeneroFiltro,
  type OrdenacaoFiltro,
} from "@/lib/clientes-queries";
import { getUnidadeAtiva } from "@/lib/unidade-ativa";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    ativ?: string;
    ori?: string;
    gen?: string;
    ord?: string;
  }>;
}) {
  const sp = await searchParams;
  const unidade = await getUnidadeAtiva();

  const pagina = Math.max(1, parseInt(sp?.page ?? "1", 10) || 1);
  const offset = (pagina - 1) * PAGE_SIZE;

  const filtros = {
    busca: sp?.q,
    atividade: (sp?.ativ as AtividadeFiltro) || "todos",
    origem: (sp?.ori as OrigemFiltro) || "todos",
    genero: (sp?.gen as GeneroFiltro) || "todos",
    ordenacao: (sp?.ord as OrdenacaoFiltro) || "ltv_desc",
  };

  // Listagem com filtros aplicados + base total sem filtro (pro contador "X de Y")
  const [kpis, rfm, top, crescimento, listagem, baseTotal] = await Promise.all([
    getClientesKpis(unidade.id),
    getSegmentacaoRFM(unidade.id),
    getTopClientes(unidade.id, 10),
    getCrescimentoSemanal(unidade.id, 12),
    listarClientes(unidade.id, {
      ...filtros,
      limit: PAGE_SIZE,
      offset,
    }),
    // Base total sem filtros — usado pra contagem comparativa
    listarClientes(unidade.id, { limit: 1, offset: 0 }),
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
        totalClientes={baseTotal.total}
        totalFiltrado={listagem.total}
        pagina={pagina}
        pageSize={PAGE_SIZE}
        filtrosAtivos={filtros}
      />
    </AppShell>
  );
}

import { AppShell } from "@/components/shell/app-shell";
import { ClientesView } from "@/components/views/clientes-view";
import {
  getClientesKpis,
  getSegmentacaoRFM,
  getTopClientes,
  getTopClientesMes,
  getCrescimentoSemanal,
  getDistribuicaoGenero,
  getNovosClientes,
  listarClientes,
  type AtividadeFiltro,
  type OrigemFiltro,
  type GeneroFiltro,
  type OrdenacaoFiltro,
  type PeriodoNovos,
} from "@/lib/clientes-queries";
import { getUnidadeAtiva } from "@/lib/unidade-ativa";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const PERIODOS_VALIDOS: PeriodoNovos[] = ["hoje", "7d", "30d", "180d", "1y", "data"];

function diaValido(s?: string): string | undefined {
  if (!s) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
}

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
    novos?: string;
    dia?: string;
  }>;
}) {
  const sp = await searchParams;
  const unidade = await getUnidadeAtiva();

  const pagina = Math.max(1, parseInt(sp?.page ?? "1", 10) || 1);
  const offset = (pagina - 1) * PAGE_SIZE;
  const periodoNovos: PeriodoNovos =
    PERIODOS_VALIDOS.includes(sp?.novos as PeriodoNovos)
      ? (sp!.novos as PeriodoNovos)
      : "30d";
  const diaNovos = diaValido(sp?.dia);

  const filtros = {
    busca: sp?.q,
    atividade: (sp?.ativ as AtividadeFiltro) || "todos",
    origem: (sp?.ori as OrigemFiltro) || "todos",
    genero: (sp?.gen as GeneroFiltro) || "todos",
    ordenacao: (sp?.ord as OrdenacaoFiltro) || "ltv_desc",
  };

  const [
    kpis, rfm, top, topMes, crescimento, listagem, baseTotal, generoDist, novosResumo,
  ] = await Promise.all([
    getClientesKpis(unidade.id),
    getSegmentacaoRFM(unidade.id),
    getTopClientes(unidade.id, 10),
    getTopClientesMes(unidade.id, 10),
    getCrescimentoSemanal(unidade.id, 12),
    listarClientes(unidade.id, { ...filtros, limit: PAGE_SIZE, offset }),
    listarClientes(unidade.id, { limit: 1, offset: 0 }),
    getDistribuicaoGenero(unidade.id),
    getNovosClientes(unidade.id, periodoNovos, 200, diaNovos),
  ]);

  return (
    <AppShell>
      <ClientesView
        unidadeId={unidade.id}
        unidadeNome={unidade.nome}
        kpis={kpis}
        segmentos={rfm}
        topClientes={top}
        topClientesMes={topMes}
        crescimento={crescimento}
        clientes={listagem.rows}
        totalClientes={baseTotal.total}
        totalFiltrado={listagem.total}
        pagina={pagina}
        pageSize={PAGE_SIZE}
        filtrosAtivos={filtros}
        generoDist={generoDist}
        novosResumo={novosResumo}
      />
    </AppShell>
  );
}

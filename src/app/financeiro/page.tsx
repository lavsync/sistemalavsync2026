import { AppShell } from "@/components/shell/app-shell";
import { FinanceiroView } from "@/components/financeiro/financeiro-view";
import {
  getConfigUnidade, getInvestimento, getCustosFixos,
  getCustosVariaveis, getLancamentos, getDespesasPorMes,
  getFaturamentoMensalVendas, mesclarLancamentosComVendas,
} from "@/lib/financeiro/queries";
import { getEngenhariaCustos, getCiclosDoMes } from "@/lib/financeiro/margem-queries";
import { calcularMargemContribuicao } from "@/lib/financeiro/margem-engine";
import { createClient } from "@/lib/supabase/server";
import { carregarPainel, lerMesPainel, ESCOPO_CONSOLIDADO } from "@/lib/financeiro/painel/carregar-painel";

export const dynamic = "force-dynamic";
// A importação da projeção (server action desta página) espera a leitura do
// CLOCK, que leva de 30 a 120 s num estudo grande
export const maxDuration = 300;

type SearchParams = Promise<{ unidade?: string; despesas_mes?: string; mes?: string; escopo?: string }>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const sb = await createClient();
  const params = await searchParams;

  const { data: unidadesRaw } = await sb
    .from("unidades")
    .select("id, nome")
    .order("nome");
  const unidades = (unidadesRaw ?? []) as Array<{ id: string; nome: string }>;

  const unidadeId = params.unidade && unidades.some((u) => u.id === params.unidade)
    ? params.unidade
    : unidades[0]?.id;

  if (!unidadeId) {
    return (
      <AppShell>
        <div className="p-8 rounded-2xl border border-border bg-card text-center">
          <p className="text-sm text-muted-foreground">Nenhuma unidade cadastrada.</p>
        </div>
      </AppShell>
    );
  }

  // Mês do Painel Geral (?mes=AAAA-MM; default = mês corrente BR) — também é
  // o mês de referência da margem de contribuição, salvo ?despesas_mes=
  const mesPainel = lerMesPainel(params.mes);
  const refMes = params.despesas_mes ? lerMesPainel(params.despesas_mes) : mesPainel;
  const [refAno, refMesNum] = refMes.split("-").map(Number);
  const escopoPainel = params.escopo === ESCOPO_CONSOLIDADO ? ESCOPO_CONSOLIDADO : unidadeId;

  const [config, investimento, custos_fixos, custos_variaveis, lancamentosRaw, despesas_por_mes, vendasMensais, engenharia, ciclosMes, painel] = await Promise.all([
    getConfigUnidade(unidadeId),
    getInvestimento(unidadeId),
    getCustosFixos(unidadeId),
    getCustosVariaveis(unidadeId),
    getLancamentos(unidadeId),
    getDespesasPorMes(unidadeId),
    getFaturamentoMensalVendas(unidadeId),
    getEngenhariaCustos(unidadeId),
    getCiclosDoMes(unidadeId, refAno, refMesNum),
    // Painel Geral do mês: falha aqui não derruba as outras abas
    carregarPainel(sb, { unidades, escopo: escopoPainel, mes: mesPainel }).catch((e) => {
      console.error("[financeiro] painel:", e instanceof Error ? e.message : e);
      return null;
    }),
  ]);

  // Margem de contribuição do mês de referência
  const margem = engenharia ? calcularMargemContribuicao(
    engenharia,
    ciclosMes.ciclosLavagem,
    ciclosMes.ciclosSecagem,
    ciclosMes.faturamentoLavagem,
    ciclosMes.faturamentoSecagem,
  ) : null;

  // Sobrescreve/cria faturamento_real a partir das vendas reais
  const lancamentos = mesclarLancamentosComVendas(lancamentosRaw, vendasMensais, config
    ? { unidade_id: config.unidade_id, mes_inauguracao: config.mes_inauguracao, ano_inauguracao: config.ano_inauguracao }
    : null);

  return (
    <AppShell>
      <FinanceiroView
        unidades={unidades}
        unidade_id={unidadeId}
        config={config}
        investimento={investimento}
        custos_fixos={custos_fixos}
        custos_variaveis={custos_variaveis}
        lancamentos={lancamentos}
        despesas_por_mes={despesas_por_mes}
        engenharia={engenharia}
        margem={margem}
        margem_mes={refMes}
        painel={painel}
      />
    </AppShell>
  );
}

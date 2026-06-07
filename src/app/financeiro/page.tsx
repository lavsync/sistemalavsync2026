import { AppShell } from "@/components/shell/app-shell";
import { FinanceiroView } from "@/components/financeiro/financeiro-view";
import {
  getConfigUnidade, getInvestimento, getCustosFixos,
  getCustosVariaveis, getLancamentos, getDespesasMes,
} from "@/lib/financeiro/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ unidade?: string; despesas_mes?: string }>;

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

  // Mês de despesas para o DRE (default = mês corrente)
  const hoje = new Date();
  const refMes = params.despesas_mes ?? `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const [refAno, refMesNum] = refMes.split("-").map(Number);

  const [config, investimento, custos_fixos, custos_variaveis, lancamentos, despesas_mes] = await Promise.all([
    getConfigUnidade(unidadeId),
    getInvestimento(unidadeId),
    getCustosFixos(unidadeId),
    getCustosVariaveis(unidadeId),
    getLancamentos(unidadeId),
    getDespesasMes(unidadeId, refAno, refMesNum),
  ]);

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
        despesas_mes={{
          ano: refAno,
          mes: refMesNum,
          itens: despesas_mes.itens,
          por_categoria: Object.fromEntries(despesas_mes.porCategoria),
          por_descricao: Object.fromEntries(despesas_mes.porDescricao),
          total: despesas_mes.totalReal,
        }}
      />
    </AppShell>
  );
}

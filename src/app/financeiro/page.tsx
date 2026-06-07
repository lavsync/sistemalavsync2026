import { AppShell } from "@/components/shell/app-shell";
import { FinanceiroView } from "@/components/financeiro/financeiro-view";
import {
  getConfigUnidade, getInvestimento, getCustosFixos,
  getCustosVariaveis, getLancamentos,
} from "@/lib/financeiro/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ unidade?: string }>;

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

  const [config, investimento, custos_fixos, custos_variaveis, lancamentos] = await Promise.all([
    getConfigUnidade(unidadeId),
    getInvestimento(unidadeId),
    getCustosFixos(unidadeId),
    getCustosVariaveis(unidadeId),
    getLancamentos(unidadeId),
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
      />
    </AppShell>
  );
}

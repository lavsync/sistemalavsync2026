import { AppShell } from "@/components/shell/app-shell";
import { PainelAoVivoView } from "@/components/painel-ao-vivo/painel-view";
import { getPainelAoVivo } from "@/lib/painel-ao-vivo-queries";
import { listarUnidades } from "@/lib/unidade-ativa";

export const dynamic = "force-dynamic";
export const revalidate = 0; // sempre fresco

export const metadata = {
  title: "Painel ao Vivo · LavSync",
  description: "Vendas em tempo real · todas as unidades · faturamento, ciclos e clientes ao vivo.",
};

export default async function Page() {
  const unidades = await listarUnidades();
  const painel = await getPainelAoVivo(
    unidades.map((u) => ({ id: u.id, nome: u.nome })),
  );

  return (
    <AppShell hideClockRail>
      <PainelAoVivoView
        unidadesIniciais={painel.unidades}
        totalInicial={painel.total}
        geradoEmInicial={painel.geradoEm}
      />
    </AppShell>
  );
}

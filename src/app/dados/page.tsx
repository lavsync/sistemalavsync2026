import { AppShell } from "@/components/shell/app-shell";
import { DadosView } from "@/components/dados/dados-view";
import { listarUnidades } from "@/lib/unidade-ativa";

export const dynamic = "force-dynamic";

export default async function Page() {
  const unidades = await listarUnidades();
  return (
    <AppShell>
      <DadosView unidades={unidades} />
    </AppShell>
  );
}

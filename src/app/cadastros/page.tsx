import { AppShell } from "@/components/shell/app-shell";
import { CadastrosHubView } from "@/components/cadastros/hub-view";
import { getContadoresCadastros } from "@/lib/cadastros-queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cadastros · LavSync",
  description: "Hub de configurações da unidade — 11 blocos pra alimentar o sistema.",
};

export default async function Page() {
  const contadores = await getContadoresCadastros();
  return (
    <AppShell>
      <div className="px-6 lg:px-8 py-6">
        <CadastrosHubView contadores={contadores} />
      </div>
    </AppShell>
  );
}

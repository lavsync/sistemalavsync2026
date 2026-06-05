import { AppShell } from "@/components/shell/app-shell";
import { ServicosView } from "@/components/cadastros/servicos-view";
import { listarServicos } from "@/lib/cadastros/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Serviços · LavSync" };

export default async function Page() {
  const servicos = await listarServicos();
  return (
    <AppShell>
      <div className="px-6 lg:px-8 py-6">
        <ServicosView servicos={servicos} />
      </div>
    </AppShell>
  );
}

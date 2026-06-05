import { AppShell } from "@/components/shell/app-shell";
import { PlanosView } from "@/components/cadastros/planos-view";
import { listarPlanos, listarServicos } from "@/lib/cadastros/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Planos · LavSync" };

export default async function Page() {
  const [planos, servicos] = await Promise.all([listarPlanos(), listarServicos()]);
  return (
    <AppShell>
      <div className="px-6 lg:px-8 py-6">
        <PlanosView planos={planos} servicos={servicos} />
      </div>
    </AppShell>
  );
}

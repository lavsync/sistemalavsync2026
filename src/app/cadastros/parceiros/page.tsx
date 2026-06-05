import { AppShell } from "@/components/shell/app-shell";
import { ParceirosView } from "@/components/cadastros/parceiros-view";
import { listarParceiros } from "@/lib/cadastros/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Parceiros · LavSync" };

export default async function Page() {
  const parceiros = await listarParceiros();
  return (
    <AppShell>
      <div className="px-6 lg:px-8 py-6">
        <ParceirosView parceiros={parceiros} />
      </div>
    </AppShell>
  );
}

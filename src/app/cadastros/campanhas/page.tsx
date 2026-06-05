import { AppShell } from "@/components/shell/app-shell";
import { CampanhasView } from "@/components/cadastros/campanhas-view";
import { listarCampanhas } from "@/lib/cadastros/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campanhas · LavSync" };

export default async function Page() {
  const campanhas = await listarCampanhas();
  return (
    <AppShell>
      <div className="px-6 lg:px-8 py-6">
        <CampanhasView campanhas={campanhas} />
      </div>
    </AppShell>
  );
}

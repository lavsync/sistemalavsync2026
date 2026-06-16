import { PageHeader } from "@mi/components/admin/page-header";
import { requireUser } from "@mi/lib/auth";
import { WizardClient } from "./wizard-client";

export const metadata = { title: "Novo template" };

export default async function NovoTemplatePage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Criar novo template"
        description="Escolha o formato e parta de um modelo curado ou em branco."
      />
      <WizardClient />
    </div>
  );
}

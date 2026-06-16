import { PageHeader } from "@mi/components/admin/page-header";
import { UnitForm } from "../unit-form";
import { requireRole } from "@mi/lib/auth";

export const metadata = { title: "Nova unidade" };

export default async function NovaUnidadePage() {
  await requireRole(["master"]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Nova unidade"
        description="Cadastre uma nova unidade Xô Varal. Os links do player e do clube serão gerados automaticamente a partir do slug."
      />
      <UnitForm />
    </div>
  );
}

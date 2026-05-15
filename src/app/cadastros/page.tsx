import { AppShell } from "@/components/shell/app-shell";
import { ModulePlaceholder } from "@/components/views/module-placeholder";

export default function Page() {
  return (
    <AppShell>
      <ModulePlaceholder
        eyebrow="Cadastros"
        title="Cadastros estruturais do sistema"
        subtitle="Clientes, fornecedores, despesas, categorias, máquinas, planos, serviços, campanhas, parceiros e usuários."
        iconName="clipboard-list"
        components={[
          "Clientes",
          "Fornecedores",
          "Despesas",
          "Categorias financeiras",
          "Máquinas",
          "Planos",
          "Serviços",
          "Campanhas",
          "Parceiros",
          "Unidade",
          "Usuário/franqueado",
        ]}
      />
    </AppShell>
  );
}

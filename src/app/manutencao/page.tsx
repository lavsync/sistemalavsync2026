import { AppShell } from "@/components/shell/app-shell";
import { ModulePlaceholder } from "@/components/views/module-placeholder";

export default function Page() {
  return (
    <AppShell>
      <ModulePlaceholder
        eyebrow="Manutenção"
        title="Saúde técnica das máquinas"
        subtitle="Lista de máquinas, status, preventiva, corretiva, histórico de ocorrências e custos · alertas técnicos da CLOCK."
        iconName="wrench"
        components={[
          "Lista de máquinas",
          "Status por máquina",
          "Manutenção preventiva",
          "Manutenção corretiva",
          "Histórico de ocorrências",
          "Custos de manutenção",
          "Alertas técnicos",
        ]}
      />
    </AppShell>
  );
}

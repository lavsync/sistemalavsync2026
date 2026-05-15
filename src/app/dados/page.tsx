import { AppShell } from "@/components/shell/app-shell";
import { ModulePlaceholder } from "@/components/views/module-placeholder";

export default function Page() {
  return (
    <AppShell>
      <ModulePlaceholder
        eyebrow="Dados Gerais"
        title="Dados estruturais e metas"
        subtitle="Dados da unidade, metas mensais, capacidade operacional, horários, máquinas e projeções."
        iconName="database"
        components={[
          "Dados da unidade",
          "Metas mensais",
          "Capacidade operacional",
          "Horário de funcionamento",
          "Quantidade de máquinas",
          "Ticket médio esperado",
          "Custos previstos",
          "Projeções",
        ]}
      />
    </AppShell>
  );
}

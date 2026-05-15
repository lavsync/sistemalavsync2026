import { AppShell } from "@/components/shell/app-shell";
import { ModulePlaceholder } from "@/components/views/module-placeholder";

export default function Page() {
  return (
    <AppShell>
      <ModulePlaceholder
        eyebrow="Agenda"
        title="Calendário operacional integrado"
        subtitle="Tarefas, manutenções, contas, campanhas e checklists em uma única timeline mensal/diária."
        iconName="calendar"
        components={[
          "Calendário mensal",
          "Tarefas do dia",
          "Lembretes",
          "Manutenção agendada",
          "Contas a pagar",
          "Campanhas futuras",
          "Checklist operacional",
        ]}
      />
    </AppShell>
  );
}

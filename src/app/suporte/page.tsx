import { AppShell } from "@/components/shell/app-shell";
import { ModulePlaceholder } from "@/components/views/module-placeholder";

export default function Page() {
  return (
    <AppShell>
      <ModulePlaceholder
        eyebrow="Suporte"
        title="Central de chamados e conhecimento"
        subtitle="Abrir chamados, acompanhar SLA, base de conhecimento e tutoriais — com triagem automática da CLOCK."
        iconName="life-buoy"
        components={[
          "Abrir chamado",
          "Histórico de chamados",
          "Status do atendimento",
          "Base de conhecimento",
          "Tutoriais",
          "FAQ",
          "Canal de suporte",
        ]}
      />
    </AppShell>
  );
}

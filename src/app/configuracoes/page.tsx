import { AppShell } from "@/components/shell/app-shell";
import { ModulePlaceholder } from "@/components/views/module-placeholder";

export default function Page() {
  return (
    <AppShell>
      <ModulePlaceholder
        eyebrow="Configurações"
        title="Preferências da unidade e do sistema"
        subtitle="Identidade da marca, tema, notificações, fuso horário, integrações default, política de dados e permissões."
        iconName="settings"
        components={[
          "Identidade da unidade (logo, cores, slogan)",
          "Tema (claro/escuro/auto)",
          "Notificações (e-mail, push, WhatsApp)",
          "Fuso horário e moeda",
          "Política de retenção de dados",
          "Permissões e papéis (RBAC)",
          "API keys e webhooks",
          "Backups e exportações",
          "Auditoria de acessos",
        ]}
      />
    </AppShell>
  );
}

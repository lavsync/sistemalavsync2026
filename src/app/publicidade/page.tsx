import { AppShell } from "@/components/shell/app-shell";
import { ModulePlaceholder } from "@/components/views/module-placeholder";

export default function Page() {
  return (
    <AppShell>
      <ModulePlaceholder
        eyebrow="Publicidade"
        title="Campanhas e parceiros locais"
        subtitle="Campanhas ativas, programadas, parceiros locais, mídia indoor, cupons, WhatsApp, promoções e resultados."
        iconName="megaphone"
        components={[
          "Campanhas ativas",
          "Campanhas programadas",
          "Parceiros locais",
          "Mídia indoor",
          "Cupons",
          "WhatsApp",
          "Promoções",
          "Resultados das campanhas",
        ]}
      />
    </AppShell>
  );
}

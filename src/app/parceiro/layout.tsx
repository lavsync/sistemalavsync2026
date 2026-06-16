import { Toaster } from "@mi/components/ui/toaster";

export const metadata = {
  title: {
    default: "Portal de Parceiros — Xô Varal Local",
    template: "%s — Portal de Parceiros",
  },
};

/**
 * Layout exclusivo do portal do parceiro local.
 * Não compartilha com /dashboard (admin) — visualmente mais comercial.
 */
export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--brand-turquoise-light)]/30 via-white to-white">
      {children}
      <Toaster />
    </div>
  );
}

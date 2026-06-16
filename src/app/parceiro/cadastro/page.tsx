import { redirect } from "next/navigation";
import { createClient } from "@mi/lib/supabase/server";
import { CadastroWizard } from "./wizard-client";

export const metadata = { title: "Completar cadastro" };

export default async function CadastroParceiroPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/parceiro/cadastro");
  }

  // Se já tem partner vinculado, manda pro dashboard
  const { data: link } = await supabase
    .from("mi_partner_users")
    .select("partner_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (link?.partner_id) redirect("/parceiro/dashboard");

  const { data: categories } = await supabase
    .from("mi_partner_categories")
    .select("*")
    .order("label");

  return (
    <main className="min-h-screen py-8 sm:py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Bem-vindo ao Portal de Parceiros
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Vamos conhecer seu negócio
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            5 etapas rápidas · leva menos de 5 minutos
          </p>
        </div>

        <CadastroWizard
          categories={categories ?? []}
          userEmail={user.email ?? ""}
        />
      </div>
    </main>
  );
}

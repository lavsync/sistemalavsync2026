import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, MapPin, Store } from "lucide-react";
import { Button } from "@mi/components/ui/button";
import { Card, CardContent } from "@mi/components/ui/card";
import { createClient } from "@mi/lib/supabase/server";
import { APP_NAME } from "@mi/lib/constants";

export const metadata = { title: "Quero ser parceiro" };
export const dynamic = "force-dynamic";

export default async function QueroSerParceiroHubPage() {
  const supabase = await createClient();
  const { data: units } = await supabase
    .from("mi_units")
    .select("slug, name, neighborhood, city")
    .eq("is_active", true)
    .order("name");

  // Uma unidade ativa: vai direto pro formulário dela
  if (units && units.length === 1) {
    redirect(`/${units[0].slug}/quero-ser-parceiro`);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[var(--brand-turquoise-light)] via-white to-white">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
            XV
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Quero ser parceiro</h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            {units && units.length > 0
              ? "Escolha a unidade Xô Varal mais perto do seu comércio pra fazer sua proposta de parceria."
              : `Nenhuma unidade ${APP_NAME} disponível no momento. Volte em breve!`}
          </p>
        </div>

        {units && units.length > 0 && (
          <div className="mt-10 grid gap-3">
            {units.map((u) => (
              <Card key={u.slug} className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Store className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold">{u.name}</p>
                      {(u.neighborhood || u.city) && (
                        <p className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {[u.neighborhood, u.city].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/${u.slug}/quero-ser-parceiro`}>
                      Escolher <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

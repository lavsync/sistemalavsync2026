import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Tv, Users, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@mi/components/ui/card";
import { createClient } from "@mi/lib/supabase/server";
import { PartnerLeadForm } from "./partner-lead-form";

export const metadata = {
  title: "Quero ser parceiro",
  description:
    "Cadastre seu comércio na rede Xô Varal. Apareça na TV da lavanderia para clientes do bairro.",
};

export default async function QueroSerParceiroPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: unit } = await supabase
    .from("mi_units")
    .select("id, slug, name, neighborhood, city, state")
    .eq("slug", slug)
    .eq("is_active", true)
    .single<{ id: string; slug: string; name: string; neighborhood: string | null; city: string | null; state: string | null }>();

  if (!unit) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href={`/m/${slug}/clube-de-beneficios`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao clube
      </Link>

      <div className="mt-6 text-center">
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Apareça na TV da Xô Varal {unit.name.replace(/^Xô Varal\s+/i, "")}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-balance text-muted-foreground">
          Cadastre-se gratuitamente e faça parte da rede de comerciantes do bairro. Sem mensalidade,
          sem fidelidade.
        </p>
      </div>

      {/* Benefícios */}
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Tv className="mx-auto h-7 w-7 text-primary" />
            <p className="mt-2 text-sm font-semibold">Visibilidade na TV</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sua marca exibida pra clientes ao vivo, todos os dias
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="mx-auto h-7 w-7 text-primary" />
            <p className="mt-2 text-sm font-semibold">Clientes do bairro</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pessoas que moram perto e podem virar clientes recorrentes
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="mx-auto h-7 w-7 text-primary" />
            <p className="mt-2 text-sm font-semibold">QR Code rastreável</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Acompanhe quantos clientes vieram da TV até o seu negócio
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Form */}
      <Card className="mt-8">
        <CardContent className="p-6">
          <h2 className="mb-1 text-lg font-semibold">Conte sobre o seu negócio</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Recebemos sua proposta e entramos em contato pelo WhatsApp em até 2 dias úteis.
          </p>
          <PartnerLeadForm unitId={unit.id} unitSlug={unit.slug} />
        </CardContent>
      </Card>
    </article>
  );
}

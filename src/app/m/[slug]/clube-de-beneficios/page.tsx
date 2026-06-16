import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Heart, Star, ArrowRight, Sparkles, Store } from "lucide-react";
import { Button } from "@mi/components/ui/button";
import { Badge } from "@mi/components/ui/badge";
import { PartnersGrid } from "@mi/components/public/partners-grid";
import { createClient } from "@mi/lib/supabase/server";
import { ClubSignupSection } from "./club-signup-section";
import type { Tables } from "@mi/types/database";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return {
    title: `Clube de Benefícios — ${slug}`,
    description: "Descontos e vantagens dos comerciantes locais para quem é cliente Xô Varal.",
  };
}

export default async function ClubeDeBeneficiosPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: unit } = await supabase
    .from("mi_units")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single<Tables<"units">>();

  if (!unit) notFound();

  const [partnersRes, featuredOffersRes, categoriesRes] = await Promise.all([
    supabase
      .from("mi_partners")
      .select(
        "*, partner_categories:mi_partner_categories(slug, label), offers:mi_offers(id, title, is_featured, status)",
      )
      .eq("unidade_id", unit.id)
      .eq("status", "ativo")
      .order("plan", { ascending: false })
      .order("name"),
    supabase
      .from("mi_offers")
      .select(
        "id, title, description, banner_url, coupon, expires_at, partner_id, partners:mi_partners(id, slug, name, logo_url, unidade_id)",
      )
      .eq("is_featured", true)
      .eq("status", "ativa")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("mi_partner_categories").select("*").order("label"),
  ]);

  type PartnerWithRelations = Tables<"partners"> & {
    partner_categories: { slug: string; label: string } | null;
    offers: { id: string; title: string; is_featured: boolean; status: string }[];
  };

  const partners = (partnersRes.data ?? []) as PartnerWithRelations[];

  type FeaturedOffer = {
    id: string;
    title: string;
    description: string | null;
    banner_url: string | null;
    coupon: string | null;
    expires_at: string | null;
    partner_id: string;
    partners: { id: string; slug: string; name: string; logo_url: string | null; unidade_id: string } | null;
  };

  const featuredOffers = (
    (featuredOffersRes.data ?? []) as unknown as FeaturedOffer[]
  ).filter((o) => o.partners?.unidade_id === unit.id);

  const totalOffers = partners.reduce(
    (sum, p) => sum + (p.offers?.filter((o) => o.status === "ativa").length ?? 0),
    0,
  );

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-[var(--brand-turquoise)] via-[var(--brand-turquoise-light)] to-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-20">
          <Badge className="mb-4 bg-white/90 text-primary hover:bg-white">
            <Sparkles className="mr-1 h-3 w-3" />
            Conexão Local
          </Badge>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-white drop-shadow sm:text-5xl md:text-6xl">
            Benefícios do bairro
            <br />
            para quem lava com a gente.
          </h1>
          <p className="mt-4 max-w-2xl text-balance text-base text-white/95 sm:text-lg md:text-xl">
            Enquanto suas roupas lavam ou secam, aproveite descontos exclusivos em{" "}
            <strong>{partners.length}</strong> parceiros locais{" "}
            {totalOffers > 0 && (
              <>
                e <strong>{totalOffers} ofertas ativas</strong>
              </>
            )}
            .
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="brand">
              <Link href="#cadastro">
                <Heart className="mr-1 h-4 w-4" />
                Quero entrar no clube grátis
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="bg-white/90 hover:bg-white">
              <Link href="#parceiros">
                Ver parceiros <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Ofertas em destaque */}
      {featuredOffers.length > 0 && (
        <section className="border-b bg-secondary/30 py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <Star className="h-4 w-4 fill-current" /> Ofertas em destaque
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">
                  Aproveite agora
                </h2>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredOffers.map((offer) => (
                <Link
                  key={offer.id}
                  href={`/${unit.slug}/oferta/${offer.id}`}
                  className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
                >
                  <div className="relative aspect-video w-full bg-muted">
                    {offer.banner_url ? (
                      <Image
                        src={offer.banner_url}
                        alt={offer.title}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                        unoptimized
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-muted-foreground">
                        <Star className="h-8 w-8" />
                      </div>
                    )}
                    {offer.coupon && (
                      <span className="absolute left-2 top-2 rounded-md bg-[var(--brand-yellow)] px-2 py-1 font-mono text-xs font-bold text-yellow-900">
                        {offer.coupon}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold leading-tight group-hover:text-primary">
                      {offer.title}
                    </p>
                    {offer.partners && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {offer.partners.name}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Cadastro */}
      <ClubSignupSection unitId={unit.id} unitName={unit.name} unitSlug={unit.slug} />

      {/* Parceiros */}
      <section id="parceiros" className="py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-6">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
              <Store className="h-4 w-4" /> Parceiros do bairro
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">
              Conheça quem faz parte da nossa rede local
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Filtre por categoria e descubra comerciantes que oferecem vantagens exclusivas.
            </p>
          </div>

          <PartnersGrid
            unitSlug={unit.slug}
            categories={categoriesRes.data ?? []}
            partners={partners}
          />
        </div>
      </section>

      {/* CTA Quero ser parceiro */}
      <section className="border-t bg-primary/5 py-12">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 text-center sm:px-6">
          <Badge variant="outline">Para comerciantes</Badge>
          <h2 className="text-balance text-2xl font-bold tracking-tight">
            Tem um comércio no bairro? Apareça na TV da lavanderia.
          </h2>
          <p className="text-balance text-sm text-muted-foreground">
            Cadastre-se gratuitamente e tenha sua marca exibida para todos os clientes da unidade,
            todos os dias. Receba clientes da região direto no seu negócio.
          </p>
          <Button asChild size="lg">
            <Link href={`/${unit.slug}/quero-ser-parceiro`}>
              Quero ser parceiro <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}

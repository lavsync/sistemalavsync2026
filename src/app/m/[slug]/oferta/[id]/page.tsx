import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Copy, MessageCircle, ExternalLink, Calendar, FileText } from "lucide-react";
import { Button } from "@mi/components/ui/button";
import { Card, CardContent } from "@mi/components/ui/card";
import { Badge } from "@mi/components/ui/badge";
import { createClient } from "@mi/lib/supabase/server";
import { formatDate, whatsappLink } from "@mi/lib/utils";
import { CopyCoupon } from "./copy-coupon";
import type { Tables } from "@mi/types/database";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("mi_offers")
    .select("title, description")
    .eq("id", id)
    .single<{ title: string; description: string | null }>();
  return {
    title: data?.title ?? "Oferta",
    description: data?.description ?? undefined,
  };
}

export default async function OfertaPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const supabase = await createClient();

  const { data: offer } = await supabase
    .from("mi_offers")
    .select(
      "*, partners:mi_partners(id, slug, name, logo_url, whatsapp, instagram, website, short_description, unidade_id, units:mi_units(slug, name))",
    )
    .eq("id", id)
    .eq("status", "ativa")
    .single<
      Tables<"offers"> & {
        partners: {
          id: string;
          slug: string;
          name: string;
          logo_url: string | null;
          whatsapp: string | null;
          instagram: string | null;
          website: string | null;
          short_description: string | null;
          unidade_id: string;
          units: { slug: string; name: string } | null;
        } | null;
      }
    >();

  if (!offer || offer.partners?.units?.slug !== slug) notFound();

  const partner = offer.partners!;

  return (
    <article className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <Link
        href={`/m/${slug}/clube-de-beneficios`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao clube
      </Link>

      {/* Banner */}
      {offer.banner_url && (
        <div className="relative mt-6 aspect-video overflow-hidden rounded-xl border bg-muted">
          <Image src={offer.banner_url} alt={offer.title} fill className="object-cover" unoptimized />
        </div>
      )}

      {/* Header da oferta */}
      <div className="mt-6">
        {offer.is_featured && (
          <Badge variant="warning" className="mb-2">
            ⭐ Oferta em destaque
          </Badge>
        )}
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          {offer.title}
        </h1>
        {offer.main_call && (
          <p className="mt-3 text-balance text-lg text-muted-foreground">{offer.main_call}</p>
        )}
      </div>

      {/* Parceiro */}
      <Card className="mt-6">
        <CardContent className="flex items-center gap-4 p-4">
          <Link
            href={`/m/${slug}/parceiro/${partner.slug}`}
            className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md border bg-background"
          >
            {partner.logo_url ? (
              <Image
                src={partner.logo_url}
                alt={partner.name}
                width={56}
                height={56}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <span className="text-xs font-bold text-muted-foreground">
                {partner.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/m/${slug}/parceiro/${partner.slug}`}
              className="font-semibold hover:text-primary"
            >
              {partner.name}
            </Link>
            {partner.short_description && (
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {partner.short_description}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CTAs */}
      <div className="mt-6 flex flex-wrap gap-3">
        {offer.coupon && <CopyCoupon code={offer.coupon} />}

        {offer.whatsapp_url && (
          <Button asChild size="lg" variant="brand">
            <a href={offer.whatsapp_url} target="_blank" rel="noreferrer">
              <MessageCircle className="mr-1 h-4 w-4" />
              {offer.cta_label ?? "Falar no WhatsApp"}
            </a>
          </Button>
        )}

        {!offer.whatsapp_url && partner.whatsapp && (
          <Button asChild size="lg" variant="brand">
            <a
              href={whatsappLink(
                partner.whatsapp,
                `Olá ${partner.name}! Vi a oferta "${offer.title}" no Clube Xô Varal.`,
              )}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="mr-1 h-4 w-4" />
              Falar no WhatsApp
            </a>
          </Button>
        )}

        {offer.cta_url && (
          <Button asChild size="lg" variant="outline">
            <a href={offer.cta_url} target="_blank" rel="noreferrer">
              {offer.cta_label ?? "Saiba mais"} <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        )}
      </div>

      {/* Descrição */}
      {offer.description && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Detalhes
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{offer.description}</p>
        </section>
      )}

      {/* Vigência */}
      {(offer.starts_at || offer.expires_at) && (
        <section className="mt-6 flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            {offer.starts_at && <p>Início: {formatDate(offer.starts_at)}</p>}
            {offer.expires_at && (
              <p>
                Expira em <strong>{formatDate(offer.expires_at)}</strong>
              </p>
            )}
          </div>
        </section>
      )}

      {/* Regulamento */}
      {offer.terms && (
        <section className="mt-6 rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-muted-foreground" /> Regulamento
          </div>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
            {offer.terms}
          </p>
        </section>
      )}
    </article>
  );
}

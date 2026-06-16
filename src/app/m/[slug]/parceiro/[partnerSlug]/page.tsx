import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle, AtSign, Globe, MapPin, ExternalLink, Tag } from "lucide-react";
import { Button } from "@mi/components/ui/button";
import { Card, CardContent } from "@mi/components/ui/card";
import { Badge } from "@mi/components/ui/badge";
import { createClient } from "@mi/lib/supabase/server";
import { whatsappLink, formatDate } from "@mi/lib/utils";
import type { Tables } from "@mi/types/database";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; partnerSlug: string }>;
}) {
  const { partnerSlug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("mi_partners")
    .select("name, short_description")
    .eq("slug", partnerSlug)
    .single<{ name: string; short_description: string | null }>();
  return {
    title: data?.name ?? "Parceiro",
    description: data?.short_description ?? undefined,
  };
}

export default async function ParceiroPage({
  params,
}: {
  params: Promise<{ slug: string; partnerSlug: string }>;
}) {
  const { slug, partnerSlug } = await params;
  const supabase = await createClient();

  const { data: unit } = await supabase
    .from("mi_units")
    .select("id, slug")
    .eq("slug", slug)
    .single<{ id: string; slug: string }>();

  if (!unit) notFound();

  const { data: partner } = await supabase
    .from("mi_partners")
    .select("*, partner_categories:mi_partner_categories(label), units:mi_units(slug, name)")
    .eq("slug", partnerSlug)
    .eq("unidade_id", unit.id)
    .eq("status", "ativo")
    .single<
      Tables<"partners"> & {
        partner_categories: { label: string } | null;
        units: { slug: string; name: string } | null;
      }
    >();

  if (!partner) notFound();

  const { data: offers } = await supabase
    .from("mi_offers")
    .select("*")
    .eq("partner_id", partner.id)
    .eq("status", "ativa")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  const whatsappMessage = `Olá ${partner.name}! Vim através do Clube de Benefícios Xô Varal.`;

  return (
    <>
      {/* Banner */}
      <div className="relative h-40 w-full bg-gradient-to-br from-[var(--brand-turquoise)] to-[var(--brand-turquoise-light)] sm:h-56">
        {partner.cover_url && (
          <Image
            src={partner.cover_url}
            alt={partner.name}
            fill
            className="object-cover"
            unoptimized
          />
        )}
      </div>

      <article className="mx-auto -mt-12 max-w-3xl px-4 pb-12 sm:px-6">
        {/* Header card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-background bg-background shadow-sm">
                {partner.logo_url ? (
                  <Image
                    src={partner.logo_url}
                    alt={partner.name}
                    width={80}
                    height={80}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="text-lg font-bold text-muted-foreground">
                    {partner.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                {partner.partner_categories?.label && (
                  <Badge variant="outline" className="mb-1">
                    {partner.partner_categories.label}
                  </Badge>
                )}
                <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
                  {partner.name}
                </h1>
                {partner.short_description && (
                  <p className="mt-2 text-balance text-sm text-muted-foreground">
                    {partner.short_description}
                  </p>
                )}
                {partner.address && (
                  <p className="mt-2 flex items-start gap-1 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      {partner.address}
                      {partner.neighborhood && ` · ${partner.neighborhood}`}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <Link
              href={`/m/${slug}/clube-de-beneficios`}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Voltar ao clube
            </Link>
          </CardContent>
        </Card>

        {/* CTAs de contato */}
        <div className="mt-4 flex flex-wrap gap-2">
          {partner.whatsapp && (
            <Button asChild variant="brand">
              <a
                href={whatsappLink(partner.whatsapp, whatsappMessage)}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
              </a>
            </Button>
          )}
          {partner.instagram && (
            <Button asChild variant="outline">
              <a
                href={`https://instagram.com/${partner.instagram.replace(/^@mi/, "")}`}
                target="_blank"
                rel="noreferrer"
              >
                <AtSign className="mr-1 h-4 w-4" /> Instagram
              </a>
            </Button>
          )}
          {partner.website && (
            <Button asChild variant="outline">
              <a href={partner.website} target="_blank" rel="noreferrer">
                <Globe className="mr-1 h-4 w-4" /> Site
              </a>
            </Button>
          )}
          {partner.external_link && (
            <Button asChild variant="outline">
              <a href={partner.external_link} target="_blank" rel="noreferrer">
                Cardápio <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          )}
        </div>

        {/* Descrição completa */}
        {partner.full_description && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Sobre
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
              {partner.full_description}
            </p>
          </section>
        )}

        {/* Ofertas ativas */}
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <Tag className="h-4 w-4" /> Ofertas ativas ({offers?.length ?? 0})
            </h2>
          </div>

          {offers && offers.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {offers.map((o: Tables<"offers">) => (
                <Link
                  key={o.id}
                  href={`/m/${slug}/oferta/${o.id}`}
                  className="group flex gap-3 overflow-hidden rounded-lg border bg-card p-3 transition-shadow hover:shadow-md"
                >
                  <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                    {o.banner_url ? (
                      <Image
                        src={o.banner_url}
                        alt={o.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-muted-foreground">
                        <Tag className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold group-hover:text-primary">
                      {o.title}
                    </p>
                    {o.coupon && (
                      <code className="mt-1 inline-block rounded bg-[var(--brand-yellow)]/30 px-1.5 py-0.5 font-mono text-[10px] text-yellow-900">
                        {o.coupon}
                      </code>
                    )}
                    {o.expires_at && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Até {formatDate(o.expires_at)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Nenhuma oferta ativa no momento. Volte em breve.
            </p>
          )}
        </section>
      </article>
    </>
  );
}

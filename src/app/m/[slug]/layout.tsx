import Link from "next/link";
import { notFound } from "next/navigation";
import { AtSign, MessageCircle, MapPin } from "lucide-react";
import { createClient } from "@mi/lib/supabase/server";
import { Toaster } from "@mi/components/ui/toaster";
import { APP_TAGLINE } from "@mi/lib/constants";
import { whatsappLink } from "@mi/lib/utils";
import type { Tables } from "@mi/types/database";

interface PublicLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function PublicLayout({ children, params }: PublicLayoutProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: unit } = await supabase
    .from("mi_units")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single<Tables<"units">>();

  if (!unit) notFound();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href={`/${unit.slug}/clube-de-beneficios`} className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
              XV
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold leading-tight">Xô Varal {unit.name.replace(/^Xô Varal\s+/i, "")}</p>
              <p className="text-[11px] text-muted-foreground">Clube de Benefícios</p>
            </div>
          </Link>

          <div className="flex items-center gap-1.5 text-sm">
            {unit.whatsapp && (
              <a
                href={whatsappLink(unit.whatsapp, "Olá! Quero saber mais sobre o clube.")}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <MessageCircle className="h-4 w-4" />
                <span className="hidden md:inline">WhatsApp</span>
              </a>
            )}
            {unit.instagram && (
              <a
                href={`https://instagram.com/${unit.instagram.replace(/^@mi/, "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <AtSign className="h-4 w-4" />
                <span className="hidden md:inline">Instagram</span>
              </a>
            )}
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-12 border-t bg-secondary/30">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="text-sm font-semibold">Xô Varal {unit.name.replace(/^Xô Varal\s+/i, "")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{APP_TAGLINE}</p>
            </div>
            <div className="text-xs text-muted-foreground">
              {unit.address && (
                <p className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {unit.address}
                    {unit.neighborhood && ` · ${unit.neighborhood}`}
                  </span>
                </p>
              )}
              {unit.opening_hours && <p className="mt-1">{unit.opening_hours}</p>}
            </div>
            <div className="text-xs text-muted-foreground">
              <Link href={`/${unit.slug}/quero-ser-parceiro`} className="text-primary hover:underline">
                Quero ser parceiro →
              </Link>
            </div>
          </div>
          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} Xô Varal · Conexão Local
          </p>
        </div>
      </footer>
      <Toaster />
    </div>
  );
}

import { notFound } from "next/navigation";
import { PageHeader } from "@mi/components/admin/page-header";
import { UnitForm } from "../unit-form";
import { Card, CardContent } from "@mi/components/ui/card";
import { Badge } from "@mi/components/ui/badge";
import { Button } from "@mi/components/ui/button";
import { Copy, ExternalLink } from "lucide-react";
import { createClient } from "@mi/lib/supabase/server";
import { requireUser } from "@mi/lib/auth";
import { APP_URL } from "@mi/lib/constants";
import { CopyButton } from "./copy-button";

export const metadata = { title: "Editar unidade" };

export default async function EditarUnidadePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await requireUser();
  const supabase = await createClient();

  const { data: unit } = await supabase.from("mi_units").select("*").eq("id", id).single();
  if (!unit) notFound();

  // Gestor só pode editar a própria unidade
  if (profile.role !== "master" && profile.unidade_id !== unit.id) {
    notFound();
  }

  const playerUrl = `${APP_URL}/player/${unit.slug}?token=${unit.player_token}`;
  const clubeUrl = `${APP_URL}/${unit.slug}/clube-de-beneficios`;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={unit.name}
        description={`Slug: /${unit.slug}`}
        actions={
          <Badge variant={unit.is_active ? "success" : "secondary"}>
            {unit.is_active ? "Ativa" : "Pausada"}
          </Badge>
        }
      />

      <Card className="mb-6">
        <CardContent className="space-y-3 p-6">
          <p className="text-sm font-semibold">Links públicos</p>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-muted px-3 py-2 font-mono text-xs">
                {playerUrl}
              </code>
              <CopyButton text={playerUrl} label="player" />
              <Button asChild variant="outline" size="sm">
                <a href={playerUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              ☝️ URL do player TV — abrir no Chromecast com Google TV em modo fullscreen.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-muted px-3 py-2 font-mono text-xs">
                {clubeUrl}
              </code>
              <CopyButton text={clubeUrl} label="clube" />
              <Button asChild variant="outline" size="sm">
                <a href={clubeUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              ☝️ Página pública do clube de benefícios — compartilhe com clientes.
            </p>
          </div>
        </CardContent>
      </Card>

      <UnitForm unit={unit} />
    </div>
  );
}

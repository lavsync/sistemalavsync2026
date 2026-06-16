import Link from "next/link";
import { Plus, ExternalLink, Pencil } from "lucide-react";
import { PageHeader } from "@mi/components/admin/page-header";
import { Button } from "@mi/components/ui/button";
import { Badge } from "@mi/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@mi/components/ui/table";
import { Card } from "@mi/components/ui/card";
import { createClient } from "@mi/lib/supabase/server";
import { requireUser } from "@mi/lib/auth";
import { UnitRowActions } from "./unit-row-actions";
import { APP_URL } from "@mi/lib/constants";

export const metadata = { title: "Unidades" };

export default async function UnidadesPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  let query = supabase
    .from("mi_units")
    .select("*")
    .order("created_at", { ascending: false });

  if (profile.role !== "master" && profile.unidade_id) {
    query = query.eq("id", profile.unidade_id);
  }

  const { data: units, error } = await query;

  return (
    <>
      <PageHeader
        title="Unidades"
        description={
          profile.role === "master"
            ? "Cadastre e gerencie todas as unidades Xô Varal."
            : "Visualize e edite os dados da sua unidade."
        }
        actions={
          profile.role === "master" ? (
            <Button asChild>
              <Link href="/publicidade/midia-indoor/unidades/nova">
                <Plus className="h-4 w-4" /> Nova unidade
              </Link>
            </Button>
          ) : null
        }
      />

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Erro ao carregar unidades: {error.message}
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Slug</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>URLs</TableHead>
              <TableHead className="w-16 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units && units.length > 0 ? (
              units.map((unit) => {
                const clubeUrl = `${APP_URL}/${unit.slug}/clube-de-beneficios`;
                const playerUrl = `${APP_URL}/player/${unit.slug}?token=${unit.player_token}`;
                return (
                  <TableRow key={unit.id}>
                    <TableCell>
                      <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
                        {unit.slug}
                      </code>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/publicidade/midia-indoor/unidades/${unit.id}`} className="hover:text-primary">
                        {unit.name}
                      </Link>
                      {unit.neighborhood && (
                        <p className="text-xs text-muted-foreground">{unit.neighborhood}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {unit.city
                        ? `${unit.city}${unit.state ? `/${unit.state}` : ""}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={unit.is_active ? "success" : "secondary"}>
                        {unit.is_active ? "Ativa" : "Pausada"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-xs">
                          <a href={playerUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3 w-3" />
                            Player
                          </a>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-xs">
                          <a href={clubeUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-3 w-3" />
                            Clube
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <UnitRowActions
                        unit={unit}
                        canManage={profile.role === "master"}
                        playerUrl={playerUrl}
                        clubeUrl={clubeUrl}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  Nenhuma unidade cadastrada ainda.{" "}
                  {profile.role === "master" && (
                    <Link href="/publicidade/midia-indoor/unidades/nova" className="text-primary hover:underline">
                      Criar a primeira →
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {units && units.length > 0 && profile.role === "gestor" && (
        <Card className="mt-4 p-4">
          <div className="flex items-start gap-3">
            <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Como gestor, você pode editar os dados da sua unidade mas não pode criar novas. Para
              expandir, fale com o administrador master.
            </p>
          </div>
        </Card>
      )}
    </>
  );
}

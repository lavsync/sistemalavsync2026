import Link from "next/link";
import { Plus, Star } from "lucide-react";
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
import { formatDate } from "@mi/lib/utils";
import { CampaignRowActions } from "./campaign-row-actions";
import type { Tables } from "@mi/types/database";

export const metadata = { title: "Campanhas" };

const STATUS_VARIANTS: Record<string, "success" | "warning" | "secondary"> = {
  ativa: "success",
  rascunho: "secondary",
  pausada: "secondary",
  expirada: "warning",
};

const PRIORITY_VARIANTS: Record<string, "default" | "outline" | "warning"> = {
  premium: "warning",
  destaque: "default",
  normal: "outline",
};

export default async function CampanhasPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  let query = supabase
    .from("mi_campaigns")
    .select(
      "*, units(name, slug), templates(name, slug), partners(name)",
    )
    .order("created_at", { ascending: false });

  if (profile.role !== "master" && profile.unidade_id) {
    query = query.eq("unidade_id", profile.unidade_id);
  }

  const { data: campaigns } = await query;

  type CampaignRow = Tables<"campaigns"> & {
    units: { name: string; slug: string } | null;
    templates: { name: string; slug: string } | null;
    partners: { name: string } | null;
  };

  return (
    <>
      <PageHeader
        title="Campanhas"
        description="Conteúdos que aparecem na TV. Premium aparece 3x mais, destaque 2x, normal 1x."
        actions={
          <Button asChild>
            <Link href="/publicidade/midia-indoor/campanhas/nova">
              <Plus className="h-4 w-4" />
              Nova campanha
            </Link>
          </Button>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campanha</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns && campaigns.length > 0 ? (
              (campaigns as CampaignRow[]).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/publicidade/midia-indoor/campanhas/${c.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {c.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {c.partners?.name ?? "Institucional"}
                      {profile.role === "master" && c.units?.name && ` · ${c.units.name}`}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{c.templates?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={PRIORITY_VARIANTS[c.priority] ?? "outline"}>
                      {c.priority === "premium" && (
                        <Star className="mr-1 h-3 w-3 fill-current" />
                      )}
                      {c.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {c.starts_at && <p>De: {formatDate(c.starts_at)}</p>}
                    {c.ends_at && <p>Até: {formatDate(c.ends_at)}</p>}
                    {!c.starts_at && !c.ends_at && (
                      <span className="text-muted-foreground">Sem agendamento</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[c.status] ?? "secondary"}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <CampaignRowActions campaign={c} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  Nenhuma campanha criada ainda.{" "}
                  <Link href="/publicidade/midia-indoor/campanhas/nova" className="text-primary hover:underline">
                    Criar a primeira →
                  </Link>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

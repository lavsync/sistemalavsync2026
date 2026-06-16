import Link from "next/link";
import Image from "next/image";
import { Plus, MoreVertical } from "lucide-react";
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
import { PartnerRowActions } from "./partner-row-actions";
import type { Tables } from "@mi/types/database";

export const metadata = { title: "Parceiros" };

const STATUS_VARIANTS: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  ativo: "success",
  pendente: "warning",
  pausado: "secondary",
  removido: "destructive",
};

const PLAN_LABELS: Record<string, string> = {
  gratuito: "Gratuito",
  destaque: "Destaque",
  premium: "Premium",
};

export default async function ParceirosPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  let query = supabase
    .from("mi_partners")
    .select("*, units:mi_units(name, slug), partner_categories:mi_partner_categories(label, icon)")
    .order("created_at", { ascending: false });

  if (profile.role !== "master" && profile.unidade_id) {
    query = query.eq("unidade_id", profile.unidade_id);
  }

  const { data: partners } = await query;

  return (
    <>
      <PageHeader
        title="Parceiros"
        description="Comerciantes locais que aparecem na TV e no clube de benefícios."
        actions={
          <Button asChild>
            <Link href="/publicidade/midia-indoor/parceiros/novo">
              <Plus className="h-4 w-4" />
              Novo parceiro
            </Link>
          </Button>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Parceiro</TableHead>
              <TableHead>Categoria</TableHead>
              {profile.role === "master" && <TableHead>Unidade</TableHead>}
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {partners && partners.length > 0 ? (
              partners.map((p: Tables<"partners"> & {
                units: { name: string; slug: string } | null;
                partner_categories: { label: string; icon: string | null } | null;
              }) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                        {p.logo_url ? (
                          <Image
                            src={p.logo_url}
                            alt={p.name}
                            width={40}
                            height={40}
                            className="h-full w-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground">
                            {p.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/publicidade/midia-indoor/parceiros/${p.id}`}
                          className="truncate font-medium hover:text-primary"
                        >
                          {p.name}
                        </Link>
                        {p.neighborhood && (
                          <p className="truncate text-xs text-muted-foreground">{p.neighborhood}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.partner_categories?.label ?? "—"}
                  </TableCell>
                  {profile.role === "master" && (
                    <TableCell className="text-sm">{p.units?.name ?? "—"}</TableCell>
                  )}
                  <TableCell>
                    <Badge variant={p.plan === "premium" ? "default" : "outline"}>
                      {PLAN_LABELS[p.plan]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[p.status] ?? "secondary"}>{p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <PartnerRowActions partner={p} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={profile.role === "master" ? 6 : 5} className="py-12 text-center text-sm text-muted-foreground">
                  Nenhum parceiro cadastrado ainda.{" "}
                  <Link href="/publicidade/midia-indoor/parceiros/novo" className="text-primary hover:underline">
                    Cadastrar o primeiro →
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

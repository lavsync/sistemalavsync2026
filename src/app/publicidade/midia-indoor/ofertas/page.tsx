import Link from "next/link";
import Image from "next/image";
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
import { OfferRowActions } from "./offer-row-actions";
import type { Tables } from "@mi/types/database";

export const metadata = { title: "Ofertas" };

const STATUS_VARIANTS: Record<string, "success" | "warning" | "secondary"> = {
  ativa: "success",
  inativa: "secondary",
  expirada: "warning",
};

export default async function OfertasPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  let query = supabase
    .from("mi_offers")
    .select("*, partners(id, name, logo_url, unidade_id, units(name, slug))")
    .order("created_at", { ascending: false });

  // Para gestor, filtrar por unidade_id via partner. RLS faz isso automaticamente,
  // mas explicitamos pra performance.

  const { data: offers } = await query;

  type OfferWithRelations = Tables<"offers"> & {
    partners: {
      id: string;
      name: string;
      logo_url: string | null;
      unidade_id: string;
      units: { name: string; slug: string } | null;
    } | null;
  };

  // Filtro client-side para gestor (RLS já cuida no banco, isso é defesa em profundidade)
  const filtered =
    profile.role === "master"
      ? offers
      : (offers as OfferWithRelations[] | null)?.filter((o) => o.partners?.unidade_id === profile.unidade_id);

  return (
    <>
      <PageHeader
        title="Ofertas"
        description="Ofertas dos parceiros que aparecem no clube de benefícios e na TV. QR Code é gerado automaticamente."
        actions={
          <Button asChild>
            <Link href="/publicidade/midia-indoor/ofertas/nova">
              <Plus className="h-4 w-4" />
              Nova oferta
            </Link>
          </Button>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Oferta</TableHead>
              <TableHead>Parceiro</TableHead>
              <TableHead>Cupom</TableHead>
              <TableHead>Expira</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered && filtered.length > 0 ? (
              (filtered as OfferWithRelations[]).map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {o.banner_url ? (
                        <Image
                          src={o.banner_url}
                          alt={o.title}
                          width={64}
                          height={36}
                          className="h-9 w-16 rounded object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="h-9 w-16 rounded bg-muted" />
                      )}
                      <div className="min-w-0">
                        <Link
                          href={`/publicidade/midia-indoor/ofertas/${o.id}`}
                          className="flex items-center gap-1.5 truncate font-medium hover:text-primary"
                        >
                          {o.is_featured && (
                            <Star className="h-3.5 w-3.5 fill-[var(--brand-yellow)] text-[var(--brand-yellow)]" />
                          )}
                          {o.title}
                        </Link>
                        {o.main_call && (
                          <p className="truncate text-xs text-muted-foreground">{o.main_call}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <p className="font-medium">{o.partners?.name ?? "—"}</p>
                    {profile.role === "master" && o.partners?.units?.name && (
                      <p className="text-xs text-muted-foreground">{o.partners.units.name}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {o.coupon ? (
                      <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{o.coupon}</code>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {o.expires_at ? formatDate(o.expires_at) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[o.status] ?? "secondary"}>{o.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <OfferRowActions offer={o} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  Nenhuma oferta cadastrada ainda.{" "}
                  <Link href="/publicidade/midia-indoor/ofertas/nova" className="text-primary hover:underline">
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

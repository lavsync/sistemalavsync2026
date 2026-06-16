import Link from "next/link";
import Image from "next/image";
import { Plus, Tag, Sparkles, AlertCircle, ExternalLink, Star } from "lucide-react";
import { PageHeader } from "@mi/components/admin/page-header";
import { Button } from "@mi/components/ui/button";
import { Badge } from "@mi/components/ui/badge";
import { Card, CardContent } from "@mi/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@mi/components/ui/table";
import { requirePartnerUser } from "@mi/lib/partner-auth";
import { createClient } from "@mi/lib/supabase/server";
import { formatDate } from "@mi/lib/utils";
import { OfferRowActions } from "./offer-row-actions";
import type { Tables } from "@mi/types/database";

export const metadata = { title: "Minhas ofertas" };

const MAX_OFFERS = 5;

export default async function ParceiroOfertasPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { partner } = await requirePartnerUser();
  const { created } = await searchParams;

  if (!partner) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
          <p className="mt-2 font-semibold">Cadastro incompleto</p>
          <Button asChild className="mt-4">
            <Link href="/parceiro/cadastro">Completar cadastro</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const supabase = await createClient();
  const { data: offers } = await supabase
    .from("mi_offers")
    .select("*")
    .eq("partner_id", partner.id)
    .order("created_at", { ascending: false });

  const count = offers?.length ?? 0;
  const remaining = Math.max(0, MAX_OFFERS - count);
  const limitReached = count >= MAX_OFFERS;
  const isPending = partner.status !== "ativo";

  return (
    <>
      <PageHeader
        title="Minhas ofertas"
        description={`Você pode ter até ${MAX_OFFERS} ofertas ativas no Clube de Benefícios.`}
        actions={
          isPending ? (
            <Badge variant="warning">Cadastro em análise</Badge>
          ) : (
            <Button asChild disabled={limitReached}>
              <Link href="/parceiro/ofertas/nova" aria-disabled={limitReached}>
                <Plus className="h-4 w-4" />
                Nova oferta
              </Link>
            </Button>
          )
        }
      />

      {created && (
        <Card className="mb-4 border-emerald-500/30 bg-emerald-50">
          <CardContent className="flex items-start gap-3 p-4">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div className="text-sm text-emerald-900">
              <p className="font-semibold">Oferta criada com sucesso!</p>
              <p className="mt-0.5 text-emerald-800/80">
                Geramos automaticamente: QR Code rastreável + banner para TV. Veja em{" "}
                <Link href="/parceiro/banners" className="underline">Meus banners</Link>.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {isPending && (
        <Card className="mb-4 border-amber-500/30 bg-amber-50">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Cadastro em análise</p>
              <p className="mt-0.5 text-amber-800/80">
                Sua conta ainda está aguardando aprovação. Você poderá criar ofertas assim
                que for aprovado.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-4 p-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span>
            <strong>{count}</strong> de {MAX_OFFERS} ofertas criadas
          </span>
          <span className="text-muted-foreground">
            {remaining > 0 ? `${remaining} ${remaining === 1 ? "vaga restante" : "vagas restantes"}` : "Limite atingido"}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(count / MAX_OFFERS) * 100}%` }}
          />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Oferta</TableHead>
              <TableHead>Cupom</TableHead>
              <TableHead>Vigência</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!offers || offers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <Tag className="mx-auto h-10 w-10 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nenhuma oferta criada ainda
                  </p>
                  {!isPending && (
                    <Button asChild className="mt-4">
                      <Link href="/parceiro/ofertas/nova">Criar primeira oferta</Link>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              (offers as Tables<"offers">[]).map((o) => (
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
                        <p className="flex items-center gap-1.5 truncate font-medium">
                          {o.is_featured && (
                            <Star className="h-3.5 w-3.5 fill-[var(--brand-yellow)] text-[var(--brand-yellow)]" />
                          )}
                          {o.title}
                        </p>
                        {o.main_call && (
                          <p className="truncate text-xs text-muted-foreground">{o.main_call}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {o.coupon ? (
                      <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{o.coupon}</code>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {o.expires_at ? `Até ${formatDate(o.expires_at)}` : "Sem expiração"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        o.status === "ativa"
                          ? "success"
                          : o.status === "expirada"
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {o.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <OfferRowActions offerId={o.id} status={o.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="mt-4 p-4">
        <p className="flex items-center gap-2 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Como funciona
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Quando você cria uma oferta, geramos <strong>automaticamente</strong>:
        </p>
        <ul className="mt-1 ml-4 list-disc text-xs text-muted-foreground">
          <li>QR Code rastreável que mede cada scan na TV</li>
          <li>Banner pronto pra exibição (você pode editar em "Meus banners")</li>
          <li>Página pública da oferta no Clube de Benefícios</li>
        </ul>
      </Card>
    </>
  );
}

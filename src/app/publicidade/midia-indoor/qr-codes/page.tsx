import Link from "next/link";
import { QrCode } from "lucide-react";
import { PageHeader } from "@mi/components/admin/page-header";
import { Card } from "@mi/components/ui/card";
import { Badge } from "@mi/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@mi/components/ui/table";
import { createClient } from "@mi/lib/supabase/server";
import { requireUser } from "@mi/lib/auth";
import { APP_URL } from "@mi/lib/constants";
import { formatDate } from "@mi/lib/utils";
import { QrPreviewButton } from "./qr-preview-button";
import type { Tables } from "@mi/types/database";

export const metadata = { title: "QR Codes" };

const PURPOSE_LABELS: Record<string, string> = {
  oferta: "Oferta",
  parceiro: "Parceiro",
  "clube-beneficios": "Clube",
  "clube": "Clube",
  whatsapp: "WhatsApp",
  "quero-ser-parceiro": "Quero ser parceiro",
  campanha: "Campanha",
};

export default async function QrCodesPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  let qrQuery = supabase
    .from("mi_qr_codes")
    .select(
      "*, units(name, slug), partners(name), offers(title), campaigns(name)",
    )
    .order("created_at", { ascending: false });

  if (profile.role !== "master" && profile.unidade_id) {
    qrQuery = qrQuery.eq("unidade_id", profile.unidade_id);
  }

  const { data: qrCodes } = await qrQuery;

  // Conta cliques por qr_code_id
  let clicksQuery = supabase.from("mi_qr_clicks").select("qr_code_id");
  if (profile.role !== "master" && profile.unidade_id) {
    clicksQuery = clicksQuery.eq("unidade_id", profile.unidade_id);
  }
  const { data: allClicks } = await clicksQuery;

  const clickCount = new Map<string, number>();
  for (const c of ((allClicks ?? []) as { qr_code_id: string }[])) {
    clickCount.set(c.qr_code_id, (clickCount.get(c.qr_code_id) ?? 0) + 1);
  }

  type QrRow = Tables<"qr_codes"> & {
    units: { name: string; slug: string } | null;
    partners: { name: string } | null;
    offers: { title: string } | null;
    campaigns: { name: string } | null;
  };

  return (
    <>
      <PageHeader
        title="QR Codes"
        description="Todos os códigos rastreáveis gerados pelo sistema. Cliente escaneia → registra clique → redireciona pra URL alvo com UTM."
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Vínculo</TableHead>
              <TableHead>Short URL</TableHead>
              {profile.role === "master" && <TableHead>Unidade</TableHead>}
              <TableHead className="text-right">Cliques</TableHead>
              <TableHead>Criado</TableHead>
              <TableHead className="w-16 text-right">QR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {qrCodes && qrCodes.length > 0 ? (
              (qrCodes as QrRow[]).map((qr) => {
                const label =
                  qr.offers?.title ??
                  qr.partners?.name ??
                  qr.campaigns?.name ??
                  PURPOSE_LABELS[qr.purpose] ??
                  qr.purpose;
                const shortUrl = `${APP_URL}/qr/${qr.short_code}`;
                const clicks = clickCount.get(qr.id) ?? 0;
                return (
                  <TableRow key={qr.id}>
                    <TableCell>
                      <Badge variant="outline">{PURPOSE_LABELS[qr.purpose] ?? qr.purpose}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <p className="font-medium">{label}</p>
                    </TableCell>
                    <TableCell>
                      <a
                        href={shortUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        /qr/{qr.short_code}
                      </a>
                    </TableCell>
                    {profile.role === "master" && (
                      <TableCell className="text-sm">{qr.units?.name ?? "—"}</TableCell>
                    )}
                    <TableCell className="text-right">
                      <Badge variant={clicks > 0 ? "success" : "secondary"}>
                        {clicks.toLocaleString("pt-BR")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(qr.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <QrPreviewButton url={shortUrl} label={label} />
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={profile.role === "master" ? 7 : 6} className="py-12 text-center">
                  <QrCode className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nenhum QR Code criado ainda. Crie uma oferta para gerar automaticamente.{" "}
                    <Link href="/publicidade/midia-indoor/ofertas/nova" className="text-primary hover:underline">
                      Nova oferta →
                    </Link>
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

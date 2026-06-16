import Link from "next/link";
import { TrendingUp, AlertCircle, QrCode, Calendar, Eye, MousePointerClick } from "lucide-react";
import { PageHeader } from "@mi/components/admin/page-header";
import { StatCard } from "@mi/components/admin/stat-card";
import { Card, CardContent } from "@mi/components/ui/card";
import { Button } from "@mi/components/ui/button";
import { Badge } from "@mi/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@mi/components/ui/table";
import { requirePartnerUser } from "@mi/lib/partner-auth";
import { createAdminClient } from "@mi/lib/supabase/admin";
import { formatDateTime, formatDate } from "@mi/lib/utils";

export const metadata = { title: "Leads e métricas" };

export default async function ParceiroLeadsPage() {
  const { partner } = await requirePartnerUser();

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

  const admin = createAdminClient();
  const now = new Date();
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // QR codes do parceiro
  const { data: qrCodes } = await admin
    .from("mi_qr_codes")
    .select("id, short_code, purpose, offers(title), created_at")
    .eq("partner_id", partner.id);

  const qrIds = (qrCodes ?? []).map((q: { id: string }) => q.id);

  // Cliques agregados
  const [totalRes, last30Res, last7Res, recentRes, impressionsRes] = await Promise.all([
    admin.from("mi_qr_clicks").select("*", { count: "exact", head: true }).in("qr_code_id", qrIds.length > 0 ? qrIds : ["__none__"]),
    admin.from("mi_qr_clicks").select("*", { count: "exact", head: true }).in("qr_code_id", qrIds.length > 0 ? qrIds : ["__none__"]).gte("clicked_at", since30d),
    admin.from("mi_qr_clicks").select("*", { count: "exact", head: true }).in("qr_code_id", qrIds.length > 0 ? qrIds : ["__none__"]).gte("clicked_at", since7d),
    admin
      .from("mi_qr_clicks")
      .select("qr_code_id, clicked_at, user_agent, referer")
      .in("qr_code_id", qrIds.length > 0 ? qrIds : ["__none__"])
      .order("clicked_at", { ascending: false })
      .limit(20),
    // Impressões dos banners do parceiro
    admin
      .from("mi_campaign_impressions")
      .select("id", { count: "exact", head: true })
      .in("unidade_id", [partner.unidade_id])
      .gte("shown_at", since30d),
  ]);

  type QrRow = { id: string; short_code: string; purpose: string; offers: { title: string } | null };
  const qrByCodeId = new Map((qrCodes ?? []).map((q) => [q.id, q as unknown as QrRow]));

  // Top QR codes
  type ClickRow = { qr_code_id: string };
  const { data: allClicks30d } = await admin
    .from("mi_qr_clicks")
    .select("qr_code_id")
    .in("qr_code_id", qrIds.length > 0 ? qrIds : ["__none__"])
    .gte("clicked_at", since30d)
    .limit(2000);
  const clickAgg = new Map<string, number>();
  for (const row of (allClicks30d ?? []) as ClickRow[]) {
    clickAgg.set(row.qr_code_id, (clickAgg.get(row.qr_code_id) ?? 0) + 1);
  }
  const topQrs = [...clickAgg.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({
      id,
      count,
      label: (() => {
        const q = qrByCodeId.get(id);
        return q?.offers?.title ?? `QR ${q?.short_code?.slice(0, 8) ?? ""}`;
      })(),
    }));

  const total = totalRes.count ?? 0;
  const last30 = last30Res.count ?? 0;
  const last7 = last7Res.count ?? 0;
  const impressions = impressionsRes.count ?? 0;

  return (
    <>
      <PageHeader
        title="Leads e métricas"
        description="Acompanhe quantos clientes Xô Varal escanearam seus QR Codes."
      />

      {qrIds.length === 0 && (
        <Card className="mb-4 border-amber-500/30 bg-amber-50">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Nenhum QR Code criado ainda</p>
              <p className="mt-0.5 text-amber-800/80">
                Crie sua primeira oferta — geramos QR rastreável automaticamente.
              </p>
              <Button asChild className="mt-3">
                <Link href="/parceiro/ofertas/nova">Criar oferta</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Scans no QR (total)"
          value={total}
          icon={MousePointerClick}
          tone="success"
        />
        <StatCard
          label="Scans (30d)"
          value={last30}
          icon={Calendar}
          tone="brand"
        />
        <StatCard
          label="Scans (7d)"
          value={last7}
          icon={TrendingUp}
          tone="brand"
        />
        <StatCard
          label="Impressões na TV (30d)"
          value={impressions.toLocaleString("pt-BR")}
          hint="Estimativa por unidade"
          icon={Eye}
          tone="default"
        />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Top QR Codes (30 dias)
            </h3>
            {topQrs.length === 0 ? (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Sem scans nos últimos 30 dias
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {topQrs.map((q, idx) => (
                  <li key={q.id} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {idx + 1}
                      </span>
                      <p className="truncate text-sm font-medium">{q.label}</p>
                    </div>
                    <Badge variant="success">{q.count}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Últimos scans
            </h3>
            {!recentRes.data || recentRes.data.length === 0 ? (
              <div className="mt-6 text-center">
                <QrCode className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Aguardando o primeiro scan
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-0">QR Code</TableHead>
                    <TableHead className="text-right">Quando</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRes.data.slice(0, 10).map((c: { qr_code_id: string; clicked_at: string }, i) => {
                    const q = qrByCodeId.get(c.qr_code_id);
                    return (
                      <TableRow key={i}>
                        <TableCell className="px-0 text-sm">
                          {q?.offers?.title ?? `QR ${q?.short_code?.slice(0, 8) ?? ""}`}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {formatDateTime(c.clicked_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 p-4 text-xs text-muted-foreground">
        <p>
          <strong className="text-foreground">Privacidade:</strong> não compartilhamos identidade
          do cliente (LGPD). Você vê apenas a quantidade agregada de scans, sem dados pessoais.
          O cliente vira lead quando ele <strong>fala com você no WhatsApp</strong>.
        </p>
      </Card>
    </>
  );
}

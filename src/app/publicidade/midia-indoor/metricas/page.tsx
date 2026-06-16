import { TrendingUp, Tv, Heart, Inbox, Store, Tags } from "lucide-react";
import { PageHeader } from "@mi/components/admin/page-header";
import { StatCard } from "@mi/components/admin/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@mi/components/ui/card";
import { Badge } from "@mi/components/ui/badge";
import { createClient } from "@mi/lib/supabase/server";
import { requireUser } from "@mi/lib/auth";
import { formatDate } from "@mi/lib/utils";

export const metadata = { title: "Métricas" };

interface QrClickRow {
  qr_code_id: string;
  qr_codes: {
    purpose: string;
    short_code: string;
    partners: { name: string } | null;
    offers: { title: string } | null;
  } | null;
}

interface ImpressionRow {
  campaign_id: string;
  campaigns: { name: string; priority: string; partners: { name: string } | null } | null;
}

export default async function MetricasPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const isMaster = profile.role === "master";
  const unitFilter = isMaster ? null : profile.unidade_id;

  // Período: últimos 30 dias
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const buildCount = (table: string, since?: string) => {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (since) q = q.gte("created_at", since);
    if (unitFilter && ["club_members", "partner_leads", "qr_clicks", "campaign_impressions"].includes(table)) {
      q = q.eq("unidade_id", unitFilter);
    }
    return q;
  };

  const [
    clicksTotalRes,
    impressionsTotalRes,
    clubeMembers30dRes,
    leads30dRes,
    qrClicksDetailRes,
    impressionsDetailRes,
  ] = await Promise.all([
    buildCount("qr_clicks", since),
    buildCount("campaign_impressions", since),
    buildCount("club_members", since),
    buildCount("partner_leads", since),
    (async () => {
      let q = supabase
        .from("mi_qr_clicks")
        .select(
          "qr_code_id, qr_codes(purpose, short_code, partners:mi_partners(name), offers:mi_offers(title))",
        )
        .gte("clicked_at", since);
      if (unitFilter) q = q.eq("unidade_id", unitFilter);
      return q.limit(1000);
    })(),
    (async () => {
      let q = supabase
        .from("mi_campaign_impressions")
        .select("campaign_id, campaigns:mi_campaigns(name, priority, partners:mi_partners(name))")
        .gte("shown_at", since);
      if (unitFilter) q = q.eq("unidade_id", unitFilter);
      return q.limit(2000);
    })(),
  ]);

  // Agregação top 10 cliques por QR
  const clickAgg = new Map<string, { count: number; label: string; purpose: string }>();
  for (const row of (qrClicksDetailRes.data ?? []) as unknown as QrClickRow[]) {
    if (!row.qr_codes) continue;
    const label =
      row.qr_codes.offers?.title ??
      row.qr_codes.partners?.name ??
      row.qr_codes.purpose ??
      "—";
    const existing = clickAgg.get(row.qr_code_id);
    if (existing) existing.count++;
    else
      clickAgg.set(row.qr_code_id, {
        count: 1,
        label,
        purpose: row.qr_codes.purpose,
      });
  }
  const topClicks = [...clickAgg.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  // Agregação impressões por campanha
  const impAgg = new Map<string, { count: number; name: string; priority: string; partner: string | null }>();
  for (const row of (impressionsDetailRes.data ?? []) as unknown as ImpressionRow[]) {
    if (!row.campaigns) continue;
    const existing = impAgg.get(row.campaign_id);
    if (existing) existing.count++;
    else
      impAgg.set(row.campaign_id, {
        count: 1,
        name: row.campaigns.name,
        priority: row.campaigns.priority,
        partner: row.campaigns.partners?.name ?? null,
      });
  }
  const topImpressions = [...impAgg.values()].sort((a, b) => b.count - a.count).slice(0, 10);

  return (
    <>
      <PageHeader
        title="Métricas"
        description="Performance dos últimos 30 dias — TV, QR Codes, cadastros e leads."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Cliques em QR (30d)"
          value={clicksTotalRes.count ?? 0}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="Impressões na TV (30d)"
          value={(impressionsTotalRes.count ?? 0).toLocaleString("pt-BR")}
          icon={Tv}
          tone="brand"
        />
        <StatCard
          label="Cadastros no clube (30d)"
          value={clubeMembers30dRes.count ?? 0}
          icon={Heart}
          tone="brand"
        />
        <StatCard
          label="Leads novos (30d)"
          value={leads30dRes.count ?? 0}
          icon={Inbox}
          tone="warning"
        />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 10 QR Codes mais clicados</CardTitle>
            <CardDescription>Últimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent>
            {topClicks.length > 0 ? (
              <ul className="space-y-3">
                {topClicks.map(([id, info], idx) => (
                  <li key={id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{info.label}</p>
                        <p className="text-xs text-muted-foreground">{info.purpose}</p>
                      </div>
                    </div>
                    <Badge variant="success">{info.count}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sem cliques registrados ainda. Aguardando QR Codes serem escaneados na TV.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campanhas mais exibidas</CardTitle>
            <CardDescription>Impressões na TV nos últimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent>
            {topImpressions.length > 0 ? (
              <ul className="space-y-3">
                {topImpressions.map((c, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.partner ?? "Institucional"} · {c.priority}
                        </p>
                      </div>
                    </div>
                    <Badge>{c.count.toLocaleString("pt-BR")}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sem impressões registradas. Ative o player na TV para começar.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

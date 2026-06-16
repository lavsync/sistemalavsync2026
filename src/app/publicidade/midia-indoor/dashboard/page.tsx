import {
  Store,
  Users,
  Megaphone,
  TrendingUp,
  Inbox,
  Tags,
  Heart,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@mi/components/admin/page-header";
import { StatCard } from "@mi/components/admin/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@mi/components/ui/card";
import { Badge } from "@mi/components/ui/badge";
import { requireUser } from "@mi/lib/auth";
import { createClient } from "@mi/lib/supabase/server";
import { formatDate } from "@mi/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  const isMaster = profile.role === "master";

  // Filtros: master vê tudo, gestor vê só sua unit
  const unitFilter = isMaster ? null : profile.unidade_id;

  const buildQuery = (table: string, status?: string) => {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (status) q = q.eq("status", status);
    if (unitFilter && ["units", "partners", "campaigns", "club_members", "partner_leads"].includes(table)) {
      if (table === "units") q = q.eq("id", unitFilter);
      else q = q.eq("unidade_id", unitFilter);
    }
    return q;
  };

  const [
    unitsRes,
    partnersActiveRes,
    partnersPendingRes,
    campaignsActiveRes,
    clubMembersRes,
    leadsNewRes,
    offersActiveRes,
    qrClicksRes,
  ] = await Promise.all([
    buildQuery("units"),
    buildQuery("partners", "ativo"),
    buildQuery("partners", "pendente"),
    buildQuery("campaigns", "ativa"),
    buildQuery("club_members"),
    buildQuery("partner_leads", "novo"),
    buildQuery("offers", "ativa"),
    buildQuery("qr_clicks"),
  ]);

  // Campanhas próximas do vencimento (próximos 7 dias)
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  let expiringQuery = supabase
    .from("mi_campaigns")
    .select("id, name, ends_at, unidade_id, units:mi_units(slug, name)")
    .eq("status", "ativa")
    .not("ends_at", "is", null)
    .lte("ends_at", sevenDaysFromNow)
    .order("ends_at", { ascending: true })
    .limit(5);
  if (unitFilter) expiringQuery = expiringQuery.eq("unidade_id", unitFilter);
  const { data: expiringCampaigns } = await expiringQuery;

  // Últimos leads
  let leadsQuery = supabase
    .from("mi_partner_leads")
    .select("id, business_name, segment, status, created_at, unidade_id, units:mi_units(slug, name)")
    .order("created_at", { ascending: false })
    .limit(5);
  if (unitFilter) leadsQuery = leadsQuery.eq("unidade_id", unitFilter);
  const { data: recentLeads } = await leadsQuery;

  return (
    <>
      <PageHeader
        title={`Olá, ${profile.full_name?.split(" ")[0] || "bem-vindo"} 👋`}
        description={
          isMaster
            ? "Visão consolidada de todas as unidades."
            : "Visão da sua unidade — escolha um cartão para entrar nos detalhes."
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={isMaster ? "Unidades ativas" : "Sua unidade"}
          value={unitsRes.count ?? 0}
          icon={Store}
          tone="brand"
        />
        <StatCard
          label="Parceiros ativos"
          value={partnersActiveRes.count ?? 0}
          hint={
            (partnersPendingRes.count ?? 0) > 0
              ? `${partnersPendingRes.count} aguardando aprovação`
              : "Todos aprovados"
          }
          icon={Users}
          tone="success"
        />
        <StatCard
          label="Campanhas ativas"
          value={campaignsActiveRes.count ?? 0}
          icon={Megaphone}
          tone="brand"
        />
        <StatCard
          label="Ofertas ativas"
          value={offersActiveRes.count ?? 0}
          icon={Tags}
          tone="warning"
        />
        <StatCard
          label="Clube — cadastros"
          value={clubMembersRes.count ?? 0}
          icon={Heart}
          tone="brand"
        />
        <StatCard
          label="Cliques em QR Codes"
          value={qrClicksRes.count ?? 0}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="Leads aguardando"
          value={leadsNewRes.count ?? 0}
          icon={Inbox}
          tone={(leadsNewRes.count ?? 0) > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Campanhas vencendo"
          value={expiringCampaigns?.length ?? 0}
          hint="Próximos 7 dias"
          icon={AlertTriangle}
          tone={(expiringCampaigns?.length ?? 0) > 0 ? "danger" : "default"}
        />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Campanhas próximas do vencimento</CardTitle>
            <CardDescription>Renove ou pause antes que saiam do ar.</CardDescription>
          </CardHeader>
          <CardContent>
            {expiringCampaigns && expiringCampaigns.length > 0 ? (
              <ul className="space-y-3">
                {expiringCampaigns.map((c: { id: string; name: string; ends_at: string | null; units?: { name: string } | { name: string }[] | null }) => {
                  const unitName = Array.isArray(c.units) ? c.units[0]?.name : c.units?.name;
                  return (
                  <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{unitName ?? "—"}</p>
                    </div>
                    <Badge variant="warning">
                      {c.ends_at ? formatDate(c.ends_at as string) : "—"}
                    </Badge>
                  </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma campanha vencendo nos próximos 7 dias 🎉
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimos leads de parceiros</CardTitle>
            <CardDescription>Comerciantes querendo entrar na rede.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentLeads && recentLeads.length > 0 ? (
              <ul className="space-y-3">
                {recentLeads.map((l: { id: string; business_name: string; segment: string | null; status: string; created_at: string }) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{l.business_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {l.segment ?? "Sem segmento"} · {formatDate(l.created_at)}
                      </p>
                    </div>
                    <Badge variant={l.status === "novo" ? "warning" : "secondary"}>
                      {l.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Ainda sem leads. Compartilhe o QR Code de &quot;quero ser parceiro&quot;.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Image as ImageIcon, FilePlus, Send, Eye, CheckCircle,
  AlertCircle, Sparkles, Gift,
} from "lucide-react";
import { PageHeader } from "@mi/components/admin/page-header";
import { StatCard } from "@mi/components/admin/stat-card";
import { Card, CardContent } from "@mi/components/ui/card";
import { Button } from "@mi/components/ui/button";
import { Badge } from "@mi/components/ui/badge";
import { requirePartnerUser } from "@mi/lib/partner-auth";
import { createClient } from "@mi/lib/supabase/server";

export const metadata = { title: "Dashboard" };

export default async function PartnerDashboardPage() {
  const { profile, partner } = await requirePartnerUser();

  // Sem cadastro: leva direto pro wizard em vez de mostrar tela intermediária
  if (!partner) {
    redirect("/parceiro/cadastro");
  }

  // Estatísticas
  const supabase = await createClient();
  const [offersRes, bannersRes, qrClicks] = await Promise.all([
    supabase
      .from("mi_offers")
      .select("*", { count: "exact", head: true })
      .eq("partner_id", partner.id),
    supabase
      .from("mi_editor_templates")
      .select("*", { count: "exact", head: true })
      .eq("partner_id", partner.id),
    supabase
      .from("mi_qr_clicks")
      .select("qr_codes!inner(partner_id)", { count: "exact", head: true })
      .eq("qr_codes.partner_id", partner.id),
  ]);
  const banners = { count: bannersRes.count ?? 0 };

  const isPending = partner.status === "pendente";

  return (
    <>
      <PageHeader
        title={`Olá, ${(profile.full_name ?? partner.name).split(" ")[0]} 👋`}
        description="Acompanhe seus banners, campanhas e benefícios do clube."
        actions={
          <Badge variant={partner.status === "ativo" ? "success" : "warning"}>
            Status: {partner.status}
          </Badge>
        }
      />

      {isPending && (
        <Card className="mb-6 border-amber-500/30 bg-amber-50">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Cadastro em análise</p>
              <p className="mt-0.5 text-amber-800/80">
                Nossa equipe está revisando seu cadastro. Você receberá um e-mail assim
                que for aprovado e poderá começar a criar banners.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Banners criados"
          value={banners.count ?? 0}
          icon={ImageIcon}
          tone="brand"
        />
        <StatCard
          label="Ofertas no clube"
          value={offersRes.count ?? 0}
          icon={Gift}
          tone="warning"
        />
        <StatCard
          label="Cliques no QR (30d)"
          value={qrClicks.count ?? 0}
          icon={Eye}
          tone="success"
        />
        <StatCard
          label="Em exibição na TV"
          value={0}
          hint="Ative campanhas para começar"
          icon={Send}
          tone="default"
        />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <FilePlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Criar novo banner</h3>
                <p className="text-xs text-muted-foreground">
                  Escolha um template e edite com seu conteúdo
                </p>
              </div>
            </div>
            <Button asChild className="w-full" disabled={isPending}>
              <Link href="/parceiro/banners/novo">
                <Sparkles className="h-4 w-4" />
                Começar criação
              </Link>
            </Button>
            {isPending && (
              <p className="text-xs text-muted-foreground">
                Aguarde aprovação do cadastro para criar banners.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Clube de Benefícios</h3>
                <p className="text-xs text-muted-foreground">
                  Cadastre ofertas exclusivas para clientes Xô Varal
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="w-full" disabled={isPending}>
              <Link href="/parceiro/beneficios/novo">
                Adicionar benefício
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardContent className="p-5">
          <div className="flex items-start gap-3 text-sm">
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div>
              <p className="font-medium">Como funciona a rede</p>
              <p className="mt-1 text-muted-foreground">
                Você cria banners → nossa equipe aprova → eles passam nas TVs Xô Varal.
                Cada banner tem um QR Code rastreável: você sabe quantos clientes vieram
                da campanha. Em troca, oferecemos seus benefícios pra clientes da Xô Varal
                que escaneiam o QR.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

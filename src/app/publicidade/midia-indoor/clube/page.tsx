import Link from "next/link";
import { Gift, ArrowRight, Sparkles } from "lucide-react";
import { PageHeader } from "@mi/components/admin/page-header";
import { Card, CardContent } from "@mi/components/ui/card";
import { Button } from "@mi/components/ui/button";
import { Badge } from "@mi/components/ui/badge";
import { requireUser } from "@mi/lib/auth";
import { createClient } from "@mi/lib/supabase/server";

export const metadata = { title: "Clube de Benefícios" };
export const dynamic = "force-dynamic";

export default async function ClubeAdminPage() {
  await requireUser();
  const supabase = await createClient();

  const [partnersRes, offersRes] = await Promise.all([
    supabase
      .from("mi_partners")
      .select("*", { count: "exact", head: true })
      .eq("status", "ativo"),
    supabase
      .from("mi_offers")
      .select("*", { count: "exact", head: true })
      .eq("status", "ativa"),
  ]);

  return (
    <>
      <PageHeader
        title="Clube de Benefícios"
        description="Ofertas e descontos exclusivos que os parceiros oferecem aos clientes Xô Varal."
        actions={
          <Badge variant="warning">Em construção</Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Parceiros ativos
            </p>
            <p className="mt-1 text-3xl font-bold">{partnersRes.count ?? 0}</p>
            <Button asChild variant="link" size="sm" className="mt-2 p-0">
              <Link href="/publicidade/midia-indoor/parceiros">
                Gerenciar
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Ofertas ativas
            </p>
            <p className="mt-1 text-3xl font-bold">{offersRes.count ?? 0}</p>
            <Button asChild variant="link" size="sm" className="mt-2 p-0">
              <Link href="/publicidade/midia-indoor/ofertas">
                Gerenciar
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-dashed bg-muted/30">
          <CardContent className="p-5">
            <Sparkles className="h-5 w-5 text-primary" />
            <p className="mt-2 text-sm font-medium">Próximo passo</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Vamos separar o Clube de Vantagens (Xô Varal → clientes) do Clube de
              Benefícios (parceiros → clientes Xô Varal) na FASE 3.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Gift className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold">Como funciona o Clube</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>• Parceiros aprovados publicam ofertas exclusivas para clientes Xô Varal.</li>
                <li>• Cada oferta gera um QR Code rastreável que entra automaticamente nas TVs das lavanderias.</li>
                <li>• O cliente escaneia o QR e é levado direto pra oferta, com cupom.</li>
                <li>• Você acompanha leads, scans e conversões nas Métricas.</li>
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link href="/publicidade/midia-indoor/parceiros">Aprovar parceiros</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/publicidade/midia-indoor/ofertas">Ver ofertas</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/publicidade/midia-indoor/metricas">Ver métricas</Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

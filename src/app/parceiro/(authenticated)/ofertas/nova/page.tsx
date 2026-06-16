import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { PageHeader } from "@mi/components/admin/page-header";
import { Button } from "@mi/components/ui/button";
import { Card, CardContent } from "@mi/components/ui/card";
import { requirePartnerUser } from "@mi/lib/partner-auth";
import { createClient } from "@mi/lib/supabase/server";
import { OfferForm } from "./offer-form";

export const metadata = { title: "Nova oferta" };

export default async function NovaOfertaParceiroPage() {
  const { partner } = await requirePartnerUser();

  if (!partner) redirect("/parceiro/cadastro");
  if (partner.status !== "ativo") {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm">
          <p className="font-semibold">Cadastro em análise</p>
          <p className="mt-1 text-muted-foreground">
            Você poderá criar ofertas assim que sua conta for aprovada pela equipe.
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/parceiro/ofertas">Voltar</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("mi_offers")
    .select("*", { count: "exact", head: true })
    .eq("partner_id", partner.id)
    .in("status", ["ativa", "inativa"]);

  if ((count ?? 0) >= 5) redirect("/parceiro/ofertas");

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/parceiro/ofertas">
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </Link>
      </Button>

      <PageHeader
        title="Criar nova oferta"
        description="Preencha os campos abaixo. Vamos gerar banner + QR Code automaticamente."
      />

      <Card className="mb-4 border-primary/30 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="text-primary">
            <p className="font-semibold">Ao salvar, criamos pra você:</p>
            <ul className="mt-1 ml-4 list-disc text-primary/80">
              <li>QR Code rastreável (mede cada scan)</li>
              <li>Banner 16:9 pronto pra TV (você pode editar depois)</li>
              <li>Página pública da oferta no Clube de Benefícios</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <OfferForm />
        </CardContent>
      </Card>
    </div>
  );
}

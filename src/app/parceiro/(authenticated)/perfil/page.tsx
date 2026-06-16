import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { PageHeader } from "@mi/components/admin/page-header";
import { Button } from "@mi/components/ui/button";
import { Card, CardContent } from "@mi/components/ui/card";
import { Badge } from "@mi/components/ui/badge";
import { requirePartnerUser } from "@mi/lib/partner-auth";
import { PerfilForm } from "./perfil-form";

export const metadata = { title: "Meu perfil" };

export default async function ParceiroPerfilPage() {
  const { partner, profile } = await requirePartnerUser();

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

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Meu perfil"
        description="Edite os dados que aparecem para clientes no clube."
        actions={
          <Badge variant={partner.status === "ativo" ? "success" : "warning"}>
            {partner.status}
          </Badge>
        }
      />

      <Card className="mb-4">
        <CardContent className="p-4 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">Login:</strong> {profile.email} ·{" "}
            <strong className="text-foreground">Categoria:</strong> {partner.category_id ? "definida no cadastro" : "—"}
          </p>
          <p className="mt-1">
            <strong className="text-foreground">CNPJ:</strong> {partner.cnpj ?? "—"} ·{" "}
            <strong className="text-foreground">Razão social:</strong> {partner.legal_name ?? "—"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <PerfilForm partner={partner} />
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { Image as ImageIcon, Plus, ExternalLink, AlertCircle, Sparkles } from "lucide-react";
import { PageHeader } from "@mi/components/admin/page-header";
import { Button } from "@mi/components/ui/button";
import { Badge } from "@mi/components/ui/badge";
import { Card, CardContent } from "@mi/components/ui/card";
import { requirePartnerUser } from "@mi/lib/partner-auth";
import { createClient } from "@mi/lib/supabase/server";
import { rowToTemplate } from "@/app/publicidade/midia-indoor/templates/_components/row-to-template";
import { TemplatePreview } from "@/app/publicidade/midia-indoor/templates/_components/template-preview";
import { formatDate } from "@mi/lib/utils";

export const metadata = { title: "Meus banners" };

export default async function ParceiroBannersPage() {
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

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("mi_editor_templates")
    .select("*")
    .eq("partner_id", partner.id)
    .order("updated_at", { ascending: false });

  const banners = (rows ?? []).map((r) => rowToTemplate(r as Record<string, unknown>));

  return (
    <>
      <PageHeader
        title="Meus banners"
        description="Banners gerados automaticamente a partir das suas ofertas. Edite ou personalize quando quiser."
        actions={
          partner.status === "ativo" && (
            <Button asChild>
              <Link href="/parceiro/ofertas/nova">
                <Plus className="h-4 w-4" />
                Nova oferta (gera banner)
              </Link>
            </Button>
          )
        }
      />

      {banners.length === 0 ? (
        <Card className="p-8 text-center">
          <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-2 font-semibold">Nenhum banner ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie sua primeira oferta — vamos gerar um banner pronto pra TV automaticamente.
          </p>
          <Button asChild className="mt-4" disabled={partner.status !== "ativo"}>
            <Link href="/parceiro/ofertas/nova">
              <Sparkles className="h-4 w-4" />
              Criar primeira oferta
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {banners.map((b) => (
            <Card key={b.id} className="overflow-hidden">
              <div
                className="relative w-full bg-black"
                style={{ aspectRatio: b.format === "horizontal" ? "16/9" : "9/16" }}
              >
                <TemplatePreview template={b} />
                <div className="absolute right-2 top-2">
                  {b.isPublished ? (
                    <Badge variant="success" className="text-[10px]">No ar</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px]">Rascunho</Badge>
                  )}
                </div>
              </div>
              <CardContent className="p-3">
                <p className="truncate text-sm font-semibold">{b.name}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {b.format === "horizontal" ? "16:9" : "9:16"} · {formatDate(b.updatedAt)}
                </p>
                <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                  <Link href={`/templates/${b.id}`} target="_blank">
                    <ExternalLink className="h-3 w-3" />
                    Abrir editor
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-4 p-4">
        <p className="flex items-center gap-2 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Como criar banners
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Você não cria banners diretamente — eles são gerados automaticamente quando você
          cria uma oferta. Cada oferta vira 1 banner pronto pra TV. Pra editar, clique em
          &quot;Abrir editor&quot;.
        </p>
      </Card>
    </>
  );
}

import Link from "next/link";
import { Plus, LayoutTemplate, Send, Eye } from "lucide-react";
import { PageHeader } from "@mi/components/admin/page-header";
import { Button } from "@mi/components/ui/button";
import { Badge } from "@mi/components/ui/badge";
import { Card } from "@mi/components/ui/card";
import { createClient } from "@mi/lib/supabase/server";
import { requireUser } from "@mi/lib/auth";
import { formatDate } from "@mi/lib/utils";
import { TemplatePreview } from "./_components/template-preview";
import { rowToTemplate } from "./_components/row-to-template";
import { TemplateRowActions } from "./template-row-actions";

export const metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  let query = supabase.from("mi_editor_templates").select("*").order("updated_at", { ascending: false });
  if (profile.role !== "master" && profile.unidade_id) {
    query = query.eq("unidade_id", profile.unidade_id);
  }
  const { data: rows } = await query;

  const templates = (rows ?? []).map((r) => rowToTemplate(r as Record<string, unknown>));

  return (
    <>
      <PageHeader
        title="Templates do editor"
        description="Crie peças visuais para a TV com o editor Canva-style. Suporta 16:9 e 9:16."
        actions={
          <Button asChild>
            <Link href="/publicidade/midia-indoor/templates/novo">
              <Plus className="h-4 w-4" />
              Novo template
            </Link>
          </Button>
        }
      />

      {templates.length === 0 ? (
        <Card className="p-12 text-center">
          <LayoutTemplate className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-semibold">Nenhum template ainda</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie seu primeiro template — comece com um modelo pronto ou do zero.
          </p>
          <Button asChild className="mt-6">
            <Link href="/publicidade/midia-indoor/templates/novo">
              <Plus className="h-4 w-4" />
              Criar primeiro template
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="group overflow-hidden transition-shadow hover:shadow-lg">
              <Link href={`/publicidade/midia-indoor/templates/${tpl.id}`}>
                <div
                  className="relative w-full overflow-hidden bg-black"
                  style={{ aspectRatio: tpl.format === "horizontal" ? "16/9" : "9/16" }}
                >
                  <TemplatePreview template={tpl} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="absolute right-2 top-2 flex gap-1">
                    {tpl.isPublished ? (
                      <Badge variant="success" className="text-[10px]">
                        <Send className="mr-0.5 h-2.5 w-2.5" />
                        Publicado
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Rascunho</Badge>
                    )}
                  </div>
                </div>
              </Link>
              <div className="flex items-start justify-between gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/publicidade/midia-indoor/templates/${tpl.id}`}
                    className="block truncate text-sm font-semibold hover:text-primary"
                  >
                    {tpl.name}
                  </Link>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {tpl.format === "horizontal" ? "16:9" : "9:16"} · {formatDate(tpl.updatedAt)}
                  </p>
                </div>
                <TemplateRowActions templateId={tpl.id} isPublished={tpl.isPublished} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

import { Inbox } from "lucide-react";
import { PageHeader } from "@mi/components/admin/page-header";
import { Badge } from "@mi/components/ui/badge";
import { Card } from "@mi/components/ui/card";
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
import { formatDate, whatsappLink } from "@mi/lib/utils";
import { LeadRowActions } from "./lead-row-actions";
import type { Tables } from "@mi/types/database";

export const metadata = { title: "Leads de parceiros" };

const STATUS_VARIANTS: Record<string, "warning" | "default" | "success" | "destructive"> = {
  novo: "warning",
  em_analise: "default",
  aprovado: "success",
  rejeitado: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  novo: "Novo",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

export default async function LeadsPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  let query = supabase
    .from("mi_partner_leads")
    .select("*, units:mi_units(name, slug)")
    .order("created_at", { ascending: false });

  if (profile.role !== "master" && profile.unidade_id) {
    query = query.eq("unidade_id", profile.unidade_id);
  }

  const { data: leads } = await query;

  type LeadRow = Tables<"partner_leads"> & { units: { name: string; slug: string } | null };

  const totalNovos = (leads as LeadRow[] | null)?.filter((l) => l.status === "novo").length ?? 0;

  return (
    <>
      <PageHeader
        title="Leads de Parceiros"
        description="Comerciantes que se cadastraram via formulário 'Quero ser parceiro'."
        actions={
          totalNovos > 0 ? (
            <Badge variant="warning" className="text-sm">
              {totalNovos} aguardando
            </Badge>
          ) : null
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Negócio</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>WhatsApp</TableHead>
              {profile.role === "master" && <TableHead>Unidade</TableHead>}
              <TableHead>Recebido</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads && leads.length > 0 ? (
              (leads as LeadRow[]).map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <p className="font-medium">{lead.business_name}</p>
                    <p className="text-xs text-muted-foreground">{lead.segment ?? "—"}</p>
                    {lead.benefit_proposal && (
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        Oferece: {lead.benefit_proposal}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{lead.responsible_name}</TableCell>
                  <TableCell>
                    <a
                      href={whatsappLink(
                        lead.whatsapp,
                        `Olá ${lead.responsible_name}, vi o cadastro de ${lead.business_name} no Xô Varal.`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {lead.whatsapp}
                    </a>
                  </TableCell>
                  {profile.role === "master" && (
                    <TableCell className="text-sm">{lead.units?.name ?? "—"}</TableCell>
                  )}
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(lead.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[lead.status] ?? "secondary"}>
                      {STATUS_LABELS[lead.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <LeadRowActions lead={lead} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={profile.role === "master" ? 7 : 6} className="py-12 text-center">
                  <Inbox className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Nenhum lead recebido ainda. Compartilhe o link
                    &ldquo;Quero ser parceiro&rdquo; com comerciantes do bairro.
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

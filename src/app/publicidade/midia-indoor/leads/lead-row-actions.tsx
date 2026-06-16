"use client";

import { useTransition } from "react";
import { MoreVertical, CheckCircle, XCircle, Eye, Trash2, FileText } from "lucide-react";
import { Button } from "@mi/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@mi/components/ui/dropdown-menu";
import { toast } from "sonner";
import { updateLeadStatusAction, deleteLeadAction } from "./actions";
import type { Tables } from "@mi/types/database";

export function LeadRowActions({ lead }: { lead: Tables<"partner_leads"> }) {
  const [pending, startTransition] = useTransition();

  const setStatus = (status: "novo" | "em_analise" | "aprovado" | "rejeitado") =>
    startTransition(async () => {
      try {
        await updateLeadStatusAction(lead.id, status);
        toast.success("Status atualizado");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });

  const remove = () => {
    if (!confirm(`Excluir lead "${lead.business_name}"?`)) return;
    startTransition(async () => {
      try {
        await deleteLeadAction(lead.id);
        toast.success("Excluído");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  const showDetails = () => {
    alert(
      [
        `Negócio: ${lead.business_name}`,
        `Responsável: ${lead.responsible_name}`,
        `WhatsApp: ${lead.whatsapp}`,
        `Segmento: ${lead.segment ?? "—"}`,
        `Instagram: ${lead.instagram ?? "—"}`,
        `Endereço: ${lead.address ?? "—"}`,
        ``,
        `Proposta: ${lead.benefit_proposal ?? "—"}`,
        ``,
        `Mensagem: ${lead.message ?? "—"}`,
      ].join("\n"),
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Ações</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={showDetails}>
          <FileText className="h-4 w-4" /> Ver detalhes
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {lead.status !== "em_analise" && (
          <DropdownMenuItem onClick={() => setStatus("em_analise")}>
            <Eye className="h-4 w-4" /> Marcar em análise
          </DropdownMenuItem>
        )}
        {lead.status !== "aprovado" && (
          <DropdownMenuItem onClick={() => setStatus("aprovado")} className="text-emerald-700">
            <CheckCircle className="h-4 w-4" /> Aprovar
          </DropdownMenuItem>
        )}
        {lead.status !== "rejeitado" && (
          <DropdownMenuItem onClick={() => setStatus("rejeitado")} className="text-muted-foreground">
            <XCircle className="h-4 w-4" /> Rejeitar
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={remove} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4" /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

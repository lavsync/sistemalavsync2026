"use client";

import { useTransition } from "react";
import Link from "next/link";
import { MoreVertical, Pencil, CheckCircle, Pause, Play, Trash2 } from "lucide-react";
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
import {
  approvePartnerAction,
  togglePartnerStatusAction,
  deletePartnerAction,
} from "./actions";
import type { Tables } from "@mi/types/database";

export function PartnerRowActions({ partner }: { partner: Tables<"partners"> }) {
  const [pending, startTransition] = useTransition();

  const approve = () =>
    startTransition(async () => {
      try {
        await approvePartnerAction(partner.id);
        toast.success("Parceiro aprovado e ativado");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });

  const toggle = () =>
    startTransition(async () => {
      try {
        await togglePartnerStatusAction(partner.id, partner.status);
        toast.success(partner.status === "ativo" ? "Pausado" : "Reativado");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });

  const remove = () => {
    if (!confirm(`Excluir parceiro "${partner.name}"?`)) return;
    startTransition(async () => {
      try {
        await deletePartnerAction(partner.id);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
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
        <DropdownMenuItem asChild>
          <Link href={`/publicidade/midia-indoor/parceiros/${partner.id}`}>
            <Pencil className="h-4 w-4" /> Editar
          </Link>
        </DropdownMenuItem>
        {partner.status === "pendente" && (
          <DropdownMenuItem onClick={approve} className="text-emerald-700">
            <CheckCircle className="h-4 w-4" /> Aprovar e ativar
          </DropdownMenuItem>
        )}
        {(partner.status === "ativo" || partner.status === "pausado") && (
          <DropdownMenuItem onClick={toggle}>
            {partner.status === "ativo" ? (
              <>
                <Pause className="h-4 w-4" /> Pausar
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Reativar
              </>
            )}
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

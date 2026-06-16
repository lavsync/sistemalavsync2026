"use client";

import { useTransition } from "react";
import { MoreVertical, Pause, Play, Trash2 } from "lucide-react";
import { Button } from "@mi/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@mi/components/ui/dropdown-menu";
import { toast } from "sonner";
import { togglePartnerOfferAction, deletePartnerOfferAction } from "./actions";

export function OfferRowActions({ offerId, status }: { offerId: string; status: string }) {
  const [pending, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      try {
        await togglePartnerOfferAction(offerId);
        toast.success(status === "ativa" ? "Pausada" : "Ativada");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });

  const remove = () => {
    if (!confirm("Excluir esta oferta? Isso também remove o QR Code e o banner gerado.")) return;
    startTransition(async () => {
      try {
        await deletePartnerOfferAction(offerId);
        toast.success("Excluída");
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
        <DropdownMenuItem onClick={toggle}>
          {status === "ativa" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {status === "ativa" ? "Pausar" : "Ativar"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={remove} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

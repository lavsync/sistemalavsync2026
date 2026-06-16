"use client";

import { useTransition } from "react";
import Link from "next/link";
import { MoreVertical, Pencil, Pause, Play, Trash2 } from "lucide-react";
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
import { toggleCampaignStatusAction, deleteCampaignAction } from "./actions";
import type { Tables } from "@mi/types/database";

export function CampaignRowActions({ campaign }: { campaign: Tables<"campaigns"> }) {
  const [pending, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      try {
        await toggleCampaignStatusAction(campaign.id, campaign.status);
        toast.success("Status atualizado");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });

  const remove = () => {
    if (!confirm(`Excluir campanha "${campaign.name}"?`)) return;
    startTransition(async () => {
      try {
        await deleteCampaignAction(campaign.id);
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
          <Link href={`/publicidade/midia-indoor/campanhas/${campaign.id}`}>
            <Pencil className="h-4 w-4" /> Editar
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggle}>
          {campaign.status === "ativa" ? (
            <>
              <Pause className="h-4 w-4" /> Pausar
            </>
          ) : (
            <>
              <Play className="h-4 w-4" /> Ativar
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={remove} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4" /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

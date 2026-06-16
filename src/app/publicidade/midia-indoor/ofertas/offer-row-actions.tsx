"use client";

import { useTransition } from "react";
import Link from "next/link";
import { MoreVertical, Pencil, Star, Pause, Play, Trash2 } from "lucide-react";
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
  toggleOfferFeaturedAction,
  toggleOfferStatusAction,
  deleteOfferAction,
} from "./actions";
import type { Tables } from "@mi/types/database";

export function OfferRowActions({ offer }: { offer: Tables<"offers"> }) {
  const [pending, startTransition] = useTransition();

  const toggleFeatured = () =>
    startTransition(async () => {
      try {
        await toggleOfferFeaturedAction(offer.id, offer.is_featured);
        toast.success(offer.is_featured ? "Destaque removido" : "Marcado como destaque");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });

  const toggleStatus = () =>
    startTransition(async () => {
      try {
        await toggleOfferStatusAction(offer.id, offer.status);
        toast.success(offer.status === "ativa" ? "Pausada" : "Ativada");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });

  const remove = () => {
    if (!confirm(`Excluir oferta "${offer.title}"?`)) return;
    startTransition(async () => {
      try {
        await deleteOfferAction(offer.id);
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
          <Link href={`/publicidade/midia-indoor/ofertas/${offer.id}`}>
            <Pencil className="h-4 w-4" /> Editar
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleFeatured}>
          <Star className="h-4 w-4" /> {offer.is_featured ? "Remover destaque" : "Marcar destaque"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleStatus}>
          {offer.status === "ativa" ? (
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

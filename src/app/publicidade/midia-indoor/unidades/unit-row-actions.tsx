"use client";

import { useTransition } from "react";
import Link from "next/link";
import { MoreVertical, Copy, RefreshCw, Pencil, Pause, Play, Trash2 } from "lucide-react";
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
  toggleUnitActiveAction,
  regenerateUnitTokenAction,
  deleteUnitAction,
} from "./actions";
import type { Tables } from "@mi/types/database";

interface UnitRowActionsProps {
  unit: Tables<"units">;
  canManage: boolean;
  playerUrl: string;
  clubeUrl: string;
}

export function UnitRowActions({ unit, canManage, playerUrl, clubeUrl }: UnitRowActionsProps) {
  const [pending, startTransition] = useTransition();

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const togglePause = () => {
    startTransition(async () => {
      try {
        await toggleUnitActiveAction(unit.id, unit.is_active);
        toast.success(unit.is_active ? "Unidade pausada" : "Unidade ativada");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  const regenerateToken = () => {
    if (!confirm("Regenerar token vai invalidar o player atual da TV. Continuar?")) return;
    startTransition(async () => {
      try {
        await regenerateUnitTokenAction(unit.id);
        toast.success("Token regenerado — atualize o player na TV");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  const remove = () => {
    if (!confirm(`Excluir unidade "${unit.name}"? Esta ação não pode ser desfeita.`)) return;
    startTransition(async () => {
      try {
        await deleteUnitAction(unit.id);
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
          <Link href={`/publicidade/midia-indoor/unidades/${unit.id}`}>
            <Pencil className="h-4 w-4" /> Editar dados
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copy(playerUrl, "URL do player")}>
          <Copy className="h-4 w-4" /> Copiar URL do player
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copy(clubeUrl, "URL do clube")}>
          <Copy className="h-4 w-4" /> Copiar URL do clube
        </DropdownMenuItem>
        {canManage && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={togglePause}>
              {unit.is_active ? (
                <>
                  <Pause className="h-4 w-4" /> Pausar unidade
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Ativar unidade
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={regenerateToken}>
              <RefreshCw className="h-4 w-4" /> Regenerar token do player
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={remove}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" /> Excluir unidade
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

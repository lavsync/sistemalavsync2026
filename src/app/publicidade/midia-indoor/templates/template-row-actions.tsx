"use client";

import { useTransition } from "react";
import Link from "next/link";
import { MoreVertical, Pencil, Copy, Send, EyeOff, Trash2 } from "lucide-react";
import { Button } from "@mi/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@mi/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  duplicateTemplateAction, publishTemplateAction,
  unpublishTemplateAction, deleteTemplateAction,
} from "./actions";

export function TemplateRowActions({ templateId, isPublished }: { templateId: string; isPublished: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const dup = () =>
    startTransition(async () => {
      const res = await duplicateTemplateAction(templateId);
      if (res?.ok) {
        toast.success("Duplicado");
        if (res.id) router.push(`/publicidade/midia-indoor/templates/${res.id}`);
      } else if (res) {
        toast.error(res.error);
      }
    });

  const togglePublish = () =>
    startTransition(async () => {
      const res = isPublished
        ? await unpublishTemplateAction(templateId)
        : await publishTemplateAction(templateId);
      if (res?.ok) toast.success(isPublished ? "Despublicado" : "Publicado");
      else if (res) toast.error(res.error);
    });

  const remove = () => {
    if (!confirm("Excluir este template?")) return;
    startTransition(async () => {
      try {
        await deleteTemplateAction(templateId);
        toast.success("Excluído");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={pending} className="h-8 w-8 shrink-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Ações</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/publicidade/midia-indoor/templates/${templateId}`}>
            <Pencil className="h-4 w-4" /> Editar
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={dup}>
          <Copy className="h-4 w-4" /> Duplicar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={togglePublish}>
          {isPublished ? <EyeOff className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {isPublished ? "Despublicar" : "Publicar"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={remove} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4" /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

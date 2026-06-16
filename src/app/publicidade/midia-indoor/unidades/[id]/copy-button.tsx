"use client";

import { Copy } from "lucide-react";
import { Button } from "@mi/components/ui/button";
import { toast } from "sonner";

export function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        navigator.clipboard.writeText(text);
        toast.success(`Link do ${label} copiado`);
      }}
    >
      <Copy className="h-3 w-3" />
    </Button>
  );
}

"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@mi/components/ui/button";
import { toast } from "sonner";

export function CopyCoupon({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success(`Cupom ${code} copiado!`);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Button
      onClick={copy}
      size="lg"
      variant="brand"
      className="font-mono"
    >
      {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
      Cupom {code}
    </Button>
  );
}

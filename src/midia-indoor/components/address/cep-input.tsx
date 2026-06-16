"use client";

import { useRef, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Input } from "@mi/components/ui/input";
import { toast } from "sonner";
import { cn } from "@mi/lib/utils";

export interface CepAddress {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

async function fetchCep(cep: string): Promise<CepAddress | null> {
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.erro) return null;
  return {
    cep: data.cep ?? "",
    logradouro: data.logradouro ?? "",
    bairro: data.bairro ?? "",
    localidade: data.localidade ?? "",
    uf: data.uf ?? "",
  };
}

/**
 * Preenche inputs não-controlados (defaultValue) direto no DOM.
 * Mapa: id do input → valor. Ignora ids inexistentes na página.
 */
export function fillAddressInputs(values: Record<string, string>) {
  for (const [id, value] of Object.entries(values)) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el && value) {
      el.value = value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
}

interface CepInputProps {
  id?: string;
  /** name do campo no form. Omita pra não enviar o CEP no submit. */
  name?: string;
  defaultValue?: string;
  /** Modo controlado (ex.: wizard). */
  value?: string;
  onValueChange?: (masked: string) => void;
  /** Chamado quando o ViaCEP retorna endereço. */
  onResult?: (addr: CepAddress) => void;
  /** Atalho pra forms não-controlados: ids dos inputs a preencher. */
  fillIds?: {
    address?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  };
  placeholder?: string;
  className?: string;
}

/**
 * Input de CEP com máscara 00000-000 e busca automática no ViaCEP
 * ao completar 8 dígitos. Preenche endereço, bairro, cidade e UF.
 */
export function CepInput({
  id = "cep",
  name,
  defaultValue,
  value,
  onValueChange,
  onResult,
  fillIds,
  placeholder = "30000-000",
  className,
}: CepInputProps) {
  const [internal, setInternal] = useState(formatCep(defaultValue ?? ""));
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState(false);
  const lastLookup = useRef("");

  const controlled = value !== undefined;
  const current = controlled ? value : internal;

  const handleChange = async (raw: string) => {
    const masked = formatCep(raw);
    if (controlled) onValueChange?.(masked);
    else setInternal(masked);
    setFound(false);

    const digits = masked.replace(/\D/g, "");
    if (digits.length !== 8 || digits === lastLookup.current) return;
    lastLookup.current = digits;

    setLoading(true);
    try {
      const addr = await fetchCep(digits);
      if (!addr) {
        toast.error("CEP não encontrado. Confira e preencha o endereço manualmente.");
        return;
      }
      setFound(true);
      if (fillIds) {
        fillAddressInputs({
          ...(fillIds.address ? { [fillIds.address]: addr.logradouro } : {}),
          ...(fillIds.neighborhood ? { [fillIds.neighborhood]: addr.bairro } : {}),
          ...(fillIds.city ? { [fillIds.city]: addr.localidade } : {}),
          ...(fillIds.state ? { [fillIds.state]: addr.uf } : {}),
        });
      }
      onResult?.(addr);
    } catch {
      toast.error("Falha ao buscar o CEP. Preencha o endereço manualmente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        inputMode="numeric"
        autoComplete="postal-code"
        placeholder={placeholder}
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className={cn("pr-9", className)}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : found ? (
          <Check className="h-4 w-4 text-emerald-600" />
        ) : null}
      </span>
    </div>
  );
}

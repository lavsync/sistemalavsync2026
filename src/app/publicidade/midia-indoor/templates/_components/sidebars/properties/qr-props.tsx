"use client";

import { useEffect, useState } from "react";
import { Link2, RefreshCw, Search, Loader2 } from "lucide-react";
import { useEditorStore } from "@mi/stores/editor-store";
import type { QrCodeElement, QrSource } from "@mi/types/editor";
import { FieldLabel, PropSection, TextInput, NumberInput, ColorInput, SelectInput } from "./shared";
import { QR_SOURCE_LABELS, resolveQrUrl } from "../../qr-helpers";
import { cn } from "@mi/lib/utils";

interface QrLibraryItem {
  id: string;
  shortCode: string;
  shortUrl: string;
  purpose: string;
  label: string;
  detail: string;
  utmCampaign: string | null;
  createdAt: string;
}

export function QrProperties({ element }: { element: QrCodeElement }) {
  const update = useEditorStore((s) => s.updateElement);
  const patch = (p: Partial<QrCodeElement>) => update(element.id, p);

  const meta = QR_SOURCE_LABELS[element.source];
  const resolved = resolveQrUrl(element.source, element.value, element.utmCampaign);

  // Biblioteca de QR codes do sistema
  const [libOpen, setLibOpen] = useState(false);
  const [libItems, setLibItems] = useState<QrLibraryItem[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [libSearch, setLibSearch] = useState("");
  const [libFilter, setLibFilter] = useState<string>("");

  const fetchLibrary = async () => {
    setLibLoading(true);
    try {
      const params = new URLSearchParams();
      if (libFilter) params.set("purpose", libFilter);
      if (libSearch) params.set("q", libSearch);
      const res = await fetch(`/api/qr-codes/list?${params.toString()}`);
      const data = await res.json();
      if (res.ok) setLibItems(data.items ?? []);
    } catch {
      setLibItems([]);
    } finally {
      setLibLoading(false);
    }
  };

  useEffect(() => {
    if (libOpen) fetchLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libOpen, libFilter]);

  // Debounce search
  useEffect(() => {
    if (!libOpen) return;
    const id = window.setTimeout(fetchLibrary, 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libSearch]);

  const useFromLibrary = (item: QrLibraryItem) => {
    patch({
      source: "custom",
      value: item.shortUrl,
      utmCampaign: item.utmCampaign ?? undefined,
      label: element.label || item.label,
    });
    setLibOpen(false);
  };

  return (
    <>
      <PropSection title="Origem do QR Code">
        {/* Biblioteca: usar QR já criado */}
        <button
          type="button"
          onClick={() => setLibOpen(!libOpen)}
          className={cn(
            "flex w-full items-center justify-between rounded-md border px-3 py-2 text-xs transition-colors",
            libOpen
              ? "border-primary bg-primary/10 text-primary"
              : "border-white/15 bg-white/5 text-white hover:bg-white/10",
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <Link2 className="h-3 w-3" />
            Usar QR já criado (oferta/parceiro)
          </span>
          <span className="text-[10px] opacity-70">{libOpen ? "▼" : "▶"}</span>
        </button>

        {libOpen && (
          <div className="rounded-md border border-white/10 bg-black/30 p-2">
            <div className="mb-2 flex gap-1">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/40" />
                <input
                  value={libSearch}
                  onChange={(e) => setLibSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full rounded bg-white/5 py-1 pl-7 pr-2 text-[11px] text-white outline-none ring-1 ring-white/10 focus:ring-primary"
                />
              </div>
              <select
                value={libFilter}
                onChange={(e) => setLibFilter(e.target.value)}
                className="rounded bg-white/5 px-2 py-1 text-[11px] text-white outline-none ring-1 ring-white/10 focus:ring-primary"
              >
                <option value="">Todos</option>
                <option value="oferta">Ofertas</option>
                <option value="parceiro">Parceiros</option>
                <option value="clube-beneficios">Clube</option>
                <option value="campanha">Campanhas</option>
              </select>
              <button
                type="button"
                onClick={fetchLibrary}
                className="rounded bg-white/5 p-1 text-white/60 hover:bg-white/10 hover:text-white"
                title="Atualizar"
              >
                <RefreshCw className={cn("h-3 w-3", libLoading && "animate-spin")} />
              </button>
            </div>

            {libLoading && libItems.length === 0 && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            )}

            {!libLoading && libItems.length === 0 && (
              <p className="py-3 text-center text-[11px] text-white/40">
                Nenhum QR Code criado ainda. Crie uma oferta primeiro.
              </p>
            )}

            <div className="max-h-64 space-y-1 overflow-y-auto scrollbar-thin">
              {libItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => useFromLibrary(item)}
                  className="block w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-left transition-colors hover:border-primary hover:bg-primary/10"
                >
                  <p className="truncate text-[11px] font-semibold text-white">{item.label}</p>
                  <p className="mt-0.5 text-[9px] text-white/40">
                    {item.purpose} · /qr/{item.shortCode.slice(0, 8)}...
                  </p>
                </button>
              ))}
            </div>

            <p className="mt-2 text-[9px] text-white/40">
              💡 Os QR Codes de ofertas são criados automaticamente quando você cadastra uma oferta.
            </p>
          </div>
        )}

        <div className="border-t border-white/10 pt-3">
          <FieldLabel>Tipo manual</FieldLabel>
          <SelectInput
            value={element.source}
            onChange={(v) => patch({ source: v as QrSource })}
            options={Object.entries(QR_SOURCE_LABELS).map(([value, m]) => ({ value, label: m.label }))}
          />

          <FieldLabel>{meta.label} *</FieldLabel>
          <TextInput
            value={element.value}
            onChange={(value) => patch({ value })}
            placeholder={meta.placeholder}
          />
          <p className="text-[10px] text-white/40">{meta.helper}</p>

          <FieldLabel>UTM campaign (rastreio)</FieldLabel>
          <TextInput
            value={element.utmCampaign ?? ""}
            onChange={(utmCampaign) => patch({ utmCampaign })}
            placeholder="ex: oferta-relampago-junho"
          />

          {resolved && (
            <div className="mt-2 break-all rounded-md bg-emerald-500/10 p-2 text-[10px] text-emerald-300">
              <span className="font-bold">URL final:</span>
              <br />
              {resolved}
            </div>
          )}
        </div>
      </PropSection>

      <PropSection title="Aparência">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Cor do código</FieldLabel>
            <ColorInput value={element.fgColor} onChange={(fgColor) => patch({ fgColor })} />
          </div>
          <div>
            <FieldLabel>Fundo</FieldLabel>
            <ColorInput value={element.bgColor} onChange={(bgColor) => patch({ bgColor })} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Nível correção</FieldLabel>
            <SelectInput
              value={element.level}
              onChange={(v) => patch({ level: v as "L" | "M" | "Q" | "H" })}
              options={[
                { value: "L", label: "L (7%)" },
                { value: "M", label: "M (15%)" },
                { value: "Q", label: "Q (25%)" },
                { value: "H", label: "H (30%)" },
              ]}
            />
          </div>
          <div>
            <FieldLabel>Margem</FieldLabel>
            <NumberInput value={element.margin} onChange={(margin) => patch({ margin })} min={0} max={10} suffix="x" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={element.pulse ?? false}
            onChange={(e) => patch({ pulse: e.target.checked })}
            className="h-4 w-4 rounded border-white/20"
          />
          Pulsar (chama atenção)
        </label>
      </PropSection>

      <PropSection title="Etiqueta (abaixo do QR)">
        <FieldLabel>Texto</FieldLabel>
        <TextInput
          value={element.label ?? ""}
          onChange={(label) => patch({ label })}
          placeholder="Ex: Aponte a câmera"
        />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Cor</FieldLabel>
            <ColorInput value={element.labelColor ?? element.fgColor} onChange={(labelColor) => patch({ labelColor })} />
          </div>
          <div>
            <FieldLabel>Tamanho</FieldLabel>
            <NumberInput value={element.labelSize ?? 22} onChange={(labelSize) => patch({ labelSize })} min={10} max={60} suffix="px" />
          </div>
        </div>
      </PropSection>
    </>
  );
}

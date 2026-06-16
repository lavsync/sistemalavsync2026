"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, Image as ImageIcon, Film, ExternalLink, AlertCircle } from "lucide-react";
import { useEditorStore } from "@mi/stores/editor-store";
import { createElement } from "../element-factory";
import type { ImageElement, VideoElement } from "@mi/types/editor";
import { toast } from "sonner";
import { PanelHeader } from "./shared";
import { cn } from "@mi/lib/utils";
import type { StockItem } from "@/app/api/midia-indoor/stocks/search/route";

type Tab = "photo" | "video";

const SUGGESTED_QUERIES = [
  "padaria", "café", "academia", "pet", "salão", "comida",
  "lavanderia", "produtos limpeza", "família", "dinheiro",
];

export function StocksPanel() {
  const [tab, setTab] = useState<Tab>("photo");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<StockItem[]>([]);
  const [page, setPage] = useState(1);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);

  const format = useEditorStore((s) => s.format);
  const addElement = useEditorStore((s) => s.addElement);
  const updateElement = useEditorStore((s) => s.updateElement);
  const selectedId = useEditorStore((s) => s.selectedId);
  const elements = useEditorStore((s) => s.elements);
  const canvasWidth = useEditorStore((s) => s.width);
  const canvasHeight = useEditorStore((s) => s.height);

  const orientation = format === "horizontal" ? "landscape" : "portrait";

  const fetchPage = useCallback(
    async (q: string, p: number, append: boolean) => {
      if (!q.trim()) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/stocks/search?q=${encodeURIComponent(q)}&type=${tab}&orientation=${orientation}&page=${p}`,
        );
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 503 && data.helpUrl) {
            setNeedsKey(true);
            setError("API key do Pexels não configurada");
            return;
          }
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setNeedsKey(false);
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setNextPage(data.nextPage);
        setPage(p);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [tab, orientation],
  );

  // Debounce search
  useEffect(() => {
    if (!query) {
      setItems([]);
      setNextPage(null);
      return;
    }
    const id = window.setTimeout(() => fetchPage(query, 1, false), 350);
    return () => window.clearTimeout(id);
  }, [query, fetchPage]);

  // Reset on tab change
  useEffect(() => {
    if (query) fetchPage(query, 1, false);
  }, [tab, orientation]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinelRef.current || !nextPage || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextPage) {
          fetchPage(query, nextPage, true);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [nextPage, loading, query, fetchPage]);

  const useItem = (item: StockItem) => {
    const selected = elements.find((e) => e.id === selectedId);

    // Se elemento selecionado é image/video, atualiza o src
    if (selected) {
      if (item.type === "photo" && (selected.type === "image" || selected.type === "logo" || selected.type === "sticker")) {
        updateElement(selected.id, { src: item.full, alt: item.alt } as Partial<ImageElement>);
        toast.success("Imagem aplicada ao elemento selecionado");
        return;
      }
      if (item.type === "video" && selected.type === "video") {
        updateElement(selected.id, { src: item.full, poster: item.preview } as Partial<VideoElement>);
        toast.success("Vídeo aplicado ao elemento selecionado");
        return;
      }
    }

    // Senão: cria novo elemento centralizado
    if (item.type === "photo") {
      const el = createElement("image", { canvasWidth, canvasHeight }) as ImageElement;
      el.src = item.full;
      el.alt = item.alt;
      addElement(el);
    } else {
      const el = createElement("video", { canvasWidth, canvasHeight }) as VideoElement;
      el.src = item.full;
      el.poster = item.preview;
      addElement(el);
    }
    toast.success(`${item.type === "photo" ? "Foto" : "Vídeo"} adicionado por ${item.author}`);
  };

  return (
    <div>
      <PanelHeader title="Stocks" subtitle="Fotos e vídeos grátis via Pexels" />

      {/* Tabs */}
      <div className="mx-3 mb-3 flex gap-1 rounded-lg bg-white/5 p-1">
        <button
          onClick={() => setTab("photo")}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
            tab === "photo" ? "bg-primary text-primary-foreground" : "text-white/60 hover:text-white",
          )}
        >
          <ImageIcon className="h-3 w-3" /> Fotos
        </button>
        <button
          onClick={() => setTab("video")}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
            tab === "video" ? "bg-primary text-primary-foreground" : "text-white/60 hover:text-white",
          )}
        >
          <Film className="h-3 w-3" /> Vídeos
        </button>
      </div>

      {/* Search */}
      <div className="mx-3 mb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar ${tab === "photo" ? "fotos" : "vídeos"}...`}
            className="w-full rounded-md border-0 bg-white/5 py-1.5 pl-8 pr-2.5 text-xs text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-primary"
          />
        </div>

        {!query && (
          <div className="mt-2 flex flex-wrap gap-1">
            {SUGGESTED_QUERIES.map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
                className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/60 hover:bg-white/10 hover:text-white"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Estados */}
      <div className="px-3 pb-6">
        {needsKey && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <AlertCircle className="mb-2 h-4 w-4" />
            <p className="mb-2 font-semibold">API key não configurada</p>
            <p className="text-amber-200/70">
              Peça pro Daniel cadastrar a key Pexels.
            </p>
            <a
              href="https://www.pexels.com/api/new/"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[11px] underline hover:no-underline"
            >
              Criar key grátis <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        )}

        {error && !needsKey && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </p>
        )}

        {!error && !needsKey && query && items.length === 0 && !loading && (
          <p className="py-8 text-center text-xs text-white/40">Sem resultados</p>
        )}

        {!query && !error && (
          <p className="py-2 text-center text-[11px] text-white/40">
            Digite acima ou clique numa sugestão
          </p>
        )}

        {items.length > 0 && (
          <>
            <p className="mb-2 text-[10px] text-white/40">
              {items.length} {tab === "photo" ? "foto(s)" : "vídeo(s)"} ·{" "}
              {orientation === "landscape" ? "paisagem" : "retrato"}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => useItem(item)}
                  className="group relative overflow-hidden rounded-md bg-black ring-1 ring-white/10 transition-transform hover:scale-105 hover:ring-primary"
                  title={`Por ${item.author}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.preview}
                    alt={item.alt}
                    loading="lazy"
                    className={cn(
                      "w-full object-cover",
                      orientation === "landscape" ? "h-20" : "h-32",
                    )}
                  />
                  {item.type === "video" && (
                    <span className="absolute right-1 top-1 inline-flex items-center gap-0.5 rounded bg-black/80 px-1.5 py-0.5 text-[9px] text-white">
                      <Film className="h-2.5 w-2.5" />
                      {item.duration ? `${item.duration}s` : ""}
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1 text-left text-[9px] text-white/70">
                    {item.author}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {loading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        <div ref={sentinelRef} className="h-1" />

        {items.length > 0 && !nextPage && !loading && (
          <p className="mt-3 text-center text-[10px] text-white/30">— fim dos resultados —</p>
        )}

        <p className="mt-4 text-center text-[9px] text-white/30">
          Fotos e vídeos por{" "}
          <a href="https://www.pexels.com" target="_blank" rel="noreferrer" className="underline hover:text-white/50">
            Pexels
          </a>
          {" · "}uso comercial liberado
        </p>
      </div>
    </div>
  );
}

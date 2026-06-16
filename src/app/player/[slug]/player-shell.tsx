"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { TemplateRenderer } from "@mi/components/templates/template-renderer";
import { PlayerFooter } from "@mi/components/player/player-footer";
import type { PlaylistSlide } from "@mi/lib/playlist";

interface PlayerShellProps {
  unit: {
    id: string;
    slug: string;
    name: string;
    whatsapp: string | null;
  };
  initialPlaylist: PlaylistSlide[];
  defaultSlideMs: number;
  previewMode: boolean;
}

const REFETCH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 1 minuto

export function PlayerShell({
  unit,
  initialPlaylist,
  defaultSlideMs,
  previewMode,
}: PlayerShellProps) {
  const [playlist, setPlaylist] = useState<PlaylistSlide[]>(initialPlaylist);
  const [index, setIndex] = useState(0);
  const [online, setOnline] = useState(true);
  const sessionIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  // Captura token da URL (?token=XXX)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    tokenRef.current = params.get("token");
  }, []);

  // Esconde cursor após 3s de inatividade (modo kiosk)
  useEffect(() => {
    let timer: number | undefined;
    const hide = () => {
      document.body.style.cursor = "none";
    };
    const reset = () => {
      document.body.style.cursor = "";
      window.clearTimeout(timer);
      timer = window.setTimeout(hide, 3000);
    };
    reset();
    window.addEventListener("mousemove", reset);
    return () => {
      window.removeEventListener("mousemove", reset);
      document.body.style.cursor = "";
      window.clearTimeout(timer);
    };
  }, []);

  // Online/offline status
  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  // Heartbeat: cria sessão e mantém viva a cada 60s
  useEffect(() => {
    if (previewMode || !tokenRef.current) return;

    const heartbeat = async () => {
      try {
        const res = await fetch("/api/player/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "heartbeat",
            unitId: unit.id,
            token: tokenRef.current,
            sessionId: sessionIdRef.current,
          }),
        });
        const data = await res.json();
        if (data.sessionId && !sessionIdRef.current) {
          sessionIdRef.current = data.sessionId;
        }
      } catch {
        // silencioso — offline OK
      }
    };

    heartbeat();
    const id = window.setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [unit.id, previewMode]);

  // Cycle automático
  const currentSlide = playlist[index];
  const slideMs = (currentSlide?.durationSeconds ?? defaultSlideMs / 1000) * 1000;

  useEffect(() => {
    if (playlist.length === 0) return;
    const timer = window.setTimeout(() => {
      setIndex((i) => (i + 1) % playlist.length);
    }, slideMs);
    return () => window.clearTimeout(timer);
  }, [index, slideMs, playlist.length]);

  // Track impression
  useEffect(() => {
    if (previewMode || !currentSlide?.campaignId || !tokenRef.current) return;
    fetch("/api/player/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "impression",
        unitId: unit.id,
        token: tokenRef.current,
        sessionId: sessionIdRef.current,
        campaignId: currentSlide.campaignId,
      }),
    }).catch(() => null);
  }, [currentSlide?.id, currentSlide?.campaignId, unit.id, previewMode]);

  // Re-fetch playlist a cada 5min
  const refetchPlaylist = useCallback(async () => {
    if (!tokenRef.current) return;
    try {
      const res = await fetch(
        `/api/player/${unit.slug}/playlist?token=${tokenRef.current}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.playlist) && data.playlist.length > 0) {
        setPlaylist(data.playlist);
      }
    } catch {
      // ignora
    }
  }, [unit.slug]);

  useEffect(() => {
    const id = window.setInterval(refetchPlaylist, REFETCH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [refetchPlaylist]);

  // Atalho de teclado para reload (debug)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" && e.shiftKey) window.location.reload();
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % playlist.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + playlist.length) % playlist.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playlist.length]);

  // Error boundary simples: se nenhum slide, mostrar fallback
  if (playlist.length === 0 || !currentSlide) {
    return (
      <div className="player-screen grid place-items-center bg-slate-900 text-white">
        <div className="text-center">
          <p className="text-3xl font-bold">Xô Varal</p>
          <p className="mt-2 text-white/60">Carregando conteúdos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="player-screen relative bg-black">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          <TemplateRenderer slide={currentSlide} />
        </motion.div>
      </AnimatePresence>

      {/* Footer com clock + status */}
      <PlayerFooter
        unitName={unit.name}
        whatsapp={unit.whatsapp}
        online={online}
      />

      {/* Reload oculto (canto superior esquerdo, semi-transparente) */}
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="absolute left-2 top-2 h-8 w-8 rounded-full bg-white/5 opacity-0 transition-opacity hover:opacity-100"
        aria-label="Recarregar"
      >
        <RefreshCw className="m-auto h-4 w-4 text-white" />
      </button>

      {previewMode && (
        <div className="absolute right-4 top-4 rounded-full bg-yellow-500 px-3 py-1 text-xs font-bold text-yellow-950">
          PREVIEW
        </div>
      )}
    </div>
  );
}

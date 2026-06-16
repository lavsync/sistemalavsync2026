"use client";

import { OfertaParceiroTemplate } from "./oferta-parceiro";
import { ClubeBeneficiosTemplate } from "./clube-beneficios";
import { InstitucionalTemplate } from "./institucional";
import { RankingClienteTemplate } from "./ranking-cliente";
import { ParceirosBairroTemplate } from "./parceiros-bairro";
import { CampanhaSazonalTemplate } from "./campanha-sazonal";
import { EditorTemplateRenderer } from "./editor-template-renderer";
import type { PlaylistSlide } from "@mi/lib/playlist";
import type { EditorTemplate } from "@mi/types/editor";

interface TemplateRendererProps {
  slide: PlaylistSlide;
}

export function TemplateRenderer({ slide }: TemplateRendererProps) {
  switch (slide.templateSlug) {
    case "oferta-parceiro":
      return <OfertaParceiroTemplate payload={slide.payload} />;
    case "clube-beneficios":
      return <ClubeBeneficiosTemplate payload={slide.payload} />;
    case "institucional":
      return <InstitucionalTemplate payload={slide.payload} />;
    case "ranking-cliente":
      return <RankingClienteTemplate payload={slide.payload} />;
    case "parceiros-bairro":
      return <ParceirosBairroTemplate payload={slide.payload} />;
    case "campanha-sazonal":
      return <CampanhaSazonalTemplate payload={slide.payload} />;
    case "editor-template":
      return <EditorTemplateRenderer template={slide.payload as unknown as EditorTemplate} />;
    default:
      return <InstitucionalTemplate payload={slide.payload} />;
  }
}

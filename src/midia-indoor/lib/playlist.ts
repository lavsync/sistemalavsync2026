import { PRIORITY_WEIGHTS, type CampaignPriority } from "@mi/lib/constants";
import type { EditorTemplate } from "@mi/types/editor";

/**
 * Slide na playlist do player TV.
 * - "campaign": uma campanha vinculada a um dos 6 templates de sistema
 * - "editor-template": template criado no editor visual (Canva-style)
 * - "club": chamada para o Clube de Benefícios (intercala automaticamente)
 * - "institutional": fallback genérico Xô Varal
 */
export type PlaylistSlide = {
  id: string;
  type: "campaign" | "club" | "institutional" | "editor-template";
  templateSlug:
    | "oferta-parceiro"
    | "clube-beneficios"
    | "institucional"
    | "ranking-cliente"
    | "parceiros-bairro"
    | "campanha-sazonal"
    | "editor-template";
  durationSeconds: number;
  campaignId?: string;
  editorTemplateId?: string;
  payload: Record<string, unknown>;
};

export interface CampaignForPlaylist {
  id: string;
  name: string;
  priority: CampaignPriority;
  duration_seconds: number;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  headline: string | null;
  subheadline: string | null;
  cta_label: string | null;
  cta_url: string | null;
  media_url: string | null;
  media_type: "image" | "video" | null;
  editor_template_id: string | null;
  templates: { slug: string; name: string } | null;
  partners: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
  } | null;
  offers: {
    id: string;
    title: string;
    coupon: string | null;
    banner_url: string | null;
  } | null;
  qr_codes: {
    short_code: string;
    target_url: string;
  } | null;
}

export interface PlaylistContext {
  unitName: string;
  unitSlug: string;
  unitWhatsapp: string | null;
  clubeUrl: string;
  clubeShortUrl: string;
  campaigns: CampaignForPlaylist[];
  /** Templates do editor visual já publicados (entram com peso destaque=2x) */
  editorTemplates?: EditorTemplate[];
  clubInterval?: number;
  defaultSlideMs?: number;
}

const DEFAULT_INSTITUTIONAL_SLIDES: PlaylistSlide[] = [
  {
    id: "inst-economia",
    type: "institutional",
    templateSlug: "institucional",
    durationSeconds: 15,
    payload: {
      icon: "Sparkles",
      title: "Economize tempo na sua semana",
      subtitle: "Lave + seque + dobre tudo no mesmo lugar, sem complicação.",
    },
  },
  {
    id: "inst-pratico",
    type: "institutional",
    templateSlug: "institucional",
    durationSeconds: 15,
    payload: {
      icon: "Shirt",
      title: "Roupas limpas em até 60 minutos",
      subtitle: "Máquinas modernas, secagem rápida, ambiente acolhedor.",
    },
  },
  {
    id: "inst-bairro",
    type: "institutional",
    templateSlug: "institucional",
    durationSeconds: 15,
    payload: {
      icon: "Heart",
      title: "Xô Varal é do bairro, pra você",
      subtitle: "Comerciantes locais oferecem benefícios exclusivos para quem lava aqui.",
    },
  },
];

/**
 * Constrói a playlist final aplicando:
 * - Pesos por prioridade (premium 3x, destaque 2x, normal 1x)
 * - Editor templates publicados (entram com peso destaque=2x)
 * - Slide do clube a cada N posições (default 5)
 * - Fallback institucional se sem nada ativo
 */
export function buildPlaylist(ctx: PlaylistContext): PlaylistSlide[] {
  const interval = ctx.clubInterval ?? 5;
  const defaultMs = ctx.defaultSlideMs ?? 15000;
  const defaultSec = Math.round(defaultMs / 1000);

  const now = new Date();
  const weighted: PlaylistSlide[] = [];

  // 1. Campanhas (templates de sistema)
  const validCampaigns = ctx.campaigns.filter((c) => {
    if (c.status !== "ativa") return false;
    if (c.starts_at && new Date(c.starts_at) > now) return false;
    if (c.ends_at && new Date(c.ends_at) < now) return false;
    if (!c.templates) return false;
    return true;
  });

  // Mapa de editor templates indexado por id (pra usar em campanhas vinculadas)
  const editorById = new Map<string, EditorTemplate>();
  for (const t of ctx.editorTemplates ?? []) editorById.set(t.id, t);

  for (const c of validCampaigns) {
    const weight = PRIORITY_WEIGHTS[c.priority] ?? 1;

    // Se a campanha vincula a um editor template, renderiza esse template
    // mas mantém prioridade/duração/agendamento da campanha.
    const linkedEditor = c.editor_template_id ? editorById.get(c.editor_template_id) : null;

    for (let i = 0; i < weight; i++) {
      if (linkedEditor) {
        weighted.push({
          id: `${c.id}-${i}`,
          type: "editor-template",
          templateSlug: "editor-template",
          durationSeconds: c.duration_seconds || linkedEditor.durationSeconds || defaultSec,
          campaignId: c.id,
          editorTemplateId: linkedEditor.id,
          payload: linkedEditor as unknown as Record<string, unknown>,
        });
      } else {
        weighted.push({
          id: `${c.id}-${i}`,
          type: "campaign",
          templateSlug:
            (c.templates?.slug as PlaylistSlide["templateSlug"]) ?? "institucional",
          durationSeconds: c.duration_seconds || defaultSec,
          campaignId: c.id,
          payload: c as unknown as Record<string, unknown>,
        });
      }
    }
  }

  // 2. Editor templates publicados SEM campanha vinculada (autônomos, peso 2x destaque)
  const linkedEditorIds = new Set(
    validCampaigns.filter((c) => c.editor_template_id).map((c) => c.editor_template_id!),
  );
  for (const tpl of ctx.editorTemplates ?? []) {
    if (!tpl.isPublished) continue;
    if (linkedEditorIds.has(tpl.id)) continue; // já está numa campanha, não duplica
    const weight = 2;
    for (let i = 0; i < weight; i++) {
      weighted.push({
        id: `editor-${tpl.id}-${i}`,
        type: "editor-template",
        templateSlug: "editor-template",
        durationSeconds: tpl.durationSeconds || defaultSec,
        editorTemplateId: tpl.id,
        payload: tpl as unknown as Record<string, unknown>,
      });
    }
  }

  // Shuffle anti-bunching
  shuffleByPriority(weighted);

  // Fallback se vazio
  if (weighted.length === 0) {
    return DEFAULT_INSTITUTIONAL_SLIDES;
  }

  // Slide do clube
  const clubSlide: PlaylistSlide = {
    id: "club-cta",
    type: "club",
    templateSlug: "clube-beneficios",
    durationSeconds: defaultSec,
    payload: {
      clubeUrl: ctx.clubeUrl,
      clubeShortUrl: ctx.clubeShortUrl,
      unitName: ctx.unitName,
    },
  };

  // Intercala clube a cada `interval` slides
  const final: PlaylistSlide[] = [];
  for (let i = 0; i < weighted.length; i++) {
    final.push(weighted[i]);
    if ((i + 1) % interval === 0) {
      final.push({ ...clubSlide, id: `club-cta-${i}` });
    }
  }

  // Garante pelo menos um clube por ciclo
  if (!final.some((s) => s.type === "club")) {
    final.push(clubSlide);
  }

  return final;
}

/**
 * Shuffle simples que tenta não agrupar slides da mesma origem (campaign/editor) em sequência.
 */
function shuffleByPriority(arr: PlaylistSlide[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  // Anti-bunching: campaign ou editor template repetido consecutivo
  for (let i = 1; i < arr.length; i++) {
    const prev = arr[i - 1];
    const curr = arr[i];
    const sameOrigin =
      (curr.campaignId && prev.campaignId === curr.campaignId) ||
      (curr.editorTemplateId && prev.editorTemplateId === curr.editorTemplateId);
    if (sameOrigin) {
      for (let j = i + 1; j < arr.length; j++) {
        const candidate = arr[j];
        const candSame =
          (candidate.campaignId && prev.campaignId === candidate.campaignId) ||
          (candidate.editorTemplateId && prev.editorTemplateId === candidate.editorTemplateId);
        if (!candSame) {
          [arr[i], arr[j]] = [arr[j], arr[i]];
          break;
        }
      }
    }
  }
}

import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StockType = "photo" | "video";
type Orientation = "landscape" | "portrait" | "square";

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  alt: string;
  photographer: string;
  photographer_url: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  image: string; // poster
  user: { name: string; url: string };
  video_files: Array<{
    id: number;
    quality: string;
    file_type: string;
    width: number;
    height: number;
    fps: number;
    link: string;
  }>;
}

export interface StockItem {
  id: string;
  type: StockType;
  width: number;
  height: number;
  preview: string; // thumb pra grid
  full: string; // URL alta resolução pra usar
  duration?: number;
  alt: string;
  author: string;
  authorUrl: string;
}

// Cache simples em memória (5min) — evita explodir cota
const cache = new Map<string, { ts: number; data: { items: StockItem[]; nextPage: number | null } }>();
const TTL_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "PEXELS_API_KEY não configurada no servidor",
        helpUrl: "https://www.pexels.com/api/new/",
      },
      { status: 503 },
    );
  }

  const params = req.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim();
  const type = (params.get("type") as StockType) ?? "photo";
  const orientation = (params.get("orientation") as Orientation) ?? "landscape";
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));
  const perPage = 30;

  if (!q) {
    return NextResponse.json({ items: [], nextPage: null });
  }

  const cacheKey = `${type}|${orientation}|${q.toLowerCase()}|${page}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return NextResponse.json(cached.data);
  }

  const url =
    type === "video"
      ? `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=${perPage}&page=${page}&orientation=${orientation}`
      : `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${perPage}&page=${page}&orientation=${orientation}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Pexels respondeu ${res.status}` },
        { status: res.status },
      );
    }
    const json = await res.json();

    let items: StockItem[] = [];

    if (type === "video") {
      items = (json.videos as PexelsVideo[]).map((v) => {
        // Escolhe melhor qualidade até HD pra não estourar banda
        const best =
          v.video_files.find((f) => f.quality === "hd" && f.width <= 1920) ??
          v.video_files.find((f) => f.quality === "sd") ??
          v.video_files[0];
        return {
          id: `pexels-v-${v.id}`,
          type: "video",
          width: v.width,
          height: v.height,
          duration: v.duration,
          preview: v.image,
          full: best?.link ?? v.image,
          alt: `Vídeo por ${v.user.name}`,
          author: v.user.name,
          authorUrl: v.user.url,
        };
      });
    } else {
      items = (json.photos as PexelsPhoto[]).map((p) => ({
        id: `pexels-p-${p.id}`,
        type: "photo",
        width: p.width,
        height: p.height,
        preview: p.src.medium,
        full: orientation === "portrait" ? p.src.portrait : p.src.landscape,
        alt: p.alt || `Foto por ${p.photographer}`,
        author: p.photographer,
        authorUrl: p.photographer_url,
      }));
    }

    const hasMore = items.length === perPage;
    const data = { items, nextPage: hasMore ? page + 1 : null };

    cache.set(cacheKey, { ts: Date.now(), data });
    if (cache.size > 200) {
      // garbage collect simples — limpa entradas mais antigas
      const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts).slice(0, 50);
      for (const [k] of oldest) cache.delete(k);
    }

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

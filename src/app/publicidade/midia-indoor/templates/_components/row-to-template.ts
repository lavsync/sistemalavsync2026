import type {
  CanvasFormat,
  EditorBackground,
  EditorElement,
  EditorTemplate,
} from "@mi/types/editor";

/** Converte uma row do banco no shape consumido pelo store. */
export function rowToTemplate(row: Record<string, unknown>): EditorTemplate {
  return {
    id: row.id as string,
    unitId: (row.unidade_id as string) ?? null,
    name: row.name as string,
    format: row.format as CanvasFormat,
    width: row.width as number,
    height: row.height as number,
    background: row.background as EditorBackground,
    elements: row.elements as EditorElement[],
    motion: row.motion as { enterDuration: number; exitDuration: number },
    durationSeconds: row.duration_seconds as number,
    isPublished: row.is_published as boolean,
    thumbnailUrl: (row.thumbnail_url as string) ?? null,
    category: row.category as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

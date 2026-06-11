// Helper universal pra contornar o limite default de 1000 linhas do PostgREST.
// Uso: passar uma factory que monta a query com .range(from, to).
import "server-only";

export type RangeArgs = { from: number; to: number };

export async function paginarTodos<T>(
  build: (r: RangeArgs) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize: number = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  for (let safe = 0; safe < 200; safe++) {
    const { data, error } = await build({ from: offset, to: offset + pageSize - 1 });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < pageSize) return all;
    offset += pageSize;
  }
  return all; // safety cap em 200k linhas
}

/**
 * Shared opaque-cursor pagination for in-memory list endpoints. A cursor
 * encodes the key of the last item on the previous page; the next page
 * starts immediately after that key in the given (already ordered) list.
 */

export type CursorPage<T> = { page: T[]; nextCursor: string | null };
export type CursorPageResult<T> =
  | ({ ok: true } & CursorPage<T>)
  | { ok: false; reason: "malformed" | "not_found" };

export function encodeCursorKey(key: string): string {
  return Buffer.from(key).toString("base64url");
}

export function decodeCursorKey(raw: string): string | null {
  let decoded: string;
  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    return null;
  }
  return decoded.length > 0 ? decoded : null;
}

/**
 * Slices `items` into the page following `cursorRaw`, bounded by `limit`.
 * `items` must be in a stable, deterministic order across calls.
 */
export function paginateByCursor<T>(
  items: readonly T[],
  cursorRaw: string | undefined,
  limit: number,
  keyOf: (item: T) => string
): CursorPageResult<T> {
  let startIndex = 0;
  if (cursorRaw !== undefined) {
    const decodedKey = decodeCursorKey(cursorRaw);
    if (decodedKey === null) return { ok: false, reason: "malformed" };
    const index = items.findIndex((item) => keyOf(item) === decodedKey);
    if (index === -1) return { ok: false, reason: "not_found" };
    startIndex = index + 1;
  }

  const page = items.slice(startIndex, startIndex + limit);
  const nextCursor =
    startIndex + page.length < items.length
      ? encodeCursorKey(keyOf(page[page.length - 1]))
      : null;
  return { ok: true, page, nextCursor };
}

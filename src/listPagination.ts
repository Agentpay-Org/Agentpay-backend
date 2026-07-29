import type { Request } from "express";
import { parseIntParam } from "./queryParams.js";
import { encodeCursorKey, paginateByCursor } from "./cursorPagination.js";

export type OffsetPage<T> = { items: T[]; total: number };

export type ListPageResult<T> =
  | { ok: true; items: T[]; total: number; nextCursor: string | null }
  | { ok: false; reason: "malformed" | "not_found" };

/**
 * Offset/limit pagination (see applyOffsetPage) extended with an opt-in
 * `?cursor=` mode: when a cursor is supplied it takes priority over
 * `offset`. Both modes report the same `nextCursor`, so offset-based
 * clients can switch to cursor paging without a contract change.
 */
export function applyListPage<T>(
  allItems: readonly T[],
  query: Request["query"],
  keyOf: (item: T) => string
): ListPageResult<T> {
  const total = allItems.length;
  const limit = parseIntParam(query.limit, {
    defaultValue: total || 1,
    min: 1,
    max: 1000,
  });

  const cursorRaw = typeof query.cursor === "string" ? query.cursor : undefined;
  if (cursorRaw !== undefined) {
    const paged = paginateByCursor(allItems, cursorRaw, limit, keyOf);
    if (!paged.ok) return paged;
    return { ok: true, items: paged.page, total, nextCursor: paged.nextCursor };
  }

  const offset = parseIntParam(query.offset, {
    defaultValue: 0,
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
  });
  const items = allItems.slice(offset, offset + limit);
  const nextCursor =
    offset + items.length < total && items.length > 0
      ? encodeCursorKey(keyOf(items[items.length - 1]))
      : null;
  return { ok: true, items, total, nextCursor };
}

/**
 * Shared offset/limit pagination preamble for `GET` list endpoints
 * (api-keys, webhooks). Defaults `limit` to the full result set so
 * existing callers that omit `limit` keep seeing every item.
 */
export function applyOffsetPage<T>(
  allItems: readonly T[],
  query: Request["query"]
): OffsetPage<T> {
  const total = allItems.length;
  const limit = parseIntParam(query.limit, {
    defaultValue: total || 1,
    min: 1,
    max: 1000,
  });
  const offset = parseIntParam(query.offset, {
    defaultValue: 0,
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
  });
  return { items: allItems.slice(offset, offset + limit) as T[], total };
}

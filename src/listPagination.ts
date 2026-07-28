import type { Request } from "express";
import { parseIntParam } from "./queryParams.js";

export type OffsetPage<T> = { items: T[]; total: number };

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

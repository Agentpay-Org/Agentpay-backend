import type { Request } from "express";

export type Pagination = {
  limit: number;
  offset: number;
};

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

function firstQueryValue(value: Request["query"][string]): string | undefined {
  if (Array.isArray(value)) return firstQueryValue(value[0]);
  return typeof value === "string" ? value : undefined;
}

function boundedInteger(
  value: string | undefined,
  defaultValue: number,
  min: number,
  max: number
): number {
  const parsed = value === undefined ? defaultValue : Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

/**
 * Parses the shared bounded limit/offset query contract for list endpoints.
 */
export function parsePagination(query: Request["query"]): Pagination {
  return {
    limit: boundedInteger(firstQueryValue(query.limit), DEFAULT_LIMIT, 1, MAX_LIMIT),
    offset: boundedInteger(
      firstQueryValue(query.offset),
      0,
      0,
      Number.MAX_SAFE_INTEGER
    ),
  };
}

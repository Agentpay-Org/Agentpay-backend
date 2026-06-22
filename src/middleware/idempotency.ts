import { createHash } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";

export type IdempotencyRoute = {
  method: string;
  path: string;
};

export type IdempotencyOptions = {
  routes?: IdempotencyRoute[];
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
};

type CacheEntry = {
  fingerprint: string;
  statusCode: number;
  body: unknown;
  createdAt: number;
};

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 10_000;
const DEFAULT_ROUTES: IdempotencyRoute[] = [
  { method: "POST", path: "/api/v1/usage" },
  { method: "POST", path: "/api/v1/usage/bulk" },
  { method: "POST", path: "/api/v1/settle" },
];

function routeKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(",")}}`;
}

function requestFingerprint(req: Request): string {
  return hash(
    `${routeKey(req.method, req.path)}\n${stableStringify(req.body ?? null)}`
  );
}

function callerKey(req: Request): string {
  const apiKey = (req as Request & { apiKey?: string }).apiKey;
  if (apiKey) return `api-key:${hash(apiKey)}`;

  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  return `ip:${ip}`;
}

function prune(cache: Map<string, CacheEntry>, now: number, ttlMs: number): void {
  for (const [key, entry] of cache.entries()) {
    if (now - entry.createdAt > ttlMs) {
      cache.delete(key);
    }
  }
}

function enforceCap(cache: Map<string, CacheEntry>, maxEntries: number): void {
  while (cache.size > maxEntries) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) return;
    cache.delete(oldest);
  }
}

/**
 * Caches the first JSON response for protected POST routes by
 * `(apiKey-or-ip, Idempotency-Key)` so network retries return the same result
 * without mutating usage or settlement state again.
 */
export function createIdempotencyMiddleware(
  options: IdempotencyOptions = {}
): RequestHandler {
  const routes = new Set(
    (options.routes ?? DEFAULT_ROUTES).map((route) =>
      routeKey(route.method, route.path)
    )
  );
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const now = options.now ?? Date.now;
  const cache = new Map<string, CacheEntry>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (!routes.has(routeKey(req.method, req.path))) {
      next();
      return;
    }

    const idempotencyKey = req.header("idempotency-key");
    if (idempotencyKey === undefined) {
      next();
      return;
    }

    const requestId = (req as Request & { id?: string }).id;
    if (idempotencyKey.length === 0 || idempotencyKey.length > 256) {
      res.status(400).json({
        error: "invalid_request",
        message: "Idempotency-Key must be a non-empty string up to 256 chars",
        requestId,
      });
      return;
    }

    const timestamp = now();
    prune(cache, timestamp, ttlMs);

    const key = `${callerKey(req)}:${hash(idempotencyKey)}`;
    const fingerprint = requestFingerprint(req);
    const cached = cache.get(key);

    if (cached) {
      if (cached.fingerprint !== fingerprint) {
        res.status(409).json({
          error: "idempotency_conflict",
          message: "Idempotency-Key was reused with a different request",
          requestId,
        });
        return;
      }

      res.setHeader("Idempotency-Replayed", "true");
      res.status(cached.statusCode).json(cached.body);
      return;
    }

    const originalJson = res.json.bind(res) as Response["json"];
    res.json = ((body?: unknown) => {
      cache.set(key, {
        fingerprint,
        statusCode: res.statusCode,
        body,
        createdAt: timestamp,
      });
      enforceCap(cache, maxEntries);
      return originalJson(body);
    }) as Response["json"];

    next();
  };
}

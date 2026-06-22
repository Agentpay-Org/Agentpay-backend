import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

type StoredResponse = {
  body: unknown;
  fingerprint: string;
  status: number;
  storedAt: number;
};

type IdempotencyOptions = {
  maxEntries?: number;
  now?: () => number;
  routes?: ReadonlySet<string>;
  ttlMs?: number;
};

const DEFAULT_IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
const DEFAULT_IDEMPOTENCY_CACHE_CAP = 10_000;
const DEFAULT_IDEMPOTENT_ROUTES = new Set([
  "POST /api/v1/usage",
  "POST /api/v1/usage/bulk",
  "POST /api/v1/settle",
]);

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return `{${entries
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
    .join(",")}}`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function callerNamespace(req: Request) {
  const apiKey = (req as Request & { apiKey?: string }).apiKey;
  if (apiKey) return `api-key:${sha256(apiKey)}`;
  return `ip:${req.ip ?? req.socket.remoteAddress ?? "unknown"}`;
}

/**
 * Cache successful or failed JSON responses for mutating billing endpoints.
 * Replays are namespaced by caller and key, and body fingerprints prevent
 * accidental key reuse from returning an unrelated mutation result.
 */
function createIdempotencyMiddleware(options: IdempotencyOptions = {}) {
  const ttlMs = options.ttlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS;
  const maxEntries = options.maxEntries ?? DEFAULT_IDEMPOTENCY_CACHE_CAP;
  const now = options.now ?? Date.now;
  const routes = options.routes ?? DEFAULT_IDEMPOTENT_ROUTES;
  const cache = new Map<string, StoredResponse>();

  function evictExpired(currentTime: number) {
    for (const [key, entry] of cache.entries()) {
      if (currentTime - entry.storedAt > ttlMs) {
        cache.delete(key);
      }
    }
  }

  function trimToCap() {
    while (cache.size > maxEntries) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) return;
      cache.delete(oldest);
    }
  }

  return function idempotencyMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const routeKey = `${req.method.toUpperCase()} ${req.path}`;
    if (!routes.has(routeKey)) {
      next();
      return;
    }

    const idempotencyKey = req.header("Idempotency-Key")?.trim();
    if (!idempotencyKey) {
      next();
      return;
    }

    const currentTime = now();
    evictExpired(currentTime);

    const cacheKey = `${callerNamespace(req)}:${sha256(idempotencyKey)}`;
    const fingerprint = sha256(stableStringify(req.body ?? null));
    const existing = cache.get(cacheKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        res.status(409).json({
          error: "idempotency_conflict",
          message: "Idempotency-Key was already used with a different body",
          requestId: (req as Request & { id?: string }).id,
        });
        return;
      }
      res.setHeader("Idempotency-Replayed", "true");
      res.status(existing.status).json(existing.body);
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = ((body?: unknown) => {
      cache.set(cacheKey, {
        body,
        fingerprint,
        status: res.statusCode,
        storedAt: now(),
      });
      trimToCap();
      return originalJson(body);
    }) as Response["json"];

    next();
  };
}

export {
  DEFAULT_IDEMPOTENCY_CACHE_CAP,
  DEFAULT_IDEMPOTENCY_TTL_MS,
  createIdempotencyMiddleware,
};

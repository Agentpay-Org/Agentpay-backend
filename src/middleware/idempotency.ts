import { createHash } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { AgentPayRequest } from "../types.js";
import { getRequestId } from "../types.js";

const DEFAULT_IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
const DEFAULT_IDEMPOTENCY_MAX_ENTRIES = 1000;

type IdempotencyEntry = {
  createdAt: number;
  fingerprint: string;
  statusCode: number;
  body: unknown;
};

type IdempotencyOptions = {
  ttlMs?: number;
  maxEntries?: number;
};

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveOptions(options: IdempotencyOptions): Required<IdempotencyOptions> {
  return {
    ttlMs:
      options.ttlMs ??
      readPositiveIntegerEnv("IDEMPOTENCY_CACHE_TTL_MS", DEFAULT_IDEMPOTENCY_TTL_MS),
    maxEntries:
      options.maxEntries ??
      readPositiveIntegerEnv(
        "IDEMPOTENCY_CACHE_MAX_ENTRIES",
        DEFAULT_IDEMPOTENCY_MAX_ENTRIES
      ),
  };
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getCallerNamespace(req: Request): string {
  const apiKeyHash = (req as AgentPayRequest).apiKeyHash;
  if (apiKeyHash) return `api-key:${apiKeyHash}`;
  const suppliedKey = req.header("x-api-key");
  if (suppliedKey) return `api-key-raw:${digest(suppliedKey)}`;
  return `ip:${req.ip ?? req.socket.remoteAddress ?? "unknown"}`;
}

function encodePrimitive(value: unknown): string {
  const encoded = JSON.stringify(value);
  return encoded ?? "undefined";
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return encodePrimitive(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function cloneJsonBody(body: unknown): unknown {
  if (body === undefined) return undefined;
  return JSON.parse(JSON.stringify(body)) as unknown;
}

function pruneCache(
  cache: Map<string, IdempotencyEntry>,
  now: number,
  options: Required<IdempotencyOptions>
): void {
  for (const [key, entry] of cache.entries()) {
    if (now - entry.createdAt >= options.ttlMs) {
      cache.delete(key);
    }
  }

  while (cache.size > options.maxEntries) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) return;
    cache.delete(oldest);
  }
}

/**
 * Creates middleware that replays completed JSON responses for repeated
 * Idempotency-Key requests from the same API key or client IP.
 */
export function createIdempotencyMiddleware(
  options: IdempotencyOptions = {}
): RequestHandler {
  const resolved = resolveOptions(options);
  const cache = new Map<string, IdempotencyEntry>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const idempotencyKey = req.header("idempotency-key")?.trim();
    if (!idempotencyKey) {
      next();
      return;
    }

    const now = Date.now();
    pruneCache(cache, now, resolved);

    const cacheKey = `${getCallerNamespace(req)}:${digest(idempotencyKey)}`;
    const fingerprint = `${req.method.toUpperCase()} ${req.path}\n${stableStringify(
      req.body
    )}`;
    const cached = cache.get(cacheKey);

    if (cached) {
      if (cached.fingerprint !== fingerprint) {
        res.status(409).json({
          error: "idempotency_conflict",
          message:
            "Idempotency-Key was already used with a different request body or route",
          requestId: getRequestId(req),
        });
        return;
      }

      res.setHeader("Idempotency-Replayed", "true");
      res.status(cached.statusCode).json(cached.body);
      return;
    }

    const originalJson = res.json.bind(res) as Response["json"];
    let captured = false;
    let capturedBody: unknown;

    res.json = ((body?: unknown) => {
      captured = true;
      capturedBody = cloneJsonBody(body);
      return originalJson(body);
    }) as Response["json"];

    res.on("finish", () => {
      if (!captured) return;
      cache.set(cacheKey, {
        createdAt: now,
        fingerprint,
        statusCode: res.statusCode,
        body: capturedBody,
      });
      pruneCache(cache, Date.now(), resolved);
    });

    next();
  };
}

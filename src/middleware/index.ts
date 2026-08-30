import { randomUUID } from "node:crypto";
import { gzipSync } from "node:zlib";
import express, {
  type Application,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { verifyApiKey, timingSafeEqualSecret } from "../auth/apiKeys.js";
import { logger, logRequestCompletion } from "../logger.js";
import {
  config,
  apiKeyStore,
  pauseState,
  rateBuckets,
  type RateLimitBucket,
} from "../store/state.js";
import { recordHttpRequest } from "../metrics.js";
import type { AgentPayRequest } from "../types.js";

/**
 * Installs middleware that must run before the early admin/config/metrics
 * routes.
 */
export function installPreRouteMiddleware(app: Application): void {
  app.use(requestTimerMiddleware);
  app.use(createCompressionMiddleware());
  app.use(createCorsMiddleware());
  app.use(requestIdMiddleware);
  app.use(apiKeyAuthMiddleware);
  app.use(express.json({ limit: "100kb" }));
  app.use(requireJsonContentTypeForBodyWrites);
  app.use(securityHeadersMiddleware);
}

/**
 * Buffers string/Buffer response bodies and gzip-encodes them when the client
 * negotiates gzip, the response is large enough, and compression is enabled via
 * the COMPRESSION env flag. Prometheus text exposition is left untouched.
 */
function createCompressionMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (process.env.COMPRESSION !== "on") return next();
    const acceptEncoding = req.header("accept-encoding") ?? "";
    if (!/\bgzip\b/.test(acceptEncoding)) return next();

    const configured = Number(process.env.COMPRESSION_THRESHOLD_BYTES);
    const minBytes = Number.isFinite(configured) && configured > 0 ? configured : 1024;
    const originalSend = res.send.bind(res);

    res.send = ((body?: unknown) => {
      if (res.statusCode === 304 || res.getHeader("Content-Encoding")) {
        return originalSend(body as never);
      }
      const contentType = String(res.getHeader("Content-Type") ?? "");
      if (contentType.startsWith("text/plain")) {
        return originalSend(body as never);
      }
      let buffer: Buffer | undefined;
      if (typeof body === "string") buffer = Buffer.from(body);
      else if (Buffer.isBuffer(body)) buffer = body;
      if (!buffer) return originalSend(body as never);

      res.setHeader("Vary", "Accept-Encoding");
      if (buffer.length < minBytes) return originalSend(buffer as never);

      const gzipped = gzipSync(buffer);
      res.setHeader("Content-Encoding", "gzip");
      res.removeHeader("Content-Length");
      return originalSend(gzipped as never);
    }) as Response["send"];

    next();
  };
}

/**
 * Installs middleware that originally ran after admin/config/metrics but before
 * the main API routes.
 */
export function installRequestStateMiddleware(app: Application): void {
  app.use(pauseGuardMiddleware);
  app.use(rateLimitMiddleware);
}

function normalizeCorsOrigin(origin: string): string | undefined {
  const trimmed = origin.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    if (parsed.pathname !== "/" || parsed.search.length > 0 || parsed.hash.length > 0) {
      return undefined;
    }
    return `${parsed.protocol}//${parsed.host.toLowerCase()}`;
  } catch {
    return undefined;
  }
}

function parseCorsOrigins(rawOrigins: string | undefined): Set<string> {
  if (!rawOrigins || rawOrigins.trim().length === 0) {
    return new Set<string>();
  }

  const trimmed = rawOrigins.trim();
  if (trimmed === "*") {
    throw new Error("CORS_ALLOWED_ORIGINS wildcard is not supported");
  }

  const allowed = new Set<string>();
  for (const token of trimmed.split(",")) {
    const normalized = normalizeCorsOrigin(token);
    if (!normalized) {
      console.warn(
        `Ignoring malformed CORS origin in CORS_ALLOWED_ORIGINS: ${token.trim()}`
      );
      continue;
    }
    allowed.add(normalized);
  }
  return allowed;
}

/**
 * CORS allowlist middleware backed by CORS_ALLOWED_ORIGINS.
 */
function createCorsMiddleware() {
  const corsAllowed = parseCorsOrigins(process.env.CORS_ALLOWED_ORIGINS);

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.header("origin");
    if (origin) {
      res.vary("Origin");
    }
    const normalizedOrigin = origin ? normalizeCorsOrigin(origin) : undefined;
    if (normalizedOrigin && corsAllowed.has(normalizedOrigin)) {
      res.setHeader("Access-Control-Allow-Origin", normalizedOrigin);
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS"
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type,X-Request-Id,X-API-Key"
      );
      res.setHeader("Access-Control-Max-Age", "86400");
    }
    if (req.method === "OPTIONS") {
      res.status(204).send();
      return;
    }
    next();
  };
}

/**
 * Rejects write requests that carry a non-empty payload without declaring
 * JSON as the request media type. Bodyless writes are allowed so admin and
 * synthetic webhook probes remain usable without a content-type header.
 */
function requireJsonContentTypeForBodyWrites(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const method = req.method.toUpperCase();
  if (method !== "POST" && method !== "PUT" && method !== "PATCH") {
    next();
    return;
  }

  const contentLength = req.header("content-length");
  const transferEncoding = req.header("transfer-encoding");
  const hasPayload =
    (contentLength !== undefined && contentLength !== "0") ||
    (transferEncoding !== undefined && transferEncoding.length > 0);

  if (!hasPayload) {
    next();
    return;
  }

  if (req.is("application/json")) {
    next();
    return;
  }

  res.status(415).json({
    error: "unsupported_media_type",
    message: "write requests with a body must use Content-Type: application/json",
    requestId: (req as AgentPayRequest).id,
  });
}

/**
 * Applies the API's hardening headers to every response path without pulling in
 * a browser-document framing dependency.
 */
const securityHeadersMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; base-uri 'none'; connect-src 'none'; font-src 'none'; form-action 'none'; frame-ancestors 'none'; img-src 'none'; manifest-src 'none'; media-src 'none'; object-src 'none'; script-src 'none'; script-src-attr 'none'; style-src 'none'; worker-src 'none'"
  );
  next();
};

/** Keeps the API's explicit browser feature restrictions. */
function _permissionsPolicyMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  next();
}

/** Attaches or echoes X-Request-Id on every request. */
function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id");
  const id = incoming && incoming.length <= 200 ? incoming : randomUUID();
  (req as AgentPayRequest).id = id;
  res.setHeader("X-Request-Id", id);
  next();
}

/** Recognizes tenant keys and enforces them on writes when REQUIRE_API_KEY=true. */
function apiKeyAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const supplied = req.header("x-api-key");
  const tenantKey = verifyApiKey(supplied, apiKeyStore);
  if (tenantKey) {
    (req as AgentPayRequest).apiKeyHash = tenantKey.hash;
    (req as AgentPayRequest).apiKeyPrefix = tenantKey.prefix;
  }

  if (!requiresApiKey()) {
    next();
    return;
  }

  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    next();
    return;
  }

  if (req.path.startsWith("/api/v1/admin/") || isApiKeyManagementPath(req.path)) {
    if (isValidAdminKey(supplied)) {
      (req as AgentPayRequest).adminApiKey = true;
      next();
      return;
    }
    sendUnauthorized(res, req, "valid ADMIN_API_KEY required for privileged writes");
    return;
  }

  if (!tenantKey) {
    sendUnauthorized(res, req, "valid X-API-Key required for write request");
    return;
  }

  next();
}

function requiresApiKey(): boolean {
  return process.env.REQUIRE_API_KEY?.toLowerCase() === "true";
}

function isApiKeyManagementPath(path: string): boolean {
  return path === "/api/v1/api-keys" || path.startsWith("/api/v1/api-keys/");
}

function isValidAdminKey(supplied: string | undefined): boolean {
  const adminKey = process.env.ADMIN_API_KEY;
  return (
    typeof supplied === "string" &&
    typeof adminKey === "string" &&
    adminKey.length > 0 &&
    timingSafeEqualSecret(supplied, adminKey)
  );
}

function sendUnauthorized(res: Response, req: Request, message: string): void {
  res.status(401).json({
    error: "unauthorized",
    message,
    requestId: (req as AgentPayRequest).id,
  });
}

/** Blocks state-changing requests while the backend is paused. */
function pauseGuardMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!pauseState.paused) return next();
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();
  if (req.path === "/api/v1/admin/unpause") return next();
  res.status(503).json({
    error: "service_paused",
    message: "AgentPay backend is paused; only admin/unpause and reads are accepted",
    requestId: (req as AgentPayRequest).id,
  });
}

/**
 * Builds a stable rate-limit key from the authenticated API key when present,
 * otherwise falling back to Express' trusted client IP. An unrecognized
 * X-API-Key is deliberately not used as an identity: callers must not be able
 * to mint unlimited buckets by changing an invalid header on every request.
 */
export function deriveRateLimitKey(req: Request): string {
  const apiKeyHash = (req as AgentPayRequest).apiKeyHash;
  if (apiKeyHash) {
    return `api-key:${apiKeyHash}`;
  }
  return `ip:${req.ip ?? req.socket.remoteAddress ?? "unknown"}`;
}

type RateLimitWindowState = {
  estimatedCount: number;
  resetAt: number;
};

function subWindowMs(windowMs: number): number {
  // Each counter window is one configured limit period. The current and
  // immediately previous windows are enough to estimate the rolling period;
  // older windows have zero weight and can be discarded.
  return Math.max(1, windowMs);
}

function emptyBucket(now: number, windowMs: number): RateLimitBucket {
  const width = subWindowMs(windowMs);
  // Anchor a new key at its first hit. This keeps Retry-After tied to the
  // caller's actual window instead of an unrelated epoch boundary.
  const currentWindowStart = now;
  return {
    currentWindowStart,
    currentCount: 0,
    previousWindowStart: currentWindowStart - width,
    previousCount: 0,
  };
}

/** Converts old timestamp seeds into compact state for compatibility. */
function normalizeBucket(
  value: RateLimitBucket | number[] | undefined,
  now: number,
  windowMs: number
): RateLimitBucket {
  if (!Array.isArray(value)) return value ?? emptyBucket(now, windowMs);

  const oldestAllowed = now - windowMs;
  const recentHits = value.filter((hit) => hit >= oldestAllowed && hit <= now);
  if (recentHits.length === 0) return emptyBucket(now, windowMs);

  // Legacy seeds do not carry a window anchor. Treat their retained hits as
  // one current counter anchored at the oldest retained hit; this preserves
  // the old "all recent requests count" behavior during a rolling upgrade.
  const currentWindowStart = Math.min(...recentHits);
  return {
    currentWindowStart,
    currentCount: recentHits.length,
    previousWindowStart: currentWindowStart - subWindowMs(windowMs),
    previousCount: 0,
  };
}

/** Rolls a bucket forward, dropping subwindows older than the rolling window. */
function rollBucket(bucket: RateLimitBucket, now: number, windowMs: number): void {
  const width = subWindowMs(windowMs);
  if (now < bucket.currentWindowStart + width) return;
  const currentWindowStart = bucket.currentWindowStart + width;
  if (now < bucket.currentWindowStart + 2 * width) {
    bucket.previousWindowStart = bucket.currentWindowStart;
    bucket.previousCount = bucket.currentCount;
  } else {
    bucket.previousWindowStart = now;
    bucket.previousCount = 0;
  }
  bucket.currentWindowStart = currentWindowStart;
  bucket.currentCount = 0;
}

function weightedCount(bucket: RateLimitBucket, now: number, windowMs: number): number {
  const width = subWindowMs(windowMs);
  const elapsed = Math.max(0, Math.min(width, now - bucket.currentWindowStart));
  const previousWeight = 1 - elapsed / width;
  return bucket.currentCount + bucket.previousCount * previousWeight;
}

function resetAtFor(
  bucket: RateLimitBucket,
  now: number,
  windowMs: number,
  limit?: number
): number {
  const width = subWindowMs(windowMs);
  if (limit === undefined) return bucket.currentWindowStart + width;

  if (bucket.currentCount >= limit) {
    const decay =
      bucket.currentCount === 0 ? width : width * (1 - limit / bucket.currentCount);
    return bucket.currentWindowStart + width + Math.max(0, decay);
  }
  if (bucket.previousCount > 0 && bucket.currentCount + bucket.previousCount >= limit) {
    const needed = limit - bucket.currentCount;
    const elapsed = width * (1 - needed / bucket.previousCount);
    return bucket.currentWindowStart + Math.max(0, elapsed);
  }
  return Math.max(now + 1, bucket.currentWindowStart + width);
}

function stateForKey(
  key: string,
  now: number,
  windowMs: number,
  limit?: number
): RateLimitWindowState {
  const bucket = normalizeBucket(rateBuckets.get(key), now, windowMs);
  rollBucket(bucket, now, windowMs);
  rateBuckets.set(key, bucket);
  const estimatedCount = weightedCount(bucket, now, windowMs);
  return {
    estimatedCount,
    resetAt: resetAtFor(bucket, now, windowMs, limit),
  };
}

/** Prunes stale compact counters without scanning per-request timestamps. */
export function pruneExpiredRateBuckets(now: number, windowMs: number): number {
  let pruned = 0;
  for (const [key, value] of rateBuckets.entries()) {
    const bucket = normalizeBucket(value, now, windowMs);
    rollBucket(bucket, now, windowMs);
    if (bucket.currentCount === 0 && bucket.previousCount === 0) {
      rateBuckets.delete(key);
      pruned += 1;
    } else {
      rateBuckets.set(key, bucket);
    }
  }
  return pruned;
}

/** Records one rate-limit hit and returns whether the request is still allowed. */
export function applyRateLimitHit(
  key: string,
  now: number,
  rateLimitPerWindow: number,
  rateLimitWindowMs: number
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  pruneExpiredRateBuckets(now, rateLimitWindowMs);
  const state = stateForKey(key, now, rateLimitWindowMs, rateLimitPerWindow);
  if (state.estimatedCount >= rateLimitPerWindow) {
    const retryAfterSeconds = Math.max(1, Math.ceil((state.resetAt - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  const bucket = rateBuckets.get(key);
  if (Array.isArray(bucket) || bucket === undefined) {
    const normalized = normalizeBucket(bucket, now, rateLimitWindowMs);
    normalized.currentCount += 1;
    rateBuckets.set(key, normalized);
  } else {
    bucket.currentCount += 1;
  }
  return { allowed: true };
}

/** Returns the bounded estimate used to populate response headers. */
export function getRateLimitWindowState(
  key: string,
  now: number,
  windowMs: number,
  rateLimitPerWindow?: number
): RateLimitWindowState {
  return stateForKey(key, now, windowMs, rateLimitPerWindow);
}

/** In-process rate limiter keyed by API key or trusted client IP. */
function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === "test") return next();
  const perWindow = config.rateLimitPerWindow;
  const windowMs = config.rateLimitWindowMs;
  const key = deriveRateLimitKey(req);
  const now = Date.now();
  const allowed = applyRateLimitHit(key, now, perWindow, windowMs);
  const state = getRateLimitWindowState(key, now, windowMs, perWindow);
  const remaining = Math.max(0, Math.floor(perWindow - state.estimatedCount));
  const resetSeconds = Math.max(1, Math.ceil((state.resetAt - now) / 1000));

  res.setHeader("RateLimit-Limit", String(perWindow));
  res.setHeader("RateLimit-Remaining", String(remaining));
  res.setHeader("RateLimit-Reset", String(resetSeconds));

  if (!allowed.allowed) {
    res.setHeader("Retry-After", String(allowed.retryAfterSeconds));
    res.status(429).json({
      error: "rate_limited",
      message: `more than ${perWindow} requests per ${windowMs / 1000}s`,
      requestId: (req as AgentPayRequest).id,
    });
    return;
  }

  next();
}

/**
 * Emits coarse request duration through the standard Server-Timing response
 * header before headers flush, then logs the final structured duration on
 * finish. The header intentionally exposes only the total app duration.
 */
function requestTimerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startNs = process.hrtime.bigint();
  const originalWriteHead = res.writeHead.bind(res);
  let serverTimingApplied = false;

  const durationMs = () => Number(process.hrtime.bigint() - startNs) / 1_000_000;
  const applyServerTimingHeader = () => {
    if (serverTimingApplied || res.headersSent) return;
    serverTimingApplied = true;
    res.setHeader("Server-Timing", `app;dur=${durationMs().toFixed(1)}`);
  };

  res.writeHead = ((...args: Parameters<Response["writeHead"]>) => {
    applyServerTimingHeader();
    return originalWriteHead(...args);
  }) as Response["writeHead"];

  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - startNs) / 1_000_000;
    recordHttpRequest(req, res.statusCode, ms / 1000);
    if (!res.headersSent) {
      res.setHeader("Server-Timing", `app;dur=${ms.toFixed(1)}`);
    }
    logRequestCompletion(logger, {
      requestId: (req as AgentPayRequest).id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(ms * 10) / 10,
    });
  });
  next();
}

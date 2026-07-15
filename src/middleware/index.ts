import { createHash, randomUUID } from "node:crypto";
import express, {
  type Application,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import { apiKeyStore, config, pauseState, rateBuckets } from "../store/state.js";
import type { AgentPayRequest } from "../types.js";

/**
 * Installs middleware that must run before the early admin/config/metrics
 * routes.
 */
export function installPreRouteMiddleware(app: Application): void {
  app.use(createCorsMiddleware());
  app.use(express.json({ limit: "100kb" }));
  app.use(securityHeadersMiddleware);
  app.use(requestIdMiddleware);
  app.use(createCompressionMiddleware());
}

/**
 * Converts TRUST_PROXY into Express' hop-count based trust proxy setting.
 * Boolean-like truthy values intentionally map to one trusted proxy hop.
 */
export function resolveTrustProxySetting(
  raw = process.env.TRUST_PROXY
): false | number {
  if (raw === undefined) return false;
  const normalized = raw.trim().toLowerCase();
  if (
    normalized === "" ||
    normalized === "false" ||
    normalized === "0" ||
    normalized === "off" ||
    normalized === "no"
  ) {
    return false;
  }
  if (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "on" ||
    normalized === "yes"
  ) {
    return 1;
  }
  const hopCount = Number(normalized);
  if (Number.isInteger(hopCount) && hopCount > 0) {
    return hopCount;
  }
  return false;
}

/** Applies the process trust-proxy setting before request middleware runs. */
export function configureTrustProxy(app: Application): void {
  app.set("trust proxy", resolveTrustProxySetting());
}

/**
 * Installs middleware that originally ran after admin/config/metrics but before
 * the main API routes.
 */
export function installRequestStateMiddleware(app: Application): void {
  app.use(apiKeyRecognitionMiddleware);
  app.use(pauseGuardMiddleware);
  app.use(rateLimitMiddleware);
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
 * Parses configured CORS origins into canonical scheme://host[:port] entries.
 */
function parseCorsOrigins(raw: string | undefined): Set<string> {
  const origins = new Set<string>();
  for (const entry of (raw ?? "").split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (trimmed === "*") {
      throw new Error(
        "CORS_ALLOWED_ORIGINS wildcard '*' is not supported; list explicit http(s) origins"
      );
    }

    const normalized = normalizeCorsOrigin(trimmed);
    if (normalized) {
      origins.add(normalized);
    } else {
      console.warn(
        `Ignoring malformed CORS origin in CORS_ALLOWED_ORIGINS: ${trimmed}`
      );
    }
  }
  return origins;
}

function normalizeCorsOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    if (url.pathname !== "/" || url.search || url.hash) return undefined;
    return url.origin.toLowerCase();
  } catch {
    return undefined;
  }
}

/** Adds the minimal hardening headers used by the original app. */
function securityHeadersMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
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

/**
 * Rejects non-JSON bodies on mutating endpoints with a clear 415 response.
 */
function contentTypeGuardMiddleware(
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
  const hasBody =
    Boolean(transferEncoding) ||
    (contentLength !== undefined && Number(contentLength) > 0);
  if (!hasBody) {
    next();
    return;
  }

  if (req.is("application/json") || req.is("application/*+json")) {
    next();
    return;
  }

  res.status(415).json({
    error: "unsupported_media_type",
    message: "Content-Type must be application/json for write requests with a body",
    requestId: getRequestId(req),
  });
}

/** Recognizes known API keys without requiring them. */
function apiKeyRecognitionMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const supplied = req.header("x-api-key");
  if (typeof supplied === "string" && apiKeyStore.has(supplied)) {
    (req as AgentPayRequest).apiKey = supplied;
  }
  next();
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
 * otherwise falling back to Express' trusted client IP.
 */
export function deriveRateLimitKey(req: Request): string {
  const apiKey = (req as AgentPayRequest).apiKey;
  if (apiKey) {
    const digest = createHash("sha256").update(apiKey).digest("hex");
    return `api-key:${digest}`;
  }
  return `ip:${req.ip ?? req.socket.remoteAddress ?? "unknown"}`;
}

/** In-process rate limiter keyed by API key or trusted client IP. */
function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === "test") return next();
  const key = deriveRateLimitKey(req);
  const now = Date.now();
  const bucket = (rateBuckets.get(key) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (bucket.length >= RATE_LIMIT_PER_WINDOW) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({
      error: "rate_limited",
      message: `more than ${rateLimitPerWindow} requests per ${rateLimitWindowMs / 1000}s`,
      requestId: (req as AgentPayRequest).id,
    });
    return;
  }
  bucket.push(now);
  rateBuckets.set(key, bucket);
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
    const ms = durationMs();
    if (process.env.NODE_ENV !== "test") {
      console.log(
        JSON.stringify({
          requestId: (req as AgentPayRequest).id,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Math.round(ms * 10) / 10,
        })
      );
    }
  });
  next();
}

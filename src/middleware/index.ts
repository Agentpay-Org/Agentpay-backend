import { createHash, randomUUID } from "node:crypto";
import express, {
  type Application,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import { logger, logRequestCompletion } from "../logger.js";
import {
  apiKeyStore,
  pauseState,
  rateBuckets,
  RATE_LIMIT_PER_WINDOW,
  RATE_LIMIT_WINDOW_MS,
} from "../store/state.js";
import { recordHttpRequest } from "../metrics.js";
import type { AgentPayRequest } from "../types.js";

/**
 * Installs middleware that must run before the early admin/config/metrics
 * routes.
 */
export function installPreRouteMiddleware(app: Application): void {
  app.use(createCorsMiddleware());
  app.use(requestIdMiddleware);
  app.use(express.json({ limit: "100kb" }));
  app.use(securityHeadersMiddleware);
}

/**
 * Installs middleware that originally ran after admin/config/metrics but before
 * the main API routes.
 */
export function installRequestStateMiddleware(app: Application): void {
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
 * Helmet owns the standard response hardening header set. The CSP is tuned for
 * this JSON API surface: no document subresources are expected, framing is
 * denied, and explicit script/style directives avoid inline or eval fallbacks.
 */
const securityHeadersMiddleware = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      connectSrc: ["'none'"],
      fontSrc: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'none'"],
      manifestSrc: ["'none'"],
      mediaSrc: ["'none'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'none'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'none'"],
      workerSrc: ["'none'"],
    },
  },
  referrerPolicy: { policy: "no-referrer" },
  strictTransportSecurity: {
    maxAge: 63_072_000,
    includeSubDomains: true,
    preload: true,
  },
  xFrameOptions: { action: "deny" },
});

/** Keeps the API's explicit browser feature restrictions. */
function permissionsPolicyMiddleware(
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

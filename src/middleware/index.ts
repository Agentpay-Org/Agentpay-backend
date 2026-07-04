import { randomUUID } from "node:crypto";
import express, {
  type Application,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { timingSafeEqualSecret, verifyApiKey } from "../auth/apiKeys.js";
import {
  apiKeyStore,
  pauseState,
  rateBuckets,
  RATE_LIMIT_PER_WINDOW,
  RATE_LIMIT_WINDOW_MS,
} from "../store/state.js";
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
  app.use(apiKeyAuthMiddleware);
}

/**
 * Installs middleware that originally ran after admin/config/metrics but before
 * the main API routes.
 */
export function installRequestStateMiddleware(app: Application): void {
  app.use(pauseGuardMiddleware);
  app.use(rateLimitMiddleware);
  app.use(requestTimerMiddleware);
}

/**
 * CORS allowlist middleware backed by CORS_ALLOWED_ORIGINS.
 */
function createCorsMiddleware() {
  const corsAllowed = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.header("origin");
    if (origin && corsAllowed.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
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

/** In-process IP rate limiter matching the original 60/min behavior. */
function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === "test") return next();
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const bucket = (rateBuckets.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (bucket.length >= RATE_LIMIT_PER_WINDOW) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({
      error: "rate_limited",
      message: `more than ${RATE_LIMIT_PER_WINDOW} requests per ${RATE_LIMIT_WINDOW_MS / 1000}s`,
      requestId: (req as AgentPayRequest).id,
    });
    return;
  }
  bucket.push(now);
  rateBuckets.set(ip, bucket);
  next();
}

/** Emits structured duration logs for completed requests. */
function requestTimerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startNs = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - startNs) / 1_000_000;
    if (!res.headersSent) {
      res.setHeader("Server-Timing", `app;dur=${ms.toFixed(1)}`);
    }
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

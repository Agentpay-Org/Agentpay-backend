import { randomUUID } from "node:crypto";
import compression from "compression";
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

const DEFAULT_COMPRESSION_THRESHOLD_BYTES = 1024;

function compressionEnabled(value: string | undefined): boolean {
  if (value === undefined || value.trim().length === 0) return true;
  return !["0", "false", "off", "disabled"].includes(value.trim().toLowerCase());
}

function compressionThreshold(value: string | undefined): number {
  if (value === undefined || value.trim().length === 0) {
    return DEFAULT_COMPRESSION_THRESHOLD_BYTES;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return DEFAULT_COMPRESSION_THRESHOLD_BYTES;
  }
  return parsed;
}

/**
 * Negotiates compression for large public responses. Metrics stay uncompressed
 * so Prometheus-compatible content negotiation remains predictable, and callers
 * can disable compression for deployments with reflected-secret risk.
 */
function createCompressionMiddleware(): RequestHandler {
  if (!compressionEnabled(process.env.COMPRESSION)) {
    return (_req, _res, next) => next();
  }

  return compression({
    threshold: compressionThreshold(process.env.COMPRESSION_THRESHOLD_BYTES),
    filter: (req, res) => {
      if (req.path === "/api/v1/metrics") return false;
      return compression.filter(req, res);
    },
  });
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

/** In-process IP rate limiter backed by the live runtime config. */
function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (process.env.NODE_ENV === "test") return next();
  const rateLimitWindowMs = config.rateLimitWindowMs;
  const rateLimitPerWindow = config.rateLimitPerWindow;
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const bucket = (rateBuckets.get(ip) ?? []).filter((t) => now - t < rateLimitWindowMs);
  if (bucket.length >= rateLimitPerWindow) {
    res.setHeader(
      "Retry-After",
      String(Math.max(1, Math.ceil(rateLimitWindowMs / 1000)))
    );
    res.status(429).json({
      error: "rate_limited",
      message: `more than ${rateLimitPerWindow} requests per ${rateLimitWindowMs / 1000}s`,
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

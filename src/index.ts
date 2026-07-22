import express, { type Express } from "express";
import type { EventEmitter } from "node:events";
import type { Server } from "node:http";
import {
  logger,
  logForcedShutdown,
  logServerCloseError,
  logServerStarted,
  logShutdownSignal,
} from "./logger.js";
import {
  installPreRouteMiddleware,
  installRequestStateMiddleware,
} from "./middleware/index.js";
import { createAdminRouter } from "./routes/admin.js";
import { createApiKeysRouter } from "./routes/apiKeys.js";
import { createConfigRouter } from "./routes/config.js";
import { installErrorHandlers } from "./routes/errors.js";
import { createEventsRouter } from "./routes/events.js";
import { createMetaRouter } from "./routes/meta.js";
import { createMetricsRouter } from "./routes/metrics.js";
import { createServicesRouter } from "./routes/services.js";
import { createUsageRouter } from "./routes/usage.js";
import { createWebhooksRouter } from "./routes/webhooks.js";
export { KNOWN_EVENT_TYPES } from "./events.js";
import { markShuttingDown as _markShuttingDown } from "./readiness.js";

const PORT = process.env.PORT ?? 3001;
const DRAIN_TIMEOUT_MS = 10_000;

type ProcessFaultEvent = "unhandledRejection" | "uncaughtException";

interface CloseableServer {
  close(callback: (err?: Error) => void): unknown;
}

interface ShutdownLogger {
  log: (...parts: unknown[]) => void;
  error: (...parts: unknown[]) => void;
}

interface DrainTimer {
  unref?: () => void;
}

interface ShutdownControllerOptions {
  server: CloseableServer;
  logger?: ShutdownLogger;
  exit?: (code?: number) => void;
  setTimeoutFn?: (callback: () => void, ms: number) => DrainTimer;
  drainTimeoutMs?: number;
}

interface ShutdownController {
  shutdown: (signal: string, exitCode?: number) => boolean;
  handleProcessFault: (event: ProcessFaultEvent, reason: unknown) => boolean;
}

type ServerTimeouts = {
  requestTimeoutMs: number;
  headersTimeoutMs: number;
  keepAliveTimeoutMs: number;
};

const DEFAULT_SERVER_TIMEOUTS: ServerTimeouts = {
  requestTimeoutMs: 30_000,
  headersTimeoutMs: 10_000,
  keepAliveTimeoutMs: 5_000,
};

function positiveIntegerEnv(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number
): number {
  const raw = env[key];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function resolveServerTimeouts(env: NodeJS.ProcessEnv): ServerTimeouts {
  const requestTimeoutMs = positiveIntegerEnv(
    env,
    "REQUEST_TIMEOUT_MS",
    DEFAULT_SERVER_TIMEOUTS.requestTimeoutMs
  );
  const keepAliveTimeoutMs = positiveIntegerEnv(
    env,
    "KEEPALIVE_TIMEOUT_MS",
    DEFAULT_SERVER_TIMEOUTS.keepAliveTimeoutMs
  );
  const configuredHeadersTimeoutMs = positiveIntegerEnv(
    env,
    "HEADERS_TIMEOUT_MS",
    DEFAULT_SERVER_TIMEOUTS.headersTimeoutMs
  );
  const headersTimeoutMs = Math.max(configuredHeadersTimeoutMs, keepAliveTimeoutMs);

  return { requestTimeoutMs, headersTimeoutMs, keepAliveTimeoutMs };
}

/**
 * Applies bounded HTTP server timeouts to limit slow or hung connections.
 */
function configureServerTimeouts(
  server: Server,
  env: NodeJS.ProcessEnv = process.env
): ServerTimeouts {
  const timeouts = resolveServerTimeouts(env);
  server.requestTimeout = timeouts.requestTimeoutMs;
  server.headersTimeout = timeouts.headersTimeoutMs;
  server.keepAliveTimeout = timeouts.keepAliveTimeoutMs;
  server.setTimeout(timeouts.requestTimeoutMs, (socket) => {
    socket.destroy();
  });
  return timeouts;
}

/**
 * Composes the AgentPay Express application from route and middleware modules.
 */
function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");

  configureTrustProxy(app);
  installPreRouteMiddleware(app);

  app.use(createAdminRouter());
  app.use(createConfigRouter());
  app.use(createMetricsRouter());

  installRequestStateMiddleware(app);

  app.use(createMetaRouter());
  app.use(createUsageRouter({ stroopsAsNumber: true }));
  app.use(createServicesRouter());
  app.use(createApiKeysRouter());
  app.use(createEventsRouter());
  app.use(createWebhooksRouter());

  installErrorHandlers(app);

  return app;
}

const app = createApp();

/**
 * Configures Express trust proxy based on TRUST_PROXY env var.
 */
function configureTrustProxy(app: Express): void {
  const raw = process.env.TRUST_PROXY;
  if (raw) {
    const n = Number(raw);
    app.set("trust proxy", Number.isFinite(n) && n >= 0 ? n : 1);
  }
}

/**
 * Parses PORT from environment with validation.
 */
function resolvePort(
  env: NodeJS.ProcessEnv = process.env
): number {
  const raw = env.PORT;
  if (raw === undefined) return 3001;
  const n = Number(raw);
  if (
    !Number.isFinite(n) ||
    !Number.isInteger(n) ||
    n < 1 ||
    n > 65535 ||
    String(n) !== raw.trim()
  ) {
    throw new Error(
      `PORT must be an integer between 1-65535, got ${JSON.stringify(raw)}`
    );
  }
  return n;
}

/** Returns true when this module is the launched server entrypoint. */
function isServerEntrypoint(argv = process.argv): boolean {
  const entrypoint = argv[1] ?? "";
  return entrypoint.endsWith("index.js") || entrypoint.endsWith("index.ts");
}

function describeFault(reason: unknown) {
  if (reason instanceof Error) {
    return {
      message: reason.message,
      stack: reason.stack,
    };
  }
  return {
    message: String(reason),
  };
}

/**
 * Creates the shared drain path used by normal signals and last-resort process
 * fault handlers. The boolean return value reports whether a new drain started.
 */
function createShutdownController({
  server,
  logger = console,
  exit = (code?: number) => process.exit(code),
  setTimeoutFn = setTimeout,
  drainTimeoutMs = DRAIN_TIMEOUT_MS,
}: ShutdownControllerOptions): ShutdownController {
  let draining = false;
  let requestedExitCode = 0;

  const shutdown = (signal: string, exitCode = 0): boolean => {
    if (draining) {
      if (exitCode !== 0) {
        requestedExitCode = exitCode;
      }
      return false;
    }
    draining = true;
    requestedExitCode = exitCode;
    logger.log(`Received ${signal}, draining...`);
    server.close((err?: Error) => {
      if (err) {
        logger.error("server.close error:", err);
        exit(1);
        return;
      }
      exit(requestedExitCode);
    });
    setTimeoutFn(() => {
      logger.error("Forced exit after 10s drain timeout");
      exit(1);
    }, drainTimeoutMs).unref?.();
    return true;
  };

  return {
    shutdown,
    handleProcessFault(event, reason) {
      logger.error(
        JSON.stringify({
          event: "process_fault",
          fault: event,
          ...describeFault(reason),
        })
      );
      return shutdown(event, 1);
    },
  };
}

/** Installs last-resort process fault handlers for the running server only. */
function installProcessFaultHandlers(
  processLike: Pick<EventEmitter, "on">,
  controller: Pick<ShutdownController, "handleProcessFault">
): void {
  processLike.on("unhandledRejection", (reason: unknown) => {
    controller.handleProcessFault("unhandledRejection", reason);
  });
  processLike.on("uncaughtException", (error: unknown) => {
    controller.handleProcessFault("uncaughtException", error);
  });
}

if (isServerEntrypoint()) {
  const server = app.listen(PORT, () => {
    logServerStarted(logger, PORT);
  });
  configureServerTimeouts(server);

  const shutdown = (signal: string) => {
    logShutdownSignal(logger, signal);
    server.close((err) => {
      if (err) {
        logServerCloseError(logger, err);
        process.exit(1);
      }
      process.exit(0);
    });
    setTimeout(() => {
      logForcedShutdown(logger, 10_000);
      process.exit(1);
    }, 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

export {
  app,
  configureServerTimeouts,
  createApp,
  createShutdownController,
  DEFAULT_SERVER_TIMEOUTS,
  installProcessFaultHandlers,
  isServerEntrypoint,
  resolvePort,
};

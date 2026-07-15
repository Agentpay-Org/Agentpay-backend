import express from "express";
import type { EventEmitter } from "node:events";
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

/**
 * Composes the AgentPay Express application from route and middleware modules.
 */
function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");

  installPreRouteMiddleware(app);

  app.use(createAdminRouter());
  app.use(createConfigRouter());
  app.use(createMetricsRouter());

  installRequestStateMiddleware(app);

  app.use(createMetaRouter());
  app.use(createUsageRouter());
  app.use(createServicesRouter());
  app.use(createApiKeysRouter());
  app.use(createEventsRouter());
  app.use(createWebhooksRouter());

  installErrorHandlers(app);

  return app;
}

const app = createApp();

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
    console.log(`AgentPay backend listening on port ${PORT}`);
  });

  const shutdownController = createShutdownController({ server });
  process.on("SIGTERM", () => shutdownController.shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdownController.shutdown("SIGINT"));
  installProcessFaultHandlers(process, shutdownController);
}

export {
  app,
  createApp,
  createShutdownController,
  installProcessFaultHandlers,
  isServerEntrypoint,
};

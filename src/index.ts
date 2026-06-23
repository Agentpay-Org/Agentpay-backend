import express from "express";
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

/**
 * Composes the AgentPay Express application from route and middleware modules.
 */
function createApp() {
  const app = express();

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

if (process.argv[1]?.endsWith("index.js") || process.argv[1]?.endsWith("index.ts")) {
  const server = app.listen(PORT, () => {
    console.log(`AgentPay backend listening on port ${PORT}`);
  });

  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, draining…`);
    server.close((err) => {
      if (err) {
        console.error("server.close error:", err);
        process.exit(1);
      }
      process.exit(0);
    });
    setTimeout(() => {
      console.error("Forced exit after 10s drain timeout");
      process.exit(1);
    }, 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

export { app, createApp };

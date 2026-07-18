import { Router, type Request, type Response } from "express";
import { eventLog, recordEvent, type AppEvent } from "../events.js";
import {
  apiKeyStore,
  config,
  pauseState,
  rateBuckets,
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageStore,
  webhookStore,
} from "../store/state.js";
import { getRequestId } from "../types.js";

type AdminResetSummary = {
  usage: number;
  services: number;
  servicesMetadata: number;
  servicesDisabled: number;
  apiKeys: number;
  webhooks: number;
  eventLog: number;
  rateBuckets: number;
  paused: boolean;
  config: Record<string, number>;
};

const ENABLED_RESET_VALUES = new Set(["1", "true", "yes", "on"]);

function isAdminResetEnabled(): boolean {
  return ENABLED_RESET_VALUES.has(
    (process.env.ALLOW_ADMIN_RESET ?? "").trim().toLowerCase()
  );
}

function getResetSummary(): AdminResetSummary {
  return {
    usage: usageStore.size,
    services: servicesStore.size,
    servicesMetadata: servicesMetadata.size,
    servicesDisabled: servicesDisabled.size,
    apiKeys: apiKeyStore.size,
    webhooks: webhookStore.size,
    eventLog: eventLog.length,
    rateBuckets: rateBuckets.size,
    paused: pauseState.paused,
    config: { ...config },
  };
}

function resetConfig(): void {
  for (const k of Object.keys(config)) {
    config[k] = 0;
  }
}

function clearInMemoryState(): { cleared: AdminResetSummary; auditEvent: AppEvent } {
  const cleared = getResetSummary();
  const auditEvent = recordEvent("admin.reset", { cleared });

  usageStore.clear();
  servicesStore.clear();
  servicesMetadata.clear();
  servicesDisabled.clear();
  apiKeyStore.clear();
  webhookStore.clear();
  eventLog.length = 0;
  rateBuckets.clear();
  pauseState.paused = false;
  resetConfig();

  return { cleared, auditEvent };
}

/**
 * Builds the admin router that controls and reports the pause flag.
 */
export function createAdminRouter(): Router {
  const router = Router();

  router.post("/api/v1/admin/pause", (_req, res: Response) => {
    pauseState.paused = true;
    res.json({ paused: pauseState.paused });
  });

  router.post("/api/v1/admin/unpause", (_req, res: Response) => {
    pauseState.paused = false;
    res.json({ paused: pauseState.paused });
  });

  router.get("/api/v1/admin/status", (_req, res: Response) => {
    res.json({ paused: pauseState.paused });
  });

  /**
   * Destructively clears process-local demo/test state behind an explicit
   * environment gate. Production deployments should leave this disabled unless
   * a separate admin-auth layer is added in front of the route.
   */
  router.post("/api/v1/admin/reset", (req: Request, res: Response) => {
    if (!isAdminResetEnabled()) {
      res.status(404).json({
        error: "not_found",
        message: "admin reset is disabled",
        requestId: getRequestId(req),
      });
      return;
    }

    const { cleared, auditEvent } = clearInMemoryState();
    res.json({
      reset: true,
      cleared,
      paused: pauseState.paused,
      config,
      auditEvent,
    });
  });

  return router;
}

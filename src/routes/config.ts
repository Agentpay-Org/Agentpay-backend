import { Router, type Request, type Response } from "express";
import { BULK_MAX_ITEMS_LIMIT, config } from "../store/state.js";
import { getRequestId } from "../types.js";

const allowedConfigKeys = [
  "rateLimitPerWindow",
  "rateLimitWindowMs",
  "bulkMaxItems",
  "usageStoreMaxKeys",
  "servicesStoreMaxKeys",
  "webhookStoreMaxKeys",
  "apiKeyStoreMaxKeys",
] as const;

type ConfigKey = (typeof allowedConfigKeys)[number];

const configBounds: Record<ConfigKey, { min: number; max?: number }> = {
  rateLimitPerWindow: { min: 1 },
  rateLimitWindowMs: { min: 1 },
  bulkMaxItems: { min: 1, max: BULK_MAX_ITEMS_LIMIT },
};

function configValidationMessage(key: ConfigKey): string {
  const bounds = configBounds[key];
  if (bounds.max !== undefined) {
    return `${key} must be an integer between ${bounds.min} and ${bounds.max}`;
  }
  return `${key} must be a positive integer`;
}

/**
 * Builds the runtime config router.
 */
export function createConfigRouter(): Router {
  const router = Router();

  router.get("/api/v1/config", (_req, res: Response) => {
    res.json({ config });
  });

  /**
   * Applies a bounded, all-or-nothing runtime config patch.
   *
   * Only known mutable keys are accepted, every value must be a positive
   * integer, and eventLogCap is capped to avoid unbounded memory growth.
   */
  router.patch("/api/v1/config", (req: Request, res: Response) => {
    const requestId = getRequestId(req);
    const rawUpdates: unknown = req.body ?? {};
    if (typeof rawUpdates !== "object" || Array.isArray(rawUpdates)) {
      res.status(400).json({
        error: "invalid_request",
        message: "config patch body must be an object",
        requestId,
      });
      return;
    }

    const updates = rawUpdates as Record<string, unknown>;
    const unknownKeys = Object.keys(updates).filter((k) => !allowedConfigKeySet.has(k));
    if (unknownKeys.length > 0) {
      res.status(400).json({
        error: "invalid_request",
        message: `unknown config key${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.join(", ")}`,
        unknownKeys,
        requestId,
      });
      return;
    }

    const validated: Partial<Record<WritableConfigKey, number>> = {};
    for (const k of allowedConfigKeys) {
      if (k in updates) {
        const v = updates[k];
        const bounds = configBounds[k];
        if (
          typeof v !== "number" ||
          !Number.isInteger(v) ||
          v < bounds.min ||
          (bounds.max !== undefined && v > bounds.max)
        ) {
          res.status(400).json({
            error: "invalid_request",
            message: configValidationMessage(k),
            requestId,
          });
          return;
        }
        const maxValue = maxConfigValues[k];
        if (maxValue !== undefined && v > maxValue) {
          res.status(400).json({
            error: "invalid_request",
            message: `${k} must be less than or equal to ${maxValue}`,
            requestId,
          });
          return;
        }
        validated[k] = v;
      }
    }

    for (const k of allowedConfigKeys) {
      const v = validated[k];
      if (v !== undefined) config[k] = v;
    }
    if (validated.eventLogCap !== undefined) trimEventLogToCap(validated.eventLogCap);

    res.json({ config });
  });

  return router;
}

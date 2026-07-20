import { trimEventLogToCap } from "../events.js";
import { Router, type Request, type Response } from "express";
import { validateBody } from "../middleware/validate.js";
import { requestBodySchemas } from "../schemas/requestBodies.js";
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
  "eventLogCap",
] as const;

type ConfigKey = (typeof allowedConfigKeys)[number];

const configBounds: Record<string, { min: number; max?: number }> = {
  rateLimitPerWindow: { min: 1 },
  rateLimitWindowMs: { min: 1 },
  bulkMaxItems: { min: 1, max: BULK_MAX_ITEMS_LIMIT },
  usageStoreMaxKeys: { min: 1 },
  servicesStoreMaxKeys: { min: 1 },
  webhookStoreMaxKeys: { min: 1 },
  apiKeyStoreMaxKeys: { min: 1 },
  eventLogCap: { min: 1, max: 100_000 },
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

  router.patch(
    "/api/v1/config",
    validateBody(requestBodySchemas.configPatch),
    (req: Request, res: Response) => {
      const updates = req.body ?? {};
      const requestId = getRequestId(req);
      for (const k of allowedConfigKeys) {
        if (k in updates) {
          const v = updates[k];
          const bounds = configBounds[k];
          if (bounds) {
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
          }
          config[k] = v;
        }
      }
      if ("eventLogCap" in updates) {
        trimEventLogToCap();
      }
      res.json({ config });
    }
  );

  return router;
}

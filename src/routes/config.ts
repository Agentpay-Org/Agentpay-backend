import { Router, type Request, type Response } from "express";
import { BULK_MAX_ITEMS_LIMIT, config } from "../store/state.js";
import { getRequestId } from "../types.js";

const allowedConfigKeys = [
  "rateLimitPerWindow",
  "rateLimitWindowMs",
  "bulkMaxItems",
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

  router.patch("/api/v1/config", (req: Request, res: Response) => {
    const requestId = getRequestId(req);
    const updates = req.body ?? {};
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
        config[k] = v;
      }
    }
    res.json({ config });
  });

  return router;
}

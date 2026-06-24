import { Router, type Request, type Response } from "express";
import { BULK_MAX_ITEMS_MAX, config } from "../store/state.js";
import { getRequestId } from "../types.js";

const allowedConfigKeys = [
  "rateLimitPerWindow",
  "rateLimitWindowMs",
  "bulkMaxItems",
] as const;

type ConfigKey = (typeof allowedConfigKeys)[number];

const maxConfigValues: Partial<Record<ConfigKey, number>> = {
  bulkMaxItems: BULK_MAX_ITEMS_MAX,
};

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
        const max = maxConfigValues[k];
        if (
          typeof v !== "number" ||
          !Number.isInteger(v) ||
          v <= 0 ||
          (max !== undefined && v > max)
        ) {
          res.status(400).json({
            error: "invalid_request",
            message:
              max === undefined
                ? `${k} must be a positive integer`
                : `${k} must be a positive integer up to ${max}`,
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

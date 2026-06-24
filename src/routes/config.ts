import { Router, type Request, type Response } from "express";
import { config } from "../store/state.js";
import { getRequestId } from "../types.js";

const allowedConfigKeys = [
  "rateLimitPerWindow",
  "rateLimitWindowMs",
  "bulkMaxItems",
] as const;

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
        if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
          res.status(400).json({
            error: "invalid_request",
            message: `${k} must be a positive integer`,
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

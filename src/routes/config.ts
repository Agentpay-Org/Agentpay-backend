import { Router, type Request, type Response } from "express";
import { validateBody } from "../middleware/validate.js";
import { requestBodySchemas } from "../schemas/requestBodies.js";
import { config } from "../store/state.js";

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

  router.patch(
    "/api/v1/config",
    validateBody(requestBodySchemas.configPatch),
    (req: Request, res: Response) => {
      const updates = req.body ?? {};
      for (const k of allowedConfigKeys) {
        if (k in updates) {
          const v = updates[k];
          config[k] = v;
        }
      }
      res.json({ config });
    }
  );

  return router;
}

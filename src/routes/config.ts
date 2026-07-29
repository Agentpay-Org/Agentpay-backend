import { trimEventLogToCap } from "../events.js";
import { Router, type Request, type Response } from "express";
import { config } from "../store/state.js";
import { getRequestId } from "../types.js";
import { allowedConfigKeys, validateConfigPatchBody } from "../configValidation.js";

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
    const validation = validateConfigPatchBody(req.body);
    if (!validation.ok) {
      res.status(400).json({
        error: "invalid_request",
        message: validation.message,
        ...(validation.unknownKeys ? { unknownKeys: validation.unknownKeys } : {}),
        requestId,
      });
      return;
    }

    for (const key of allowedConfigKeys) {
      if (key in validation.updates) config[key] = validation.updates[key];
    }
    if ("eventLogCap" in validation.updates) {
      trimEventLogToCap();
    }
    res.json({ config });
  });

  return router;
}

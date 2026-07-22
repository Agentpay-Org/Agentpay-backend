import { trimEventLogToCap } from "../events.js";
import { Router, type Request, type Response } from "express";
import { BULK_MAX_ITEMS_LIMIT, config } from "../store/state.js";
import { getRequestId } from "../types.js";

const allowedConfigKeys = [
  "rateLimitPerWindow",
  "rateLimitWindowMs",
  "bulkMaxItems",
  "eventLogCap",
  "usageStoreMaxKeys",
  "servicesStoreMaxKeys",
  "webhookStoreMaxKeys",
  "apiKeyStoreMaxKeys",
] as const;

const configCeilings: Record<string, number> = {
  bulkMaxItems: BULK_MAX_ITEMS_LIMIT,
  eventLogCap: 100_000,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Validates one config value, returning an error message when invalid. */
function validateConfigValue(key: string, value: unknown): string | undefined {
  const isInteger = typeof value === "number" && Number.isInteger(value);
  if (key === "bulkMaxItems") {
    if (!isInteger || value < 1 || value > BULK_MAX_ITEMS_LIMIT) {
      return `bulkMaxItems must be an integer between 1 and ${BULK_MAX_ITEMS_LIMIT}`;
    }
    return undefined;
  }
  if (!isInteger || value < 1) {
    return `${key} must be a positive integer`;
  }
  const ceiling = configCeilings[key];
  if (ceiling !== undefined && value > ceiling) {
    return `${key} must be less than or equal to ${ceiling}`;
  }
  return undefined;
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
    if (!isPlainObject(updates)) {
      res.status(400).json({
        error: "invalid_request",
        message: "body must be a JSON object",
        requestId,
      });
      return;
    }

    const unknownKeys = Object.keys(updates).filter(
      (key) => !(allowedConfigKeys as readonly string[]).includes(key)
    );
    if (unknownKeys.length > 0) {
      res.status(400).json({
        error: "invalid_request",
        message: `unknown config keys: ${unknownKeys.join(", ")}`,
        unknownKeys,
        requestId,
      });
      return;
    }

    for (const key of allowedConfigKeys) {
      if (!(key in updates)) continue;
      const message = validateConfigValue(key, updates[key]);
      if (message) {
        res.status(400).json({ error: "invalid_request", message, requestId });
        return;
      }
    }

    for (const key of allowedConfigKeys) {
      if (key in updates) config[key] = updates[key] as number;
    }
    if ("eventLogCap" in updates) {
      trimEventLogToCap();
    }
    res.json({ config });
  });

  return router;
}

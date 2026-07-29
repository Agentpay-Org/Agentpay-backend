import { trimEventLogToCap } from "../events.js";
import { Router, type Request, type Response } from "express";
import { config } from "../store/state.js";
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
  rateLimitPerWindow: 1_000_000,
  rateLimitWindowMs: 86_400_000,
  bulkMaxItems: BULK_MAX_ITEMS_LIMIT,
  eventLogCap: 100_000,
  usageStoreMaxKeys: 100_000,
  servicesStoreMaxKeys: 10_000,
  webhookStoreMaxKeys: 10_000,
  apiKeyStoreMaxKeys: 10_000,
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
  const ceiling = configCeilings[key];
  if (!isInteger || value < 1 || (ceiling !== undefined && value > ceiling)) {
    return ceiling !== undefined
      ? `${key} must be an integer between 1 and ${ceiling}`
      : `${key} must be a positive integer`;
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

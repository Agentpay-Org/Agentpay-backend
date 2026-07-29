import { trimEventLogToCap } from "../events.js";
import { Router, type Request, type Response } from "express";
import { paginateByCursor } from "../cursorPagination.js";
import { config } from "../store/state.js";
import { parseIntParam } from "../queryParams.js";
import { rejectUnknownQueryParams } from "../middleware/validate.js";
import { getRequestId } from "../types.js";
import { validateConfigPatchBody } from "../configValidation.js";

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

const DEFAULT_CONFIG_PAGE_SIZE = 4;
const MAX_CONFIG_PAGE_SIZE = 4;

type ConfigEntry = { key: string; value: number };

function buildConfigEntries(): ConfigEntry[] {
  return Object.entries(config)
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Builds the runtime config router.
 */
export function createConfigRouter(): Router {
  const router = Router();

  router.get(
    "/api/v1/config",
    rejectUnknownQueryParams(["limit", "cursor"]),
    (req: Request, res: Response) => {
      const limit = parseIntParam(req.query.limit, {
        defaultValue: DEFAULT_CONFIG_PAGE_SIZE,
        min: 1,
        max: MAX_CONFIG_PAGE_SIZE,
      });
      const cursorRaw =
        typeof req.query.cursor === "string" ? req.query.cursor : undefined;
      const entries = buildConfigEntries();
      const paged = paginateByCursor(entries, cursorRaw, limit, (entry) => entry.key);

      if (!paged.ok) {
        res.status(400).json({
          error: "invalid_request",
          message:
            paged.reason === "malformed"
              ? "cursor is malformed"
              : "cursor is invalid or expired",
          requestId: getRequestId(req),
        });
        return;
      }

      res.json({
        config,
        items: paged.page,
        total: entries.length,
        nextCursor: paged.nextCursor,
      });
    }
  );

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

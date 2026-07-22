import { Router, type Request, type Response } from "express";
import { createApiKeyRecord } from "../auth/apiKeys.js";
import { validateBody } from "../middleware/validate.js";
import { parseIntParam } from "../queryParams.js";
import { requestBodySchemas } from "../schemas/requestBodies.js";
import { apiKeyStore, config, hasStoreCapacityFor } from "../store/state.js";
import { getRequestId } from "../types.js";

/**
 * Builds API-key listing, creation, and prefix revocation routes.
 */
export function createApiKeysRouter(): Router {
  const router = Router();

  router.delete("/api/v1/api-keys/:prefix", (req: Request, res: Response) => {
    const prefix = String(req.params.prefix);
    let found: string | undefined;
    for (const [hash, meta] of apiKeyStore.entries()) {
      if (meta.prefix === prefix) {
        found = hash;
        break;
      }
    }
    if (!found) {
      res.status(404).json({
        error: "not_found",
        message: `no api key with prefix ${prefix}`,
        requestId: getRequestId(req),
      });
      return;
    }
    apiKeyStore.delete(found);
    res.status(204).send();
  });

  router.get("/api/v1/api-keys", (req: Request, res: Response) => {
    const allItems = Array.from(apiKeyStore.values())
      .sort((a, b) => a.createdAt - b.createdAt || a.prefix.localeCompare(b.prefix))
      .map((meta) => ({
        prefix: meta.prefix,
        label: meta.label,
        createdAt: meta.createdAt,
      }));
    const total = allItems.length;
    const limit = parseIntParam(req.query.limit, {
      defaultValue: total || 1,
      min: 1,
      max: 1000,
    });
    const offset = parseIntParam(req.query.offset, {
      defaultValue: 0,
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    });
    res.json({ items: allItems.slice(offset, offset + limit), total });
  });

  router.post(
    "/api/v1/api-keys",
    validateBody(requestBodySchemas.apiKeyCreate),
    (req: Request, res: Response) => {
      const { label } = req.body as { label?: unknown };
      if (
        !hasStoreCapacityFor(apiKeyStore.size, false, config.apiKeyStoreMaxKeys)
      ) {
        res.status(429).json({
          error: "store_capacity_exceeded",
          message: "api key store capacity exceeded",
          requestId: getRequestId(req),
        });
        return;
      }
      const { key, hash, record } = createApiKeyRecord(label as string);
      apiKeyStore.set(hash, record);
      res.status(201).json({ key, label });
    }
  );

  return router;
}
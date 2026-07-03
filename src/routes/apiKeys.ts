import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { hasCapacityForNewKey, storeCapacityError } from "../store/caps.js";
import { apiKeyStore } from "../store/state.js";
import { getRequestId } from "../types.js";

/**
 * Builds API-key listing, creation, and prefix revocation routes.
 */
export function createApiKeysRouter(): Router {
  const router = Router();

  router.delete("/api/v1/api-keys/:prefix", (req: Request, res: Response) => {
    const { prefix } = req.params;
    let found: string | undefined;
    for (const key of apiKeyStore.keys()) {
      if (key.slice(0, 8) === prefix) {
        found = key;
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

  router.get("/api/v1/api-keys", (_req, res: Response) => {
    const items = Array.from(apiKeyStore.entries()).map(([key, meta]) => ({
      prefix: key.slice(0, 8),
      label: meta.label,
      createdAt: meta.createdAt,
    }));
    res.json({ items });
  });

  router.post("/api/v1/api-keys", (req: Request, res: Response) => {
    const { label } = req.body ?? {};
    const requestId = getRequestId(req);
    if (typeof label !== "string" || label.length === 0 || label.length > 64) {
      res.status(400).json({
        error: "invalid_request",
        message: "label must be a non-empty string up to 64 chars",
        requestId,
      });
      return;
    }
    const key = `apk_${randomUUID().replace(/-/g, "")}`;
    if (!hasCapacityForNewKey(apiKeyStore, key, "apiKeyStoreMaxKeys")) {
      res
        .status(429)
        .json(storeCapacityError("apiKeyStore", "apiKeyStoreMaxKeys", requestId));
      return;
    }
    apiKeyStore.set(key, { label, createdAt: Date.now() });
    res.status(201).json({ key, label });
  });

  return router;
}

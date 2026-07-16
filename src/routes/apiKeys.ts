import { Router, type Request, type Response } from "express";
import { createApiKeyRecord } from "../auth/apiKeys.js";
import { validateBody } from "../middleware/validate.js";
import { requestBodySchemas } from "../schemas/requestBodies.js";
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

  router.get("/api/v1/api-keys", (_req, res: Response) => {
    const items = Array.from(apiKeyStore.values()).map((meta) => ({
      prefix: meta.prefix,
      label: meta.label,
      createdAt: meta.createdAt,
    }));
    res.json({ items });
  });

  router.post(
    "/api/v1/api-keys",
    validateBody(requestBodySchemas.apiKeyCreate),
    (req: Request, res: Response) => {
      const { label } = req.body ?? {};
      const { key, hash, record } = createApiKeyRecord(label);
      apiKeyStore.set(hash, record);
      res.status(201).json({ key, label });
    }
  );

  return router;
}

import { Router, type Request, type Response } from "express";
import { createApiKeyRecord } from "../auth/apiKeys.js";
import { rejectUnknownQueryParams, validateBody } from "../middleware/validate.js";
import { applyListPage } from "../listPagination.js";
import { requestBodySchemas } from "../schemas/requestBodies.js";
import { apiKeyStore, config, hasStoreCapacityFor } from "../store/state.js";
import { getRequestId } from "../types.js";

const PREFIX_PATTERN = /^[A-Za-z0-9_]{1,64}$/;

/**
 * Builds API-key listing, creation, and prefix revocation routes.
 */
export function createApiKeysRouter(): Router {
  const router = Router();

  router.delete("/api/v1/api-keys/:prefix", (req: Request, res: Response) => {
    const prefix = String(req.params.prefix);
    const requestId = getRequestId(req);
    if (!PREFIX_PATTERN.test(prefix)) {
      res.status(400).json({
        error: "invalid_request",
        message: "prefix must be 1-64 alphanumeric/underscore characters",
        requestId,
      });
      return;
    }
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
        requestId,
      });
      return;
    }
    apiKeyStore.delete(found);
    res.status(204).send();
  });

  router.get(
    "/api/v1/api-keys",
    rejectUnknownQueryParams(["limit", "offset", "cursor"]),
    (req: Request, res: Response) => {
      const allItems = Array.from(apiKeyStore.values())
        .sort((a, b) => a.createdAt - b.createdAt || a.prefix.localeCompare(b.prefix))
        .map((meta) => ({
          prefix: meta.prefix,
          label: meta.label,
          createdAt: meta.createdAt,
        }));
      const paged = applyListPage(allItems, req.query, (item) => item.prefix);
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
      res.json({ items: paged.items, total: paged.total, nextCursor: paged.nextCursor });
    }
  );

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